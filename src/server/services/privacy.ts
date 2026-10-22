import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db/client';
import {
  bloodRequests,
  communityMemberships,
  contactRequests,
  deletionRequests,
  donorProfiles,
  notifications,
  passwordResetTokens,
  requestStatusEvents,
  sessions,
  users,
} from '../db/schema';
import { hashPassword } from '../auth/password';
import { randomToken } from '../domain/ids';
import { AppError, forbidden, notFound } from '../errors';
import { isAdmin, type Actor } from '../policy';
import { confirmPassword, type ClientMeta } from './accounts';
import { audit } from './audit';

/** Hides the account and donor listing everywhere and signs out all devices. Signing in again offers reactivation. */
export async function deactivateAccount(actor: Actor, password: string, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw new AppError('invalid_state');
  if (!(await confirmPassword(actor.userId, password))) throw new AppError('forbidden', 'reauth_failed', { password: 'wrongPassword' });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status: 'deactivated', updatedAt: new Date() }).where(eq(users.id, actor.userId));
    await tx.delete(sessions).where(eq(sessions.userId, actor.userId));
    await audit(tx, { actor, action: 'account.deactivated', targetType: 'user', targetId: actor.userId, ipHash: meta.ipHash });
  });
}

export async function reactivateAccount(actor: Actor, meta: ClientMeta = {}) {
  if (actor.status !== 'deactivated') throw new AppError('invalid_state');
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status: 'active', updatedAt: new Date() }).where(and(eq(users.id, actor.userId), eq(users.status, 'deactivated')));
    await audit(tx, { actor: { ...actor, status: 'active' }, action: 'account.reactivated', targetType: 'user', targetId: actor.userId, ipHash: meta.ipHash });
  });
}

export async function requestAccountDeletion(actor: Actor, password: string, reason: string | null, meta: ClientMeta = {}) {
  if (!(await confirmPassword(actor.userId, password))) throw new AppError('forbidden', 'reauth_failed', { password: 'wrongPassword' });
  const [existing] = await db.select().from(deletionRequests).where(and(eq(deletionRequests.userId, actor.userId), eq(deletionRequests.status, 'pending')));
  if (existing) throw new AppError('conflict', 'deletion_pending');
  await db.transaction(async (tx) => {
    await tx.insert(deletionRequests).values({ userId: actor.userId, reason });
    // Hide the donor straight away; the data itself is removed when an admin processes the request.
    await tx.update(donorProfiles).set({ status: 'paused', updatedAt: new Date() }).where(and(eq(donorProfiles.userId, actor.userId), ne(donorProfiles.status, 'restricted')));
    await audit(tx, { actor, action: 'account.deletion_requested', targetType: 'user', targetId: actor.userId, ipHash: meta.ipHash });
  });
}

export async function cancelDeletionRequest(actor: Actor, meta: ClientMeta = {}) {
  const updated = await db
    .update(deletionRequests)
    .set({ status: 'cancelled', processedAt: new Date() })
    .where(and(eq(deletionRequests.userId, actor.userId), eq(deletionRequests.status, 'pending')))
    .returning({ id: deletionRequests.id });
  if (updated.length === 0) throw notFound();
  await audit(db, { actor, action: 'account.deletion_cancelled', targetType: 'user', targetId: actor.userId, ipHash: meta.ipHash });
}

export async function myDeletionRequest(actor: Actor) {
  const [row] = await db.select().from(deletionRequests).where(and(eq(deletionRequests.userId, actor.userId), eq(deletionRequests.status, 'pending')));
  return row ?? null;
}

/**
 * Removes a user's personal data. The user row is kept as an anonymous tombstone so audit
 * entries and community history stay consistent, but every personal field is erased:
 * donor profile (with donations, availability and consents), memberships, notifications,
 * sessions, contact requests, and requester details on their blood requests.
 */
export async function processDeletion(actor: Actor, deletionRequestId: string, meta: ClientMeta = {}) {
  if (!isAdmin(actor)) throw forbidden();
  const unusable = await hashPassword(randomToken());
  await db.transaction(async (tx) => {
    const [request] = await tx.select().from(deletionRequests).where(eq(deletionRequests.id, deletionRequestId)).for('update');
    if (!request) throw notFound();
    if (request.status !== 'pending') throw new AppError('invalid_state');
    const userId = request.userId;
    if (userId === actor.userId) throw forbidden();
    await tx.delete(donorProfiles).where(eq(donorProfiles.userId, userId));
    await tx.delete(communityMemberships).where(eq(communityMemberships.userId, userId));
    await tx.delete(contactRequests).where(eq(contactRequests.requesterUserId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    const owned = await tx.select({ id: bloodRequests.id, status: bloodRequests.status }).from(bloodRequests).where(eq(bloodRequests.createdByUserId, userId));
    const open = owned.filter((r) => r.status === 'open' || r.status === 'in_progress').map((r) => r.id);
    if (open.length) {
      await tx.update(bloodRequests).set({ status: 'cancelled', statusReason: 'requester account deleted', closedAt: new Date() }).where(inArray(bloodRequests.id, open));
      await tx.insert(requestStatusEvents).values(open.map((id) => ({ requestId: id, actorUserId: actor.userId, action: 'status', toStatus: 'cancelled' as const, note: 'requester account deleted' })));
    }
    if (owned.length) {
      await tx
        .update(bloodRequests)
        .set({ requesterName: '—', requesterPhone: '—', note: null, createdByUserId: null, manageTokenHash: null, updatedAt: new Date() })
        .where(inArray(bloodRequests.id, owned.map((r) => r.id)));
    }
    await tx
      .update(users)
      .set({ phone: `deleted:${userId}`, email: null, displayName: '—', passwordHash: unusable, status: 'deleted', phoneVerifiedAt: null, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.update(deletionRequests).set({ status: 'completed', processedByUserId: actor.userId, processedAt: new Date() }).where(eq(deletionRequests.id, request.id));
    await audit(tx, { actor, action: 'account.deleted', targetType: 'user', targetId: userId, metadata: { requests: owned.length }, ipHash: meta.ipHash });
  });
}

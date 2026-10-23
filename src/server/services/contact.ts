import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '../db/client';
import { bloodRequests, contactRequests, donorConsents, donorProfiles, users } from '../db/schema';
import { AppError, forbidden, isUniqueViolation, notFound } from '../errors';
import type { Actor } from '../policy';
import type { ClientMeta } from './accounts';
import { audit } from './audit';
import { createNotifications } from './notifications';
import { getSettings } from './settings';
import { donorAvailability, donorInServiceArea, isPubliclyListed } from './donors';

/**
 * Consent-based contact: a signed-in person asks a donor to get in touch. The donor sees the
 * requester's name and message (never the other way round) and decides. Only when the donor
 * accepts does the requester see the donor's number — and the donor sees the requester's.
 */
export async function sendContactRequest(actor: Actor, donorPublicId: string, message: string, bloodRequestPublicId: string | null, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  const settings = await getSettings();
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ donor: donorProfiles, consent: donorConsents, accountStatus: users.status, inServiceArea: donorInServiceArea() })
        .from(donorProfiles)
        .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
        .innerJoin(users, eq(users.id, donorProfiles.userId))
        .where(eq(donorProfiles.publicId, donorPublicId));
      if (!row || !isPubliclyListed(row)) throw notFound();
      if (row.donor.userId === actor.userId) throw new AppError('invalid_state', 'cannot_contact_self');
      if (!row.consent.allowContactRequests || donorAvailability(row.donor, row.accountStatus) === 'restricted') {
        throw new AppError('forbidden', 'contact_not_allowed');
      }
      let bloodRequestId: string | null = null;
      if (bloodRequestPublicId) {
        const [req] = await tx.select({ id: bloodRequests.id }).from(bloodRequests).where(eq(bloodRequests.publicId, bloodRequestPublicId));
        bloodRequestId = req?.id ?? null;
      }
      const [created] = await tx
        .insert(contactRequests)
        .values({
          donorId: row.donor.id,
          requesterUserId: actor.userId,
          bloodRequestId,
          message,
          expiresAt: new Date(Date.now() + settings.contactRequestExpiryDays * 86400 * 1000),
        })
        .returning();
      await createNotifications(tx, [{ userId: row.donor.userId, kind: 'contact_request_received', data: { requester: actor.displayName }, link: '/account/contact-requests' }]);
      await audit(tx, { actor, action: 'contact.requested', targetType: 'donor', targetId: row.donor.id, metadata: { contactRequestId: created.id }, ipHash: meta.ipHash });
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'contact_requests_one_pending')) throw new AppError('conflict', 'contact_pending');
    throw error;
  }
}

export async function respondToContactRequest(actor: Actor, contactRequestId: string, decision: 'accepted' | 'declined', meta: ClientMeta = {}) {
  if (actor.status !== 'active' || !actor.donorId) throw forbidden();
  return db.transaction(async (tx) => {
    const [cr] = await tx.select().from(contactRequests).where(eq(contactRequests.id, contactRequestId)).for('update');
    if (!cr || cr.donorId !== actor.donorId) throw notFound();
    if (cr.status !== 'pending' || cr.expiresAt < new Date()) throw new AppError('invalid_state');
    await tx.update(contactRequests).set({ status: decision, respondedAt: new Date() }).where(eq(contactRequests.id, cr.id));
    await createNotifications(tx, [
      { userId: cr.requesterUserId, kind: decision === 'accepted' ? 'contact_request_accepted' : 'contact_request_declined', data: { donor: actor.displayName }, link: '/account/contact-requests' },
    ]);
    await audit(tx, { actor, action: `contact.${decision}`, targetType: 'contact_request', targetId: cr.id, ipHash: meta.ipHash });
  });
}

export async function cancelContactRequest(actor: Actor, contactRequestId: string) {
  const updated = await db
    .update(contactRequests)
    .set({ status: 'cancelled' })
    .where(and(eq(contactRequests.id, contactRequestId), eq(contactRequests.requesterUserId, actor.userId), eq(contactRequests.status, 'pending')))
    .returning({ id: contactRequests.id });
  if (updated.length === 0) throw notFound();
}

/** Requests received by the donor. The requester's phone is shown only after the donor accepts. */
export async function incomingContactRequests(actor: Actor) {
  if (!actor.donorId) return [];
  const rows = await db
    .select({ cr: contactRequests, requesterName: users.displayName, requesterPhone: users.phone, requestPublicId: bloodRequests.publicId })
    .from(contactRequests)
    .innerJoin(users, eq(users.id, contactRequests.requesterUserId))
    .leftJoin(bloodRequests, eq(bloodRequests.id, contactRequests.bloodRequestId))
    .where(eq(contactRequests.donorId, actor.donorId))
    .orderBy(desc(contactRequests.createdAt))
    .limit(100);
  const now = new Date();
  return rows.map((r) => ({
    ...r.cr,
    status: r.cr.status === 'pending' && r.cr.expiresAt < now ? ('expired' as const) : r.cr.status,
    requesterName: r.requesterName,
    requesterPhone: r.cr.status === 'accepted' ? r.requesterPhone : null,
    requestPublicId: r.requestPublicId,
  }));
}

/** Requests the actor sent. The donor's number is shown only once accepted and the donor still shares it. */
export async function outgoingContactRequests(actor: Actor) {
  const rows = await db
    .select({ cr: contactRequests, donorName: donorProfiles.fullName, donorPublicId: donorProfiles.publicId, contactPhone: donorProfiles.contactPhone, method: donorProfiles.preferredContactMethod, bloodGroup: donorProfiles.bloodGroup })
    .from(contactRequests)
    .innerJoin(donorProfiles, eq(donorProfiles.id, contactRequests.donorId))
    .where(eq(contactRequests.requesterUserId, actor.userId))
    .orderBy(desc(contactRequests.createdAt))
    .limit(100);
  const now = new Date();
  return rows.map((r) => ({
    ...r.cr,
    status: r.cr.status === 'pending' && r.cr.expiresAt < now ? ('expired' as const) : r.cr.status,
    donorName: r.donorName,
    donorPublicId: r.donorPublicId,
    bloodGroup: r.bloodGroup,
    donorPhone: r.cr.status === 'accepted' ? r.contactPhone : null,
    method: r.method,
  }));
}

export async function pendingIncomingCount(actor: Actor): Promise<number> {
  if (!actor.donorId) return 0;
  const rows = await db
    .select({ id: contactRequests.id })
    .from(contactRequests)
    .where(and(eq(contactRequests.donorId, actor.donorId), eq(contactRequests.status, 'pending'), gt(contactRequests.expiresAt, new Date())));
  return rows.length;
}

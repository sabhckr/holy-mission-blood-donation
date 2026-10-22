import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { donorProfiles, passwordResetTokens, sessions, users } from '../db/schema';
import { getDummyHash, hashPassword, verifyPassword } from '../auth/password';
import { randomToken, sha256 } from '../domain/ids';
import { AppError, conflict, forbidden, isUniqueViolation, validationError } from '../errors';
import type { Actor } from '../policy';
import { isAdmin } from '../policy';
import { isWeakPassword } from '../validation';
import { audit } from './audit';

export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const LOCK_AFTER_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 24 * 3600 * 1000;

export interface ClientMeta {
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface NewAccount {
  phone: string; // normalised
  password: string;
  displayName: string;
  email?: string | null;
  locale?: 'bn' | 'en';
}

/** Creates a user inside the given transaction. Throws a field error when the phone/email is taken. */
export async function createAccount(executor: Executor, input: NewAccount) {
  if (isWeakPassword(input.password, input.phone)) throw validationError({ password: 'passwordWeak' });
  const passwordHash = await hashPassword(input.password);
  try {
    const [user] = await executor
      .insert(users)
      .values({
        phone: input.phone,
        email: input.email ?? null,
        passwordHash,
        displayName: input.displayName,
        preferredLocale: input.locale ?? 'bn',
        passwordChangedAt: new Date(),
      })
      .returning();
    return user;
  } catch (error) {
    if (isUniqueViolation(error, 'users_phone_key')) throw conflict('validation', { phone: 'phoneTaken' });
    if (isUniqueViolation(error, 'users_email_key')) throw conflict('validation', { email: 'emailTaken' });
    throw error;
  }
}

/** Standalone account (people who need blood or community leaders who are not donors). */
export async function registerAccount(input: NewAccount, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const user = await createAccount(tx, input);
    await audit(tx, { actor: toActor(user, null), action: 'account.created', targetType: 'user', targetId: user.id, ipHash: meta.ipHash });
    return user;
  });
}

export function toActor(user: typeof users.$inferSelect, donorId: string | null): Actor {
  return { userId: user.id, role: user.role, status: user.status, displayName: user.displayName, donorId };
}

/**
 * Checks a phone/password pair. The same generic error is used for unknown numbers and wrong
 * passwords, and a dummy hash is computed for unknown numbers so timing does not reveal accounts.
 */
export async function authenticate(phone: string | null, password: string, meta: ClientMeta = {}) {
  const [user] = phone ? await db.select().from(users).where(eq(users.phone, phone)) : [];
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    throw new AppError('unauthenticated', 'invalid_credentials');
  }
  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) throw new AppError('rate_limited', 'account_locked');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failures = user.failedSignInCount + 1;
    const lock = failures >= LOCK_AFTER_FAILURES;
    await db
      .update(users)
      .set({ failedSignInCount: lock ? 0 : failures, lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : user.lockedUntil })
      .where(eq(users.id, user.id));
    await audit(db, { actor: null, action: lock ? 'auth.locked' : 'auth.sign_in_failed', targetType: 'user', targetId: user.id, ipHash: meta.ipHash });
    throw new AppError('unauthenticated', 'invalid_credentials');
  }
  if (user.status === 'suspended' || user.status === 'deleted') throw new AppError('forbidden', 'account_inactive');
  await db.update(users).set({ failedSignInCount: 0, lockedUntil: null, lastSignInAt: now }).where(eq(users.id, user.id));
  await audit(db, { actor: toActor(user, null), action: 'auth.sign_in', targetType: 'user', targetId: user.id, ipHash: meta.ipHash });
  return user;
}

export async function createSession(userId: string, meta: ClientMeta = {}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: sha256(token), userId, expiresAt, userAgent: meta.userAgent ?? null, ipHash: meta.ipHash ?? null });
  return { token, expiresAt };
}

/** Resolves a session cookie to an actor. Suspended/deleted accounts and expired sessions resolve to null. */
export async function getActorBySessionToken(token: string): Promise<{ actor: Actor; sessionId: string } | null> {
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const [row] = await db
    .select({ session: sessions, user: users, donorId: donorProfiles.id })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(donorProfiles, eq(donorProfiles.userId, users.id))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())));
  if (!row) return null;
  if (row.user.status === 'suspended' || row.user.status === 'deleted') return null;
  if (Date.now() - row.session.lastSeenAt.getTime() > 3600 * 1000) {
    await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
  }
  return { actor: toActor(row.user, row.donorId ?? null), sessionId: id };
}

export async function revokeSessionToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function revokeSessionById(actor: Actor, sessionId: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, actor.userId)));
  await audit(db, { actor, action: 'auth.session_revoked', targetType: 'user', targetId: actor.userId });
}

export async function revokeOtherSessions(actor: Actor, keepSessionId: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, actor.userId), ne(sessions.id, keepSessionId)));
  await audit(db, { actor, action: 'auth.other_sessions_revoked', targetType: 'user', targetId: actor.userId });
}

export async function listSessions(userId: string) {
  return db
    .select({ id: sessions.id, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt, userAgent: sessions.userAgent, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastSeenAt));
}

/** Re-authentication for sensitive actions (exports, deletion, password change). */
export async function confirmPassword(userId: string, password: string): Promise<boolean> {
  const [user] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId));
  if (!user) return false;
  return verifyPassword(password, user.hash);
}

export async function changePassword(actor: Actor, currentPassword: string, newPassword: string, keepSessionId: string | null, meta: ClientMeta = {}) {
  const [user] = await db.select().from(users).where(eq(users.id, actor.userId));
  if (!user) throw forbidden();
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw validationError({ currentPassword: 'wrongPassword' });
  if (isWeakPassword(newPassword, user.phone)) throw validationError({ newPassword: 'passwordWeak' });
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordChangedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(keepSessionId ? and(eq(sessions.userId, user.id), ne(sessions.id, keepSessionId)) : eq(sessions.userId, user.id));
    await audit(tx, { actor, action: 'auth.password_changed', targetType: 'user', targetId: user.id, ipHash: meta.ipHash });
  });
}

/**
 * Administrators issue one-time reset links and hand them over in person or by phone, because
 * no SMS/email provider is bundled. The raw token is returned once and only its hash is stored.
 */
export async function issuePasswordReset(actor: Actor, userId: string, meta: ClientMeta = {}): Promise<string> {
  if (!isAdmin(actor)) throw forbidden();
  const token = randomToken();
  await db.transaction(async (tx) => {
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({ id: sha256(token), userId, createdByUserId: actor.userId, expiresAt: new Date(Date.now() + RESET_TTL_MS) });
    await audit(tx, { actor, action: 'auth.reset_link_issued', targetType: 'user', targetId: userId, ipHash: meta.ipHash });
  });
  return token;
}

export async function checkResetToken(token: string) {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.id, sha256(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())));
  return row ?? null;
}

export async function resetPasswordWithToken(token: string, newPassword: string, meta: ClientMeta = {}) {
  const row = await checkResetToken(token);
  if (!row) throw new AppError('invalid_state', 'token_invalid');
  const [user] = await db.select().from(users).where(eq(users.id, row.userId));
  if (!user || user.status === 'deleted') throw new AppError('invalid_state', 'token_invalid');
  if (isWeakPassword(newPassword, user.phone)) throw validationError({ password: 'passwordWeak' });
  const passwordHash = await hashPassword(newPassword);
  await db.transaction(async (tx) => {
    const used = await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.id, row.id), isNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });
    if (used.length === 0) throw new AppError('invalid_state', 'token_invalid');
    await tx
      .update(users)
      .set({ passwordHash, passwordChangedAt: new Date(), failedSignInCount: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await audit(tx, { actor: null, action: 'auth.password_reset', targetType: 'user', targetId: user.id, ipHash: meta.ipHash });
  });
}

export async function setPreferredLocale(userId: string, locale: 'bn' | 'en'): Promise<void> {
  await db.update(users).set({ preferredLocale: locale }).where(eq(users.id, userId));
}

export async function updateAccountBasics(actor: Actor, input: { displayName: string; email: string | null }, meta: ClientMeta = {}) {
  try {
    await db.transaction(async (tx) => {
      await tx.update(users).set({ displayName: input.displayName, email: input.email, updatedAt: new Date() }).where(eq(users.id, actor.userId));
      await audit(tx, { actor, action: 'account.updated', targetType: 'user', targetId: actor.userId, metadata: { fields: ['displayName', 'email'] }, ipHash: meta.ipHash });
    });
  } catch (error) {
    if (isUniqueViolation(error, 'users_email_key')) throw conflict('validation', { email: 'emailTaken' });
    throw error;
  }
}

/** Number of active administrators (used to stop the last admin from being removed). */
export async function activeAdminCount(executor: Executor = db): Promise<number> {
  const [row] = await executor
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
  return row?.n ?? 0;
}

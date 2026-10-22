import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/server/db/client';
import { auditLogs, sessions, users } from '@/server/db/schema';
import { AppError } from '@/server/errors';
import {
  authenticate,
  changePassword,
  checkResetToken,
  createSession,
  getActorBySessionToken,
  issuePasswordReset,
  registerAccount,
  resetPasswordWithToken,
  revokeSessionToken,
  toActor,
} from '@/server/services/accounts';
import { makeAdmin, makeUser, nextPhone, PASSWORD, resetDb } from './helpers';

beforeEach(resetDb);

async function expectAppError(p: Promise<unknown>, messageKey: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.messageKey === messageKey);
}

describe('accounts and sessions', () => {
  it('refuses weak passwords and duplicate phone numbers', async () => {
    const phone = nextPhone();
    await expect(registerAccount({ phone, password: '12345678', displayName: 'A' })).rejects.toMatchObject({ fieldErrors: { password: 'passwordWeak' } });
    await registerAccount({ phone, password: PASSWORD, displayName: 'A' });
    await expect(registerAccount({ phone, password: PASSWORD, displayName: 'B' })).rejects.toMatchObject({ fieldErrors: { phone: 'phoneTaken' } });
  });

  it('stores only a scrypt hash, never the password', async () => {
    const { user } = await makeUser();
    expect(user.passwordHash.startsWith('scrypt$')).toBe(true);
    expect(user.passwordHash).not.toContain(PASSWORD);
  });

  it('uses the same error for unknown numbers and wrong passwords', async () => {
    const { user } = await makeUser();
    await expectAppError(authenticate(nextPhone(), PASSWORD), 'invalid_credentials');
    await expectAppError(authenticate(user.phone, 'wrong-password-1'), 'invalid_credentials');
    await expectAppError(authenticate(null, PASSWORD), 'invalid_credentials');
    await expect(authenticate(user.phone, PASSWORD)).resolves.toMatchObject({ id: user.id });
  });

  it('locks the account for 15 minutes after five wrong passwords', async () => {
    const { user } = await makeUser();
    for (let i = 0; i < 5; i++) await expectAppError(authenticate(user.phone, `wrong-${i}-xx`), 'invalid_credentials');
    await expectAppError(authenticate(user.phone, PASSWORD), 'account_locked');
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.locked'));
    expect(logs).toHaveLength(1);
  });

  it('resolves sessions from the cookie token, stores only its hash, and revokes them', async () => {
    const { user } = await makeUser();
    const { token } = await createSession(user.id);
    const [row] = await db.select().from(sessions);
    expect(row.id).not.toBe(token);
    expect((await getActorBySessionToken(token))?.actor.userId).toBe(user.id);
    await revokeSessionToken(token);
    expect(await getActorBySessionToken(token)).toBeNull();
  });

  it('drops sessions of suspended accounts and expired sessions', async () => {
    const { user } = await makeUser();
    const { token } = await createSession(user.id);
    await db.update(users).set({ status: 'suspended' }).where(eq(users.id, user.id));
    expect(await getActorBySessionToken(token)).toBeNull();
    await db.update(users).set({ status: 'active' }).where(eq(users.id, user.id));
    await db.update(sessions).set({ expiresAt: sql`now() - interval '1 minute'` });
    expect(await getActorBySessionToken(token)).toBeNull();
  });

  it('changing the password signs out other devices but keeps the current one', async () => {
    const { user } = await makeUser();
    const a = await createSession(user.id);
    const b = await createSession(user.id);
    const current = await getActorBySessionToken(a.token);
    await changePassword(toActor(user, null), PASSWORD, 'NewPass2026x', current!.sessionId);
    expect(await getActorBySessionToken(a.token)).not.toBeNull();
    expect(await getActorBySessionToken(b.token)).toBeNull();
    await expect(changePassword(toActor(user, null), 'not-it-123', 'Another2026x', null)).rejects.toMatchObject({ fieldErrors: { currentPassword: 'wrongPassword' } });
  });

  it('admin reset links work once, expire, and sign out everywhere', async () => {
    const { user } = await makeUser();
    const { actor: admin } = await makeAdmin();
    const { actor: other } = await makeUser('Other');
    await expect(issuePasswordReset(other, user.id)).rejects.toMatchObject({ code: 'forbidden' });
    const session = await createSession(user.id);
    const token = await issuePasswordReset(admin, user.id);
    expect(await checkResetToken(token)).not.toBeNull();
    await resetPasswordWithToken(token, 'Fresh2026pass');
    expect(await getActorBySessionToken(session.token)).toBeNull();
    await expect(authenticate(user.phone, 'Fresh2026pass')).resolves.toBeTruthy();
    await expectAppError(resetPasswordWithToken(token, 'Again2026pass'), 'token_invalid');
  });
});

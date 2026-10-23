import { eq } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { users } from '../db/schema';
import { normalizeBdPhone } from '../domain/phone';
import { audit } from './audit';

/**
 * Makes the existing accounts with these mobile numbers administrators. Used by the deploy seed
 * with the ADMIN_PHONE setting (one or more numbers, comma-separated), so the owner can become an
 * admin on the live site without handling the database password. It never creates an account,
 * never removes anyone's role and skips suspended or deleted accounts. Each change is audit-logged.
 */
export async function promoteAdmins(phones: string | undefined, executor: Executor = db): Promise<{ promoted: number; alreadyAdmin: number; notFound: number }> {
  const result = { promoted: 0, alreadyAdmin: 0, notFound: 0 };
  const numbers = [...new Set((phones ?? '').split(',').map((p) => normalizeBdPhone(p.trim())).filter((p): p is string => !!p))];
  for (const phone of numbers) {
    const [user] = await executor.select().from(users).where(eq(users.phone, phone));
    if (!user || user.status !== 'active') {
      result.notFound += 1;
      continue;
    }
    if (user.role === 'admin') {
      result.alreadyAdmin += 1;
      continue;
    }
    await executor.update(users).set({ role: 'admin', updatedAt: new Date() }).where(eq(users.id, user.id));
    await audit(executor, { actor: null, action: 'admin.role_changed', targetType: 'user', targetId: user.id, metadata: { from: user.role, to: 'admin', via: 'ADMIN_PHONE' } });
    result.promoted += 1;
  }
  return result;
}

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import type { Actor } from '../policy';
import { myCommunities } from './communities';

/** Name, email and sign-in number for the account's own profile page. */
export async function getAccountBasics(userId: string) {
  const [row] = await db.select({ displayName: users.displayName, email: users.email, phone: users.phone }).from(users).where(eq(users.id, userId));
  return row ?? null;
}

/** Approved communities where the actor is an active member (for verification requests). */
export async function verifyingCommunities(actor: Actor) {
  const rows = await myCommunities(actor);
  return rows
    .filter((r) => r.membership.status === 'active' && r.community.status === 'approved')
    .map((r) => ({ id: r.community.id, name: r.community.name, nameEn: r.community.nameEn }));
}

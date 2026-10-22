import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { communities, donorProfiles, users } from '../db/schema';
import { forbidden } from '../errors';
import { isAdmin, type Actor } from '../policy';

/** Read-only helpers for the admin pages. Every function re-checks admin rights. */

/** Every donor profile waiting for verification, across all communities. */
export async function pendingProfileVerificationsAll(actor: Actor) {
  if (!isAdmin(actor)) throw forbidden();
  return db
    .select({
      donorId: donorProfiles.id,
      publicId: donorProfiles.publicId,
      userId: donorProfiles.userId,
      fullName: donorProfiles.fullName,
      bloodGroup: donorProfiles.bloodGroup,
      districtId: donorProfiles.districtId,
      upazilaId: donorProfiles.upazilaId,
      requestedAt: donorProfiles.updatedAt,
      communityName: communities.name,
      accountStatus: users.status,
    })
    .from(donorProfiles)
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .leftJoin(communities, eq(communities.id, donorProfiles.verificationCommunityId))
    .where(eq(donorProfiles.verificationStatus, 'pending'))
    .orderBy(asc(donorProfiles.updatedAt))
    .limit(200);
}

/** Community id -> slug, for linking reports to community pages. */
export async function communitySlugsByIds(actor: Actor, ids: string[]) {
  if (!isAdmin(actor)) throw forbidden();
  const valid = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (valid.length === 0) return new Map<string, string>();
  const rows = await db.select({ id: communities.id, slug: communities.slug }).from(communities).where(inArray(communities.id, valid));
  return new Map(rows.map((r) => [r.id, r.slug]));
}

/** Donor public id -> user id, so admins can jump from a donor report to the account page. */
export async function userIdsByDonorPublicIds(actor: Actor, publicIds: string[]) {
  if (!isAdmin(actor)) throw forbidden();
  const valid = publicIds.filter((id) => /^[a-z0-9]{6,20}$/.test(id));
  if (valid.length === 0) return new Map<string, string>();
  const rows = await db.select({ publicId: donorProfiles.publicId, userId: donorProfiles.userId }).from(donorProfiles).where(inArray(donorProfiles.publicId, valid));
  return new Map(rows.map((r) => [r.publicId, r.userId]));
}

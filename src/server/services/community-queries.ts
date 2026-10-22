import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { bloodRequests, communityMemberships, donations, donorProfiles } from '../db/schema';

/** Read-only helpers for the community management pages. Callers must check capabilities first. */

/** Donor profiles of active members (for "record a donation you witnessed"). */
export async function activeDonorMembers(communityId: string) {
  return db
    .select({ donorId: donorProfiles.id, userId: donorProfiles.userId, fullName: donorProfiles.fullName, bloodGroup: donorProfiles.bloodGroup })
    .from(communityMemberships)
    .innerJoin(donorProfiles, eq(donorProfiles.userId, communityMemberships.userId))
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.status, 'active')))
    .orderBy(asc(donorProfiles.fullName));
}

/** Counts for the "needs attention" box on the overview page. */
export async function pendingCounts(communityId: string) {
  const [row] = await db
    .select({
      members: sql<number>`(select count(*) from ${communityMemberships} m where m.community_id = ${communityId} and m.status = 'pending')::int`,
      records: sql<number>`(select count(*) from ${donations} d where d.review_community_id = ${communityId} and d.status = 'pending')::int`,
      profiles: sql<number>`(select count(*) from ${donorProfiles} p where p.verification_community_id = ${communityId} and p.verification_status = 'pending')::int`,
      openRequests: sql<number>`(select count(*) from ${bloodRequests} r where r.status in ('open', 'in_progress') and r.expires_at > now()
        and (r.assigned_community_id = ${communityId} or exists (select 1 from request_escalations e where e.request_id = r.id and e.to_community_id = ${communityId})))::int`,
    })
    .from(sql`(select 1) as one`);
  return row;
}

/** Service area ids as stored (not expanded), for the settings form. */
export async function storedServiceAreaIds(communityId: string) {
  const rows = await db.execute<{ location_id: number }>(sql`select location_id from community_service_areas where community_id = ${communityId}`);
  return rows.map((r) => Number(r.location_id));
}

export async function membershipUserIds(membershipIds: string[]) {
  if (membershipIds.length === 0) return [];
  return db.select({ id: communityMemberships.id, userId: communityMemberships.userId }).from(communityMemberships).where(inArray(communityMemberships.id, membershipIds));
}

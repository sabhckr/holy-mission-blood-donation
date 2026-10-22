/**
 * Read-only helpers for the blood request pages. Mutations live in requests.ts.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { bloodRequests, communities, communityMemberships, donorProfiles, requestEscalations, users } from '../db/schema';
import { sha256 } from '../domain/ids';

/** Public id of the request a private management link belongs to, or null. */
export async function publicIdForManageToken(token: string): Promise<string | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [row] = await db.select({ publicId: bloodRequests.publicId }).from(bloodRequests).where(eq(bloodRequests.manageTokenHash, sha256(token)));
  return row?.publicId ?? null;
}

/** Raw request row plus the communities it was escalated to (for coordinator pages; check access before showing private fields). */
export async function getRequestRow(publicId: string) {
  if (!/^[a-z0-9]{6,20}$/.test(publicId)) return null;
  const [request] = await db.select().from(bloodRequests).where(eq(bloodRequests.publicId, publicId));
  if (!request) return null;
  const escalations = await db.select({ id: requestEscalations.toCommunityId }).from(requestEscalations).where(eq(requestEscalations.requestId, request.id));
  return { request, escalatedTo: escalations.map((e) => e.id) };
}

export interface CommunityOption {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  districtId: number;
}

/** Approved communities, for the "send to a community" and escalation selects. */
export async function approvedCommunityOptions(): Promise<CommunityOption[]> {
  return db
    .select({ id: communities.id, name: communities.name, nameEn: communities.nameEn, slug: communities.slug, districtId: communities.districtId })
    .from(communities)
    .where(eq(communities.status, 'approved'))
    .orderBy(asc(communities.name))
    .limit(500);
}

export async function approvedCommunityById(id: string): Promise<CommunityOption | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ id: communities.id, name: communities.name, nameEn: communities.nameEn, slug: communities.slug, districtId: communities.districtId })
    .from(communities)
    .where(and(eq(communities.id, id), eq(communities.status, 'approved')));
  return row ?? null;
}

/** Active leaders and coordinators of a community (assignment options). */
export async function communityCoordinatorOptions(communityId: string) {
  return db
    .select({ userId: communityMemberships.userId, displayName: users.displayName, role: communityMemberships.role })
    .from(communityMemberships)
    .innerJoin(users, eq(users.id, communityMemberships.userId))
    .where(
      and(
        eq(communityMemberships.communityId, communityId),
        eq(communityMemberships.status, 'active'),
        inArray(communityMemberships.role, ['leader', 'coordinator']),
        eq(users.status, 'active'),
      ),
    )
    .orderBy(asc(users.displayName));
}

/** The signed-in user's own name and number, to prefill the request form. */
export async function ownContact(userId: string) {
  const [row] = await db.select({ displayName: users.displayName, phone: users.phone }).from(users).where(eq(users.id, userId));
  return row ?? null;
}

export async function donorBloodGroup(donorId: string): Promise<string | null> {
  const [row] = await db.select({ bloodGroup: donorProfiles.bloodGroup, status: donorProfiles.status }).from(donorProfiles).where(eq(donorProfiles.id, donorId));
  return row?.bloodGroup ?? null;
}

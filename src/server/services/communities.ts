import { and, asc, desc, eq, ilike, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import {
  bloodRequests,
  communities,
  communityMemberships,
  communityServiceAreas,
  donations,
  donorConsents,
  donorProfiles,
  locations,
  requestEscalations,
  users,
} from '../db/schema';
import { PAGE_SIZE, type BloodGroup, type CommunityKind } from '../domain/constants';
import { ageOn, todayInBangladesh } from '../domain/dates';
import { projectDonor } from '../domain/donor-view';
import { randomPublicId, slugify } from '../domain/ids';
import { normalizeBdPhone } from '../domain/phone';
import { AppError, conflict, forbidden, isUniqueViolation, notFound, validationError } from '../errors';
import {
  can,
  canChangeMemberRole,
  canRemoveMember,
  communityCapabilities,
  isAdmin,
  type Actor,
  type CommunityCapability,
  type MembershipFacts,
} from '../policy';
import type { ClientMeta } from './accounts';
import { audit } from './audit';
import { descendantIds, validateLocationChain } from './locations';
import { getServiceArea, inServiceDistrict, withinServiceArea } from './service-area';
import { createNotifications, type NewNotification } from './notifications';
import { donationStatsFor, donorAvailability } from './donors';

export type Community = typeof communities.$inferSelect;
type Membership = typeof communityMemberships.$inferSelect;

export interface CommunityInput {
  name: string;
  nameEn: string | null;
  kind: CommunityKind;
  description: string | null;
  foundedYear: number | null;
  divisionId: number;
  districtId: number;
  serviceAreaIds: number[];
  publicPhone: string | null;
  publicEmail: string | null;
  facebookUrl: string | null;
  showPublicContact: boolean;
  coordinatorContactPreference: 'in_app' | 'phone' | 'both';
  /** Responsible representative (required on save) and how admins can verify the organisation.
   *  Private: shown only to platform admins and the organisation's own leaders. */
  representativeName?: string | null;
  representativeRole?: string | null;
  representativePhone?: string | null;
  verificationInfo?: string | null;
}

async function validateCommunityInput(input: CommunityInput, executor: Executor) {
  const errors = await validateLocationChain({ divisionId: input.divisionId, districtId: input.districtId }, executor);
  // Organisations register from Lakshmipur and serve Lakshmipur only.
  if (!errors.districtId && input.districtId !== (await getServiceArea(executor)).districtId) errors.districtId = 'outsideServiceArea';
  if (input.serviceAreaIds.length === 0) errors.serviceAreaIds = 'required';
  else if (input.serviceAreaIds.length > 30) errors.serviceAreaIds = 'tooLong';
  else {
    const rows = await executor.select().from(locations).where(inArray(locations.id, input.serviceAreaIds));
    if (rows.length !== new Set(input.serviceAreaIds).size || rows.some((r) => !r.isActive)) errors.serviceAreaIds = 'invalidLocation';
    else if (!(await withinServiceArea(input.serviceAreaIds, executor))) errors.serviceAreaIds = 'outsideServiceArea';
  }
  const year = new Date().getFullYear();
  if (input.foundedYear !== null && (input.foundedYear < 1950 || input.foundedYear > year)) errors.foundedYear = 'outOfRange';
  if ((input.coordinatorContactPreference !== 'in_app' || input.showPublicContact) && !input.publicPhone && !input.publicEmail) {
    errors.publicPhone = 'required';
  }
  if (!input.representativeName || input.representativeName.trim().length < 2) errors.representativeName = 'required';
  if (!input.representativePhone) errors.representativePhone = 'required';
  else if (!normalizeBdPhone(input.representativePhone)) errors.representativePhone = 'invalidPhone';
  if (input.verificationInfo && input.verificationInfo.length > 1000) errors.verificationInfo = 'tooLong';
  if (Object.keys(errors).length) throw validationError(errors);
}

async function uniqueSlug(executor: Executor, base: string): Promise<string> {
  // Names written only in Bangla have no Latin letters to slugify; give them a short random slug.
  const root = slugify(base) || `org-${randomPublicId(6)}`;
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? root : `${root}-${randomPublicId(4)}`;
    const [hit] = await executor.select({ id: communities.id }).from(communities).where(eq(communities.slug, candidate));
    if (!hit) return candidate;
  }
  return `${root}-${randomPublicId(8)}`;
}

/** Anyone signed in can apply to register an organisation; it starts 'pending' until an admin approves it. */
export async function registerCommunity(actor: Actor, input: CommunityInput, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  try {
    return await db.transaction(async (tx) => {
      await validateCommunityInput(input, tx);
      const slug = await uniqueSlug(tx, input.nameEn || input.name);
      const { serviceAreaIds, ...fields } = { ...input, representativePhone: normalizeBdPhone(input.representativePhone ?? '') };
      const [community] = await tx.insert(communities).values({ ...fields, slug, status: 'pending', createdByUserId: actor.userId }).returning();
      await tx.insert(communityServiceAreas).values([...new Set(serviceAreaIds)].map((locationId) => ({ communityId: community.id, locationId })));
      await tx.insert(communityMemberships).values({ communityId: community.id, userId: actor.userId, role: 'leader', status: 'active', reviewedByUserId: actor.userId });
      await audit(tx, { actor, action: 'community.registered', targetType: 'community', targetId: community.id, communityId: community.id, ipHash: meta.ipHash });
      return community;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'communities_name_district_key')) throw validationError({ name: 'nameTaken' });
    throw error;
  }
}

export async function getMembership(communityId: string, userId: string, executor: Executor = db): Promise<Membership | null> {
  const [m] = await executor
    .select()
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, userId)));
  return m ?? null;
}

export interface CommunityContext {
  community: Community;
  membership: Membership | null;
  caps: Set<CommunityCapability>;
}

/** Community + the actor's membership and capabilities. Use for every management page/action. */
export async function getCommunityContext(actor: Actor | null, idOrSlug: { id?: string; slug?: string }, executor: Executor = db): Promise<CommunityContext | null> {
  const where = idOrSlug.id ? eq(communities.id, idOrSlug.id) : eq(communities.slug, idOrSlug.slug ?? '');
  const [community] = await executor.select().from(communities).where(where);
  if (!community) return null;
  const membership = actor ? await getMembership(community.id, actor.userId, executor) : null;
  return { community, membership, caps: communityCapabilities(actor, membership as MembershipFacts | null, community.status) };
}

async function requireCapability(actor: Actor, communityId: string, cap: CommunityCapability, executor: Executor = db): Promise<CommunityContext> {
  const ctx = await getCommunityContext(actor, { id: communityId }, executor);
  if (!ctx) throw notFound();
  if (!ctx.caps.has(cap)) throw forbidden();
  return ctx;
}

export async function updateCommunityProfile(actor: Actor, communityId: string, input: CommunityInput, meta: ClientMeta = {}) {
  try {
    return await db.transaction(async (tx) => {
      await requireCapability(actor, communityId, 'edit_profile', tx);
      await validateCommunityInput(input, tx);
      const { serviceAreaIds, ...fields } = { ...input, representativePhone: normalizeBdPhone(input.representativePhone ?? '') };
      await tx.update(communities).set({ ...fields, updatedAt: new Date() }).where(eq(communities.id, communityId));
      await tx.delete(communityServiceAreas).where(eq(communityServiceAreas.communityId, communityId));
      await tx.insert(communityServiceAreas).values([...new Set(serviceAreaIds)].map((locationId) => ({ communityId, locationId })));
      await audit(tx, { actor, action: 'community.updated', targetType: 'community', targetId: communityId, communityId, metadata: { serviceAreas: serviceAreaIds.length }, ipHash: meta.ipHash });
    });
  } catch (error) {
    if (isUniqueViolation(error, 'communities_name_district_key')) throw validationError({ name: 'nameTaken' });
    throw error;
  }
}

async function leaderIds(executor: Executor, communityId: string, roles: MembershipFacts['role'][] = ['leader']) {
  const rows = await executor
    .select({ userId: communityMemberships.userId })
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.status, 'active'), inArray(communityMemberships.role, roles)));
  return rows.map((r) => r.userId);
}

/** Admin decision on an organisation. */
export async function reviewCommunity(
  actor: Actor,
  communityId: string,
  decision: 'approved' | 'rejected' | 'suspended',
  reason: string | null,
  meta: ClientMeta = {},
) {
  if (!isAdmin(actor)) throw forbidden();
  return db.transaction(async (tx) => {
    const [community] = await tx.select().from(communities).where(eq(communities.id, communityId)).for('update');
    if (!community) throw notFound();
    const allowed: Record<typeof decision, Community['status'][]> = {
      approved: ['pending', 'suspended', 'rejected'],
      rejected: ['pending'],
      suspended: ['approved'],
    };
    if (!allowed[decision].includes(community.status)) throw new AppError('invalid_state');
    // An organisation based outside Lakshmipur cannot be approved (it can still be rejected or suspended).
    if (decision === 'approved' && community.districtId !== (await getServiceArea(tx)).districtId) throw new AppError('invalid_state', 'outside_service_area');
    await tx
      .update(communities)
      .set({ status: decision, statusReason: reason, reviewedByUserId: actor.userId, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(communities.id, communityId));
    const kind = decision === 'approved' ? 'community_approved' : decision === 'suspended' ? 'community_suspended' : 'community_rejected';
    const leaders = await leaderIds(tx, communityId);
    await createNotifications(tx, leaders.map((userId) => ({ userId, kind, data: { community: community.name }, link: `/manage/${community.slug}` }) as NewNotification));
    await audit(tx, { actor, action: `community.${decision}`, targetType: 'community', targetId: communityId, communityId, metadata: { from: community.status }, ipHash: meta.ipHash });
  });
}

// ---------------------------------------------------------------------------
// Public directory
// ---------------------------------------------------------------------------

export async function serviceAreasFor(communityIds: string[], executor: Executor = db) {
  const map = new Map<string, { id: number; nameBn: string; nameEn: string; level: string }[]>();
  if (communityIds.length === 0) return map;
  const rows = await executor
    .select({ communityId: communityServiceAreas.communityId, id: locations.id, nameBn: locations.nameBn, nameEn: locations.nameEn, level: locations.level })
    .from(communityServiceAreas)
    .innerJoin(locations, eq(locations.id, communityServiceAreas.locationId))
    .where(inArray(communityServiceAreas.communityId, communityIds));
  for (const r of rows) map.set(r.communityId, [...(map.get(r.communityId) ?? []), { id: r.id, nameBn: r.nameBn, nameEn: r.nameEn, level: r.level }]);
  return map;
}

async function memberCounts(communityIds: string[]) {
  const map = new Map<string, number>();
  if (communityIds.length === 0) return map;
  const rows = await db
    .select({ communityId: communityMemberships.communityId, n: sql<number>`count(*)::int` })
    .from(communityMemberships)
    .where(and(inArray(communityMemberships.communityId, communityIds), eq(communityMemberships.status, 'active')))
    .groupBy(communityMemberships.communityId);
  for (const r of rows) map.set(r.communityId, r.n);
  return map;
}

/** Public projection: contact details only when the organisation chose to show them. */
export function publicCommunity(c: Community) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    nameEn: c.nameEn,
    kind: c.kind,
    description: c.description,
    foundedYear: c.foundedYear,
    status: c.status,
    divisionId: c.divisionId,
    districtId: c.districtId,
    coordinatorContactPreference: c.coordinatorContactPreference,
    affiliation: c.affiliation,
    publicPhone: c.showPublicContact ? c.publicPhone : null,
    publicEmail: c.showPublicContact ? c.publicEmail : null,
    facebookUrl: c.facebookUrl,
  };
}

export async function listCommunities(filters: { q?: string | null; divisionId?: number | null; districtId?: number | null; page?: number }) {
  const conditions: SQL[] = [eq(communities.status, 'approved'), inServiceDistrict(communities.districtId)];
  if (filters.divisionId) conditions.push(eq(communities.divisionId, filters.divisionId));
  if (filters.districtId) {
    conditions.push(
      or(
        eq(communities.districtId, filters.districtId),
        sql`exists (select 1 from community_service_areas sa join locations l on l.id = sa.location_id
          where sa.community_id = ${communities.id} and (l.id = ${filters.districtId} or l.parent_id = ${filters.districtId}))`,
      )!,
    );
  }
  if (filters.q) {
    const pattern = `%${filters.q.normalize('NFC').replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(communities.name, pattern), ilike(communities.nameEn, pattern))!);
  }
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(communities).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db.select().from(communities).where(where).orderBy(asc(communities.name)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  const ids = rows.map((r) => r.id);
  const [areas, counts] = await Promise.all([serviceAreasFor(ids), memberCounts(ids)]);
  return {
    items: rows.map((r) => ({ ...publicCommunity(r), serviceAreas: areas.get(r.id) ?? [], memberCount: counts.get(r.id) ?? 0 })),
    total,
    page,
    pageCount,
  };
}

/** Public page data. Pending/suspended organisations are visible only to their leaders and admins. */
export async function getPublicCommunity(slug: string, actor: Actor | null) {
  const ctx = await getCommunityContext(actor, { slug });
  if (!ctx) return null;
  if (ctx.community.status !== 'approved' && !ctx.caps.has('view_dashboard')) return null;
  // Organisations based outside Lakshmipur are not part of the public directory.
  const inServiceArea = ctx.community.districtId === (await getServiceArea()).districtId;
  if (!inServiceArea && !ctx.caps.has('view_dashboard')) return null;
  const [areas, counts] = await Promise.all([serviceAreasFor([ctx.community.id]), memberCounts([ctx.community.id])]);
  return {
    community: { ...publicCommunity(ctx.community), serviceAreas: areas.get(ctx.community.id) ?? [], memberCount: counts.get(ctx.community.id) ?? 0 },
    membership: ctx.membership,
    canManage: ctx.caps.has('view_dashboard'),
  };
}

/**
 * Approved communities whose service area covers a place: the upazila itself, its district,
 * or its division. Several communities can serve the same area; none has exclusive control.
 */
export async function communitiesServingArea(area: { divisionId?: number | null; districtId?: number | null; upazilaId?: number | null }, excludeId?: string) {
  const ids = [area.upazilaId, area.districtId, area.divisionId].filter((v): v is number => typeof v === 'number' && v > 0);
  if (ids.length === 0) return [];
  const conds: SQL[] = [eq(communities.status, 'approved'), inServiceDistrict(communities.districtId), inArray(communityServiceAreas.locationId, ids)];
  if (excludeId) conds.push(ne(communities.id, excludeId));
  const rows = await db
    .selectDistinct({ community: communities })
    .from(communities)
    .innerJoin(communityServiceAreas, eq(communityServiceAreas.communityId, communities.id))
    .where(and(...conds))
    .orderBy(asc(communities.name))
    .limit(20);
  return rows.map((r) => publicCommunity(r.community));
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function applyToJoin(actor: Actor, communityId: string, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  return db.transaction(async (tx) => {
    const [community] = await tx.select().from(communities).where(eq(communities.id, communityId));
    if (!community || community.status !== 'approved') throw new AppError('invalid_state', 'community_not_approved');
    const existing = await getMembership(communityId, actor.userId, tx);
    if (existing && (existing.status === 'active' || existing.status === 'pending')) throw conflict('already_member');
    if (existing) {
      await tx.update(communityMemberships).set({ status: 'pending', role: 'member', reviewedByUserId: null, updatedAt: new Date() }).where(eq(communityMemberships.id, existing.id));
    } else {
      await tx.insert(communityMemberships).values({ communityId, userId: actor.userId, role: 'member', status: 'pending' });
    }
    const reviewers = await leaderIds(tx, communityId, ['leader', 'coordinator']);
    await createNotifications(
      tx,
      reviewers.map((userId) => ({ userId, kind: 'membership_requested', data: { name: actor.displayName, community: community.name }, link: `/manage/${community.slug}/members` }) as NewNotification),
    );
    await audit(tx, { actor, action: 'membership.applied', targetType: 'community', targetId: communityId, communityId, ipHash: meta.ipHash });
  });
}

async function assertNotLastLeader(executor: Executor, communityId: string, membership: Membership) {
  if (membership.role !== 'leader' || membership.status !== 'active') return;
  const leaders = await leaderIds(executor, communityId);
  if (leaders.length <= 1) throw new AppError('invalid_state', 'last_leader');
}

export async function leaveCommunity(actor: Actor, communityId: string, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const m = await getMembership(communityId, actor.userId, tx);
    if (!m || (m.status !== 'active' && m.status !== 'pending')) throw notFound();
    await assertNotLastLeader(tx, communityId, m);
    await tx.update(communityMemberships).set({ status: 'left', updatedAt: new Date() }).where(eq(communityMemberships.id, m.id));
    await audit(tx, { actor, action: 'membership.left', targetType: 'community', targetId: communityId, communityId, ipHash: meta.ipHash });
  });
}

async function loadMembershipForManagement(executor: Executor, actor: Actor, membershipId: string, cap: CommunityCapability) {
  const [target] = await executor.select().from(communityMemberships).where(eq(communityMemberships.id, membershipId)).for('update');
  if (!target) throw notFound();
  const ctx = await requireCapability(actor, target.communityId, cap, executor);
  return { target, ctx };
}

export async function reviewMembership(actor: Actor, membershipId: string, decision: 'active' | 'rejected', meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const { target, ctx } = await loadMembershipForManagement(tx, actor, membershipId, 'manage_members');
    if (target.status !== 'pending') throw new AppError('invalid_state');
    await tx.update(communityMemberships).set({ status: decision, reviewedByUserId: actor.userId, updatedAt: new Date() }).where(eq(communityMemberships.id, target.id));
    await createNotifications(tx, [
      { userId: target.userId, kind: decision === 'active' ? 'membership_approved' : 'membership_rejected', data: { community: ctx.community.name }, link: `/communities/${ctx.community.slug}` },
    ]);
    await audit(tx, { actor, action: decision === 'active' ? 'membership.approved' : 'membership.rejected', targetType: 'membership', targetId: target.id, communityId: target.communityId, ipHash: meta.ipHash });
  });
}

export async function removeMember(actor: Actor, membershipId: string, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const { target, ctx } = await loadMembershipForManagement(tx, actor, membershipId, 'manage_members');
    if (target.userId === actor.userId) throw forbidden();
    const actorRole = isAdmin(actor) ? 'admin' : (ctx.membership?.role ?? 'member');
    if (!canRemoveMember(ctx.caps, actorRole, target.role)) throw forbidden();
    if (target.status !== 'active' && target.status !== 'pending') throw new AppError('invalid_state');
    await assertNotLastLeader(tx, target.communityId, target);
    await tx.update(communityMemberships).set({ status: 'removed', reviewedByUserId: actor.userId, updatedAt: new Date() }).where(eq(communityMemberships.id, target.id));
    await audit(tx, { actor, action: 'membership.removed', targetType: 'membership', targetId: target.id, communityId: target.communityId, metadata: { role: target.role }, ipHash: meta.ipHash });
  });
}

export async function changeMemberRole(actor: Actor, membershipId: string, newRole: MembershipFacts['role'], meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const { target, ctx } = await loadMembershipForManagement(tx, actor, membershipId, 'manage_roles');
    if (target.status !== 'active') throw new AppError('invalid_state');
    if (!canChangeMemberRole(ctx.caps, target.userId === actor.userId, target.role, newRole)) throw forbidden();
    if (target.role === 'leader' && newRole !== 'leader') await assertNotLastLeader(tx, target.communityId, target);
    await tx.update(communityMemberships).set({ role: newRole, updatedAt: new Date() }).where(eq(communityMemberships.id, target.id));
    await audit(tx, { actor, action: 'membership.role_changed', targetType: 'membership', targetId: target.id, communityId: target.communityId, metadata: { from: target.role, to: newRole }, ipHash: meta.ipHash });
  });
}

/** Member list for coordinators/leaders/admins. Contains no phone numbers. */
export async function listMembers(actor: Actor, communityId: string) {
  await requireCapability(actor, communityId, 'view_dashboard');
  return db
    .select({
      id: communityMemberships.id,
      userId: communityMemberships.userId,
      role: communityMemberships.role,
      status: communityMemberships.status,
      joinedAt: communityMemberships.createdAt,
      displayName: users.displayName,
      donorId: donorProfiles.id,
      donorPublicId: donorProfiles.publicId,
      donorName: donorProfiles.fullName,
      bloodGroup: donorProfiles.bloodGroup,
      verificationStatus: donorProfiles.verificationStatus,
    })
    .from(communityMemberships)
    .innerJoin(users, eq(users.id, communityMemberships.userId))
    .leftJoin(donorProfiles, eq(donorProfiles.userId, communityMemberships.userId))
    .where(and(eq(communityMemberships.communityId, communityId), inArray(communityMemberships.status, ['active', 'pending'])))
    .orderBy(asc(communityMemberships.status), desc(communityMemberships.role), asc(users.displayName));
}

/** The actor's memberships (any status except removed), with the organisation's basics. */
export async function myCommunities(actor: Actor) {
  return db
    .select({ membership: communityMemberships, community: communities })
    .from(communityMemberships)
    .innerJoin(communities, eq(communities.id, communityMemberships.communityId))
    .where(and(eq(communityMemberships.userId, actor.userId), inArray(communityMemberships.status, ['active', 'pending'])))
    .orderBy(asc(communities.name));
}

/** Communities the actor can manage (dashboard access). */
export async function managedCommunities(actor: Actor) {
  if (isAdmin(actor)) return [];
  const rows = await myCommunities(actor);
  return rows.filter((r) => communityCapabilities(actor, r.membership, r.community.status).has('view_dashboard')).map((r) => r.community);
}

// ---------------------------------------------------------------------------
// Donor finder for coordinators
// ---------------------------------------------------------------------------

/** All location ids covered by a community's service areas (areas plus everything inside them). */
export async function serviceAreaLocationIds(communityId: string, executor: Executor = db) {
  const rows = await executor.select({ id: communityServiceAreas.locationId }).from(communityServiceAreas).where(eq(communityServiceAreas.communityId, communityId));
  return descendantIds(rows.map((r) => r.id), executor);
}

function inAreaCondition(areaIds: number[]): SQL {
  if (areaIds.length === 0) return sql`false`;
  return or(inArray(donorProfiles.divisionId, areaIds), inArray(donorProfiles.districtId, areaIds), inArray(donorProfiles.upazilaId, areaIds))!;
}

/**
 * Donors a coordinator may contact: they opted in to coordinator contact and live inside the
 * community's service area. Membership in the community is NOT required — several communities
 * can reach the same consenting donor.
 */
export async function findDonorsForCommunity(
  actor: Actor,
  communityId: string,
  filters: { bloodGroup?: BloodGroup | null; districtId?: number | null; upazilaId?: number | null; availableOnly?: boolean; page?: number },
) {
  await requireCapability(actor, communityId, 'find_donors');
  const areaIds = await serviceAreaLocationIds(communityId);
  const conditions: SQL[] = [
    eq(donorConsents.allowCoordinatorContact, true),
    eq(donorProfiles.registrationStatus, 'approved'),
    eq(donorProfiles.status, 'active'),
    eq(users.status, 'active'),
    inServiceDistrict(donorProfiles.districtId),
    inAreaCondition(areaIds),
  ];
  if (filters.bloodGroup) conditions.push(eq(donorProfiles.bloodGroup, filters.bloodGroup));
  if (filters.districtId) conditions.push(eq(donorProfiles.districtId, filters.districtId));
  if (filters.upazilaId) conditions.push(eq(donorProfiles.upazilaId, filters.upazilaId));
  if (filters.availableOnly) conditions.push(sql`${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now()`);
  const where = and(...conditions);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select({ donor: donorProfiles, consent: donorConsents, accountStatus: users.status })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(where)
    .orderBy(
      sql`case when ${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now() then 0 else 1 end`,
      sql`${donorProfiles.availabilityConfirmedAt} desc nulls last`,
    )
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const stats = await donationStatsFor(rows.map((r) => r.donor.id));
  const today = todayInBangladesh();
  const items = rows.map((r) => {
    const viewer = r.donor.userId === actor.userId ? 'owner' : 'coordinator';
    const view = projectDonor(
      {
        publicId: r.donor.publicId,
        userId: r.donor.userId,
        fullName: r.donor.fullName,
        bloodGroup: r.donor.bloodGroup,
        divisionId: r.donor.divisionId,
        districtId: r.donor.districtId,
        upazilaId: r.donor.upazilaId,
        locality: r.donor.locality,
        preferredContactMethod: r.donor.preferredContactMethod,
        verificationStatus: r.donor.verificationStatus,
        availability: donorAvailability(r.donor, r.accountStatus),
        availabilityConfirmedAt: r.donor.availabilityConfirmedAt,
        availabilitySource: r.donor.availabilitySource,
        consents: { ...r.consent },
        // Coordinators see verified/self-reported counts so they can judge reliability.
        stats: stats.get(r.donor.id) ?? { verifiedCount: 0, reportedCount: 0, lastDonation: null },
      },
      viewer,
    );
    return { ...view, stats: stats.get(r.donor.id) ?? { verifiedCount: 0, reportedCount: 0, lastDonation: null }, age: ageOn(r.donor.dateOfBirth, today) };
  });
  return { items, total, page, pageCount, areaCount: areaIds.length };
}

/** Coordinator reveals a consenting donor's number. Logged with the community id. */
export async function revealDonorPhoneForCommunity(actor: Actor, communityId: string, donorPublicId: string, meta: ClientMeta = {}) {
  await requireCapability(actor, communityId, 'find_donors');
  const areaIds = await serviceAreaLocationIds(communityId);
  const [row] = await db
    .select({ donor: donorProfiles, consent: donorConsents, accountStatus: users.status })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(and(eq(donorProfiles.publicId, donorPublicId), inServiceDistrict(donorProfiles.districtId), inAreaCondition(areaIds)));
  if (!row || !row.consent.allowCoordinatorContact || row.donor.registrationStatus !== 'approved' || row.donor.status !== 'active' || row.accountStatus !== 'active') throw notFound();
  if (row.consent.phoneVisibility === 'private') throw forbidden();
  await audit(db, { actor, action: 'donor.phone_revealed', targetType: 'donor', targetId: row.donor.id, communityId, metadata: { context: 'community_finder' }, ipHash: meta.ipHash });
  return { phone: row.donor.contactPhone, method: row.donor.preferredContactMethod, name: row.donor.fullName };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/** Database-backed figures for a community dashboard. Verified and self-reported numbers are kept apart. */
export async function communityReport(actor: Actor, communityId: string) {
  await requireCapability(actor, communityId, 'view_reports');
  const [members] = await db
    .select({
      active: sql<number>`count(*) filter (where ${communityMemberships.status} = 'active')::int`,
      pending: sql<number>`count(*) filter (where ${communityMemberships.status} = 'pending')::int`,
    })
    .from(communityMemberships)
    .where(eq(communityMemberships.communityId, communityId));
  const byGroup = await db
    .select({ bloodGroup: donorProfiles.bloodGroup, n: sql<number>`count(*)::int` })
    .from(communityMemberships)
    .innerJoin(donorProfiles, eq(donorProfiles.userId, communityMemberships.userId))
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.status, 'active')))
    .groupBy(donorProfiles.bloodGroup);
  const [records] = await db
    .select({
      verifiedHere: sql<number>`count(*) filter (where ${donations.status} = 'verified' and ${donations.reviewCommunityId} = ${communityId})::int`,
      pendingHere: sql<number>`count(*) filter (where ${donations.status} = 'pending' and ${donations.reviewCommunityId} = ${communityId})::int`,
      selfReportedByMembers: sql<number>`count(*) filter (where ${donations.status} in ('unverified', 'pending'))::int`,
    })
    .from(donations)
    .innerJoin(donorProfiles, eq(donorProfiles.id, donations.donorId))
    .innerJoin(
      communityMemberships,
      and(eq(communityMemberships.userId, donorProfiles.userId), eq(communityMemberships.communityId, communityId), eq(communityMemberships.status, 'active')),
    );
  const requestsByStatus = await db
    .select({ status: bloodRequests.status, n: sql<number>`count(*)::int` })
    .from(bloodRequests)
    .where(
      or(
        eq(bloodRequests.assignedCommunityId, communityId),
        sql`exists (select 1 from ${requestEscalations} e where e.request_id = ${bloodRequests.id} and e.to_community_id = ${communityId})`,
      ),
    )
    .groupBy(bloodRequests.status);
  return { members, byGroup, records, requestsByStatus };
}

/**
 * Marks an organisation as part of Holy Mission itself, or as independent. Only platform admins
 * can do this, with a reason; registering on the platform never changes it.
 */
export async function setCommunityAffiliation(actor: Actor, communityId: string, affiliation: 'independent' | 'holy_mission', reason: string, meta: ClientMeta = {}) {
  if (!can(actor, 'communities.review')) throw forbidden();
  if (!reason.trim()) throw validationError({ reason: 'required' });
  return db.transaction(async (tx) => {
    const [community] = await tx.select().from(communities).where(eq(communities.id, communityId)).for('update');
    if (!community) throw notFound();
    if (community.affiliation === affiliation) throw new AppError('invalid_state');
    if (affiliation === 'holy_mission' && community.status !== 'approved') throw new AppError('invalid_state', 'community_not_approved');
    await tx.update(communities).set({ affiliation, updatedAt: new Date() }).where(eq(communities.id, communityId));
    await audit(tx, { actor, action: 'community.affiliation_changed', targetType: 'community', targetId: communityId, communityId, metadata: { from: community.affiliation, to: affiliation, reason }, ipHash: meta.ipHash });
  });
}

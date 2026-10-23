import { and, asc, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import {
  bloodRequests,
  communities,
  communityMemberships,
  contactRequests,
  donations,
  donorProfiles,
  requestEscalations,
  requestResponses,
  requestStatusEvents,
  users,
} from '../db/schema';
import { PAGE_SIZE, type BloodGroup, type RequestContactPreference, type RequestStatus, type Urgency } from '../domain/constants';
import { neededAtError } from '../domain/booking';
import { compareDates, todayInBangladesh } from '../domain/dates';
import { estimateNextEligible } from '../domain/eligibility';
import { randomPublicId, randomToken, sha256 } from '../domain/ids';
import { AppError, forbidden, isUniqueViolation, notFound, validationError } from '../errors';
import { can, communityCapabilities, isAdmin, type Actor } from '../policy';
import type { ClientMeta } from './accounts';
import { audit } from './audit';
import { communitiesServingArea, serviceAreaLocationIds } from './communities';
import { countListedDonors } from './donors';
import { validateLocationChain } from './locations';
import { getServiceArea, inServiceDistrict, serviceAreaErrors } from './service-area';
import { createNotifications, type NewNotification } from './notifications';
import { getSettings } from './settings';

export type BloodRequest = typeof bloodRequests.$inferSelect;

export interface BloodRequestInput {
  bloodGroup: BloodGroup;
  units: number;
  divisionId: number;
  districtId: number;
  upazilaId: number | null;
  hospitalName: string;
  neededAt: Date;
  urgency: Urgency;
  requesterName: string;
  requesterPhone: string;
  contactPreference: RequestContactPreference;
  sharePhoneWithResponders: boolean;
  note: string | null;
  showOnPublicBoard: boolean;
  communityId: string | null;
}

const OPEN_STATUSES: RequestStatus[] = ['open', 'in_progress'];

function dedupeKey(input: Pick<BloodRequestInput, 'requesterPhone' | 'bloodGroup' | 'districtId' | 'neededAt'>): string {
  const day = input.neededAt.toISOString().slice(0, 10);
  return sha256(`${input.requesterPhone}|${input.bloodGroup}|${input.districtId}|${day}`);
}

async function coordinatorIds(executor: Executor, communityIds: string[]) {
  if (communityIds.length === 0) return [];
  const rows = await executor
    .select({ userId: communityMemberships.userId })
    .from(communityMemberships)
    .innerJoin(communities, eq(communities.id, communityMemberships.communityId))
    .where(
      and(
        inArray(communityMemberships.communityId, communityIds),
        eq(communityMemberships.status, 'active'),
        inArray(communityMemberships.role, ['leader', 'coordinator']),
        eq(communities.status, 'approved'),
      ),
    );
  return [...new Set(rows.map((r) => r.userId))];
}

async function statusEvent(executor: Executor, requestId: string, actor: Actor | null, action: string, from: RequestStatus | null, to: RequestStatus, note: string | null = null) {
  await executor.insert(requestStatusEvents).values({ requestId, actorUserId: actor?.userId ?? null, action, fromStatus: from, toStatus: to, note });
}

/**
 * Creates a request. Anyone may post (signed in or not); the requester receives a private
 * management link (returned once, only its hash is stored). Duplicate open requests from the
 * same number for the same group, district and day are refused.
 */
export async function createBloodRequest(actor: Actor | null, input: BloodRequestInput, meta: ClientMeta = {}) {
  const now = Date.now();
  const locationErrors = await validateLocationChain(input);
  // Requests are accepted for hospitals in Lakshmipur only.
  const errors = Object.keys(locationErrors).length ? locationErrors : await serviceAreaErrors(input);
  // Today up to 15 days ahead, Bangladesh time (see domain/booking.ts).
  const dateError = neededAtError(input.neededAt, new Date(now));
  if (dateError) errors.neededDate = dateError;
  if (input.units < 1 || input.units > 20) errors.units = 'outOfRange';
  if (Object.keys(errors).length) throw validationError(errors);
  const settings = await getSettings();
  const manageToken = randomToken();
  try {
    return await db.transaction(async (tx) => {
      let community: typeof communities.$inferSelect | undefined;
      if (input.communityId) {
        [community] = await tx.select().from(communities).where(eq(communities.id, input.communityId));
        if (!community || community.status !== 'approved') throw validationError({ communityId: 'invalid' });
      }
      const { communityId, ...fields } = input;
      const [request] = await tx
        .insert(bloodRequests)
        .values({
          ...fields,
          publicId: randomPublicId(10),
          createdByUserId: actor?.userId ?? null,
          manageTokenHash: sha256(manageToken),
          assignedCommunityId: communityId,
          dedupeKey: dedupeKey(input),
          expiresAt: new Date(input.neededAt.getTime() + settings.requestExpiryHours * 3600 * 1000),
        })
        .returning();
      await statusEvent(tx, request.id, actor, 'created', null, 'open');
      if (community) {
        const recipients = await coordinatorIds(tx, [community.id]);
        await createNotifications(
          tx,
          recipients.map((userId) => ({ userId, kind: 'request_assigned', data: { group: request.bloodGroup, place: request.hospitalName }, link: `/manage/${community!.slug}/requests/${request.publicId}` }) as NewNotification),
        );
      }
      await audit(tx, { actor, action: 'request.created', targetType: 'request', targetId: request.id, communityId: communityId, metadata: { urgency: request.urgency, bloodGroup: request.bloodGroup }, ipHash: meta.ipHash });
      return { request, manageToken };
    });
  } catch (error) {
    if (isUniqueViolation(error, 'blood_requests_open_dedupe')) throw new AppError('conflict', 'duplicate_request');
    throw error;
  }
}

export interface RequestAccess {
  isRequester: boolean;
  isAdmin: boolean;
  /** Coordinator of the assigned community or of a community it was escalated to. */
  coordinatorOf: string[];
  responderDonorId: string | null;
  canSeeRequesterPhone: boolean;
  canManage: boolean;
}

export function effectiveStatus(request: Pick<BloodRequest, 'status' | 'expiresAt'>, now = new Date()): RequestStatus {
  if (OPEN_STATUSES.includes(request.status) && request.expiresAt < now) return 'expired';
  return request.status;
}

async function escalationTargets(executor: Executor, requestId: string) {
  const rows = await executor.select({ id: requestEscalations.toCommunityId }).from(requestEscalations).where(eq(requestEscalations.requestId, requestId));
  return rows.map((r) => r.id);
}

export async function requestAccess(actor: Actor | null, request: BloodRequest, manageToken?: string | null, executor: Executor = db): Promise<RequestAccess> {
  const tokenOk = !!manageToken && !!request.manageTokenHash && sha256(manageToken) === request.manageTokenHash;
  const isRequester = tokenOk || (!!actor && actor.status === 'active' && request.createdByUserId === actor.userId);
  const admin = isAdmin(actor);
  const coordinatorOf: string[] = [];
  if (actor && actor.status === 'active' && !admin) {
    const related = [request.assignedCommunityId, ...(await escalationTargets(executor, request.id))].filter((v): v is string => !!v);
    if (related.length) {
      const rows = await executor
        .select({ membership: communityMemberships, status: communities.status })
        .from(communityMemberships)
        .innerJoin(communities, eq(communities.id, communityMemberships.communityId))
        .where(and(eq(communityMemberships.userId, actor.userId), inArray(communityMemberships.communityId, related)));
      for (const r of rows) {
        if (communityCapabilities(actor, r.membership, r.status).has('coordinate_requests')) coordinatorOf.push(r.membership.communityId);
      }
    }
  }
  let responderDonorId: string | null = null;
  if (actor?.donorId) {
    const [resp] = await executor
      .select({ donorId: requestResponses.donorId, status: requestResponses.status })
      .from(requestResponses)
      .where(and(eq(requestResponses.requestId, request.id), eq(requestResponses.donorId, actor.donorId)));
    if (resp && resp.status !== 'withdrawn') responderDonorId = resp.donorId;
  }
  const responderMaySee = !!responderDonorId && request.sharePhoneWithResponders && request.contactPreference !== 'coordinator_only';
  return {
    isRequester,
    isAdmin: admin,
    coordinatorOf,
    responderDonorId,
    canSeeRequesterPhone: isRequester || admin || coordinatorOf.length > 0 || responderMaySee,
    canManage: isRequester || admin || coordinatorOf.length > 0,
  };
}

/** A request as a given viewer may see it. Returns null if it should not be visible at all. */
export async function getRequestForViewer(publicId: string, actor: Actor | null, manageToken?: string | null) {
  if (!/^[a-z0-9]{6,20}$/.test(publicId)) return null;
  const [request] = await db.select().from(bloodRequests).where(eq(bloodRequests.publicId, publicId));
  if (!request) return null;
  const access = await requestAccess(actor, request, manageToken);
  if (!request.showOnPublicBoard && !access.canManage && !access.responderDonorId) return null;
  // Requests saved before the Lakshmipur-only rule stay reachable for the people handling them only.
  const inServiceArea = request.districtId === (await getServiceArea()).districtId;
  if (!inServiceArea && !access.canManage && !access.responderDonorId) return null;
  const responses = await db
    .select({ id: requestResponses.id, status: requestResponses.status, message: requestResponses.message, createdAt: requestResponses.createdAt, donorPublicId: donorProfiles.publicId, donorName: donorProfiles.fullName, bloodGroup: donorProfiles.bloodGroup, donorUserId: donorProfiles.userId })
    .from(requestResponses)
    .innerJoin(donorProfiles, eq(donorProfiles.id, requestResponses.donorId))
    .where(eq(requestResponses.requestId, request.id))
    .orderBy(asc(requestResponses.createdAt));
  const counts = {
    offered: responses.filter((r) => r.status === 'offered').length,
    confirmed: responses.filter((r) => r.status === 'confirmed').length,
  };
  const [assigned] = request.assignedCommunityId
    ? await db.select({ id: communities.id, name: communities.name, slug: communities.slug }).from(communities).where(eq(communities.id, request.assignedCommunityId))
    : [];
  const history = access.canManage
    ? await db
        .select({ event: requestStatusEvents, actorName: users.displayName })
        .from(requestStatusEvents)
        .leftJoin(users, eq(users.id, requestStatusEvents.actorUserId))
        .where(eq(requestStatusEvents.requestId, request.id))
        .orderBy(asc(requestStatusEvents.createdAt))
    : [];
  const escalations = access.canManage
    ? await db
        .select({ id: requestEscalations.id, toName: communities.name, toSlug: communities.slug, createdAt: requestEscalations.createdAt })
        .from(requestEscalations)
        .innerJoin(communities, eq(communities.id, requestEscalations.toCommunityId))
        .where(eq(requestEscalations.requestId, request.id))
    : [];
  return {
    request: {
      id: request.id,
      publicId: request.publicId,
      bloodGroup: request.bloodGroup,
      units: request.units,
      divisionId: request.divisionId,
      districtId: request.districtId,
      upazilaId: request.upazilaId,
      hospitalName: request.hospitalName,
      neededAt: request.neededAt,
      urgency: request.urgency,
      status: effectiveStatus(request),
      createdAt: request.createdAt,
      contactPreference: request.contactPreference,
      sharePhoneWithResponders: request.sharePhoneWithResponders,
      showOnPublicBoard: request.showOnPublicBoard,
      inServiceArea,
      // Private fields:
      requesterName: access.canManage ? request.requesterName : null,
      requesterPhone: access.canSeeRequesterPhone ? request.requesterPhone : null,
      note: access.canManage ? request.note : null,
      assignedCoordinatorId: access.canManage ? request.assignedCoordinatorId : null,
    },
    access,
    assignedCommunity: assigned ?? null,
    counts,
    // Donor names in responses are only shown to people managing the request.
    responses: access.canManage ? responses : [],
    myResponse: actor?.donorId ? (responses.find((r) => r.donorUserId === actor.userId) ?? null) : null,
    history,
    escalations,
  };
}

export async function listPublicRequests(filters: { bloodGroup?: BloodGroup | null; divisionId?: number | null; districtId?: number | null; upazilaId?: number | null; page?: number }) {
  const conditions: SQL[] = [
    inArray(bloodRequests.status, OPEN_STATUSES),
    eq(bloodRequests.showOnPublicBoard, true),
    sql`${bloodRequests.expiresAt} > now()`,
    inServiceDistrict(bloodRequests.districtId),
  ];
  if (filters.bloodGroup) conditions.push(eq(bloodRequests.bloodGroup, filters.bloodGroup));
  if (filters.divisionId) conditions.push(eq(bloodRequests.divisionId, filters.divisionId));
  if (filters.districtId) conditions.push(eq(bloodRequests.districtId, filters.districtId));
  if (filters.upazilaId) conditions.push(eq(bloodRequests.upazilaId, filters.upazilaId));
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(bloodRequests).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select({
      publicId: bloodRequests.publicId,
      bloodGroup: bloodRequests.bloodGroup,
      units: bloodRequests.units,
      divisionId: bloodRequests.divisionId,
      districtId: bloodRequests.districtId,
      upazilaId: bloodRequests.upazilaId,
      hospitalName: bloodRequests.hospitalName,
      neededAt: bloodRequests.neededAt,
      urgency: bloodRequests.urgency,
      status: bloodRequests.status,
      createdAt: bloodRequests.createdAt,
    })
    .from(bloodRequests)
    .where(where)
    .orderBy(sql`case ${bloodRequests.urgency} when 'critical' then 0 when 'urgent' then 1 else 2 end`, asc(bloodRequests.neededAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { items: rows, total, page, pageCount };
}

async function loadRequest(executor: Executor, publicId: string, lock = false) {
  const q = executor.select().from(bloodRequests).where(eq(bloodRequests.publicId, publicId));
  const [request] = lock ? await q.for('update') : await q;
  if (!request) throw notFound();
  return request;
}

/** Donor offers to help. An offer is not an agreement to donate until someone confirms it with the donor. */
export async function respondToRequest(actor: Actor, publicId: string, message: string | null, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  if (!actor.donorId) throw new AppError('not_found', 'donor_profile_required');
  return db.transaction(async (tx) => {
    const request = await loadRequest(tx, publicId, true);
    if (!OPEN_STATUSES.includes(effectiveStatus(request))) throw new AppError('invalid_state');
    if (request.createdByUserId === actor.userId) throw forbidden();
    // Locked so an offer and a confirmation elsewhere cannot race past the booking checks.
    const [donor] = await tx.select().from(donorProfiles).where(eq(donorProfiles.id, actor.donorId!)).for('update');
    // Only approved, listed donors can offer to help; pending or hidden profiles stay private.
    if (!donor || donor.status !== 'active' || donor.registrationStatus !== 'approved') throw forbidden();
    // Both the request and the donor must be in Lakshmipur.
    const area = await getServiceArea(tx);
    if (request.districtId !== area.districtId || donor.districtId !== area.districtId) throw new AppError('invalid_state', 'outside_service_area');
    const [existing] = await tx.select().from(requestResponses).where(and(eq(requestResponses.requestId, request.id), eq(requestResponses.donorId, donor.id)));
    if (existing && existing.status !== 'withdrawn') throw new AppError('conflict', 'duplicate');
    await assertDonorCanBeBooked(tx, donor.id, request);
    if (existing) await tx.update(requestResponses).set({ status: 'offered', message, updatedAt: new Date() }).where(eq(requestResponses.id, existing.id));
    else await tx.insert(requestResponses).values({ requestId: request.id, donorId: donor.id, message });
    await statusEvent(tx, request.id, actor, 'response', request.status, request.status, 'offered');
    const recipients = new Set<string>(await coordinatorIds(tx, [request.assignedCommunityId, ...(await escalationTargets(tx, request.id))].filter((v): v is string => !!v)));
    if (request.createdByUserId) recipients.add(request.createdByUserId);
    recipients.delete(actor.userId);
    await createNotifications(
      tx,
      [...recipients].map((userId) => ({ userId, kind: 'request_response', data: { group: request.bloodGroup }, link: `/requests/${request.publicId}` }) as NewNotification),
    );
    await audit(tx, { actor, action: 'request.response_offered', targetType: 'request', targetId: request.id, ipHash: meta.ipHash });
  });
}

export async function withdrawResponse(actor: Actor, publicId: string, meta: ClientMeta = {}) {
  if (!actor.donorId) throw notFound();
  return db.transaction(async (tx) => {
    const request = await loadRequest(tx, publicId);
    const updated = await tx
      .update(requestResponses)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(and(eq(requestResponses.requestId, request.id), eq(requestResponses.donorId, actor.donorId!)))
      .returning({ id: requestResponses.id });
    if (updated.length === 0) throw notFound();
    await audit(tx, { actor, action: 'request.response_withdrawn', targetType: 'request', targetId: request.id, ipHash: meta.ipHash });
  });
}

/** Requester, coordinators or admins confirm (after talking to the donor) or decline an offer. */
/**
 * The checks before a donor is offered or confirmed for a request:
 * - their own donation records must not put their estimated next donation date after the day the
 *   blood is needed (an estimate only; the hospital still screens the donor), and
 * - they must not already be confirmed for another request that is still open.
 * Callers lock the donor row first so two confirmations cannot both pass.
 */
async function assertDonorCanBeBooked(executor: Executor, donorId: string, request: BloodRequest) {
  const settings = await getSettings(executor);
  const history = await executor
    .select({ donatedOn: donations.donatedOn, donationType: donations.donationType, status: donations.status })
    .from(donations)
    .where(eq(donations.donorId, donorId));
  const estimate = estimateNextEligible(history, settings.eligibilityIntervals, todayInBangladesh());
  if (estimate.state !== 'no_data' && compareDates(estimate.nextDate, todayInBangladesh(request.neededAt)) > 0) {
    throw new AppError('invalid_state', 'not_eligible_by_date');
  }
  const [other] = await executor
    .select({ id: requestResponses.id })
    .from(requestResponses)
    .innerJoin(bloodRequests, eq(bloodRequests.id, requestResponses.requestId))
    .where(
      and(
        eq(requestResponses.donorId, donorId),
        eq(requestResponses.status, 'confirmed'),
        sql`${bloodRequests.id} <> ${request.id}`,
        inArray(bloodRequests.status, OPEN_STATUSES),
        sql`${bloodRequests.expiresAt} > now()`,
      ),
    )
    .limit(1);
  if (other) throw new AppError('conflict', 'donor_already_booked');
}

export async function setResponseStatus(actor: Actor | null, publicId: string, responseId: string, status: 'confirmed' | 'declined', manageToken: string | null, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const request = await loadRequest(tx, publicId, true);
    const access = await requestAccess(actor, request, manageToken, tx);
    if (!access.canManage) throw forbidden();
    if (!OPEN_STATUSES.includes(effectiveStatus(request))) throw new AppError('invalid_state');
    const [response] = await tx
      .select()
      .from(requestResponses)
      .where(and(eq(requestResponses.id, responseId), eq(requestResponses.requestId, request.id), inArray(requestResponses.status, ['offered', 'confirmed', 'declined'])));
    if (!response) throw notFound();
    if (response.status === status) return;
    // One confirmation at a time per donor: lock the donor before checking other bookings.
    const [donor] = await tx.select().from(donorProfiles).where(eq(donorProfiles.id, response.donorId)).for('update');
    if (!donor) throw notFound();
    if (status === 'confirmed') await assertDonorCanBeBooked(tx, donor.id, request);
    await tx.update(requestResponses).set({ status, updatedAt: new Date() }).where(eq(requestResponses.id, response.id));
    await statusEvent(tx, request.id, actor, 'response', request.status, request.status, status);
    await createNotifications(tx, [
      {
        userId: donor.userId,
        kind: status === 'confirmed' ? 'response_confirmed' : 'response_declined',
        data: { group: request.bloodGroup, place: request.hospitalName, date: todayInBangladesh(request.neededAt) },
        link: `/requests/${request.publicId}`,
      } as NewNotification,
    ]);
    await audit(tx, { actor, action: `request.response_${status}`, targetType: 'request', targetId: request.id, ipHash: meta.ipHash });
  });
}

const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  open: ['in_progress', 'fulfilled', 'cancelled'],
  in_progress: ['open', 'fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
  expired: [],
};

export async function changeRequestStatus(actor: Actor | null, publicId: string, next: RequestStatus, reason: string | null, manageToken: string | null, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const request = await loadRequest(tx, publicId, true);
    const access = await requestAccess(actor, request, manageToken, tx);
    if (!access.canManage) throw forbidden();
    const current = effectiveStatus(request);
    // Requesters may only close their own request; status 'in_progress' is for coordinators.
    if (access.isRequester && !access.isAdmin && access.coordinatorOf.length === 0 && !['fulfilled', 'cancelled'].includes(next)) throw forbidden();
    if (!TRANSITIONS[current].includes(next)) throw new AppError('invalid_state');
    const closed = next === 'fulfilled' || next === 'cancelled';
    await tx
      .update(bloodRequests)
      .set({ status: next, statusReason: reason, closedAt: closed ? new Date() : null, updatedAt: new Date() })
      .where(eq(bloodRequests.id, request.id));
    await statusEvent(tx, request.id, actor, 'status', current, next, reason);
    if (request.createdByUserId && request.createdByUserId !== actor?.userId) {
      await createNotifications(tx, [{ userId: request.createdByUserId, kind: 'request_status_changed', data: { status: next }, link: `/requests/${request.publicId}` }]);
    }
    await audit(tx, { actor, action: 'request.status_changed', targetType: 'request', targetId: request.id, metadata: { from: current, to: next, byRequesterLink: !actor && !!manageToken }, ipHash: meta.ipHash });
  });
}

/**
 * A coordinator takes an unassigned request in their service area for their community,
 * or (re)assigns a coordinator inside a community already responsible. Admins can assign anywhere.
 */
export async function assignRequest(actor: Actor, publicId: string, communityId: string, coordinatorUserId: string | null, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const request = await loadRequest(tx, publicId, true);
    if (!OPEN_STATUSES.includes(effectiveStatus(request))) throw new AppError('invalid_state');
    const [community] = await tx.select().from(communities).where(eq(communities.id, communityId));
    if (!community || community.status !== 'approved') throw new AppError('invalid_state', 'community_not_approved');
    const [membership] = await tx
      .select()
      .from(communityMemberships)
      .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, actor.userId)));
    const caps = communityCapabilities(actor, membership ?? null, community.status);
    if (!caps.has('coordinate_requests')) throw forbidden();
    if (!isAdmin(actor)) {
      const escalated = (await escalationTargets(tx, request.id)).includes(communityId);
      if (request.assignedCommunityId && request.assignedCommunityId !== communityId && !escalated) throw forbidden();
      if (!request.assignedCommunityId && !escalated) {
        const area = await serviceAreaLocationIds(communityId, tx);
        const inArea = [request.divisionId, request.districtId, request.upazilaId].some((id) => id !== null && area.includes(id));
        if (!inArea) throw forbidden();
      }
    }
    if (coordinatorUserId) {
      const [target] = await tx
        .select()
        .from(communityMemberships)
        .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, coordinatorUserId), eq(communityMemberships.status, 'active'), inArray(communityMemberships.role, ['leader', 'coordinator'])));
      if (!target) throw validationError({ coordinatorUserId: 'invalid' });
    }
    const nextStatus: RequestStatus = request.status === 'open' ? 'in_progress' : request.status;
    await tx
      .update(bloodRequests)
      .set({ assignedCommunityId: communityId, assignedCoordinatorId: coordinatorUserId ?? actor.userId, status: nextStatus, updatedAt: new Date() })
      .where(eq(bloodRequests.id, request.id));
    await statusEvent(tx, request.id, actor, 'assigned', request.status, nextStatus, community.name);
    const notifyIds = [coordinatorUserId, request.createdByUserId].filter((v): v is string => !!v && v !== actor.userId);
    await createNotifications(
      tx,
      notifyIds.map((userId) =>
        userId === request.createdByUserId
          ? ({ userId, kind: 'request_status_changed', data: { status: nextStatus }, link: `/requests/${request.publicId}` } as NewNotification)
          : ({ userId, kind: 'request_assigned', data: { group: request.bloodGroup, place: request.hospitalName }, link: `/manage/${community.slug}/requests/${request.publicId}` } as NewNotification),
      ),
    );
    await audit(tx, { actor, action: 'request.assigned', targetType: 'request', targetId: request.id, communityId, ipHash: meta.ipHash });
  });
}

/** Pass a request to another approved community. The request stays visible to both. */
export async function escalateRequest(actor: Actor, publicId: string, toCommunityId: string, note: string | null, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const request = await loadRequest(tx, publicId, true);
    if (!OPEN_STATUSES.includes(effectiveStatus(request))) throw new AppError('invalid_state');
    const access = await requestAccess(actor, request, null, tx);
    if (!access.isAdmin && access.coordinatorOf.length === 0) throw forbidden();
    const [target] = await tx.select().from(communities).where(eq(communities.id, toCommunityId));
    if (!target || target.status !== 'approved') throw validationError({ toCommunityId: 'invalid' });
    if (request.assignedCommunityId === toCommunityId || access.coordinatorOf.includes(toCommunityId)) throw validationError({ toCommunityId: 'invalid' });
    try {
      await tx.insert(requestEscalations).values({
        requestId: request.id,
        fromCommunityId: access.coordinatorOf[0] ?? request.assignedCommunityId,
        toCommunityId,
        escalatedByUserId: actor.userId,
        note,
      });
    } catch (error) {
      if (isUniqueViolation(error, 'request_escalations_key')) throw new AppError('conflict', 'duplicate');
      throw error;
    }
    await statusEvent(tx, request.id, actor, 'escalated', request.status, request.status, target.name);
    const recipients = await coordinatorIds(tx, [toCommunityId]);
    await createNotifications(
      tx,
      recipients.map((userId) => ({ userId, kind: 'request_escalated', data: { group: request.bloodGroup, place: request.hospitalName }, link: `/manage/${target.slug}/requests/${request.publicId}` }) as NewNotification),
    );
    await audit(tx, { actor, action: 'request.escalated', targetType: 'request', targetId: request.id, communityId: toCommunityId, ipHash: meta.ipHash });
  });
}

/**
 * Requests a community should see: assigned to it, escalated to it, or unassigned open requests
 * inside its service area that it can take.
 */
export async function communityRequestQueue(
  actor: Actor,
  communityId: string,
  filters: { scope?: 'mine' | 'available' | 'closed'; bloodGroup?: BloodGroup | null; urgency?: Urgency | null; page?: number },
) {
  const [community] = await db.select().from(communities).where(eq(communities.id, communityId));
  if (!community) throw notFound();
  const [membership] = await db
    .select()
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, actor.userId)));
  if (!communityCapabilities(actor, membership ?? null, community.status).has('coordinate_requests')) throw forbidden();
  const escalatedHere = sql`exists (select 1 from request_escalations e where e.request_id = ${bloodRequests.id} and e.to_community_id = ${communityId})`;
  const conditions: SQL[] = [];
  const scope = filters.scope ?? 'mine';
  if (scope === 'available') {
    const area = await serviceAreaLocationIds(communityId);
    if (area.length === 0) return { items: [], total: 0, page: 1, pageCount: 1 };
    conditions.push(
      inServiceDistrict(bloodRequests.districtId),
      sql`${bloodRequests.assignedCommunityId} is null`,
      inArray(bloodRequests.status, OPEN_STATUSES),
      sql`${bloodRequests.expiresAt} > now()`,
      or(inArray(bloodRequests.districtId, area), inArray(bloodRequests.upazilaId, area), inArray(bloodRequests.divisionId, area))!,
    );
  } else {
    conditions.push(or(eq(bloodRequests.assignedCommunityId, communityId), escalatedHere)!);
    if (scope === 'mine') conditions.push(inArray(bloodRequests.status, OPEN_STATUSES), sql`${bloodRequests.expiresAt} > now()`);
    else conditions.push(or(sql`${bloodRequests.status} not in ('open', 'in_progress')`, sql`${bloodRequests.expiresAt} <= now()`)!);
  }
  if (filters.bloodGroup) conditions.push(eq(bloodRequests.bloodGroup, filters.bloodGroup));
  if (filters.urgency) conditions.push(eq(bloodRequests.urgency, filters.urgency));
  const where = and(...conditions);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(bloodRequests).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const items = await db
    .select()
    .from(bloodRequests)
    .where(where)
    .orderBy(sql`case ${bloodRequests.urgency} when 'critical' then 0 when 'urgent' then 1 else 2 end`, asc(bloodRequests.neededAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { items: items.map((r) => ({ ...r, status: effectiveStatus(r) })), total, page, pageCount };
}

/** Admin oversight list with filters. */
export async function adminListRequests(actor: Actor, filters: { status?: RequestStatus | null; bloodGroup?: BloodGroup | null; districtId?: number | null; page?: number }) {
  if (!can(actor, 'requests.view')) throw forbidden();
  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(bloodRequests.status, filters.status));
  if (filters.bloodGroup) conditions.push(eq(bloodRequests.bloodGroup, filters.bloodGroup));
  if (filters.districtId) conditions.push(eq(bloodRequests.districtId, filters.districtId));
  const where = conditions.length ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(bloodRequests).where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const items = await db
    .select({ request: bloodRequests, communityName: communities.name })
    .from(bloodRequests)
    .leftJoin(communities, eq(communities.id, bloodRequests.assignedCommunityId))
    .where(where)
    .orderBy(desc(bloodRequests.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { items: items.map((r) => ({ ...r, status: effectiveStatus(r.request) })), total, page, pageCount };
}

/** Requests created by a signed-in user. */
export async function myRequests(actor: Actor) {
  const rows = await db.select().from(bloodRequests).where(eq(bloodRequests.createdByUserId, actor.userId)).orderBy(desc(bloodRequests.createdAt)).limit(50);
  return rows.map((r) => ({ ...r, status: effectiveStatus(r) }));
}

/** Requests a donor has offered to help with. */
export async function myResponses(actor: Actor) {
  if (!actor.donorId) return [];
  return db
    .select({ response: requestResponses, request: bloodRequests })
    .from(requestResponses)
    .innerJoin(bloodRequests, eq(bloodRequests.id, requestResponses.requestId))
    .where(eq(requestResponses.donorId, actor.donorId))
    .orderBy(desc(requestResponses.createdAt))
    .limit(50);
}

/** Marks overdue requests and contact requests as expired. Run from cron (npm run maintenance) or admin. */
export async function expireStale(now = new Date()) {
  return db.transaction(async (tx) => {
    const stale = await tx
      .update(bloodRequests)
      .set({ status: 'expired', closedAt: now, updatedAt: now })
      .where(and(inArray(bloodRequests.status, OPEN_STATUSES), lt(bloodRequests.expiresAt, now)))
      .returning({ id: bloodRequests.id, status: bloodRequests.status });
    if (stale.length) {
      await tx.insert(requestStatusEvents).values(stale.map((r) => ({ requestId: r.id, actorUserId: null, action: 'status', fromStatus: null, toStatus: 'expired' as const, note: 'automatic expiry' })));
    }
    const contacts = await tx
      .update(contactRequests)
      .set({ status: 'expired' })
      .where(and(eq(contactRequests.status, 'pending'), lt(contactRequests.expiresAt, now)))
      .returning({ id: contactRequests.id });
    return { requests: stale.length, contactRequests: contacts.length };
  });
}

/**
 * What to offer when no suitable donor is found: counts of listed donors in wider areas
 * (upazila → district → division → whole country) and approved communities serving the area.
 * Geographic neighbours are approximated by the administrative hierarchy.
 */
export async function noDonorFallback(input: { bloodGroup?: BloodGroup | null; divisionId?: number | null; districtId?: number | null; upazilaId?: number | null }) {
  const levels: { level: 'upazila' | 'district'; filter: Parameters<typeof countListedDonors>[0] }[] = [];
  if (input.upazilaId) levels.push({ level: 'upazila', filter: { bloodGroup: input.bloodGroup, upazilaId: input.upazilaId } });
  // Donors are listed in Lakshmipur only, so the widest search is the whole district.
  levels.push({ level: 'district', filter: { bloodGroup: input.bloodGroup } });
  const wider = await Promise.all(
    levels.map(async (l) => ({ level: l.level, total: await countListedDonors(l.filter), available: await countListedDonors({ ...l.filter, availableOnly: true }) })),
  );
  const serving = await communitiesServingArea(input);
  return { wider, communities: serving };
}

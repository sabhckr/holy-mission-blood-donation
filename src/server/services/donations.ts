import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { communities, communityMemberships, donationEvents, donations, donorProfiles, users } from '../db/schema';
import type { DonationType } from '../domain/constants';
import { compareDates, todayInBangladesh } from '../domain/dates';
import { AppError, forbidden, isUniqueViolation, notFound, validationError } from '../errors';
import { canVerifyRecord, communityCapabilities, isAdmin, type Actor, type CommunityCapability } from '../policy';
import type { ClientMeta } from './accounts';
import { audit } from './audit';
import { createNotifications } from './notifications';

export interface DonationInput {
  donatedOn: string;
  donationType: DonationType;
  place: string | null;
  note: string | null;
}

type DonationRow = typeof donations.$inferSelect;

async function loadDonor(executor: Executor, donorId: string) {
  const [donor] = await executor.select().from(donorProfiles).where(eq(donorProfiles.id, donorId));
  if (!donor) throw notFound();
  return donor;
}

function validateDates(input: DonationInput, dateOfBirth: string) {
  const today = todayInBangladesh();
  if (compareDates(input.donatedOn, today) > 0) throw validationError({ donatedOn: 'futureDate' });
  if (compareDates(input.donatedOn, dateOfBirth) <= 0) throw validationError({ donatedOn: 'beforeBirth' });
}

async function insertEvent(
  executor: Executor,
  donationId: string,
  actor: Actor | null,
  action: string,
  fromStatus: DonationRow['status'] | null,
  toStatus: DonationRow['status'],
  note: string | null = null,
) {
  await executor.insert(donationEvents).values({ donationId, actorUserId: actor?.userId ?? null, action, fromStatus, toStatus, note });
}

/** Capabilities of `actor` in `communityId`, plus whether `donorUserId` is an active member there. */
async function reviewContext(executor: Executor, actor: Actor, communityId: string | null, donorUserId: string) {
  if (!communityId) return { caps: new Set<CommunityCapability>(), donorIsActiveMember: false, community: null };
  const [community] = await executor.select().from(communities).where(eq(communities.id, communityId));
  if (!community) return { caps: new Set<CommunityCapability>(), donorIsActiveMember: false, community: null };
  const memberships = await executor
    .select()
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), inArray(communityMemberships.userId, [actor.userId, donorUserId])));
  const reviewer = memberships.find((m) => m.userId === actor.userId) ?? null;
  const donorMembership = memberships.find((m) => m.userId === donorUserId) ?? null;
  return {
    caps: communityCapabilities(actor, reviewer, community.status),
    donorIsActiveMember: donorMembership?.status === 'active',
    community,
  };
}

async function assertCanSubmitTo(executor: Executor, communityId: string, donorUserId: string) {
  const [community] = await executor.select().from(communities).where(eq(communities.id, communityId));
  if (!community || community.status !== 'approved') throw new AppError('invalid_state', 'community_not_approved');
  const [m] = await executor
    .select()
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, donorUserId)));
  if (!m || m.status !== 'active') throw new AppError('forbidden', 'not_member');
}

/** Donor records their own donation (self-reported). Optionally asks a community to verify it. */
export async function addOwnDonation(actor: Actor, input: DonationInput, reviewCommunityId: string | null, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  if (!actor.donorId) throw new AppError('not_found', 'donor_profile_required');
  try {
    return await db.transaction(async (tx) => {
      const donor = await loadDonor(tx, actor.donorId!);
      if (donor.userId !== actor.userId) throw forbidden();
      validateDates(input, donor.dateOfBirth);
      if (reviewCommunityId) await assertCanSubmitTo(tx, reviewCommunityId, actor.userId);
      const status = reviewCommunityId ? ('pending' as const) : ('unverified' as const);
      const [record] = await tx
        .insert(donations)
        .values({ donorId: donor.id, ...input, source: 'self_reported', status, reviewCommunityId, createdByUserId: actor.userId })
        .returning();
      await insertEvent(tx, record.id, actor, 'created', null, 'unverified');
      if (reviewCommunityId) await insertEvent(tx, record.id, actor, 'submitted', 'unverified', 'pending');
      await audit(tx, { actor, action: 'donation.created', targetType: 'donation', targetId: record.id, communityId: reviewCommunityId, metadata: { type: input.donationType, submitted: !!reviewCommunityId }, ipHash: meta.ipHash });
      return record;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'donations_no_duplicates')) throw validationError({ donatedOn: 'duplicateDonation' });
    throw error;
  }
}

/** Sends an unverified (or previously rejected) own record to a community for verification. */
export async function submitDonationForReview(actor: Actor, donationId: string, communityId: string, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(donations).where(eq(donations.id, donationId)).for('update');
    if (!record) throw notFound();
    const donor = await loadDonor(tx, record.donorId);
    if (donor.userId !== actor.userId) throw notFound(); // do not reveal other people's records
    if (record.status !== 'unverified' && record.status !== 'rejected') throw new AppError('invalid_state');
    await assertCanSubmitTo(tx, communityId, actor.userId);
    await tx.update(donations).set({ status: 'pending', reviewCommunityId: communityId, reviewNote: null, updatedAt: new Date() }).where(eq(donations.id, record.id));
    await insertEvent(tx, record.id, actor, 'submitted', record.status, 'pending');
    await audit(tx, { actor, action: 'donation.submitted', targetType: 'donation', targetId: record.id, communityId, ipHash: meta.ipHash });
  });
}

/**
 * Verify or reject a record. Allowed for platform admins, and for leaders/coordinators of the
 * community the record was submitted to while the donor is still an active member there.
 * Nobody can review their own record.
 */
export async function reviewDonation(actor: Actor, donationId: string, decision: 'verified' | 'rejected', note: string | null, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(donations).where(eq(donations.id, donationId)).for('update');
    if (!record) throw notFound();
    const donor = await loadDonor(tx, record.donorId);
    if (donor.userId === actor.userId) throw new AppError('forbidden', 'self_verification');
    const ctx = await reviewContext(tx, actor, record.reviewCommunityId, donor.userId);
    if (!canVerifyRecord(actor, { donorUserId: donor.userId, reviewerCapabilities: ctx.caps, donorIsActiveMember: ctx.donorIsActiveMember })) throw forbidden();
    const allowedFrom: DonationRow['status'][] = isAdmin(actor) ? ['pending', 'unverified'] : ['pending'];
    if (!allowedFrom.includes(record.status)) throw new AppError('invalid_state');
    await tx
      .update(donations)
      .set({
        status: decision,
        verifiedByUserId: decision === 'verified' ? actor.userId : null,
        verifiedAt: decision === 'verified' ? new Date() : null,
        reviewNote: note,
        updatedAt: new Date(),
      })
      .where(eq(donations.id, record.id));
    await insertEvent(tx, record.id, actor, decision, record.status, decision, note);
    await createNotifications(tx, [
      { userId: donor.userId, kind: decision === 'verified' ? 'donation_verified' : 'donation_rejected', data: { date: record.donatedOn }, link: '/account/donations' },
    ]);
    await audit(tx, { actor, action: `donation.${decision}`, targetType: 'donation', targetId: record.id, communityId: record.reviewCommunityId, ipHash: meta.ipHash });
  });
}

/**
 * Withdraw a record. Records are never deleted: the row stays with status 'voided' and a reason,
 * so the history remains complete. Donors can void their own records; admins can void any.
 */
export async function voidDonation(actor: Actor, donationId: string, reason: string, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  return db.transaction(async (tx) => {
    const [record] = await tx.select().from(donations).where(eq(donations.id, donationId)).for('update');
    if (!record) throw notFound();
    const donor = await loadDonor(tx, record.donorId);
    if (donor.userId !== actor.userId && !isAdmin(actor)) throw notFound();
    if (record.status === 'voided') throw new AppError('invalid_state');
    await tx.update(donations).set({ status: 'voided', voidedReason: reason, updatedAt: new Date() }).where(eq(donations.id, record.id));
    await insertEvent(tx, record.id, actor, 'voided', record.status, 'voided', reason);
    await audit(tx, { actor, action: 'donation.voided', targetType: 'donation', targetId: record.id, metadata: { previousStatus: record.status }, ipHash: meta.ipHash });
  });
}

/** Correct a record: the original is voided (kept in history) and a new linked record is created. */
export async function correctDonation(actor: Actor, donationId: string, input: DonationInput, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  try {
    return await db.transaction(async (tx) => {
      const [record] = await tx.select().from(donations).where(eq(donations.id, donationId)).for('update');
      if (!record) throw notFound();
      const donor = await loadDonor(tx, record.donorId);
      if (donor.userId !== actor.userId) throw notFound();
      if (record.status === 'voided') throw new AppError('invalid_state');
      validateDates(input, donor.dateOfBirth);
      await tx.update(donations).set({ status: 'voided', voidedReason: 'corrected', updatedAt: new Date() }).where(eq(donations.id, record.id));
      await insertEvent(tx, record.id, actor, 'corrected', record.status, 'voided');
      const [replacement] = await tx
        .insert(donations)
        .values({ donorId: donor.id, ...input, source: 'self_reported', status: 'unverified', correctsDonationId: record.id, createdByUserId: actor.userId })
        .returning();
      await insertEvent(tx, replacement.id, actor, 'created', null, 'unverified', 'correction');
      await audit(tx, { actor, action: 'donation.corrected', targetType: 'donation', targetId: replacement.id, metadata: { original: record.id }, ipHash: meta.ipHash });
      return replacement;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'donations_no_duplicates')) throw validationError({ donatedOn: 'duplicateDonation' });
    throw error;
  }
}

/**
 * A coordinator records a donation they witnessed (for example at a blood camp) for an active
 * member. It is stored as verified by that coordinator — unless the coordinator is the donor,
 * in which case it stays pending for someone else to review.
 */
export async function recordDonationForMember(actor: Actor, communityId: string, donorId: string, input: DonationInput, meta: ClientMeta = {}) {
  try {
    return await db.transaction(async (tx) => {
      const donor = await loadDonor(tx, donorId);
      const ctx = await reviewContext(tx, actor, communityId, donor.userId);
      if (!ctx.caps.has('verify_records') || !ctx.donorIsActiveMember) throw forbidden();
      validateDates(input, donor.dateOfBirth);
      const self = donor.userId === actor.userId;
      const status = self ? ('pending' as const) : ('verified' as const);
      const [record] = await tx
        .insert(donations)
        .values({
          donorId: donor.id,
          ...input,
          source: isAdmin(actor) && !ctx.community ? 'admin' : 'community',
          status,
          reviewCommunityId: communityId,
          verifiedByUserId: self ? null : actor.userId,
          verifiedAt: self ? null : new Date(),
          createdByUserId: actor.userId,
        })
        .returning();
      await insertEvent(tx, record.id, actor, 'created', null, status, 'recorded by community');
      if (!self) await createNotifications(tx, [{ userId: donor.userId, kind: 'donation_verified', data: { date: record.donatedOn }, link: '/account/donations' }]);
      await audit(tx, { actor, action: 'donation.recorded_by_community', targetType: 'donation', targetId: record.id, communityId, ipHash: meta.ipHash });
      return record;
    });
  } catch (error) {
    if (isUniqueViolation(error, 'donations_no_duplicates')) throw validationError({ donatedOn: 'duplicateDonation' });
    throw error;
  }
}

export async function listOwnDonations(actor: Actor) {
  if (!actor.donorId) return [];
  return db
    .select({
      donation: donations,
      reviewCommunityName: communities.name,
      reviewCommunitySlug: communities.slug,
    })
    .from(donations)
    .leftJoin(communities, eq(communities.id, donations.reviewCommunityId))
    .where(eq(donations.donorId, actor.donorId))
    .orderBy(desc(donations.donatedOn), desc(donations.createdAt));
}

/** Audit trail for one record; visible to the donor, the reviewing community's coordinators, and admins. */
export async function donationTrail(actor: Actor, donationId: string) {
  const [record] = await db.select().from(donations).where(eq(donations.id, donationId));
  if (!record) throw notFound();
  const donor = await loadDonor(db, record.donorId);
  if (donor.userId !== actor.userId && !isAdmin(actor)) {
    const ctx = await reviewContext(db, actor, record.reviewCommunityId, donor.userId);
    if (!ctx.caps.has('verify_records')) throw notFound();
  }
  return db
    .select({ event: donationEvents, actorName: users.displayName })
    .from(donationEvents)
    .leftJoin(users, eq(users.id, donationEvents.actorUserId))
    .where(eq(donationEvents.donationId, donationId))
    .orderBy(asc(donationEvents.createdAt));
}

/** Records waiting for a community's review (the caller must check 'verify_records'). */
export async function pendingDonationReviews(communityId: string | null) {
  const where = communityId ? and(eq(donations.status, 'pending'), eq(donations.reviewCommunityId, communityId)) : eq(donations.status, 'pending');
  return db
    .select({
      id: donations.id,
      donatedOn: donations.donatedOn,
      donationType: donations.donationType,
      place: donations.place,
      note: donations.note,
      createdAt: donations.createdAt,
      donorId: donorProfiles.id,
      donorUserId: donorProfiles.userId,
      donorName: donorProfiles.fullName,
      donorPublicId: donorProfiles.publicId,
      bloodGroup: donorProfiles.bloodGroup,
      communityName: communities.name,
    })
    .from(donations)
    .innerJoin(donorProfiles, eq(donorProfiles.id, donations.donorId))
    .leftJoin(communities, eq(communities.id, donations.reviewCommunityId))
    .where(where)
    .orderBy(asc(donations.createdAt))
    .limit(200);
}

export async function donationTotals() {
  const [row] = await db
    .select({
      verified: sql<number>`count(*) filter (where ${donations.status} = 'verified')::int`,
      selfReported: sql<number>`count(*) filter (where ${donations.status} in ('unverified', 'pending'))::int`,
      pending: sql<number>`count(*) filter (where ${donations.status} = 'pending')::int`,
    })
    .from(donations);
  return row;
}

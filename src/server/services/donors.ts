import { and, asc, desc, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import {
  availabilityUpdates,
  communities,
  communityMemberships,
  donationEvents,
  donations,
  donorConsents,
  donorProfiles,
  users,
  verificationEvents,
} from '../db/schema';
import { availabilityExpiry, availabilityState, type AvailabilityState } from '../domain/availability';
import { PAGE_SIZE, PRIVACY_POLICY_VERSION, type BloodGroup, type ContactMethod, type DonationType, type Visibility } from '../domain/constants';
import { ageOn, compareDates, todayInBangladesh } from '../domain/dates';
import { projectDonor, type DonorConsentsView, type DonorFacts, type DonorView } from '../domain/donor-view';
import { estimateNextEligible } from '../domain/eligibility';
import { nameKey, randomPublicId } from '../domain/ids';
import { AppError, conflict, forbidden, notFound, validationError } from '../errors';
import { can, canVerifyRecord, communityCapabilities, publicViewerLevel, type Actor } from '../policy';
import { audit } from './audit';
import { createAccount, toActor, type ClientMeta, type NewAccount } from './accounts';
import { validateLocationChain } from './locations';
import { inServiceDistrict, inServiceDistrictFlag, serviceAreaErrors } from './service-area';
import { createNotifications } from './notifications';
import { getSettings } from './settings';

export interface DonorProfileInput {
  fullName: string;
  dateOfBirth: string;
  bloodGroup: BloodGroup;
  divisionId: number;
  districtId: number;
  upazilaId: number | null;
  locality: string | null;
  contactPhone: string;
  preferredContactMethod: ContactMethod;
}

export interface ConsentInput {
  listedInSearch: boolean;
  nameVisibility: Visibility;
  phoneVisibility: Exclude<Visibility, 'public'>;
  localityVisibility: Visibility;
  donationHistoryVisibility: Visibility;
  communityVisibility: Visibility;
  allowCoordinatorContact: boolean;
  allowContactRequests: boolean;
}

export interface DonorRegistrationInput {
  account: NewAccount;
  profile: DonorProfileInput;
  consents: ConsentInput;
  availableNow: boolean;
  lastDonation: { date: string; type: DonationType } | null;
}

export async function validateDonorProfile(input: DonorProfileInput, executor: Executor): Promise<void> {
  const settings = await getSettings(executor);
  const today = todayInBangladesh();
  const errors: Record<string, string> = {};
  if (compareDates(input.dateOfBirth, today) > 0) errors.dateOfBirth = 'futureDate';
  else {
    const age = ageOn(input.dateOfBirth, today);
    if (age < settings.minimumDonorAge) errors.dateOfBirth = 'tooYoung';
    else if (age > 100) errors.dateOfBirth = 'tooOld';
  }
  const locationErrors = await validateLocationChain(input, executor);
  Object.assign(errors, Object.keys(locationErrors).length ? locationErrors : await serviceAreaErrors(input, executor));
  if (Object.keys(errors).length) throw validationError(errors);
}

async function insertProfile(executor: Executor, userId: string, profile: DonorProfileInput, consents: ConsentInput) {
  const [donor] = await executor
    .insert(donorProfiles)
    .values({
      userId,
      publicId: randomPublicId(),
      fullName: profile.fullName,
      nameKey: nameKey(profile.fullName),
      dateOfBirth: profile.dateOfBirth,
      bloodGroup: profile.bloodGroup,
      divisionId: profile.divisionId,
      districtId: profile.districtId,
      upazilaId: profile.upazilaId,
      locality: profile.locality,
      contactPhone: profile.contactPhone,
      preferredContactMethod: profile.preferredContactMethod,
    })
    .returning();
  await executor.insert(donorConsents).values({ donorId: donor.id, ...consents, policyVersion: PRIVACY_POLICY_VERSION });
  return donor;
}

/**
 * Records an availability statement in the history table and updates the profile's current
 * value. `by` distinguishes the donor's own statement from a staff override (which must carry
 * a reason); 'unknown' clears the current value.
 */
export async function recordAvailability(
  executor: Executor,
  donorId: string,
  status: 'available' | 'unavailable' | 'unknown',
  expiryDays: number,
  options: { note?: string | null; by?: { source: 'donor' | 'staff'; userId: string | null; reason?: string | null } } = {},
) {
  const [current] = await executor
    .select({ status: donorProfiles.availabilityStatus, expiresAt: donorProfiles.availabilityExpiresAt })
    .from(donorProfiles)
    .where(eq(donorProfiles.id, donorId));
  const previous = !current?.status ? 'unknown' : current.status === 'available' && current.expiresAt && current.expiresAt <= new Date() ? 'unknown' : current.status;
  const confirmedAt = new Date();
  const expiresAt = status === 'available' ? availabilityExpiry(confirmedAt, expiryDays) : null;
  const source = options.by?.source ?? 'donor';
  await executor.insert(availabilityUpdates).values({
    donorId,
    status,
    confirmedAt,
    expiresAt,
    note: options.note ?? null,
    source,
    setByUserId: options.by?.userId ?? null,
    previousStatus: previous,
    reason: options.by?.reason ?? null,
  });
  await executor
    .update(donorProfiles)
    .set({
      availabilityStatus: status === 'unknown' ? null : status,
      availabilityConfirmedAt: status === 'unknown' ? null : confirmedAt,
      availabilityExpiresAt: expiresAt,
      availabilitySource: status === 'unknown' ? null : source,
      updatedAt: new Date(),
    })
    .where(eq(donorProfiles.id, donorId));
  return { previous };
}

/** New account + donor profile + consents in one transaction. */
export async function registerDonor(input: DonorRegistrationInput, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    await validateDonorProfile(input.profile, tx);
    if (input.lastDonation) {
      const today = todayInBangladesh();
      if (compareDates(input.lastDonation.date, today) > 0) throw validationError({ lastDonationDate: 'futureDate' });
      if (compareDates(input.lastDonation.date, input.profile.dateOfBirth) <= 0) throw validationError({ lastDonationDate: 'beforeBirth' });
    }
    const user = await createAccount(tx, input.account);
    const donor = await insertProfile(tx, user.id, input.profile, input.consents);
    const actor = toActor(user, donor.id);
    const settings = await getSettings(tx);
    if (input.availableNow) await recordAvailability(tx, donor.id, 'available', settings.availabilityExpiryDays);
    if (input.lastDonation) {
      const [record] = await tx
        .insert(donations)
        .values({
          donorId: donor.id,
          donatedOn: input.lastDonation.date,
          donationType: input.lastDonation.type,
          source: 'self_reported',
          status: 'unverified',
          createdByUserId: user.id,
        })
        .returning();
      await tx.insert(donationEvents).values({ donationId: record.id, actorUserId: user.id, action: 'created', toStatus: 'unverified' });
    }
    await audit(tx, { actor, action: 'donor.registered', targetType: 'donor', targetId: donor.id, metadata: { listedInSearch: input.consents.listedInSearch }, ipHash: meta.ipHash });
    return { user, donor };
  });
}

/** Adds a donor profile to an existing account. */
export async function createDonorProfile(actor: Actor, profile: DonorProfileInput, consents: ConsentInput, availableNow: boolean, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  if (actor.donorId) throw conflict('donor_profile_exists');
  return db.transaction(async (tx) => {
    await validateDonorProfile(profile, tx);
    let donor;
    try {
      donor = await insertProfile(tx, actor.userId, profile, consents);
    } catch (error) {
      if ((error as { code?: string; cause?: { code?: string } })?.code === '23505' || (error as { cause?: { code?: string } })?.cause?.code === '23505') {
        throw conflict('donor_profile_exists');
      }
      throw error;
    }
    if (availableNow) await recordAvailability(tx, donor.id, 'available', (await getSettings(tx)).availabilityExpiryDays);
    await audit(tx, { actor, action: 'donor.registered', targetType: 'donor', targetId: donor.id, ipHash: meta.ipHash });
    return donor;
  });
}

async function requireOwnDonor(actor: Actor, executor: Executor = db) {
  if (!actor.donorId) throw new AppError('not_found', 'donor_profile_required');
  const [donor] = await executor.select().from(donorProfiles).where(eq(donorProfiles.id, actor.donorId));
  if (!donor || donor.userId !== actor.userId) throw new AppError('not_found', 'donor_profile_required');
  return donor;
}

/**
 * Updates the donor's own profile. Changing name, date of birth or blood group removes any
 * previous verification, because the verified facts no longer match.
 */
export async function updateDonorProfile(actor: Actor, input: DonorProfileInput, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  return db.transaction(async (tx) => {
    const current = await requireOwnDonor(actor, tx);
    await validateDonorProfile(input, tx);
    const identityChanged =
      current.fullName !== input.fullName || current.dateOfBirth !== input.dateOfBirth || current.bloodGroup !== input.bloodGroup;
    const resetVerification = identityChanged && current.verificationStatus !== 'unverified';
    // A rejected registration goes back to the review queue once the donor corrects it.
    const resubmitted = current.registrationStatus === 'rejected';
    await tx
      .update(donorProfiles)
      .set({
        ...(resubmitted ? { registrationStatus: 'pending' as const, registrationReviewedAt: null, registrationReviewedByUserId: null } : {}),
        fullName: input.fullName,
        nameKey: nameKey(input.fullName),
        dateOfBirth: input.dateOfBirth,
        bloodGroup: input.bloodGroup,
        divisionId: input.divisionId,
        districtId: input.districtId,
        upazilaId: input.upazilaId,
        locality: input.locality,
        contactPhone: input.contactPhone,
        preferredContactMethod: input.preferredContactMethod,
        ...(resetVerification ? { verificationStatus: 'unverified' as const, verifiedAt: null, verifiedByUserId: null, verificationCommunityId: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(donorProfiles.id, current.id));
    if (resetVerification) {
      await tx.insert(verificationEvents).values({
        donorId: current.id,
        actorUserId: actor.userId,
        fromStatus: current.verificationStatus,
        toStatus: 'unverified',
        note: 'identity details changed by donor',
      });
    }
    const changed = (
      [
        ['fullName', current.fullName !== input.fullName],
        ['dateOfBirth', current.dateOfBirth !== input.dateOfBirth],
        ['bloodGroup', current.bloodGroup !== input.bloodGroup],
        ['location', current.districtId !== input.districtId || current.upazilaId !== input.upazilaId || current.divisionId !== input.divisionId],
        ['locality', current.locality !== input.locality],
        ['contact', current.contactPhone !== input.contactPhone || current.preferredContactMethod !== input.preferredContactMethod],
      ] as const
    )
      .filter(([, c]) => c)
      .map(([k]) => k);
    await audit(tx, { actor, action: 'donor.profile_updated', targetType: 'donor', targetId: current.id, metadata: { changed, verificationReset: resetVerification, resubmitted }, ipHash: meta.ipHash });
    return { verificationReset: resetVerification, resubmitted };
  });
}

export async function updateConsents(actor: Actor, input: ConsentInput, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  if ((input.phoneVisibility as string) === 'public') throw validationError({ phoneVisibility: 'invalid' });
  return db.transaction(async (tx) => {
    const donor = await requireOwnDonor(actor, tx);
    const [before] = await tx.select().from(donorConsents).where(eq(donorConsents.donorId, donor.id));
    await tx
      .update(donorConsents)
      .set({ ...input, policyVersion: PRIVACY_POLICY_VERSION, consentedAt: new Date(), updatedAt: new Date() })
      .where(eq(donorConsents.donorId, donor.id));
    const changes = Object.fromEntries(
      Object.entries(input)
        .filter(([k, v]) => before?.[k as keyof typeof before] !== v)
        .map(([k, v]) => [k, { from: before?.[k as keyof typeof before] ?? null, to: v }]),
    );
    await audit(tx, { actor, action: 'donor.consent_updated', targetType: 'donor', targetId: donor.id, metadata: { changes }, ipHash: meta.ipHash });
  });
}

export async function setAvailability(actor: Actor, status: 'available' | 'unavailable', note: string | null = null, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  return db.transaction(async (tx) => {
    const donor = await requireOwnDonor(actor, tx);
    if (donor.status === 'restricted' || donor.status === 'removed') throw forbidden();
    const settings = await getSettings(tx);
    await recordAvailability(tx, donor.id, status, settings.availabilityExpiryDays, { note, by: { source: 'donor', userId: actor.userId } });
    await audit(tx, { actor, action: 'donor.availability_set', targetType: 'donor', targetId: donor.id, metadata: { status }, ipHash: meta.ipHash });
  });
}

/** Donor hides (paused) or shows (active) their listing without deleting anything. */
export async function setDonorListingPaused(actor: Actor, paused: boolean, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  return db.transaction(async (tx) => {
    const donor = await requireOwnDonor(actor, tx);
    // Staff decisions (deactivated or removed) cannot be undone by the donor.
    if (donor.status === 'restricted' || donor.status === 'removed') throw forbidden();
    await tx.update(donorProfiles).set({ status: paused ? 'paused' : 'active', updatedAt: new Date() }).where(eq(donorProfiles.id, donor.id));
    await audit(tx, { actor, action: paused ? 'donor.paused' : 'donor.resumed', targetType: 'donor', targetId: donor.id, ipHash: meta.ipHash });
  });
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

type DonorRow = typeof donorProfiles.$inferSelect;
type ConsentRow = typeof donorConsents.$inferSelect;

function consentsView(c: ConsentRow): DonorConsentsView {
  return {
    listedInSearch: c.listedInSearch,
    nameVisibility: c.nameVisibility,
    phoneVisibility: c.phoneVisibility,
    localityVisibility: c.localityVisibility,
    donationHistoryVisibility: c.donationHistoryVisibility,
    communityVisibility: c.communityVisibility,
    allowCoordinatorContact: c.allowCoordinatorContact,
    allowContactRequests: c.allowContactRequests,
  };
}

/**
 * The single definition of "publicly listed": the donor consented to be listed, staff approved
 * the registration, the listing and the account are active, and the donor's address is in
 * Lakshmipur. Search, public profiles, number reveals, counts and contact requests all use it.
 */
export function publiclyListedConditions(): SQL[] {
  return [
    eq(donorConsents.listedInSearch, true),
    eq(donorProfiles.registrationStatus, 'approved'),
    eq(donorProfiles.status, 'active'),
    eq(users.status, 'active'),
    inServiceDistrict(donorProfiles.districtId),
  ];
}

/** Select this as `inServiceArea` next to a donor row so `isPubliclyListed` can check the address. */
export const donorInServiceArea = () => inServiceDistrictFlag(donorProfiles.districtId);

export function isPubliclyListed(row: {
  donor: Pick<DonorRow, 'status' | 'registrationStatus'>;
  consent: Pick<ConsentRow, 'listedInSearch'>;
  accountStatus: string;
  inServiceArea: boolean;
}): boolean {
  return row.consent.listedInSearch && row.donor.registrationStatus === 'approved' && row.donor.status === 'active' && row.accountStatus === 'active' && row.inServiceArea;
}

/** Currently marked available (and not expired). */
export const availableNowCondition = () =>
  sql`${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now()`;

export function donorAvailability(donor: Pick<DonorRow, 'status' | 'availabilityStatus' | 'availabilityExpiresAt'>, accountStatus: typeof users.$inferSelect.status, now = new Date()): AvailabilityState {
  return availabilityState(
    { accountStatus, profileStatus: donor.status, availabilityStatus: donor.availabilityStatus, availabilityExpiresAt: donor.availabilityExpiresAt },
    now,
  );
}

export async function donationStatsFor(donorIds: string[], executor: Executor = db) {
  const map = new Map<string, { verifiedCount: number; reportedCount: number; lastDonation: string | null }>();
  if (donorIds.length === 0) return map;
  const rows = await executor
    .select({
      donorId: donations.donorId,
      verifiedCount: sql<number>`count(*) filter (where ${donations.status} = 'verified')::int`,
      reportedCount: sql<number>`count(*) filter (where ${donations.status} not in ('voided', 'rejected'))::int`,
      lastDonation: sql<string | null>`max(${donations.donatedOn}) filter (where ${donations.status} not in ('voided', 'rejected'))`,
    })
    .from(donations)
    .where(inArray(donations.donorId, donorIds))
    .groupBy(donations.donorId);
  for (const r of rows) map.set(r.donorId, { verifiedCount: r.verifiedCount, reportedCount: r.reportedCount, lastDonation: r.lastDonation });
  return map;
}

async function communitiesFor(userIds: string[], executor: Executor = db) {
  const map = new Map<string, { slug: string; name: string }[]>();
  if (userIds.length === 0) return map;
  const rows = await executor
    .select({ userId: communityMemberships.userId, slug: communities.slug, name: communities.name })
    .from(communityMemberships)
    .innerJoin(communities, eq(communities.id, communityMemberships.communityId))
    .where(and(inArray(communityMemberships.userId, userIds), eq(communityMemberships.status, 'active'), eq(communities.status, 'approved')));
  for (const r of rows) map.set(r.userId, [...(map.get(r.userId) ?? []), { slug: r.slug, name: r.name }]);
  return map;
}

function toFacts(row: DonorRow, consent: ConsentRow, accountStatus: typeof users.$inferSelect.status, extras: Pick<DonorFacts, 'stats' | 'communities'> = {}): DonorFacts {
  return {
    publicId: row.publicId,
    userId: row.userId,
    fullName: row.fullName,
    bloodGroup: row.bloodGroup,
    divisionId: row.divisionId,
    districtId: row.districtId,
    upazilaId: row.upazilaId,
    locality: row.locality,
    preferredContactMethod: row.preferredContactMethod,
    verificationStatus: row.verificationStatus,
    availability: donorAvailability(row, accountStatus),
    availabilityConfirmedAt: row.availabilityConfirmedAt,
    availabilitySource: row.availabilitySource,
    consents: consentsView(consent),
    ...extras,
  };
}

/**
 * Public profile. Hidden (null) unless the donor is listed in search and active — except for the
 * donor themself and platform admins.
 */
export async function getPublicDonorProfile(publicId: string, actor: Actor | null): Promise<DonorView | null> {
  if (!/^[a-z0-9]{6,20}$/.test(publicId)) return null;
  const [row] = await db
    .select({ donor: donorProfiles, consent: donorConsents, accountStatus: users.status, inServiceArea: donorInServiceArea() })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(eq(donorProfiles.publicId, publicId));
  if (!row) return null;
  const viewer = publicViewerLevel(actor, row.donor.userId);
  if (!isPubliclyListed(row) && viewer !== 'owner' && !can(actor, 'donors.manage')) return null;
  const stats = (await donationStatsFor([row.donor.id])).get(row.donor.id) ?? { verifiedCount: 0, reportedCount: 0, lastDonation: null };
  const comms = (await communitiesFor([row.donor.userId])).get(row.donor.userId) ?? [];
  return projectDonor(toFacts(row.donor, row.consent, row.accountStatus, { stats, communities: comms }), viewer);
}

export interface DonorSearchFilters {
  bloodGroup?: BloodGroup | null;
  divisionId?: number | null;
  districtId?: number | null;
  upazilaId?: number | null;
  locality?: string | null;
  verifiedOnly?: boolean;
  sort?: 'best' | 'recent' | 'newest';
  page?: number;
}

export interface DonorSearchResult {
  items: DonorView[];
  total: number;
  page: number;
  pageCount: number;
}

const visibleTo = (column: SQL | typeof donorConsents.localityVisibility, signedIn: boolean) =>
  signedIn ? sql`${column} in ('public', 'signed_in')` : sql`${column} = 'public'`;

/**
 * Public donor search: only publicly listed donors (consented, approved, active) who are
 * currently marked available. Donors whose availability is unknown or "not now" are left out.
 * Filtering by locality only matches donors whose locality is visible to this viewer, so the
 * filter cannot be used to discover hidden information.
 */
export async function searchDonors(filters: DonorSearchFilters, actor: Actor | null): Promise<DonorSearchResult> {
  const signedIn = !!actor && actor.status === 'active';
  const conditions: SQL[] = [...publiclyListedConditions(), availableNowCondition()];
  if (filters.bloodGroup) conditions.push(eq(donorProfiles.bloodGroup, filters.bloodGroup));
  if (filters.divisionId) conditions.push(eq(donorProfiles.divisionId, filters.divisionId));
  if (filters.districtId) conditions.push(eq(donorProfiles.districtId, filters.districtId));
  if (filters.upazilaId) conditions.push(eq(donorProfiles.upazilaId, filters.upazilaId));
  if (filters.locality) {
    const pattern = `%${filters.locality.normalize('NFC').replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(sql`${donorProfiles.locality} ilike ${pattern}`);
    conditions.push(visibleTo(donorConsents.localityVisibility, signedIn));
  }
  if (filters.verifiedOnly) conditions.push(eq(donorProfiles.verificationStatus, 'verified'));
  const where = and(...conditions);
  const verifiedFirst = sql`case when ${donorProfiles.verificationStatus} = 'verified' then 0 else 1 end`;
  const orderBy =
    filters.sort === 'newest'
      ? [desc(donorProfiles.createdAt)]
      : filters.sort === 'recent'
        ? [sql`${donorProfiles.availabilityConfirmedAt} desc nulls last`, desc(donorProfiles.createdAt)]
        : [verifiedFirst, sql`${donorProfiles.availabilityConfirmedAt} desc nulls last`, desc(donorProfiles.createdAt)];

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
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const stats = await donationStatsFor(rows.map((r) => r.donor.id));
  const items = rows.map((r) =>
    projectDonor(toFacts(r.donor, r.consent, r.accountStatus, { stats: stats.get(r.donor.id) ?? { verifiedCount: 0, reportedCount: 0, lastDonation: null } }), publicViewerLevel(actor, r.donor.userId)),
  );
  return { items, total, page, pageCount };
}

/** Count of publicly listed donors (optionally only those available now) in an area, for the no-donor fallback. */
export async function countListedDonors(filters: Pick<DonorSearchFilters, 'bloodGroup' | 'divisionId' | 'districtId' | 'upazilaId'> & { availableOnly?: boolean }): Promise<number> {
  const conditions: SQL[] = publiclyListedConditions();
  if (filters.bloodGroup) conditions.push(eq(donorProfiles.bloodGroup, filters.bloodGroup));
  if (filters.divisionId) conditions.push(eq(donorProfiles.divisionId, filters.divisionId));
  if (filters.districtId) conditions.push(eq(donorProfiles.districtId, filters.districtId));
  if (filters.upazilaId) conditions.push(eq(donorProfiles.upazilaId, filters.upazilaId));
  if (filters.availableOnly) conditions.push(availableNowCondition());
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(and(...conditions));
  return n;
}

/**
 * Reveals a donor's number to a signed-in viewer when the donor's consent allows it.
 * Every reveal is audit-logged; the caller must apply the phoneReveal rate limit.
 */
export async function revealDonorPhone(actor: Actor, publicId: string, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  const [row] = await db
    .select({ donor: donorProfiles, consent: donorConsents, accountStatus: users.status, inServiceArea: donorInServiceArea() })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(eq(donorProfiles.publicId, publicId));
  if (!row) throw notFound();
  const listed = isPubliclyListed(row);
  const view = projectDonor(toFacts(row.donor, row.consent, row.accountStatus), publicViewerLevel(actor, row.donor.userId));
  if (view.phoneAccess === 'owner') return { phone: row.donor.contactPhone, method: row.donor.preferredContactMethod };
  if (!listed || view.phoneAccess !== 'reveal') throw forbidden();
  await audit(db, { actor, action: 'donor.phone_revealed', targetType: 'donor', targetId: row.donor.id, metadata: { context: 'public_profile' }, ipHash: meta.ipHash });
  return { phone: row.donor.contactPhone, method: row.donor.preferredContactMethod };
}

/** Everything the donor's own dashboard needs. */
export async function getOwnDonorOverview(actor: Actor) {
  if (!actor.donorId) return null;
  const [row] = await db
    .select({ donor: donorProfiles, consent: donorConsents, accountStatus: users.status })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(and(eq(donorProfiles.id, actor.donorId), eq(donorProfiles.userId, actor.userId)));
  if (!row) return null;
  const settings = await getSettings();
  const history = await db
    .select()
    .from(donations)
    .where(eq(donations.donorId, row.donor.id))
    .orderBy(desc(donations.donatedOn), desc(donations.createdAt));
  const today = todayInBangladesh();
  const estimate = estimateNextEligible(history, settings.eligibilityIntervals, today);
  const stats = (await donationStatsFor([row.donor.id])).get(row.donor.id) ?? { verifiedCount: 0, reportedCount: 0, lastDonation: null };
  return {
    donor: row.donor,
    consents: row.consent,
    availability: donorAvailability(row.donor, row.accountStatus),
    history,
    estimate,
    stats,
    today,
    settings,
    age: ageOn(row.donor.dateOfBirth, today),
  };
}

export async function availabilityHistory(actor: Actor, limit = 20) {
  if (!actor.donorId) return [];
  return db
    .select()
    .from(availabilityUpdates)
    .where(eq(availabilityUpdates.donorId, actor.donorId))
    .orderBy(desc(availabilityUpdates.confirmedAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Profile verification
// ---------------------------------------------------------------------------

async function activeMembership(executor: Executor, communityId: string, userId: string) {
  const [m] = await executor
    .select()
    .from(communityMemberships)
    .where(and(eq(communityMemberships.communityId, communityId), eq(communityMemberships.userId, userId)));
  return m ?? null;
}

/** Donor asks an approved community they belong to to verify their profile. */
export async function requestProfileVerification(actor: Actor, communityId: string, meta: ClientMeta = {}) {
  if (actor.status !== 'active') throw forbidden();
  return db.transaction(async (tx) => {
    const donor = await requireOwnDonor(actor, tx);
    if (donor.verificationStatus === 'verified' || donor.verificationStatus === 'pending') throw new AppError('invalid_state');
    const [community] = await tx.select().from(communities).where(eq(communities.id, communityId));
    if (!community || community.status !== 'approved') throw new AppError('invalid_state', 'community_not_approved');
    const m = await activeMembership(tx, communityId, actor.userId);
    if (!m || m.status !== 'active') throw new AppError('forbidden', 'not_member');
    await tx
      .update(donorProfiles)
      .set({ verificationStatus: 'pending', verificationCommunityId: communityId, updatedAt: new Date() })
      .where(eq(donorProfiles.id, donor.id));
    await tx.insert(verificationEvents).values({ donorId: donor.id, actorUserId: actor.userId, communityId, fromStatus: donor.verificationStatus, toStatus: 'pending' });
    await audit(tx, { actor, action: 'donor.verification_requested', targetType: 'donor', targetId: donor.id, communityId, ipHash: meta.ipHash });
  });
}

/**
 * A coordinator/leader of the community the donor asked (and still belongs to), or a platform
 * admin, verifies or rejects a donor profile. Nobody can verify themself.
 */
export async function reviewProfileVerification(actor: Actor, donorId: string, decision: 'verified' | 'rejected', note: string | null, meta: ClientMeta = {}) {
  return db.transaction(async (tx) => {
    const [donor] = await tx.select().from(donorProfiles).where(eq(donorProfiles.id, donorId)).for('update');
    if (!donor) throw notFound();
    const communityId = donor.verificationCommunityId;
    let caps = new Set<ReturnType<typeof communityCapabilities> extends Set<infer C> ? C : never>();
    let donorIsActiveMember = false;
    if (communityId) {
      const [community] = await tx.select().from(communities).where(eq(communities.id, communityId));
      const reviewer = await activeMembership(tx, communityId, actor.userId);
      caps = communityCapabilities(actor, reviewer, community?.status ?? 'rejected');
      const donorMembership = await activeMembership(tx, communityId, donor.userId);
      donorIsActiveMember = donorMembership?.status === 'active';
    }
    if (actor.userId === donor.userId) throw new AppError('forbidden', 'self_verification');
    if (!canVerifyRecord(actor, { donorUserId: donor.userId, reviewerCapabilities: caps, donorIsActiveMember })) throw forbidden();
    if (!can(actor, 'verifications.review') && donor.verificationStatus !== 'pending') throw new AppError('invalid_state');
    await tx
      .update(donorProfiles)
      .set({
        verificationStatus: decision,
        verifiedByUserId: decision === 'verified' ? actor.userId : null,
        verifiedAt: decision === 'verified' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(donorProfiles.id, donor.id));
    await tx.insert(verificationEvents).values({ donorId: donor.id, actorUserId: actor.userId, communityId, fromStatus: donor.verificationStatus, toStatus: decision, note });
    if (decision === 'verified') await createNotifications(tx, [{ userId: donor.userId, kind: 'donor_verified', link: '/account' }]);
    await audit(tx, { actor, action: `donor.verification_${decision}`, targetType: 'donor', targetId: donor.id, communityId, ipHash: meta.ipHash });
  });
}

/** Pending profile verification requests addressed to a community. */
export async function pendingProfileVerifications(communityId: string) {
  return db
    .select({ donorId: donorProfiles.id, publicId: donorProfiles.publicId, fullName: donorProfiles.fullName, bloodGroup: donorProfiles.bloodGroup, districtId: donorProfiles.districtId, requestedAt: donorProfiles.updatedAt, userId: donorProfiles.userId })
    .from(donorProfiles)
    .where(and(eq(donorProfiles.verificationCommunityId, communityId), eq(donorProfiles.verificationStatus, 'pending')))
    .orderBy(asc(donorProfiles.updatedAt));
}

export async function verificationHistory(donorId: string) {
  return db.select().from(verificationEvents).where(eq(verificationEvents.donorId, donorId)).orderBy(desc(verificationEvents.createdAt));
}

/** Possible duplicates of a new registration (same name and date of birth). Used only for admin review. */
export async function findSimilarDonors(fullName: string, dateOfBirth: string, excludeDonorId?: string) {
  const conds: SQL[] = [eq(donorProfiles.nameKey, nameKey(fullName)), eq(donorProfiles.dateOfBirth, dateOfBirth)];
  if (excludeDonorId) conds.push(notInArray(donorProfiles.id, [excludeDonorId]));
  return db.select({ id: donorProfiles.id }).from(donorProfiles).where(and(...conds));
}

/**
 * Donor record management for platform staff (admins and moderators). Every function checks a
 * platform permission, refuses to act on the staff member's own donor record, and writes an
 * audit entry with the actor, previous and new values and the reason given.
 */
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { auditLogs, availabilityUpdates, donorConsents, donorProfiles, users, verificationEvents } from '../db/schema';
import { PAGE_SIZE, PRIVACY_POLICY_VERSION, type BloodGroup } from '../domain/constants';
import { nameKey, randomPublicId, randomToken } from '../domain/ids';
import { normalizeBdPhone } from '../domain/phone';
import { AppError, forbidden, notFound, validationError } from '../errors';
import { can, type Actor, type PlatformPermission } from '../policy';
import { hashPassword } from '../auth/password';
import { createAccount, type ClientMeta } from './accounts';
import { audit } from './audit';
import { donorAvailability, recordAvailability, type ConsentInput, type DonorProfileInput, validateDonorProfile } from './donors';
import { createNotifications } from './notifications';
import { getSettings } from './settings';
import { getServiceArea, inServiceDistrict, inServiceDistrictFlag } from './service-area';

type DonorRow = typeof donorProfiles.$inferSelect;

function requirePermission(actor: Actor, ...permissions: PlatformPermission[]) {
  if (!permissions.some((p) => can(actor, p))) throw forbidden();
}

async function loadDonor(executor: Executor, donorId: string, lock = false): Promise<DonorRow> {
  const q = executor.select().from(donorProfiles).where(eq(donorProfiles.id, donorId));
  const [row] = lock ? await q.for('update') : await q;
  if (!row) throw notFound();
  return row;
}

/** Staff never act on their own donor record through staff tools (no self-approval). */
function refuseSelf(actor: Actor, donor: DonorRow) {
  if (donor.userId === actor.userId) throw new AppError('forbidden', 'self_verification');
}

function requireReason(reason: string | null | undefined): string {
  const r = (reason ?? '').trim();
  if (!r) throw validationError({ reason: 'required' });
  return r;
}

// ---------------------------------------------------------------------------
// Listing and detail
// ---------------------------------------------------------------------------

export interface StaffDonorFilters {
  q?: string | null;
  registration?: 'pending' | 'approved' | 'rejected' | null;
  listing?: 'active' | 'paused' | 'restricted' | 'removed' | null;
  availability?: 'available' | 'unavailable' | 'unknown' | null;
  bloodGroup?: BloodGroup | null;
  districtId?: number | null;
  /** 'outside' lists records saved before the Lakshmipur-only rule, so staff can correct them. */
  area?: 'inside' | 'outside' | null;
  page?: number;
}

export async function listDonorsForStaff(actor: Actor, filters: StaffDonorFilters) {
  requirePermission(actor, 'donors.review', 'donors.manage');
  const conds: SQL[] = [];
  if (filters.q) {
    const phone = normalizeBdPhone(filters.q);
    const pattern = `%${filters.q.normalize('NFC').replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(
      phone
        ? or(eq(donorProfiles.contactPhone, phone), eq(users.phone, phone))!
        : or(ilike(donorProfiles.fullName, pattern), eq(donorProfiles.publicId, filters.q.trim().toLowerCase()))!,
    );
  }
  if (filters.registration) conds.push(eq(donorProfiles.registrationStatus, filters.registration));
  if (filters.listing) conds.push(eq(donorProfiles.status, filters.listing));
  if (filters.bloodGroup) conds.push(eq(donorProfiles.bloodGroup, filters.bloodGroup));
  if (filters.districtId) conds.push(eq(donorProfiles.districtId, filters.districtId));
  if (filters.area === 'inside') conds.push(inServiceDistrict(donorProfiles.districtId));
  if (filters.area === 'outside') conds.push(sql`not (${inServiceDistrict(donorProfiles.districtId)})`);
  if (filters.availability === 'available') conds.push(sql`${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now()`);
  if (filters.availability === 'unavailable') conds.push(eq(donorProfiles.availabilityStatus, 'unavailable'));
  if (filters.availability === 'unknown') {
    conds.push(sql`(${donorProfiles.availabilityStatus} is null or (${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} <= now()))`);
  }
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(donorProfiles)
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const rows = await db
    .select({ donor: donorProfiles, accountStatus: users.status, listed: donorConsents.listedInSearch, inServiceArea: inServiceDistrictFlag(donorProfiles.districtId) })
    .from(donorProfiles)
    .innerJoin(users, eq(users.id, donorProfiles.userId))
    .leftJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .where(where)
    .orderBy(sql`case ${donorProfiles.registrationStatus} when 'pending' then 0 else 1 end`, asc(donorProfiles.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return {
    items: rows.map((r) => ({
      id: r.donor.id,
      publicId: r.donor.publicId,
      fullName: r.donor.fullName,
      bloodGroup: r.donor.bloodGroup,
      divisionId: r.donor.divisionId,
      districtId: r.donor.districtId,
      upazilaId: r.donor.upazilaId,
      registrationStatus: r.donor.registrationStatus,
      listingStatus: r.donor.status,
      verificationStatus: r.donor.verificationStatus,
      availability: donorAvailability(r.donor, r.accountStatus),
      // Raw stated values, so staff pages can show availability separately from listing/account status.
      availabilityStatus: r.donor.availabilityStatus,
      availabilityExpiresAt: r.donor.availabilityExpiresAt,
      availabilitySource: r.donor.availabilitySource,
      availabilityConfirmedAt: r.donor.availabilityConfirmedAt,
      listedInSearch: r.listed ?? false,
      inServiceArea: r.inServiceArea,
      accountStatus: r.accountStatus,
      createdAt: r.donor.createdAt,
    })),
    total,
    page,
    pageCount,
  };
}

/** Full record for staff, including contact details; viewing it is audit-logged. */
export async function getDonorForStaff(actor: Actor, donorId: string, meta: ClientMeta = {}) {
  requirePermission(actor, 'donors.review', 'donors.manage');
  const donor = await loadDonor(db, donorId);
  const [account] = await db
    .select({ id: users.id, displayName: users.displayName, phone: users.phone, status: users.status, createdAt: users.createdAt, lastSignInAt: users.lastSignInAt })
    .from(users)
    .where(eq(users.id, donor.userId));
  const [consent] = await db.select().from(donorConsents).where(eq(donorConsents.donorId, donorId));
  const availabilityHistory = await db
    .select({ update: availabilityUpdates, setByName: users.displayName })
    .from(availabilityUpdates)
    .leftJoin(users, eq(users.id, availabilityUpdates.setByUserId))
    .where(eq(availabilityUpdates.donorId, donorId))
    .orderBy(desc(availabilityUpdates.confirmedAt))
    .limit(30);
  const verification = await db
    .select({ event: verificationEvents, actorName: users.displayName })
    .from(verificationEvents)
    .leftJoin(users, eq(users.id, verificationEvents.actorUserId))
    .where(eq(verificationEvents.donorId, donorId))
    .orderBy(desc(verificationEvents.createdAt));
  const history = await db
    .select({ log: auditLogs, actorName: users.displayName })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(eq(auditLogs.targetType, 'donor'), eq(auditLogs.targetId, donorId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  await audit(db, { actor, action: 'staff.donor_viewed', targetType: 'donor', targetId: donorId, ipHash: meta.ipHash });
  return {
    donor,
    account: account ?? null,
    consent: consent ?? null,
    availability: donorAvailability(donor, account?.status ?? 'deleted'),
    availabilityHistory,
    verification,
    history,
    isSelf: donor.userId === actor.userId,
  };
}

// ---------------------------------------------------------------------------
// Registration review
// ---------------------------------------------------------------------------

export async function reviewDonorRegistration(actor: Actor, donorId: string, decision: 'approved' | 'rejected', note: string | null, meta: ClientMeta = {}) {
  requirePermission(actor, 'donors.review');
  if (decision === 'rejected') requireReason(note);
  return db.transaction(async (tx) => {
    const donor = await loadDonor(tx, donorId, true);
    refuseSelf(actor, donor);
    if (donor.registrationStatus === decision) throw new AppError('invalid_state');
    // A donor whose address is outside Lakshmipur cannot be approved until the address is corrected.
    if (decision === 'approved' && donor.districtId !== (await getServiceArea(tx)).districtId) throw new AppError('invalid_state', 'outside_service_area');
    await tx
      .update(donorProfiles)
      .set({ registrationStatus: decision, registrationReviewedByUserId: actor.userId, registrationReviewedAt: new Date(), registrationNote: note, updatedAt: new Date() })
      .where(eq(donorProfiles.id, donorId));
    await createNotifications(tx, [
      {
        userId: donor.userId,
        kind: decision === 'approved' ? 'registration_approved' : 'registration_rejected',
        data: decision === 'rejected' ? { reason: note } : {},
        link: '/account',
      },
    ]);
    await audit(tx, {
      actor,
      action: `staff.donor_registration_${decision}`,
      targetType: 'donor',
      targetId: donorId,
      metadata: { from: donor.registrationStatus, to: decision, reason: note },
      ipHash: meta.ipHash,
    });
  });
}

// ---------------------------------------------------------------------------
// Editing, listing status, availability overrides
// ---------------------------------------------------------------------------

/** Staff correction of a donor's details. Identity changes reset profile verification. */
export async function staffUpdateDonor(actor: Actor, donorId: string, input: DonorProfileInput, reason: string, meta: ClientMeta = {}) {
  requirePermission(actor, 'donors.manage');
  const why = requireReason(reason);
  return db.transaction(async (tx) => {
    const current = await loadDonor(tx, donorId, true);
    refuseSelf(actor, current);
    await validateDonorProfile(input, tx);
    const changed = (
      [
        ['fullName', current.fullName !== input.fullName],
        ['dateOfBirth', current.dateOfBirth !== input.dateOfBirth],
        ['bloodGroup', current.bloodGroup !== input.bloodGroup],
        ['location', current.divisionId !== input.divisionId || current.districtId !== input.districtId || current.upazilaId !== input.upazilaId],
        ['locality', current.locality !== input.locality],
        ['contact', current.contactPhone !== input.contactPhone || current.preferredContactMethod !== input.preferredContactMethod],
      ] as const
    )
      .filter(([, c]) => c)
      .map(([k]) => k);
    if (changed.length === 0) return { changed };
    const identityChanged = changed.some((c) => c === 'fullName' || c === 'dateOfBirth' || c === 'bloodGroup');
    const resetVerification = identityChanged && current.verificationStatus !== 'unverified';
    await tx
      .update(donorProfiles)
      .set({
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
      .where(eq(donorProfiles.id, donorId));
    if (resetVerification) {
      await tx.insert(verificationEvents).values({ donorId, actorUserId: actor.userId, fromStatus: current.verificationStatus, toStatus: 'unverified', note: 'identity details corrected by staff' });
    }
    await createNotifications(tx, [{ userId: current.userId, kind: 'profile_changed_by_staff', link: '/account/profile' }]);
    await audit(tx, { actor, action: 'staff.donor_updated', targetType: 'donor', targetId: donorId, metadata: { changed, reason: why, verificationReset: resetVerification }, ipHash: meta.ipHash });
    return { changed };
  });
}

/**
 * Listing status set by staff: 'restricted' (deactivate), 'removed' (remove, kept for the record)
 * or 'active' (restore). A donor's own pause is left to the donor.
 */
export async function staffSetListingStatus(
  actor: Actor,
  donorId: string,
  status: 'active' | 'restricted' | 'removed',
  reason: string,
  statusLabel: string,
  meta: ClientMeta = {},
) {
  requirePermission(actor, 'donors.manage');
  const why = requireReason(reason);
  return db.transaction(async (tx) => {
    const donor = await loadDonor(tx, donorId, true);
    refuseSelf(actor, donor);
    if (donor.status === status) throw new AppError('invalid_state');
    if (status === 'active' && donor.status === 'paused') throw new AppError('invalid_state'); // only the donor un-pauses
    await tx
      .update(donorProfiles)
      .set({ status, restrictedReason: status === 'active' ? null : why, updatedAt: new Date() })
      .where(eq(donorProfiles.id, donorId));
    await createNotifications(tx, [{ userId: donor.userId, kind: 'listing_changed_by_staff', data: { status: statusLabel }, link: '/account' }]);
    const action = status === 'active' ? 'staff.donor_restored' : status === 'removed' ? 'staff.donor_removed' : 'staff.donor_deactivated';
    await audit(tx, { actor, action, targetType: 'donor', targetId: donorId, metadata: { from: donor.status, to: status, reason: why }, ipHash: meta.ipHash });
  });
}

/**
 * Staff override of availability. Recorded with source 'staff', the actor, the previous value and
 * the reason, shown to the public as "updated by an administrator", and the donor is notified so
 * they can correct it.
 */
export async function staffSetAvailability(
  actor: Actor,
  donorId: string,
  status: 'available' | 'unavailable' | 'unknown',
  reason: string,
  statusLabel: string,
  meta: ClientMeta = {},
) {
  requirePermission(actor, 'donors.availability');
  const why = requireReason(reason);
  return db.transaction(async (tx) => {
    const donor = await loadDonor(tx, donorId, true);
    refuseSelf(actor, donor);
    const settings = await getSettings(tx);
    const { previous } = await recordAvailability(tx, donorId, status, settings.availabilityExpiryDays, {
      by: { source: 'staff', userId: actor.userId, reason: why },
    });
    await createNotifications(tx, [{ userId: donor.userId, kind: 'availability_changed_by_staff', data: { status: statusLabel }, link: '/account' }]);
    await audit(tx, { actor, action: 'staff.availability_overridden', targetType: 'donor', targetId: donorId, metadata: { from: previous, to: status, reason: why }, ipHash: meta.ipHash });
    return { previous };
  });
}

// ---------------------------------------------------------------------------
// Adding a donor on someone's behalf
// ---------------------------------------------------------------------------

export interface StaffNewDonorInput {
  phone: string;
  profile: DonorProfileInput;
  consents: ConsentInput;
  availableNow: boolean;
  /** Staff confirm the person agreed to be registered and to these privacy choices. */
  consentConfirmed: boolean;
  note: string | null;
}

/**
 * Creates an account and an approved donor profile for someone who registered through staff
 * (for example by phone or at a blood camp). The account gets an unusable random password; the
 * donor can take it over later through an administrator-issued reset link.
 */
export async function staffCreateDonor(actor: Actor, input: StaffNewDonorInput, meta: ClientMeta = {}) {
  requirePermission(actor, 'donors.manage');
  if (!input.consentConfirmed) throw validationError({ consentConfirmed: 'mustAccept' });
  return db.transaction(async (tx) => {
    await validateDonorProfile(input.profile, tx);
    const user = await createAccount(tx, { phone: input.phone, password: `${randomToken()}A1`, displayName: input.profile.fullName });
    // Replace with a hash nobody knows, so nobody can sign in until a reset link is issued.
    await tx.update(users).set({ passwordHash: await hashPassword(randomToken()) }).where(eq(users.id, user.id));
    const [donor] = await tx
      .insert(donorProfiles)
      .values({
        userId: user.id,
        publicId: randomPublicId(),
        fullName: input.profile.fullName,
        nameKey: nameKey(input.profile.fullName),
        dateOfBirth: input.profile.dateOfBirth,
        bloodGroup: input.profile.bloodGroup,
        divisionId: input.profile.divisionId,
        districtId: input.profile.districtId,
        upazilaId: input.profile.upazilaId,
        locality: input.profile.locality,
        contactPhone: input.profile.contactPhone,
        preferredContactMethod: input.profile.preferredContactMethod,
        registrationStatus: 'approved',
        registrationReviewedByUserId: actor.userId,
        registrationReviewedAt: new Date(),
        registrationNote: input.note ?? 'Added by staff',
      })
      .returning();
    await tx.insert(donorConsents).values({ donorId: donor.id, ...input.consents, policyVersion: PRIVACY_POLICY_VERSION });
    if (input.availableNow) {
      const settings = await getSettings(tx);
      await recordAvailability(tx, donor.id, 'available', settings.availabilityExpiryDays, { by: { source: 'staff', userId: actor.userId, reason: 'stated at registration through staff' } });
    }
    await audit(tx, { actor, action: 'staff.donor_created', targetType: 'donor', targetId: donor.id, metadata: { listedInSearch: input.consents.listedInSearch }, ipHash: meta.ipHash });
    return { user, donor };
  });
}

// ---------------------------------------------------------------------------
// Figures for the staff overview
// ---------------------------------------------------------------------------

export async function staffDonorStats(actor: Actor) {
  requirePermission(actor, 'overview.view');
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${donorProfiles.registrationStatus} = 'pending')::int`,
      approved: sql<number>`count(*) filter (where ${donorProfiles.registrationStatus} = 'approved')::int`,
      rejected: sql<number>`count(*) filter (where ${donorProfiles.registrationStatus} = 'rejected')::int`,
      deactivated: sql<number>`count(*) filter (where ${donorProfiles.status} in ('paused', 'restricted'))::int`,
      removed: sql<number>`count(*) filter (where ${donorProfiles.status} = 'removed')::int`,
      available: sql<number>`count(*) filter (where ${donorProfiles.registrationStatus} = 'approved' and ${donorProfiles.status} = 'active' and ${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now())::int`,
      unavailable: sql<number>`count(*) filter (where ${donorProfiles.registrationStatus} = 'approved' and ${donorProfiles.status} = 'active' and ${donorProfiles.availabilityStatus} = 'unavailable')::int`,
      unknown: sql<number>`count(*) filter (where ${donorProfiles.registrationStatus} = 'approved' and ${donorProfiles.status} = 'active' and (${donorProfiles.availabilityStatus} is null or (${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} <= now())))::int`,
      staffSet: sql<number>`count(*) filter (where ${donorProfiles.availabilitySource} = 'staff')::int`,
    })
    .from(donorProfiles);
  return row;
}

/** Most recent actions by platform staff (for the overview). Contains no personal data. */
export async function recentStaffActivity(actor: Actor, limit = 10) {
  requirePermission(actor, 'overview.view');
  return db
    .select({ id: auditLogs.id, action: auditLogs.action, targetType: auditLogs.targetType, targetId: auditLogs.targetId, createdAt: auditLogs.createdAt, actorName: users.displayName, actorRole: auditLogs.actorRole })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(and(inArray(auditLogs.actorRole, ['admin', 'moderator']), sql`${auditLogs.action} not like '%viewed'`))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

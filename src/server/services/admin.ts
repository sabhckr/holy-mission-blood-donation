import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../db/client';
import {
  auditLogs,
  bloodRequests,
  communities,
  communityMemberships,
  deletionRequests,
  donations,
  donorConsents,
  donorProfiles,
  duplicateReviews,
  locations,
  notificationDeliveries,
  reports,
  sessions,
  users,
} from '../db/schema';
import { PAGE_SIZE } from '../domain/constants';
import { normalizeBdPhone } from '../domain/phone';
import { AppError, forbidden, notFound } from '../errors';
import { can, isAdmin, type Actor, type PlatformPermission } from '../policy';
import { activeAdminCount, confirmPassword, type ClientMeta } from './accounts';
import { audit } from './audit';
import { donorAvailability } from './donors';

function requirePermission(actor: Actor | null, permission: PlatformPermission): asserts actor is Actor {
  if (!can(actor, permission)) throw forbidden();
}

function requireAdmin(actor: Actor | null): asserts actor is Actor {
  if (!isAdmin(actor)) throw forbidden();
}

// ---------------------------------------------------------------------------
// Overview figures (all from the database; self-reported and verified kept apart)
// ---------------------------------------------------------------------------

export async function platformStats(actor: Actor) {
  requirePermission(actor, 'overview.view');
  const [donors] = await db
    .select({
      total: sql<number>`count(*)::int`,
      listed: sql<number>`count(*) filter (where ${donorConsents.listedInSearch} and ${donorProfiles.status} = 'active')::int`,
      availableNow: sql<number>`count(*) filter (where ${donorProfiles.status} = 'active' and ${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now())::int`,
      verified: sql<number>`count(*) filter (where ${donorProfiles.verificationStatus} = 'verified')::int`,
      pendingVerification: sql<number>`count(*) filter (where ${donorProfiles.verificationStatus} = 'pending')::int`,
    })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id));
  const byGroup = await db
    .select({ bloodGroup: donorProfiles.bloodGroup, n: sql<number>`count(*)::int` })
    .from(donorProfiles)
    .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
    .where(and(eq(donorConsents.listedInSearch, true), eq(donorProfiles.registrationStatus, 'approved'), eq(donorProfiles.status, 'active')))
    .groupBy(donorProfiles.bloodGroup)
    .orderBy(donorProfiles.bloodGroup);
  const [records] = await db
    .select({
      verified: sql<number>`count(*) filter (where ${donations.status} = 'verified')::int`,
      selfReported: sql<number>`count(*) filter (where ${donations.status} = 'unverified')::int`,
      pending: sql<number>`count(*) filter (where ${donations.status} = 'pending')::int`,
      rejected: sql<number>`count(*) filter (where ${donations.status} = 'rejected')::int`,
    })
    .from(donations);
  const requestsByStatus = await db.select({ status: bloodRequests.status, n: sql<number>`count(*)::int` }).from(bloodRequests).groupBy(bloodRequests.status);
  const communitiesByStatus = await db.select({ status: communities.status, n: sql<number>`count(*)::int` }).from(communities).groupBy(communities.status);
  const [queues] = await db
    .select({
      openReports: sql<number>`(select count(*) from ${reports} where ${reports.status} in ('open', 'reviewing'))::int`,
      pendingDeletions: sql<number>`(select count(*) from ${deletionRequests} where ${deletionRequests.status} = 'pending')::int`,
      pendingCommunities: sql<number>`(select count(*) from ${communities} where ${communities.status} = 'pending')::int`,
      users: sql<number>`(select count(*) from ${users} where ${users.status} <> 'deleted')::int`,
      deliveriesNotConfigured: sql<number>`(select count(*) from ${notificationDeliveries} where ${notificationDeliveries.status} = 'not_configured')::int`,
      deliveriesSent: sql<number>`(select count(*) from ${notificationDeliveries} where ${notificationDeliveries.status} = 'sent')::int`,
      deliveriesFailed: sql<number>`(select count(*) from ${notificationDeliveries} where ${notificationDeliveries.status} = 'failed')::int`,
    })
    .from(sql`(select 1) as one`);
  return { donors, byGroup, records, requestsByStatus, communitiesByStatus, queues };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function searchUsers(actor: Actor, filters: { q?: string | null; role?: 'user' | 'admin' | 'moderator' | null; status?: 'active' | 'deactivated' | 'suspended' | 'deleted' | null; page?: number }) {
  requireAdmin(actor);
  const conds: SQL[] = [];
  if (filters.q) {
    const phone = normalizeBdPhone(filters.q);
    const pattern = `%${filters.q.normalize('NFC').replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conds.push(phone ? eq(users.phone, phone) : or(ilike(users.displayName, pattern), ilike(donorProfiles.fullName, pattern), ilike(users.email, pattern))!);
  }
  if (filters.role) conds.push(eq(users.role, filters.role));
  if (filters.status) conds.push(eq(users.status, filters.status));
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users)
    .leftJoin(donorProfiles, eq(donorProfiles.userId, users.id))
    .where(where);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const items = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      phone: users.phone,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      lastSignInAt: users.lastSignInAt,
      donorId: donorProfiles.id,
      bloodGroup: donorProfiles.bloodGroup,
      donorStatus: donorProfiles.status,
      verificationStatus: donorProfiles.verificationStatus,
    })
    .from(users)
    .leftJoin(donorProfiles, eq(donorProfiles.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  return { items, total, page, pageCount };
}

/** Full account detail for an administrator. Viewing it is audit-logged because it shows contact details. */
export async function getUserDetail(actor: Actor, userId: string, meta: ClientMeta = {}) {
  requireAdmin(actor);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw notFound();
  const [donor] = await db.select().from(donorProfiles).where(eq(donorProfiles.userId, userId));
  const consent = donor ? (await db.select().from(donorConsents).where(eq(donorConsents.donorId, donor.id)))[0] : undefined;
  const memberships = await db
    .select({ membership: communityMemberships, communityName: communities.name, communitySlug: communities.slug })
    .from(communityMemberships)
    .innerJoin(communities, eq(communities.id, communityMemberships.communityId))
    .where(eq(communityMemberships.userId, userId));
  const [{ sessionCount }] = await db.select({ sessionCount: sql<number>`count(*)::int` }).from(sessions).where(and(eq(sessions.userId, userId), sql`${sessions.expiresAt} > now()`));
  const deletion = await db.select().from(deletionRequests).where(eq(deletionRequests.userId, userId)).orderBy(desc(deletionRequests.createdAt));
  const donationRows = donor ? await db.select().from(donations).where(eq(donations.donorId, donor.id)).orderBy(desc(donations.donatedOn)) : [];
  await audit(db, { actor, action: 'admin.user_viewed', targetType: 'user', targetId: userId, ipHash: meta.ipHash });
  const { passwordHash: _omit, ...safeUser } = user;
  return {
    user: safeUser,
    donor: donor ?? null,
    consent: consent ?? null,
    availability: donor ? donorAvailability(donor, user.status) : null,
    memberships,
    sessionCount,
    deletion,
    donations: donationRows,
  };
}

export async function setUserStatus(actor: Actor, userId: string, status: 'active' | 'suspended', reason: string | null, meta: ClientMeta = {}) {
  requireAdmin(actor);
  if (userId === actor.userId) throw forbidden();
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.status === 'deleted') throw notFound();
    if (user.role === 'admin' && status === 'suspended' && (await activeAdminCount(tx)) <= 1) throw new AppError('invalid_state', 'last_admin');
    await tx.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
    if (status === 'suspended') await tx.delete(sessions).where(eq(sessions.userId, userId));
    await audit(tx, { actor, action: status === 'suspended' ? 'admin.user_suspended' : 'admin.user_reinstated', targetType: 'user', targetId: userId, metadata: { from: user.status, reason }, ipHash: meta.ipHash });
  });
}

/** Granting or removing platform admin rights requires the acting admin's password. */
export async function setUserRole(actor: Actor, userId: string, role: 'user' | 'admin' | 'moderator', password: string, meta: ClientMeta = {}) {
  requireAdmin(actor);
  if (!(await confirmPassword(actor.userId, password))) throw new AppError('forbidden', 'reauth_failed', { password: 'wrongPassword' });
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.status === 'deleted') throw notFound();
    if (user.role === role) return;
    if (user.role === 'admin' && role !== 'admin' && (await activeAdminCount(tx)) <= 1) throw new AppError('invalid_state', 'last_admin');
    await tx.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId)); // new privileges take effect on next sign-in
    await audit(tx, { actor, action: 'admin.role_changed', targetType: 'user', targetId: userId, metadata: { from: user.role, to: role }, ipHash: meta.ipHash });
  });
}

export async function revokeUserSessions(actor: Actor, userId: string, meta: ClientMeta = {}) {
  requireAdmin(actor);
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await audit(db, { actor, action: 'admin.sessions_revoked', targetType: 'user', targetId: userId, ipHash: meta.ipHash });
}

export async function setDonorRestriction(actor: Actor, donorId: string, restricted: boolean, reason: string | null, meta: ClientMeta = {}) {
  requireAdmin(actor);
  await db.transaction(async (tx) => {
    const [donor] = await tx.select().from(donorProfiles).where(eq(donorProfiles.id, donorId)).for('update');
    if (!donor) throw notFound();
    await tx
      .update(donorProfiles)
      .set({ status: restricted ? 'restricted' : 'active', restrictedReason: restricted ? reason : null, updatedAt: new Date() })
      .where(eq(donorProfiles.id, donorId));
    await audit(tx, { actor, action: restricted ? 'admin.donor_restricted' : 'admin.donor_unrestricted', targetType: 'donor', targetId: donorId, metadata: { reason }, ipHash: meta.ipHash });
  });
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/**
 * Possible duplicate donor profiles: same normalised name and date of birth, or the same
 * contact number on two different accounts. Pairs already reviewed are left out.
 */
export async function duplicateCandidates(actor: Actor) {
  requirePermission(actor, 'duplicates.review');
  const a = alias(donorProfiles, 'a');
  const b = alias(donorProfiles, 'b');
  const rows = await db
    .select({
      aId: a.id,
      aName: a.fullName,
      aPublicId: a.publicId,
      aUserId: a.userId,
      aDistrict: a.districtId,
      aGroup: a.bloodGroup,
      aCreated: a.createdAt,
      bId: b.id,
      bName: b.fullName,
      bPublicId: b.publicId,
      bUserId: b.userId,
      bDistrict: b.districtId,
      bGroup: b.bloodGroup,
      bCreated: b.createdAt,
      samePhone: sql<boolean>`${a.contactPhone} = ${b.contactPhone}`,
    })
    .from(a)
    .innerJoin(b, and(sql`${a.id} < ${b.id}`, or(and(eq(a.nameKey, b.nameKey), eq(a.dateOfBirth, b.dateOfBirth)), eq(a.contactPhone, b.contactPhone))))
    .where(sql`not exists (select 1 from ${duplicateReviews} r where r.donor_a = ${a.id} and r.donor_b = ${b.id})`)
    .orderBy(desc(b.createdAt))
    .limit(100);
  return rows;
}

export async function reviewDuplicate(actor: Actor, donorA: string, donorB: string, decision: 'not_duplicate' | 'duplicate_resolved', note: string | null, meta: ClientMeta = {}) {
  requirePermission(actor, 'duplicates.review');
  const [first, second] = donorA < donorB ? [donorA, donorB] : [donorB, donorA];
  await db.transaction(async (tx) => {
    await tx
      .insert(duplicateReviews)
      .values({ donorA: first, donorB: second, decision, note, reviewedByUserId: actor.userId })
      .onConflictDoUpdate({ target: [duplicateReviews.donorA, duplicateReviews.donorB], set: { decision, note, reviewedByUserId: actor.userId } });
    await audit(tx, { actor, action: 'admin.duplicate_reviewed', targetType: 'donor', targetId: first, metadata: { other: second, decision }, ipHash: meta.ipHash });
  });
}

// ---------------------------------------------------------------------------
// Communities, deletion requests, access review
// ---------------------------------------------------------------------------

export async function adminCommunities(actor: Actor, status: 'pending' | 'approved' | 'suspended' | 'rejected' | null) {
  requireAdmin(actor);
  return db
    .select({
      community: communities,
      creatorName: users.displayName,
      members: sql<number>`(select count(*) from ${communityMemberships} m where m.community_id = ${communities.id} and m.status = 'active')::int`,
    })
    .from(communities)
    .leftJoin(users, eq(users.id, communities.createdByUserId))
    .where(status ? eq(communities.status, status) : undefined)
    .orderBy(sql`case ${communities.status} when 'pending' then 0 else 1 end`, desc(communities.createdAt))
    .limit(200);
}

export async function pendingDeletionRequests(actor: Actor) {
  requireAdmin(actor);
  return db
    .select({ request: deletionRequests, displayName: users.displayName, status: users.status })
    .from(deletionRequests)
    .innerJoin(users, eq(users.id, deletionRequests.userId))
    .where(eq(deletionRequests.status, 'pending'))
    .orderBy(asc(deletionRequests.createdAt));
}

/** Everyone holding elevated access: platform admins and community leaders/coordinators. */
export async function accessReview(actor: Actor) {
  requireAdmin(actor);
  const admins = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      status: users.status,
      lastSignInAt: users.lastSignInAt,
      passwordChangedAt: users.passwordChangedAt,
      createdAt: users.createdAt,
      // Written out in full: in a single-table select Drizzle renders ${users.id} as a bare "id",
      // which inside this subquery would resolve to sessions.id.
      activeSessions: sql<number>`(select count(*) from ${sessions} s where s.user_id = "users"."id" and s.expires_at > now())::int`,
    })
    .from(users)
    .where(eq(users.role, 'admin'))
    .orderBy(asc(users.displayName));
  const leaders = await db
    .select({
      membershipId: communityMemberships.id,
      userId: users.id,
      displayName: users.displayName,
      userStatus: users.status,
      lastSignInAt: users.lastSignInAt,
      role: communityMemberships.role,
      communityName: communities.name,
      communitySlug: communities.slug,
      communityStatus: communities.status,
      since: communityMemberships.updatedAt,
    })
    .from(communityMemberships)
    .innerJoin(users, eq(users.id, communityMemberships.userId))
    .innerJoin(communities, eq(communities.id, communityMemberships.communityId))
    .where(and(eq(communityMemberships.status, 'active'), inArray(communityMemberships.role, ['leader', 'coordinator'])))
    .orderBy(asc(communities.name), asc(users.displayName));
  return { admins, leaders };
}

// ---------------------------------------------------------------------------
// Audit log search
// ---------------------------------------------------------------------------

export async function searchAuditLog(
  actor: Actor,
  filters: { action?: string | null; targetType?: string | null; targetId?: string | null; actorId?: string | null; from?: string | null; to?: string | null; page?: number },
) {
  requireAdmin(actor);
  const conds: SQL[] = [];
  if (filters.action) conds.push(ilike(auditLogs.action, `${filters.action.replace(/[%_\\]/g, (c) => `\\${c}`)}%`));
  if (filters.targetType) conds.push(eq(auditLogs.targetType, filters.targetType));
  if (filters.targetId) conds.push(eq(auditLogs.targetId, filters.targetId));
  if (filters.actorId) conds.push(eq(auditLogs.actorUserId, filters.actorId));
  if (filters.from) conds.push(gte(auditLogs.createdAt, new Date(`${filters.from}T00:00:00+06:00`)));
  if (filters.to) conds.push(lte(auditLogs.createdAt, new Date(`${filters.to}T23:59:59+06:00`)));
  const where = conds.length ? and(...conds) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLogs).where(where);
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, filters.page ?? 1), pageCount);
  const items = await db
    .select({ log: auditLogs, actorName: users.displayName })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { items, total, page, pageCount };
}

// ---------------------------------------------------------------------------
// Exports (admin + password re-check + audit log)
// ---------------------------------------------------------------------------

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export type ExportKind = 'donors_by_area' | 'requests_summary' | 'donor_directory';

/**
 * Exports. 'donor_directory' contains no phone numbers, dates of birth or localities — only what
 * is needed for coordination planning. Each export needs the admin's password and is audit-logged.
 */
export async function exportData(actor: Actor, kind: ExportKind, password: string, meta: ClientMeta = {}): Promise<{ filename: string; csv: string; rows: number }> {
  requireAdmin(actor);
  if (!(await confirmPassword(actor.userId, password))) throw new AppError('forbidden', 'reauth_failed', { password: 'wrongPassword' });
  let result: { filename: string; csv: string; rows: number };
  const district = alias(locations, 'district');
  const division = alias(locations, 'division');
  if (kind === 'donors_by_area') {
    const rows = await db
      .select({
        division: division.nameEn,
        district: district.nameEn,
        bloodGroup: donorProfiles.bloodGroup,
        listed: sql<number>`count(*)::int`,
        availableNow: sql<number>`count(*) filter (where ${donorProfiles.availabilityStatus} = 'available' and ${donorProfiles.availabilityExpiresAt} > now())::int`,
        verified: sql<number>`count(*) filter (where ${donorProfiles.verificationStatus} = 'verified')::int`,
      })
      .from(donorProfiles)
      .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
      .innerJoin(district, eq(district.id, donorProfiles.districtId))
      .innerJoin(division, eq(division.id, donorProfiles.divisionId))
      .where(and(eq(donorConsents.listedInSearch, true), eq(donorProfiles.registrationStatus, 'approved'), eq(donorProfiles.status, 'active')))
      .groupBy(division.nameEn, district.nameEn, donorProfiles.bloodGroup)
      .orderBy(division.nameEn, district.nameEn, donorProfiles.bloodGroup);
    result = {
      filename: 'donors-by-area.csv',
      csv: toCsv(['division', 'district', 'blood_group', 'listed_donors', 'available_now_self_confirmed', 'verified_profiles'], rows.map((r) => [r.division, r.district, r.bloodGroup, r.listed, r.availableNow, r.verified])),
      rows: rows.length,
    };
  } else if (kind === 'requests_summary') {
    const rows = await db
      .select({ district: district.nameEn, bloodGroup: bloodRequests.bloodGroup, status: bloodRequests.status, n: sql<number>`count(*)::int` })
      .from(bloodRequests)
      .innerJoin(district, eq(district.id, bloodRequests.districtId))
      .groupBy(district.nameEn, bloodRequests.bloodGroup, bloodRequests.status)
      .orderBy(district.nameEn, bloodRequests.bloodGroup);
    result = { filename: 'requests-summary.csv', csv: toCsv(['district', 'blood_group', 'status', 'requests'], rows.map((r) => [r.district, r.bloodGroup, r.status, r.n])), rows: rows.length };
  } else {
    const rows = await db
      .select({
        publicId: donorProfiles.publicId,
        bloodGroup: donorProfiles.bloodGroup,
        division: division.nameEn,
        district: district.nameEn,
        verification: donorProfiles.verificationStatus,
        availabilityStatus: donorProfiles.availabilityStatus,
        availabilityExpiresAt: donorProfiles.availabilityExpiresAt,
        registered: donorProfiles.createdAt,
      })
      .from(donorProfiles)
      .innerJoin(donorConsents, eq(donorConsents.donorId, donorProfiles.id))
      .innerJoin(district, eq(district.id, donorProfiles.districtId))
      .innerJoin(division, eq(division.id, donorProfiles.divisionId))
      .where(and(eq(donorConsents.listedInSearch, true), eq(donorProfiles.registrationStatus, 'approved'), eq(donorProfiles.status, 'active')))
      .orderBy(division.nameEn, district.nameEn);
    const now = new Date();
    result = {
      filename: 'donor-directory.csv',
      csv: toCsv(
        ['public_id', 'blood_group', 'division', 'district', 'verification', 'availability_self_confirmed', 'registered_on'],
        rows.map((r) => [
          r.publicId,
          r.bloodGroup,
          r.division,
          r.district,
          r.verification,
          r.availabilityStatus === 'available' && r.availabilityExpiresAt && r.availabilityExpiresAt > now ? 'available' : r.availabilityStatus === 'unavailable' ? 'unavailable' : 'unknown',
          r.registered.toISOString().slice(0, 10),
        ]),
      ),
      rows: rows.length,
    };
  }
  await audit(db, { actor, action: 'admin.export', targetType: 'export', targetId: kind, metadata: { rows: result.rows }, ipHash: meta.ipHash });
  return result;
}

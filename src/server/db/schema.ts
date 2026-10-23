/**
 * Database schema (PostgreSQL, Drizzle ORM).
 *
 * Conventions:
 * - Timestamps are `timestamptz`; calendar dates (date of birth, donation date) are `date`
 *   stored as 'YYYY-MM-DD' strings so they never shift with time zones.
 * - Personal data lives in as few tables as possible (users, donor_profiles, blood_requests).
 *   Audit logs reference ids only and never store phone numbers, passwords or tokens.
 * - History tables (donation_events, availability_updates, request_status_events,
 *   verification_events) are append-only; corrections create new rows.
 */
import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** 'moderator' = platform staff with a limited permission set (see PLATFORM_PERMISSIONS in policy.ts). */
export const userRole = pgEnum('user_role', ['user', 'admin', 'moderator']);
export const accountStatus = pgEnum('account_status', ['active', 'deactivated', 'suspended', 'deleted']);
export const bloodGroup = pgEnum('blood_group', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
export const locationLevel = pgEnum('location_level', ['division', 'district', 'upazila']);
/** Listing status: 'paused' = deactivated by the donor, 'restricted' = deactivated by staff,
 *  'removed' = removed by staff (kept for the record, restorable, never shown). */
export const donorProfileStatus = pgEnum('donor_profile_status', ['active', 'paused', 'restricted', 'removed']);
/** Registration review by platform staff; only 'approved' donors can appear publicly. */
export const registrationStatus = pgEnum('registration_status', ['pending', 'approved', 'rejected']);
/** Who last set a donor's availability: the donor themself or platform staff (an override). */
export const availabilitySource = pgEnum('availability_source', ['donor', 'staff']);
/** Whether an organisation is part of Lakshmipur Blood Donation itself; registering never makes it so. */
export const communityAffiliation = pgEnum('community_affiliation', ['independent', 'holy_mission']);
export const verificationStatus = pgEnum('verification_status', ['unverified', 'pending', 'verified', 'rejected']);
/** Who may see a category of donor information. 'public' = anyone, 'signed_in' = any signed-in account,
 *  'coordinators' = leaders/coordinators of approved communities and platform admins, 'private' = only the donor. */
export const visibility = pgEnum('visibility', ['public', 'signed_in', 'coordinators', 'private']);
export const contactMethod = pgEnum('contact_method', ['call', 'sms', 'whatsapp', 'in_app']);
export const donationType = pgEnum('donation_type', ['whole_blood', 'double_red_cells', 'platelets', 'plasma']);
export const donationSource = pgEnum('donation_source', ['self_reported', 'community', 'admin']);
export const donationStatus = pgEnum('donation_status', ['unverified', 'pending', 'verified', 'rejected', 'voided']);
/** 'unknown' is only written to the history table, when staff reset availability. */
export const availabilityStatus = pgEnum('availability_status', ['available', 'unavailable', 'unknown']);
export const communityStatus = pgEnum('community_status', ['pending', 'approved', 'suspended', 'rejected']);
export const communityKind = pgEnum('community_kind', [
  'blood_organization',
  'volunteer_group',
  'student_group',
  'religious_group',
  'hospital_support',
  'other',
]);
export const membershipRole = pgEnum('membership_role', ['member', 'coordinator', 'leader']);
export const membershipStatus = pgEnum('membership_status', ['pending', 'active', 'rejected', 'removed', 'left']);
export const requestUrgency = pgEnum('request_urgency', ['critical', 'urgent', 'normal']);
export const requestStatus = pgEnum('request_status', ['open', 'in_progress', 'fulfilled', 'cancelled', 'expired']);
export const requestContactPreference = pgEnum('request_contact_preference', ['call', 'sms', 'whatsapp', 'coordinator_only']);
export const responseStatus = pgEnum('response_status', ['offered', 'confirmed', 'declined', 'withdrawn']);
export const contactRequestStatus = pgEnum('contact_request_status', ['pending', 'accepted', 'declined', 'cancelled', 'expired']);
export const reportTarget = pgEnum('report_target', ['donor', 'community', 'request', 'user']);
export const reportReason = pgEnum('report_reason', ['fake_information', 'wrong_number', 'harassment', 'spam', 'payment_demand', 'other']);
export const reportStatus = pgEnum('report_status', ['open', 'reviewing', 'resolved', 'dismissed']);
export const notificationChannel = pgEnum('notification_channel', ['in_app', 'sms', 'email', 'webhook']);
export const deliveryStatus = pgEnum('delivery_status', ['not_configured', 'queued', 'sent', 'failed']);
export const deletionStatus = pgEnum('deletion_status', ['pending', 'completed', 'cancelled']);
export const duplicateDecision = pgEnum('duplicate_decision', ['not_duplicate', 'duplicate_resolved']);

// ---------------------------------------------------------------------------
// Accounts and sessions
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Normalised Bangladeshi mobile number, +8801XXXXXXXXX. Replaced with a tombstone on deletion. */
    phone: text('phone').notNull(),
    email: text('email'),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: userRole('role').notNull().default('user'),
    status: accountStatus('status').notNull().default('active'),
    preferredLocale: text('preferred_locale').notNull().default('bn'),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    failedSignInCount: integer('failed_sign_in_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_phone_key').on(t.phone),
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`).where(sql`${t.email} is not null`),
    index('users_role_idx').on(t.role),
    check('users_locale_check', sql`${t.preferredLocale} in ('bn', 'en')`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the session token; the raw token only ever lives in the user's cookie. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)],
);

/** One-time password reset links issued by an administrator (no SMS/email provider is required). */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(), // SHA-256 of the token
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('password_reset_tokens_user_idx').on(t.userId)],
);

// ---------------------------------------------------------------------------
// Locations (division > district > upazila; extensible by administrators)
// ---------------------------------------------------------------------------

export const locations = pgTable(
  'locations',
  {
    id: serial('id').primaryKey(),
    parentId: integer('parent_id').references((): any => locations.id, { onDelete: 'restrict' }),
    level: locationLevel('level').notNull(),
    code: text('code').notNull(),
    nameBn: text('name_bn').notNull(),
    nameEn: text('name_en').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('locations_code_key').on(t.code),
    index('locations_parent_idx').on(t.parentId),
    index('locations_level_idx').on(t.level),
    check(
      'locations_parent_level_check',
      sql`(${t.level} = 'division' and ${t.parentId} is null) or (${t.level} <> 'division' and ${t.parentId} is not null)`,
    ),
  ],
);

/**
 * Lakshmipur Blood Donation's own official operating areas (initially Lakshmipur district only). This is
 * deliberately separate from where donors and organisations are located: the platform accepts
 * donors and organisations from all of Bangladesh. Changes are audit-logged.
 */
export const operatingAreas = pgTable(
  'operating_areas',
  {
    id: serial('id').primaryKey(),
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    isActive: boolean('is_active').notNull().default(true),
    /** Optional public note (e.g. "Volunteers meet at the district hospital on Fridays"). */
    publicNote: text('public_note'),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('operating_areas_location_key').on(t.locationId),
    check('operating_areas_note_len', sql`${t.publicNote} is null or char_length(${t.publicNote}) <= 300`),
  ],
);

// ---------------------------------------------------------------------------
// Donors
// ---------------------------------------------------------------------------

export const donorProfiles = pgTable(
  'donor_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Short random id used in public URLs so internal ids are never enumerable. */
    publicId: text('public_id').notNull(),
    fullName: text('full_name').notNull(),
    /** Normalised name (lower case, single spaces) used for duplicate detection. */
    nameKey: text('name_key').notNull(),
    dateOfBirth: date('date_of_birth', { mode: 'string' }).notNull(),
    bloodGroup: bloodGroup('blood_group').notNull(),
    divisionId: integer('division_id')
      .notNull()
      .references(() => locations.id),
    districtId: integer('district_id')
      .notNull()
      .references(() => locations.id),
    upazilaId: integer('upazila_id').references(() => locations.id),
    /** Donor-chosen area name such as a neighbourhood or union. Never an exact home address. */
    locality: text('locality'),
    contactPhone: text('contact_phone').notNull(),
    preferredContactMethod: contactMethod('preferred_contact_method').notNull().default('call'),
    status: donorProfileStatus('status').notNull().default('active'),
    /** Reason given by staff for 'restricted' or 'removed'. */
    restrictedReason: text('restricted_reason'),
    registrationStatus: registrationStatus('registration_status').notNull().default('pending'),
    registrationReviewedByUserId: uuid('registration_reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    registrationReviewedAt: timestamp('registration_reviewed_at', { withTimezone: true }),
    registrationNote: text('registration_note'),
    verificationStatus: verificationStatus('verification_status').notNull().default('unverified'),
    verificationCommunityId: uuid('verification_community_id').references(() => communities.id, { onDelete: 'set null' }),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    // Current availability (denormalised from availability_updates for fast search).
    availabilityStatus: availabilityStatus('availability_status'),
    availabilityConfirmedAt: timestamp('availability_confirmed_at', { withTimezone: true }),
    availabilityExpiresAt: timestamp('availability_expires_at', { withTimezone: true }),
    /** 'staff' marks an administrative override, never shown as the donor's own confirmation. */
    availabilitySource: availabilitySource('availability_source'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('donor_profiles_user_key').on(t.userId),
    uniqueIndex('donor_profiles_public_id_key').on(t.publicId),
    index('donor_profiles_search_idx').on(t.bloodGroup, t.districtId, t.status),
    index('donor_profiles_review_idx').on(t.registrationStatus, t.createdAt),
    index('donor_profiles_upazila_idx').on(t.upazilaId),
    index('donor_profiles_division_idx').on(t.divisionId),
    index('donor_profiles_dup_idx').on(t.nameKey, t.dateOfBirth),
    check('donor_profiles_locality_len', sql`${t.locality} is null or char_length(${t.locality}) <= 80`),
  ],
);

/** Per-category consent for showing donor information. Changes are audit-logged. */
export const donorConsents = pgTable('donor_consents', {
  donorId: uuid('donor_id')
    .primaryKey()
    .references(() => donorProfiles.id, { onDelete: 'cascade' }),
  /** Appear in donor search at all. */
  listedInSearch: boolean('listed_in_search').notNull().default(false),
  /**
   * Who sees each detail. Always 'public' since migration 0006 (PUBLIC_DONOR_DETAILS): donors no
   * longer choose per detail. The columns stay so the projection in domain/donor-view keeps working.
   */
  nameVisibility: visibility('name_visibility').notNull().default('public'),
  phoneVisibility: visibility('phone_visibility').notNull().default('public'),
  localityVisibility: visibility('locality_visibility').notNull().default('public'),
  donationHistoryVisibility: visibility('donation_history_visibility').notNull().default('public'),
  communityVisibility: visibility('community_visibility').notNull().default('public'),
  /** Approved community coordinators may find and contact the donor for requests in their service area. */
  allowCoordinatorContact: boolean('allow_coordinator_contact').notNull().default(false),
  /** Signed-in users may send contact requests. */
  allowContactRequests: boolean('allow_contact_requests').notNull().default(true),
  policyVersion: text('policy_version').notNull(),
  consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: updatedAt(),
});

export const availabilityUpdates = pgTable(
  'availability_updates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donorProfiles.id, { onDelete: 'cascade' }),
    status: availabilityStatus('status').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    note: text('note'),
    /** 'donor' = the donor's own statement; 'staff' = override by platform staff (actor + reason recorded). */
    source: availabilitySource('source').notNull().default('donor'),
    setByUserId: uuid('set_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    previousStatus: text('previous_status'),
    reason: text('reason'),
  },
  (t) => [
    index('availability_updates_donor_idx').on(t.donorId, t.confirmedAt),
    check('availability_updates_expiry', sql`(${t.status} = 'available') = (${t.expiresAt} is not null)`),
  ],
);

export const verificationEvents = pgTable(
  'verification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donorProfiles.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    fromStatus: verificationStatus('from_status').notNull(),
    toStatus: verificationStatus('to_status').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('verification_events_donor_idx').on(t.donorId)],
);

// ---------------------------------------------------------------------------
// Donation records
// ---------------------------------------------------------------------------

export const donations = pgTable(
  'donations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donorProfiles.id, { onDelete: 'cascade' }),
    donatedOn: date('donated_on', { mode: 'string' }).notNull(),
    donationType: donationType('donation_type').notNull(),
    source: donationSource('source').notNull(),
    status: donationStatus('status').notNull().default('unverified'),
    /** Community asked to review this record (must be one the donor belongs to). */
    reviewCommunityId: uuid('review_community_id').references(() => communities.id, { onDelete: 'set null' }),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    place: text('place'),
    note: text('note'),
    voidedReason: text('voided_reason'),
    /** When a record is corrected, the new record points at the voided original. */
    correctsDonationId: uuid('corrects_donation_id').references((): any => donations.id, { onDelete: 'set null' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('donations_donor_idx').on(t.donorId, t.donatedOn),
    index('donations_review_idx').on(t.reviewCommunityId, t.status),
    uniqueIndex('donations_no_duplicates')
      .on(t.donorId, t.donatedOn, t.donationType)
      .where(sql`${t.status} <> 'voided'`),
    check('donations_place_len', sql`${t.place} is null or char_length(${t.place}) <= 120`),
    check('donations_note_len', sql`${t.note} is null or char_length(${t.note}) <= 300`),
  ],
);

export const donationEvents = pgTable(
  'donation_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donationId: uuid('donation_id')
      .notNull()
      .references(() => donations.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // created | submitted | verified | rejected | voided | corrected
    fromStatus: donationStatus('from_status'),
    toStatus: donationStatus('to_status').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('donation_events_donation_idx').on(t.donationId)],
);

// ---------------------------------------------------------------------------
// Communities (organisations)
// ---------------------------------------------------------------------------

export const communities = pgTable(
  'communities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    kind: communityKind('kind').notNull().default('volunteer_group'),
    description: text('description'),
    foundedYear: smallint('founded_year'),
    status: communityStatus('status').notNull().default('pending'),
    statusReason: text('status_reason'),
    /** Only platform admins can mark an organisation as part of Lakshmipur Blood Donation. */
    affiliation: communityAffiliation('affiliation').notNull().default('independent'),
    divisionId: integer('division_id')
      .notNull()
      .references(() => locations.id),
    districtId: integer('district_id')
      .notNull()
      .references(() => locations.id),
    /** Public contact, shown only when show_public_contact is true. */
    publicPhone: text('public_phone'),
    publicEmail: text('public_email'),
    facebookUrl: text('facebook_url'),
    showPublicContact: boolean('show_public_contact').notNull().default(false),
    /** How the public should reach coordinators: through in-app requests, the public phone, or both. */
    coordinatorContactPreference: text('coordinator_contact_preference').notNull().default('in_app'),
    /** Responsible representative and verification details. Private: platform admins and the
     *  organisation's own leaders only; never part of the public projection. */
    representativeName: text('representative_name'),
    representativeRole: text('representative_role'),
    representativePhone: text('representative_phone'),
    verificationInfo: text('verification_info'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('communities_slug_key').on(t.slug),
    uniqueIndex('communities_name_district_key').on(sql`lower(${t.name})`, t.districtId),
    index('communities_status_idx').on(t.status),
    check('communities_contact_pref', sql`${t.coordinatorContactPreference} in ('in_app', 'phone', 'both')`),
    check('communities_description_len', sql`${t.description} is null or char_length(${t.description}) <= 1000`),
    check('communities_verification_info_len', sql`${t.verificationInfo} is null or char_length(${t.verificationInfo}) <= 1000`),
  ],
);

export const communityServiceAreas = pgTable(
  'community_service_areas',
  {
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    locationId: integer('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.communityId, t.locationId] }), index('service_areas_location_idx').on(t.locationId)],
);

export const communityMemberships = pgTable(
  'community_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRole('role').notNull().default('member'),
    status: membershipStatus('status').notNull().default('pending'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('community_memberships_key').on(t.communityId, t.userId),
    index('community_memberships_user_idx').on(t.userId, t.status),
  ],
);

// ---------------------------------------------------------------------------
// Blood requests
// ---------------------------------------------------------------------------

export const bloodRequests = pgTable(
  'blood_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: text('public_id').notNull(),
    bloodGroup: bloodGroup('blood_group').notNull(),
    units: smallint('units').notNull(),
    divisionId: integer('division_id')
      .notNull()
      .references(() => locations.id),
    districtId: integer('district_id')
      .notNull()
      .references(() => locations.id),
    upazilaId: integer('upazila_id').references(() => locations.id),
    hospitalName: text('hospital_name').notNull(),
    neededAt: timestamp('needed_at', { withTimezone: true }).notNull(),
    urgency: requestUrgency('urgency').notNull().default('normal'),
    /** Requester contact (private: visible to the requester, assigned coordinators, admins,
     *  and — only if share_phone_with_responders — donors who offered to help). */
    requesterName: text('requester_name').notNull(),
    requesterPhone: text('requester_phone').notNull(),
    contactPreference: requestContactPreference('contact_preference').notNull().default('call'),
    sharePhoneWithResponders: boolean('share_phone_with_responders').notNull().default(false),
    /** Optional short note. The form asks people not to include diagnoses or identity documents. */
    note: text('note'),
    showOnPublicBoard: boolean('show_on_public_board').notNull().default(true),
    status: requestStatus('status').notNull().default('open'),
    statusReason: text('status_reason'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** SHA-256 of the private management link token given to the requester. */
    manageTokenHash: text('manage_token_hash'),
    assignedCommunityId: uuid('assigned_community_id').references(() => communities.id, { onDelete: 'set null' }),
    assignedCoordinatorId: uuid('assigned_coordinator_id').references(() => users.id, { onDelete: 'set null' }),
    /** Hash of phone + group + district + day; blocks duplicate open requests. */
    dedupeKey: text('dedupe_key').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('blood_requests_public_id_key').on(t.publicId),
    uniqueIndex('blood_requests_manage_token_key').on(t.manageTokenHash),
    uniqueIndex('blood_requests_open_dedupe').on(t.dedupeKey).where(sql`${t.status} in ('open', 'in_progress')`),
    index('blood_requests_board_idx').on(t.status, t.bloodGroup, t.districtId),
    index('blood_requests_community_idx').on(t.assignedCommunityId, t.status),
    index('blood_requests_needed_idx').on(t.neededAt),
    check('blood_requests_units', sql`${t.units} between 1 and 20`),
    check('blood_requests_note_len', sql`${t.note} is null or char_length(${t.note}) <= 300`),
  ],
);

export const requestStatusEvents = pgTable(
  'request_status_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => bloodRequests.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(), // created | status | assigned | escalated | response
    fromStatus: requestStatus('from_status'),
    toStatus: requestStatus('to_status').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('request_status_events_request_idx').on(t.requestId)],
);

export const requestEscalations = pgTable(
  'request_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => bloodRequests.id, { onDelete: 'cascade' }),
    fromCommunityId: uuid('from_community_id').references(() => communities.id, { onDelete: 'set null' }),
    toCommunityId: uuid('to_community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    escalatedByUserId: uuid('escalated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('request_escalations_key').on(t.requestId, t.toCommunityId),
    index('request_escalations_to_idx').on(t.toCommunityId),
  ],
);

/** A donor offering to help with a request. 'offered' is NOT an agreement to donate;
 *  only a coordinator or the requester can mark it 'confirmed' after speaking to the donor. */
export const requestResponses = pgTable(
  'request_responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => bloodRequests.id, { onDelete: 'cascade' }),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donorProfiles.id, { onDelete: 'cascade' }),
    status: responseStatus('status').notNull().default('offered'),
    message: text('message'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('request_responses_key').on(t.requestId, t.donorId)],
);

// ---------------------------------------------------------------------------
// Contact requests (consent-based donor contact)
// ---------------------------------------------------------------------------

export const contactRequests = pgTable(
  'contact_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donorId: uuid('donor_id')
      .notNull()
      .references(() => donorProfiles.id, { onDelete: 'cascade' }),
    requesterUserId: uuid('requester_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bloodRequestId: uuid('blood_request_id').references(() => bloodRequests.id, { onDelete: 'set null' }),
    message: text('message').notNull(),
    status: contactRequestStatus('status').notNull().default('pending'),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('contact_requests_one_pending').on(t.donorId, t.requesterUserId).where(sql`${t.status} = 'pending'`),
    index('contact_requests_donor_idx').on(t.donorId, t.status),
    index('contact_requests_requester_idx').on(t.requesterUserId),
    check('contact_requests_message_len', sql`char_length(${t.message}) between 1 and 300`),
  ],
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Rendered through the i18n dictionary so the text follows the reader's language. */
    kind: text('kind').notNull(),
    data: jsonb('data').$type<Record<string, string | number | null>>().notNull().default({}),
    link: text('link'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

/** Attempts to deliver a notification outside the app. 'sent' is recorded only when a provider confirms it. */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    channel: notificationChannel('channel').notNull(),
    provider: text('provider').notNull(),
    status: deliveryStatus('status').notNull(),
    providerRef: text('provider_ref'),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [index('notification_deliveries_notification_idx').on(t.notificationId)],
);

// ---------------------------------------------------------------------------
// Moderation, privacy and administration
// ---------------------------------------------------------------------------

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    targetType: reportTarget('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: reportReason('reason').notNull(),
    details: text('details'),
    reporterUserId: uuid('reporter_user_id').references(() => users.id, { onDelete: 'set null' }),
    status: reportStatus('status').notNull().default('open'),
    handledByUserId: uuid('handled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: createdAt(),
  },
  (t) => [
    index('reports_status_idx').on(t.status, t.createdAt),
    index('reports_target_idx').on(t.targetType, t.targetId),
    check('reports_details_len', sql`${t.details} is null or char_length(${t.details}) <= 500`),
  ],
);

/** Administrator decisions about possible duplicate donor profiles (pair stored with donor_a < donor_b). */
export const duplicateReviews = pgTable(
  'duplicate_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    donorA: uuid('donor_a')
      .notNull()
      .references(() => donorProfiles.id, { onDelete: 'cascade' }),
    donorB: uuid('donor_b')
      .notNull()
      .references(() => donorProfiles.id, { onDelete: 'cascade' }),
    decision: duplicateDecision('decision').notNull(),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('duplicate_reviews_pair_key').on(t.donorA, t.donorB),
    check('duplicate_reviews_order', sql`${t.donorA} < ${t.donorB}`),
  ],
);

export const deletionRequests = pgTable(
  'deletion_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    status: deletionStatus('status').notNull().default('pending'),
    processedByUserId: uuid('processed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('deletion_requests_one_pending').on(t.userId).where(sql`${t.status} = 'pending'`),
    index('deletion_requests_status_idx').on(t.status),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    communityId: uuid('community_id').references(() => communities.id, { onDelete: 'set null' }),
    /** Non-sensitive context only (ids, field names, old/new enum values). Never phone numbers or secrets. */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_created_idx').on(t.createdAt),
    index('audit_logs_action_idx').on(t.action),
    index('audit_logs_actor_idx').on(t.actorUserId),
    index('audit_logs_target_idx').on(t.targetType, t.targetId),
  ],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
});

/** Fixed-window rate limit counters shared by all app instances. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index('rate_limits_window_idx').on(t.windowStart)],
);

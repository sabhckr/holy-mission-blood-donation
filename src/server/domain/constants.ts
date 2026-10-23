export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const DONATION_TYPES = ['whole_blood', 'double_red_cells', 'platelets', 'plasma'] as const;
export type DonationType = (typeof DONATION_TYPES)[number];

export const CONTACT_METHODS = ['call', 'sms', 'whatsapp', 'in_app'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const VISIBILITIES = ['public', 'signed_in', 'coordinators', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
/** 'public' = anyone can tap "show number" without signing in (still logged and rate limited). */
export const PHONE_VISIBILITIES = ['public', 'signed_in', 'coordinators', 'private'] as const;

/**
 * Everything a donor shares is shown to everyone, signed in or not: donors no longer choose per
 * detail. A donor can still leave the donor list as a whole (listedInSearch).
 */
export const PUBLIC_DONOR_DETAILS = {
  nameVisibility: 'public',
  phoneVisibility: 'public',
  localityVisibility: 'public',
  donationHistoryVisibility: 'public',
  communityVisibility: 'public',
} as const satisfies Record<string, Visibility>;

export const URGENCIES = ['critical', 'urgent', 'normal'] as const;
export type Urgency = (typeof URGENCIES)[number];

export const REQUEST_STATUSES = ['open', 'in_progress', 'fulfilled', 'cancelled', 'expired'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_CONTACT_PREFERENCES = ['call', 'sms', 'whatsapp', 'coordinator_only'] as const;
export type RequestContactPreference = (typeof REQUEST_CONTACT_PREFERENCES)[number];

export const COMMUNITY_KINDS = [
  'blood_organization',
  'volunteer_group',
  'student_group',
  'religious_group',
  'hospital_support',
  'other',
] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export const MEMBERSHIP_ROLES = ['member', 'coordinator', 'leader'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const REPORT_REASONS = ['fake_information', 'wrong_number', 'harassment', 'spam', 'payment_demand', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGETS = ['donor', 'community', 'request', 'user'] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/** Version of the privacy notice the donor agreed to. Bump when the notice changes materially. */
export const PRIVACY_POLICY_VERSION = '2026-10-23';

export const PAGE_SIZE = 20;

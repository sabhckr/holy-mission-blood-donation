export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const DONATION_TYPES = ['whole_blood', 'double_red_cells', 'platelets', 'plasma'] as const;
export type DonationType = (typeof DONATION_TYPES)[number];

export const CONTACT_METHODS = ['call', 'sms', 'whatsapp', 'in_app'] as const;
export type ContactMethod = (typeof CONTACT_METHODS)[number];

export const VISIBILITIES = ['public', 'signed_in', 'coordinators', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
/** Phone numbers can never be shown to anonymous visitors. */
export const PHONE_VISIBILITIES = ['signed_in', 'coordinators', 'private'] as const;

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

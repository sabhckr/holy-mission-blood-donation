import {
  Ban,
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  Hourglass,
  Search,
  Siren,
  Trash2,
  TriangleAlert,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import type { Messages } from '@/i18n/messages';
import { availabilityState } from '@/server/domain/availability';
import { Badge } from '../ui';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
type Icon = LucideIcon;

type Registration = 'pending' | 'approved' | 'rejected';
type Listing = 'active' | 'paused' | 'restricted' | 'removed';
type Stated = 'available' | 'unavailable' | 'unknown';
type CommunityStatus = 'pending' | 'approved' | 'suspended' | 'rejected';
type AccountStatus = 'active' | 'deactivated' | 'suspended' | 'deleted';
type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed';
type RequestStatus = 'open' | 'in_progress' | 'fulfilled' | 'cancelled' | 'expired';
type Verification = 'unverified' | 'pending' | 'verified' | 'rejected' | 'voided';
type Urgency = 'critical' | 'urgent' | 'normal';

/** Status is always colour + icon + words. Each map gives the tone and the icon for one status kind. */
const REGISTRATION: Record<Registration, [Tone, Icon]> = { pending: ['warning', Hourglass], approved: ['success', CircleCheck], rejected: ['danger', CircleX] };
const LISTING: Record<Listing, [Tone, Icon]> = { active: ['success', Eye], paused: ['neutral', CirclePause], restricted: ['warning', EyeOff], removed: ['danger', Ban] };
const STATED: Record<Stated, [Tone, Icon]> = { available: ['success', CircleCheck], unavailable: ['neutral', Clock], unknown: ['warning', CircleDashed] };
const COMMUNITY: Record<CommunityStatus, [Tone, Icon]> = { pending: ['warning', Hourglass], approved: ['success', CircleCheck], suspended: ['danger', CirclePause], rejected: ['danger', CircleX] };
const ACCOUNT: Record<AccountStatus, [Tone, Icon]> = { active: ['success', CircleCheck], deactivated: ['neutral', CirclePause], suspended: ['danger', Ban], deleted: ['neutral', Trash2] };
const REPORT: Record<ReportStatus, [Tone, Icon]> = { open: ['warning', CircleAlert], reviewing: ['info', Search], resolved: ['success', CircleCheck], dismissed: ['neutral', CircleX] };
const REQUEST: Record<RequestStatus, [Tone, Icon]> = {
  open: ['warning', CircleAlert],
  in_progress: ['info', Clock],
  fulfilled: ['success', CircleCheck],
  cancelled: ['neutral', CircleX],
  expired: ['neutral', Hourglass],
};
const VERIFICATION: Record<Verification, [Tone, Icon]> = {
  unverified: ['neutral', CircleDashed],
  pending: ['warning', Hourglass],
  verified: ['info', BadgeCheck],
  rejected: ['danger', CircleX],
  voided: ['danger', Ban],
};
const URGENCY: Record<Urgency, [Tone, Icon]> = { critical: ['danger', Siren], urgent: ['warning', TriangleAlert], normal: ['neutral', Clock] };

function IconBadge({ entry, label }: { entry: [Tone, Icon]; label: string }) {
  const [tone, Icon] = entry;
  return (
    <Badge tone={tone}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** The tone used for a status, for small icons next to counts. */
export const statusTone = {
  registration: (s: Registration) => REGISTRATION[s][0],
  community: (s: CommunityStatus) => COMMUNITY[s][0],
  request: (s: RequestStatus) => REQUEST[s][0],
};

/** The icon used for a status, for lists of counts. */
export const statusIcon = {
  registration: (s: Registration) => REGISTRATION[s][1],
  listing: (s: Listing) => LISTING[s][1],
  stated: (s: Stated) => STATED[s][1],
  community: (s: CommunityStatus) => COMMUNITY[s][1],
  request: (s: RequestStatus) => REQUEST[s][1],
  verification: (s: Verification) => VERIFICATION[s][1],
};

/**
 * What the donor (or staff on their behalf) last said about availability, independent of the
 * listing and account status — those are shown as their own badges, never merged into this one.
 */
export function statedAvailability(donor: { availabilityStatus: 'available' | 'unavailable' | 'unknown' | null; availabilityExpiresAt: Date | null }): Stated {
  const state = availabilityState({ accountStatus: 'active', profileStatus: 'active', availabilityStatus: donor.availabilityStatus, availabilityExpiresAt: donor.availabilityExpiresAt });
  return state === 'restricted' ? 'unknown' : state;
}

export function RegistrationBadge({ status, t }: { status: Registration; t: Messages }) {
  return <IconBadge entry={REGISTRATION[status]} label={t.common.registrationStatus[status]} />;
}

export function ListingBadge({ status, t }: { status: Listing; t: Messages }) {
  return <IconBadge entry={LISTING[status]} label={t.common.listingStatus[status]} />;
}

/** Availability with its source spelled out in text when staff set it. */
export function StatedAvailabilityBadge({ state, source, t }: { state: Stated; source: 'donor' | 'staff' | null; t: Messages }) {
  return (
    <span className="cluster-sm">
      <IconBadge entry={STATED[state]} label={t.common.availability[state]} />
      {source === 'staff' && state !== 'unknown' && (
        <Badge tone="info">
          <UserCog size={14} aria-hidden="true" />
          {t.common.availability.sourceStaff}
        </Badge>
      )}
    </span>
  );
}

export function VerificationStatusBadge({ status, t }: { status: Verification; t: Messages }) {
  return <IconBadge entry={VERIFICATION[status]} label={t.common.verification[status]} />;
}

export function CommunityStatusBadge({ status, t }: { status: CommunityStatus; t: Messages }) {
  return <IconBadge entry={COMMUNITY[status]} label={t.common.communityStatus[status]} />;
}

export function AccountStatusBadge({ status, t }: { status: AccountStatus; t: Messages }) {
  return <IconBadge entry={ACCOUNT[status]} label={t.common.accountStatus[status]} />;
}

export function ReportStatusBadge({ status, t }: { status: ReportStatus; t: Messages }) {
  return <IconBadge entry={REPORT[status]} label={t.admin.reports.statuses[status]} />;
}

export function RequestStatusBadge({ status, t }: { status: RequestStatus; t: Messages }) {
  return <IconBadge entry={REQUEST[status]} label={t.common.requestStatus[status]} />;
}

export function UrgencyBadge({ urgency, t }: { urgency: Urgency; t: Messages }) {
  return <IconBadge entry={URGENCY[urgency]} label={t.common.urgency[urgency]} />;
}

export function AffiliationBadge({ affiliation, t }: { affiliation: 'independent' | 'holy_mission'; t: Messages }) {
  return <Badge tone={affiliation === 'holy_mission' ? 'info' : 'neutral'}>{t.common.affiliation[affiliation]}</Badge>;
}

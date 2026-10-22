import { CircleCheck, Clock, UserCog } from 'lucide-react';
import type { Messages } from '@/i18n/messages';
import { availabilityState } from '@/server/domain/availability';
import { Badge } from '../ui';

type Registration = 'pending' | 'approved' | 'rejected';
type Listing = 'active' | 'paused' | 'restricted' | 'removed';
type Stated = 'available' | 'unavailable' | 'unknown';

const REGISTRATION_TONE = { pending: 'warning', approved: 'success', rejected: 'danger' } as const;
const LISTING_TONE = { active: 'success', paused: 'neutral', restricted: 'warning', removed: 'danger' } as const;
const STATED_TONE = { available: 'success', unavailable: 'neutral', unknown: 'warning' } as const;

/**
 * What the donor (or staff on their behalf) last said about availability, independent of the
 * listing and account status — those are shown as their own badges, never merged into this one.
 */
export function statedAvailability(donor: { availabilityStatus: 'available' | 'unavailable' | 'unknown' | null; availabilityExpiresAt: Date | null }): Stated {
  const state = availabilityState({ accountStatus: 'active', profileStatus: 'active', availabilityStatus: donor.availabilityStatus, availabilityExpiresAt: donor.availabilityExpiresAt });
  return state === 'restricted' ? 'unknown' : state;
}

export function RegistrationBadge({ status, t }: { status: Registration; t: Messages }) {
  return <Badge tone={REGISTRATION_TONE[status]}>{t.common.registrationStatus[status]}</Badge>;
}

export function ListingBadge({ status, t }: { status: Listing; t: Messages }) {
  return <Badge tone={LISTING_TONE[status]}>{t.common.listingStatus[status]}</Badge>;
}

/** Availability with its source spelled out in text when staff set it. */
export function StatedAvailabilityBadge({ state, source, t }: { state: Stated; source: 'donor' | 'staff' | null; t: Messages }) {
  return (
    <span className="cluster-sm">
      <Badge tone={STATED_TONE[state]}>
        {state === 'available' ? <CircleCheck size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
        {t.common.availability[state]}
      </Badge>
      {source === 'staff' && state !== 'unknown' && (
        <Badge tone="info">
          <UserCog size={14} aria-hidden="true" />
          {t.common.availability.sourceStaff}
        </Badge>
      )}
    </span>
  );
}

export function AffiliationBadge({ affiliation, t }: { affiliation: 'independent' | 'holy_mission'; t: Messages }) {
  return <Badge tone={affiliation === 'holy_mission' ? 'info' : 'neutral'}>{t.common.affiliation[affiliation]}</Badge>;
}

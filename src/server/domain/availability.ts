/**
 * Donor availability is ONLY what the donor (or, as a recorded override, platform staff) has
 * said recently. It is never inferred from sign-ins, donation counts or the eligibility estimate,
 * and it never means the donor is medically eligible.
 *
 * - available:   confirmed recently and the confirmation has not expired
 * - unavailable: explicitly reported unavailable
 * - unknown:     never stated, the confirmation expired, or staff reset it
 * - restricted:  hidden (account inactive, or listing deactivated/removed by staff)
 */
export type AvailabilityState = 'available' | 'unavailable' | 'unknown' | 'restricted';

export interface AvailabilityInput {
  accountStatus: 'active' | 'deactivated' | 'suspended' | 'deleted';
  profileStatus: 'active' | 'paused' | 'restricted' | 'removed';
  availabilityStatus: 'available' | 'unavailable' | 'unknown' | null;
  availabilityExpiresAt: Date | null;
}

export function availabilityState(input: AvailabilityInput, now: Date = new Date()): AvailabilityState {
  if (input.accountStatus !== 'active' || input.profileStatus === 'restricted' || input.profileStatus === 'removed') return 'restricted';
  if (input.profileStatus === 'paused') return 'unavailable';
  if (input.availabilityStatus === 'unavailable') return 'unavailable';
  if (input.availabilityStatus === 'available' && input.availabilityExpiresAt && input.availabilityExpiresAt.getTime() > now.getTime()) {
    return 'available';
  }
  return 'unknown';
}

export function availabilityExpiry(confirmedAt: Date, expiryDays: number): Date {
  return new Date(confirmedAt.getTime() + expiryDays * 86_400_000);
}

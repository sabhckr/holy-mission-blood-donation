/**
 * Donor availability is ONLY what the donor has told us recently. It is never inferred from
 * sign-ins, donation counts or the eligibility estimate.
 */
export type AvailabilityState = 'available' | 'unavailable' | 'needs_confirmation' | 'restricted';

export interface AvailabilityInput {
  accountStatus: 'active' | 'deactivated' | 'suspended' | 'deleted';
  profileStatus: 'active' | 'paused' | 'restricted';
  availabilityStatus: 'available' | 'unavailable' | null;
  availabilityExpiresAt: Date | null;
}

export function availabilityState(input: AvailabilityInput, now: Date = new Date()): AvailabilityState {
  if (input.accountStatus !== 'active' || input.profileStatus === 'restricted') return 'restricted';
  if (input.profileStatus === 'paused') return 'unavailable';
  if (input.availabilityStatus === 'unavailable') return 'unavailable';
  if (input.availabilityStatus === 'available' && input.availabilityExpiresAt && input.availabilityExpiresAt.getTime() > now.getTime()) {
    return 'available';
  }
  return 'needs_confirmation';
}

export function availabilityExpiry(confirmedAt: Date, expiryDays: number): Date {
  return new Date(confirmedAt.getTime() + expiryDays * 86_400_000);
}

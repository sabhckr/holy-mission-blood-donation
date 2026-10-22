/**
 * Estimated next donation date. This is an ESTIMATE from the donor's own records and the
 * configured minimum intervals (see docs/ELIGIBILITY.md). It never certifies medical
 * eligibility: the blood service decides on the day after screening.
 */
import { addDays, compareDates, daysBetween } from './dates';
import type { DonationType } from './constants';

export type IntervalConfig = Record<DonationType, number>;

export interface DonationForEstimate {
  donatedOn: string;
  donationType: DonationType;
  status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'voided';
}

export type EligibilityEstimate =
  | { state: 'no_data' }
  | {
      state: 'waiting' | 'interval_passed';
      nextDate: string;
      /** Days until nextDate (0 or negative once the interval has passed). */
      daysLeft: number;
      basedOn: { donatedOn: string; donationType: DonationType; verified: boolean };
    };

/** Records that count: everything except voided or rejected records, and nothing dated after today. */
export function countableDonations<T extends DonationForEstimate>(donations: T[], today: string): T[] {
  return donations.filter((d) => d.status !== 'voided' && d.status !== 'rejected' && compareDates(d.donatedOn, today) <= 0);
}

/**
 * The estimate uses the latest "donation date + interval for that donation type" across all
 * countable records. Different blood services apply different cross-type rules, so taking the
 * latest date is the conservative choice.
 */
export function estimateNextEligible(
  donations: DonationForEstimate[],
  intervals: IntervalConfig,
  today: string,
): EligibilityEstimate {
  const usable = countableDonations(donations, today);
  if (usable.length === 0) return { state: 'no_data' };
  let best: { nextDate: string; donation: DonationForEstimate } | null = null;
  for (const donation of usable) {
    const nextDate = addDays(donation.donatedOn, intervals[donation.donationType]);
    if (!best || compareDates(nextDate, best.nextDate) > 0) best = { nextDate, donation };
  }
  const { nextDate, donation } = best!;
  const daysLeft = daysBetween(today, nextDate);
  return {
    state: daysLeft > 0 ? 'waiting' : 'interval_passed',
    nextDate,
    daysLeft,
    basedOn: { donatedOn: donation.donatedOn, donationType: donation.donationType, verified: donation.status === 'verified' },
  };
}

/** Most recent countable donation date, or null. */
export function lastDonationDate(donations: DonationForEstimate[], today: string): string | null {
  const usable = countableDonations(donations, today);
  return usable.reduce<string | null>((latest, d) => (!latest || compareDates(d.donatedOn, latest) > 0 ? d.donatedOn : latest), null);
}

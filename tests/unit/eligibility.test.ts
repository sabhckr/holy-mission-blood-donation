import { describe, expect, it } from 'vitest';
import { estimateNextEligible, lastDonationDate, type DonationForEstimate } from '@/server/domain/eligibility';
import { DEFAULT_SETTINGS } from '@/server/domain/settings-defaults';

const intervals = DEFAULT_SETTINGS.eligibilityIntervals;
const d = (donatedOn: string, donationType: DonationForEstimate['donationType'] = 'whole_blood', status: DonationForEstimate['status'] = 'unverified'): DonationForEstimate => ({ donatedOn, donationType, status });

describe('estimated next donation date', () => {
  it('has no estimate without records', () => {
    expect(estimateNextEligible([], intervals, '2026-10-22')).toEqual({ state: 'no_data' });
  });

  it('counts down from the last whole blood donation', () => {
    const r = estimateNextEligible([d('2026-08-01')], intervals, '2026-10-22');
    expect(r).toMatchObject({ state: 'waiting', nextDate: '2026-11-29', daysLeft: 38 });
  });

  it('reaches zero on the boundary date and never goes "eligible" by itself', () => {
    const r = estimateNextEligible([d('2026-06-24')], intervals, '2026-10-22');
    expect(r).toMatchObject({ state: 'interval_passed', nextDate: '2026-10-22', daysLeft: 0 });
    const day1 = estimateNextEligible([d('2026-06-25')], intervals, '2026-10-22');
    expect(day1).toMatchObject({ state: 'waiting', daysLeft: 1 });
  });

  it('reports negative days once the interval has long passed', () => {
    const r = estimateNextEligible([d('2025-01-01')], intervals, '2026-10-22');
    expect(r.state).toBe('interval_passed');
    if (r.state !== 'no_data') expect(r.daysLeft).toBeLessThan(0);
  });

  it('uses different intervals per donation type and takes the latest resulting date', () => {
    const records = [d('2026-10-10', 'platelets'), d('2026-07-01', 'whole_blood')];
    const r = estimateNextEligible(records, intervals, '2026-10-22');
    // platelets: 10 Oct + 14 = 24 Oct; whole blood: 1 Jul + 120 = 29 Oct → 29 Oct wins
    expect(r).toMatchObject({ state: 'waiting', nextDate: '2026-10-29', basedOn: { donationType: 'whole_blood' } });
  });

  it('ignores voided, rejected and future-dated records', () => {
    const records = [d('2026-10-01', 'whole_blood', 'voided'), d('2026-10-02', 'whole_blood', 'rejected'), d('2026-12-01'), d('2026-01-01', 'plasma', 'verified')];
    const r = estimateNextEligible(records, intervals, '2026-10-22');
    expect(r).toMatchObject({ state: 'interval_passed', basedOn: { donatedOn: '2026-01-01', verified: true } });
    expect(lastDonationDate(records, '2026-10-22')).toBe('2026-01-01');
  });

  it('respects configured intervals', () => {
    const r = estimateNextEligible([d('2026-10-01')], { ...intervals, whole_blood: 56 }, '2026-10-22');
    expect(r).toMatchObject({ nextDate: '2026-11-26' });
  });
});

import { describe, expect, it } from 'vitest';
import { addDays, ageOn, bangladeshDateTimeToInstant, daysBetween, isIsoDate, todayInBangladesh } from '@/server/domain/dates';

describe('calendar dates', () => {
  it('validates ISO dates strictly', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2023-02-29')).toBe(false);
    expect(isIsoDate('2024-13-01')).toBe(false);
    expect(isIsoDate('24-01-01')).toBe(false);
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2024-01-01', 120)).toBe('2024-04-30');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2024-01-01', '2024-01-01')).toBe(0);
    expect(daysBetween('2024-01-01', '2024-12-31')).toBe(365);
    expect(daysBetween('2025-01-01', '2024-12-31')).toBe(-1);
  });

  it('computes completed years of age, including 29 February birthdays', () => {
    expect(ageOn('2000-06-15', '2018-06-14')).toBe(17);
    expect(ageOn('2000-06-15', '2018-06-15')).toBe(18);
    expect(ageOn('2004-02-29', '2022-02-28')).toBe(17);
    expect(ageOn('2004-02-29', '2022-03-01')).toBe(18);
  });

  it('uses Bangladesh time (UTC+6) for "today"', () => {
    expect(todayInBangladesh(new Date('2026-10-22T17:59:00Z'))).toBe('2026-10-22');
    expect(todayInBangladesh(new Date('2026-10-22T18:00:00Z'))).toBe('2026-10-23');
  });

  it('converts Bangladesh local date and time to an instant', () => {
    expect(bangladeshDateTimeToInstant('2026-10-23', '09:30').toISOString()).toBe('2026-10-23T03:30:00.000Z');
    expect(() => bangladeshDateTimeToInstant('2026-10-23', '25:00')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { BOOKING_WINDOW_DAYS, bookingWindow, neededAtError, neededDateError } from '@/server/domain/booking';
import { bangladeshDateTimeToInstant } from '@/server/domain/dates';

// 22 Oct 2026, 10:00 in Dhaka (UTC+6).
const now = new Date('2026-10-22T04:00:00Z');

describe('15-day booking window (Bangladesh time)', () => {
  it('runs from today through 15 days ahead, inclusive', () => {
    expect(BOOKING_WINDOW_DAYS).toBe(15);
    expect(bookingWindow(now)).toEqual({ first: '2026-10-22', last: '2026-11-06' });
  });

  it('accepts today and exactly 15 days ahead; refuses yesterday and 16 days ahead', () => {
    expect(neededDateError('2026-10-22', now)).toBeNull();
    expect(neededDateError('2026-11-06', now)).toBeNull();
    expect(neededDateError('2026-10-21', now)).toBe('pastDate');
    expect(neededDateError('2026-11-07', now)).toBe('tooFarAhead');
  });

  it('counts days at Bangladesh midnight, not UTC midnight', () => {
    const lastMinute = new Date('2026-10-22T17:59:00Z'); // 23:59 on 22 Oct in Dhaka
    const firstMinute = new Date('2026-10-22T18:00:00Z'); // 00:00 on 23 Oct in Dhaka
    expect(bookingWindow(lastMinute)).toEqual({ first: '2026-10-22', last: '2026-11-06' });
    expect(bookingWindow(firstMinute)).toEqual({ first: '2026-10-23', last: '2026-11-07' });
    expect(neededDateError('2026-10-22', firstMinute)).toBe('pastDate');
    expect(neededDateError('2026-11-07', lastMinute)).toBe('tooFarAhead');
    expect(neededDateError('2026-11-07', firstMinute)).toBeNull();
  });

  it('checks the needed time too: earlier today is allowed for six hours', () => {
    expect(neededAtError(bangladeshDateTimeToInstant('2026-10-22', '05:00'), now)).toBeNull();
    expect(neededAtError(bangladeshDateTimeToInstant('2026-10-22', '03:30'), now)).toBe('pastTime');
    expect(neededAtError(bangladeshDateTimeToInstant('2026-11-06', '23:59'), now)).toBeNull();
    expect(neededAtError(bangladeshDateTimeToInstant('2026-11-07', '00:00'), now)).toBe('tooFarAhead');
    expect(neededAtError(bangladeshDateTimeToInstant('2026-10-21', '23:59'), now)).toBe('pastDate');
  });

  it('leaves malformed dates to the form schema', () => {
    expect(neededDateError('2026-02-30', now)).toBeNull();
    expect(neededDateError('not a date', now)).toBeNull();
  });
});

describe('Bangla time of day', () => {
  it('names the part of the day first, on a 12-hour clock', async () => {
    const { bnTimeOfDay, formatDateTime } = await import('@/i18n/format');
    expect(bnTimeOfDay(4, 30)).toBe('ভোর ৪:৩০');
    expect(bnTimeOfDay(9, 0)).toBe('সকাল ৯:০০');
    expect(bnTimeOfDay(12, 0)).toBe('দুপুর ১২:০০');
    expect(bnTimeOfDay(15, 0)).toBe('বিকেল ৩:০০');
    expect(bnTimeOfDay(18, 45)).toBe('সন্ধ্যা ৬:৪৫');
    expect(bnTimeOfDay(21, 5)).toBe('রাত ৯:০৫');
    expect(bnTimeOfDay(0, 0)).toBe('রাত ১২:০০');
    // 09:00 UTC is 15:00 in Dhaka.
    expect(formatDateTime('bn', new Date('2026-10-23T09:00:00Z'))).toMatch(/২৩ .*২০২৬, বিকেল ৩:০০$/);
    expect(formatDateTime('en', new Date('2026-10-23T09:00:00Z'))).toBe('23 Oct 2026, 15:00');
  });
});

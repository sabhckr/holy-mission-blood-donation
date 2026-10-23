/**
 * When blood can be requested for. A patient or their representative can ask for blood for any
 * day from today up to BOOKING_WINDOW_DAYS days ahead, inclusive, counted in Bangladesh time
 * (Asia/Dhaka). The server checks this on every request; the form only shows the same limits.
 */
import { addDays, compareDates, isIsoDate, todayInBangladesh } from './dates';

export const BOOKING_WINDOW_DAYS = 15;

/** A time earlier today is still accepted this many hours back ("needed this morning"). */
export const PAST_GRACE_HOURS = 6;

/** First and last allowed dates ('YYYY-MM-DD', Bangladesh time). */
export function bookingWindow(now: Date = new Date()): { first: string; last: string } {
  const first = todayInBangladesh(now);
  return { first, last: addDays(first, BOOKING_WINDOW_DAYS) };
}

export type NeededDateError = 'pastDate' | 'pastTime' | 'tooFarAhead';

/** Date-only check for a 'YYYY-MM-DD' value. */
export function neededDateError(date: string, now: Date = new Date()): NeededDateError | null {
  if (!isIsoDate(date)) return null; // the form schema reports malformed dates
  const { first, last } = bookingWindow(now);
  if (compareDates(date, first) < 0) return 'pastDate';
  if (compareDates(date, last) > 0) return 'tooFarAhead';
  return null;
}

/** Full check for the needed date and time as an instant. */
export function neededAtError(neededAt: Date, now: Date = new Date()): NeededDateError | null {
  const byDate = neededDateError(todayInBangladesh(neededAt), now);
  if (byDate) return byDate;
  if (neededAt.getTime() < now.getTime() - PAST_GRACE_HOURS * 3600 * 1000) return 'pastTime';
  return null;
}

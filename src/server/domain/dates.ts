/**
 * Calendar-date helpers. Dates are 'YYYY-MM-DD' strings in Bangladesh time (Asia/Dhaka, UTC+6,
 * no daylight saving). Arithmetic is done on UTC midnights so results never drift by a day.
 */
export const APP_TIME_ZONE = 'Asia/Dhaka';
const DAY_MS = 86_400_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

function toUtc(iso: string): number {
  if (!isIsoDate(iso)) throw new RangeError(`Invalid date: ${iso}`);
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's date in Bangladesh. */
export function todayInBangladesh(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function compareDates(a: string, b: string): number {
  return toUtc(a) - toUtc(b);
}

/** Completed years of age on `onDate`. A 29 February birthday counts from 1 March in common years. */
export function ageOn(dateOfBirth: string, onDate: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** Combine a Bangladesh calendar date and 'HH:MM' local time into an absolute instant. */
export function bangladeshDateTimeToInstant(date: string, time: string): Date {
  if (!isIsoDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new RangeError('Invalid date or time');
  return new Date(`${date}T${time}:00+06:00`);
}

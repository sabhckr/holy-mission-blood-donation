import { APP_TIME_ZONE } from '@/server/domain/dates';
import { INTL_LOCALE, type Locale } from './config';

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale]).format(value);
}

/** Format a 'YYYY-MM-DD' calendar date (no time zone shifting). */
export function formatDate(locale: Locale, isoDate: string, style: 'long' | 'short' = 'long'): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: 'UTC',
    year: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnDigits = (text: string) => text.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

/**
 * A time of day the way people say it in Bangla: the part of the day first, then a 12-hour clock
 * ("দুপুর ৩:০০", "রাত ৯:৩০"). Hours are Bangladesh time, 0–23.
 */
export function bnTimeOfDay(hour: number, minute: number): string {
  const period =
    hour >= 4 && hour < 6 ? 'ভোর' : hour >= 6 && hour < 12 ? 'সকাল' : hour >= 12 && hour < 15 ? 'দুপুর' : hour >= 15 && hour < 18 ? 'বিকেল' : hour >= 18 && hour < 20 ? 'সন্ধ্যা' : 'রাত';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${period} ${bnDigits(String(h12))}:${bnDigits(String(minute).padStart(2, '0'))}`;
}

/** Format an instant in Bangladesh time. */
export function formatDateTime(locale: Locale, value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (locale === 'bn') {
    const day = new Intl.DateTimeFormat(INTL_LOCALE.bn, { timeZone: APP_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    const [hour, minute] = new Intl.DateTimeFormat('en-GB', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .format(date)
      .split(':')
      .map(Number);
    return `${day}, ${bnTimeOfDay(hour, minute)}`;
  }
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatInstantDate(locale: Locale, value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: APP_TIME_ZONE, year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/**
 * Bangla locative ("in X") for a place name: লক্ষ্মীপুর → লক্ষ্মীপুরে, ঢাকা → ঢাকায়, ফেনী → ফেনীতে.
 */
export function bnLocative(name: string): string {
  const last = name.trim().slice(-1);
  if (last === 'া') return `${name}য়`;
  const code = last.codePointAt(0) ?? 0;
  const isConsonant = (code >= 0x0995 && code <= 0x09b9) || (code >= 0x09dc && code <= 0x09df);
  return isConsonant ? `${name}ে` : `${name}তে`;
}

/** "A, B ও C-তে" (Bangla, locative on the last name) or "A, B and C" (English). */
export function placeList(locale: Locale, names: string[], and: string): string {
  if (names.length === 0) return '';
  const items = locale === 'bn' ? [...names.slice(0, -1), bnLocative(names[names.length - 1])] : names;
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`;
}

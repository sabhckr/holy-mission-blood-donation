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

/** Format an instant in Bangladesh time. */
export function formatDateTime(locale: Locale, value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
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

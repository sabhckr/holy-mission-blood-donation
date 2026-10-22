import { cookies } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';
import { formatDate, formatDateTime, formatInstantDate, formatNumber } from './format';
import { getMessages, type Messages } from './messages';

/** The visitor's chosen language (cookie), Bangla by default. */
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

export interface I18n {
  locale: Locale;
  t: Messages;
  n: (value: number) => string;
  date: (isoDate: string, style?: 'long' | 'short') => string;
  dateTime: (value: Date | string) => string;
  instantDate: (value: Date | string) => string;
}

export const getI18n = cache(async (): Promise<I18n> => {
  const locale = await getLocale();
  return {
    locale,
    t: getMessages(locale),
    n: (value) => formatNumber(locale, value),
    date: (isoDate, style) => formatDate(locale, isoDate, style),
    dateTime: (value) => formatDateTime(locale, value),
    instantDate: (value) => formatInstantDate(locale, value),
  };
});

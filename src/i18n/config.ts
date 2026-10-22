export const LOCALES = ['bn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'bn';
export const LOCALE_COOKIE = 'hm_lang';

export function isLocale(value: unknown): value is Locale {
  return value === 'bn' || value === 'en';
}

/** Intl locale tags: Bangla uses Bangla digits; English uses day-month-year like Bangladesh. */
export const INTL_LOCALE: Record<Locale, string> = { bn: 'bn-BD', en: 'en-GB' };

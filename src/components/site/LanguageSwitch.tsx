import type { Locale } from '@/i18n/config';

/**
 * One small button that switches to the other language (a plain link: /lang sets the cookie and
 * returns to the same page, so it works without JavaScript). Its accessible name is the full
 * language name.
 */
export function LanguageSwitch({ locale, currentUrl, label }: { locale: Locale; currentUrl: string; label: string }) {
  const to: Locale = locale === 'bn' ? 'en' : 'bn';
  const href = `/lang?to=${to}&next=${encodeURIComponent(currentUrl)}`;
  return (
    <a className="lang" href={href} lang={to} hrefLang={to} aria-label={to === 'en' ? 'English' : 'বাংলা'} title={label}>
      {to === 'en' ? 'EN' : 'বাংলা'}
    </a>
  );
}

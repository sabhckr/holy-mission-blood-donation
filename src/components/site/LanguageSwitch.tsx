import type { Locale } from '@/i18n/config';

/** Plain links (no JavaScript): /lang sets the cookie and returns to the same page. */
export function LanguageSwitch({ locale, currentUrl, label }: { locale: Locale; currentUrl: string; label: string }) {
  const href = (to: Locale) => `/lang?to=${to}&next=${encodeURIComponent(currentUrl)}`;
  return (
    <nav className="lang-switch" aria-label={label}>
      {locale === 'bn' ? (
        <span aria-current="true" lang="bn">
          বাংলা
        </span>
      ) : (
        <a href={href('bn')} lang="bn" hrefLang="bn">
          বাংলা
        </a>
      )}
      <span className="sep" aria-hidden="true" />
      {locale === 'en' ? (
        <span aria-current="true" lang="en">
          English
        </span>
      ) : (
        <a href={href('en')} lang="en" hrefLang="en">
          English
        </a>
      )}
    </nav>
  );
}

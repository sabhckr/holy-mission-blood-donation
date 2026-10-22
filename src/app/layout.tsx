import { appBaseUrl } from '@/server/config';
import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Bengali } from 'next/font/google';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { managedCommunities } from '@/server/services/communities';
import { unreadCount } from '@/server/services/notifications';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import './globals.css';

const bangla = Noto_Sans_Bengali({ subsets: ['bengali', 'latin'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-bangla' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: `${t.common.brand} — ${t.common.slogan}`, template: `%s | ${t.common.brand}` },
    description: t.home.metaDescription,
    applicationName: t.common.brand,
    metadataBase: new URL(appBaseUrl()),
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#b4232c' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { t, locale } = await getI18n();
  const actor = await getActor();
  const currentUrl = (await headers()).get('x-url') ?? '/';
  const [unread, managed] = actor ? await Promise.all([unreadCount(actor.userId), managedCommunities(actor)]) : [0, []];
  return (
    <html lang={locale} className={bangla.variable}>
      <body>
        <a className="skip-link" href="#main">
          {t.common.skipToContent}
        </a>
        <div className="emergency-strip">
          <div className="container">
            {t.home.emergencyStrip}{' '}
            <Link href="/help#emergency">{t.home.emergencyStripLink}</Link>
          </div>
        </div>
        <SiteHeader t={t} locale={locale} actor={actor} currentUrl={currentUrl} unread={unread} manageSlug={managed[0]?.slug ?? null} />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter t={t} />
      </body>
    </html>
  );
}

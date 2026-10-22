import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';

const ITEMS = [
  ['/account', 'dashboard'],
  ['/account/profile', 'profile'],
  ['/account/privacy', 'privacy'],
  ['/account/donations', 'donations'],
  ['/account/contact-requests', 'contactRequests'],
  ['/account/notifications', 'notifications'],
  ['/account/communities', 'communities'],
  ['/account/security', 'security'],
] as const;

/** Account area shell: side navigation + page. Each page does its own sign-in check. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { t } = await getI18n();
  const path = ((await headers()).get('x-url') ?? '/account').split('?')[0];
  return (
    <div className="container section layout-sidebar">
      <nav className="side-nav" aria-label={t.account.nav.label}>
        <ul>
          {ITEMS.map(([href, key]) => (
            <li key={href}>
              <Link className="nav-link" href={href} aria-current={path === href ? 'page' : undefined}>
                {t.account.nav[key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="stack" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

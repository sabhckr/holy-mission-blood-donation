import Link from 'next/link';
import { Bell, Menu } from 'lucide-react';
import type { Messages } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import type { Actor } from '@/server/policy';
import { BrandMark } from './BrandMark';
import { LanguageSwitch } from './LanguageSwitch';

interface NavItem {
  href: string;
  label: string;
}

function isCurrent(currentPath: string, href: string) {
  return href === '/' ? currentPath === '/' : currentPath === href || currentPath.startsWith(`${href}/`);
}

export function SiteHeader({
  t,
  locale,
  actor,
  currentUrl,
  unread,
  manageSlug,
}: {
  t: Messages;
  locale: Locale;
  actor: Actor | null;
  currentUrl: string;
  unread: number;
  manageSlug: string | null;
}) {
  const path = currentUrl.split('?')[0];
  const primary: NavItem[] = [
    { href: '/donors', label: t.common.nav.findDonors },
    { href: '/requests', label: t.common.nav.requests },
    { href: '/communities', label: t.common.nav.communities },
    { href: '/help', label: t.common.nav.help },
  ];
  const accountItems: NavItem[] = actor
    ? [
        { href: '/account', label: t.common.nav.account },
        ...(manageSlug ? [{ href: `/manage/${manageSlug}`, label: t.common.nav.manageCommunity }] : []),
        ...(actor.role === 'admin' ? [{ href: '/admin', label: t.common.nav.admin }] : []),
      ]
    : [];
  const link = (item: NavItem) => (
    <li key={item.href}>
      <Link className="nav-link" href={item.href} aria-current={isCurrent(path, item.href) ? 'page' : undefined}>
        {item.label}
      </Link>
    </li>
  );
  const signOut = (
    <form action="/signout" method="post" className="inline-form">
      <button type="submit" className="nav-link btn-ghost" style={{ border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer' }}>
        {t.common.nav.signOut}
      </button>
    </form>
  );
  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href="/" className="brand" aria-label={t.common.brand}>
          <BrandMark />
          <span className="brand-text">
            {t.common.brandShort}
            <small>{t.common.brandSub}</small>
          </span>
        </Link>

        <nav className="nav-desktop" aria-label={t.common.nav.main}>
          <ul>
            {primary.map(link)}
            {accountItems.map(link)}
            {actor ? (
              <>
                <li>
                  <Link className="nav-link" href="/account/notifications" aria-label={`${t.common.nav.notifications}${unread ? ` (${unread})` : ''}`}>
                    <Bell size={18} aria-hidden="true" />
                    {unread > 0 && <span className="badge badge-danger">{unread}</span>}
                  </Link>
                </li>
                <li>{signOut}</li>
              </>
            ) : (
              <>
                <li>
                  <Link className="nav-link" href="/signin" aria-current={isCurrent(path, '/signin') ? 'page' : undefined}>
                    {t.common.nav.signIn}
                  </Link>
                </li>
                <li>
                  <Link className="btn btn-primary btn-sm" href="/register">
                    {t.common.nav.becomeDonor}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>

        <LanguageSwitch locale={locale} currentUrl={currentUrl} label={t.common.languageSwitchLabel} />

        <details className="nav-mobile">
          <summary aria-label={t.common.nav.menu}>
            <Menu size={20} aria-hidden="true" />
            <span>{t.common.nav.menu}</span>
            {unread > 0 && <span className="badge badge-danger">{unread}</span>}
          </summary>
          <nav className="nav-mobile-panel" aria-label={t.common.nav.main}>
            <ul>
              <li>
                <Link className="nav-link" href="/requests/new" style={{ color: 'var(--brand-strong)', fontWeight: 700 }}>
                  {t.common.nav.newRequest}
                </Link>
              </li>
              {primary.map(link)}
            </ul>
            <hr />
            <ul>
              {actor ? (
                <>
                  {accountItems.map(link)}
                  <li>
                    <Link className="nav-link" href="/account/notifications">
                      {t.common.nav.notifications}
                      {unread > 0 && <span className="badge badge-danger">{unread}</span>}
                    </Link>
                  </li>
                  <li>{signOut}</li>
                </>
              ) : (
                <>
                  <li>
                    <Link className="nav-link" href="/signin">
                      {t.common.nav.signIn}
                    </Link>
                  </li>
                  <li>
                    <Link className="nav-link" href="/register">
                      {t.common.nav.becomeDonor}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}

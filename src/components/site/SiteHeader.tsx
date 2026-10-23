import Link from 'next/link';
import { Bell, Building2, ClipboardList, HeartHandshake, LifeBuoy, LogIn, LogOut, Menu, Search, Settings, ShieldCheck, Siren, UserRound, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Messages } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';
import { isStaff, type Actor } from '@/server/policy';
import { BrandMark } from './BrandMark';
import { LanguageSwitch } from './LanguageSwitch';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

function isCurrent(currentPath: string, href: string) {
  return href === '/' ? currentPath === '/' : currentPath === href || currentPath.startsWith(`${href}/`);
}

/**
 * Simple header: logo, the two most used links on wide screens, the language toggle and one menu
 * that holds everything (the same menu on phones and computers).
 */
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
  const nav = t.common.nav;
  const path = currentUrl.split('?')[0];
  const current = (href: string) => (isCurrent(path, href) ? 'page' : undefined);
  const main: NavItem[] = [
    { href: '/donors', label: nav.findDonors, icon: Search },
    { href: '/register', label: nav.becomeDonor, icon: HeartHandshake },
    { href: '/requests/new', label: nav.newRequest, icon: Siren },
    { href: '/requests', label: nav.requests, icon: ClipboardList },
    { href: '/communities', label: nav.communities, icon: Users },
    { href: '/communities/new', label: nav.registerCommunity, icon: Building2 },
    { href: '/help', label: nav.help, icon: LifeBuoy },
  ];
  const mine: NavItem[] = actor
    ? [
        { href: '/account', label: nav.account, icon: UserRound },
        { href: '/account/notifications', label: nav.notifications, icon: Bell },
        ...(manageSlug ? [{ href: `/manage/${manageSlug}`, label: nav.manageCommunity, icon: Settings }] : []),
        ...(isStaff(actor) ? [{ href: '/admin', label: nav.admin, icon: ShieldCheck }] : []),
      ]
    : [{ href: '/signin', label: nav.signIn, icon: LogIn }];
  const item = (i: NavItem) => (
    <li key={i.href}>
      <Link className="nav-link" href={i.href} aria-current={current(i.href)}>
        <i.icon size={18} aria-hidden="true" />
        {i.label}
        {i.href === '/account/notifications' && unread > 0 && <span className="badge badge-danger">{unread}</span>}
      </Link>
    </li>
  );
  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href="/" className="brand" aria-label={t.common.brand}>
          <span className="logo" aria-hidden="true">
            <BrandMark size={24} />
          </span>
          <span className="brand-text">
            <span className="brand-name">{t.common.logoName}</span>
            <span className="brand-sub">{t.common.logoSub}</span>
          </span>
        </Link>

        <nav className="nav-quick" aria-label={nav.main}>
          <Link className="small-link" href="/donors" aria-current={current('/donors')}>
            {nav.findDonors}
          </Link>
          <Link className="small-link" href="/requests/new" aria-current={current('/requests/new')}>
            {nav.newRequest}
          </Link>
          {actor ? (
            <Link className="small-link" href="/account" aria-current={current('/account')}>
              {nav.account}
            </Link>
          ) : (
            <Link className="small-link" href="/signin" aria-current={current('/signin')}>
              {nav.signIn}
            </Link>
          )}
        </nav>

        <LanguageSwitch locale={locale} currentUrl={currentUrl} label={t.common.languageSwitchLabel} />

        <details className="nav-mobile" data-menu>
          <summary aria-label={nav.menu}>
            <Menu size={20} aria-hidden="true" />
            <span>{nav.menu}</span>
            {unread > 0 && <span className="badge badge-danger">{unread}</span>}
          </summary>
          <nav className="nav-mobile-panel" aria-label={nav.main}>
            <ul>{main.map(item)}</ul>
            <hr />
            <ul>
              {mine.map(item)}
              {actor && (
                <li>
                  <form action="/signout" method="post" className="inline-form">
                    <button type="submit" className="nav-link" style={{ border: 0, background: 'transparent', font: 'inherit', cursor: 'pointer' }}>
                      <LogOut size={18} aria-hidden="true" />
                      {nav.signOut}
                    </button>
                  </form>
                </li>
              )}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}

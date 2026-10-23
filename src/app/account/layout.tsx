import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { Bell, Building2, Droplet, Inbox, LayoutDashboard, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { SectionNav } from '@/components/account/SectionNav';

const ITEMS = [
  ['/account', 'dashboard', LayoutDashboard],
  ['/account/profile', 'profile', UserRound],
  ['/account/privacy', 'privacy', ShieldCheck],
  ['/account/donations', 'donations', Droplet],
  ['/account/contact-requests', 'contactRequests', Inbox],
  ['/account/notifications', 'notifications', Bell],
  ['/account/communities', 'communities', Building2],
  ['/account/security', 'security', LockKeyhole],
] as const;

/** Account area shell: section navigation + page. Each page does its own sign-in check. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { t } = await getI18n();
  const path = ((await headers()).get('x-url') ?? '/account').split('?')[0];
  return (
    <div className="container acct-shell layout-sidebar">
      <SectionNav
        id="account-nav"
        label={t.account.nav.label}
        title={t.account.title}
        items={ITEMS.map(([href, key, icon]) => ({ href, label: t.account.nav[key], icon, current: path === href }))}
      />
      <div className="acct-main">{children}</div>
    </div>
  );
}

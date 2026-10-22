import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { can, type PlatformPermission } from '@/server/policy';

type NavKey = 'overview' | 'donors' | 'verifications' | 'reports' | 'duplicates' | 'requests' | 'communities' | 'operatingAreas' | 'users' | 'access' | 'locations' | 'settings' | 'audit' | 'export' | 'deletions';

/** Every staff page and the permission it needs; the menu only lists what the viewer may open. */
const ITEMS: { key: NavKey; href: string; permission: PlatformPermission }[] = [
  { key: 'overview', href: '/admin', permission: 'overview.view' },
  { key: 'donors', href: '/admin/donors', permission: 'donors.review' },
  { key: 'verifications', href: '/admin/verifications', permission: 'verifications.review' },
  { key: 'reports', href: '/admin/reports', permission: 'reports.handle' },
  { key: 'duplicates', href: '/admin/duplicates', permission: 'duplicates.review' },
  { key: 'requests', href: '/admin/requests', permission: 'requests.view' },
  { key: 'communities', href: '/admin/communities', permission: 'communities.review' },
  { key: 'operatingAreas', href: '/admin/operating-areas', permission: 'operating_areas.manage' },
  { key: 'users', href: '/admin/users', permission: 'users.manage' },
  { key: 'access', href: '/admin/access', permission: 'access.review' },
  { key: 'locations', href: '/admin/locations', permission: 'locations.manage' },
  { key: 'settings', href: '/admin/settings', permission: 'settings.manage' },
  { key: 'audit', href: '/admin/audit', permission: 'audit.view' },
  { key: 'export', href: '/admin/export', permission: 'data.export' },
  { key: 'deletions', href: '/admin/deletions', permission: 'deletions.process' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const currentUrl = (await headers()).get('x-url') ?? '/admin';
  const actor = await requirePermission(currentUrl.startsWith('/admin') ? currentUrl : '/admin', 'staff.panel');
  const { t } = await getI18n();
  const path = currentUrl.split('?')[0];
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));
  const items = ITEMS.filter((item) => can(actor, item.permission));
  return (
    <div className="container section layout-sidebar">
      <nav className="side-nav stack-sm" aria-label={t.admin.navLabel}>
        <p className="small muted" style={{ margin: 0 }}>
          {t.admin.signedInAs(t.common.roles[actor.role])}
        </p>
        <ul>
          {items.map((item) => (
            <li key={item.key}>
              <Link className="nav-link" href={item.href} aria-current={current(item.href) ? 'page' : undefined}>
                {t.admin.nav[item.key]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="stack-lg" style={{ minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

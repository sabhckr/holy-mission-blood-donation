import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { can, type PlatformPermission } from '@/server/policy';
import { AdminNav, type AdminNavGroup } from '@/components/admin/AdminNav';
import { ADMIN_ICONS, type AdminNavKey } from '@/components/admin/icons';

type GroupKey = 'main' | 'safety' | 'setup' | 'people';

/** Every staff page, its menu group and the permission it needs; the menu only lists what the viewer may open. */
const ITEMS: { key: AdminNavKey; group: GroupKey; href: string; permission: PlatformPermission }[] = [
  { key: 'overview', group: 'main', href: '/admin', permission: 'overview.view' },
  { key: 'donors', group: 'main', href: '/admin/donors', permission: 'donors.review' },
  { key: 'communities', group: 'main', href: '/admin/communities', permission: 'communities.review' },
  { key: 'requests', group: 'main', href: '/admin/requests', permission: 'requests.view' },
  { key: 'verifications', group: 'safety', href: '/admin/verifications', permission: 'verifications.review' },
  { key: 'reports', group: 'safety', href: '/admin/reports', permission: 'reports.handle' },
  { key: 'duplicates', group: 'safety', href: '/admin/duplicates', permission: 'duplicates.review' },
  { key: 'operatingAreas', group: 'setup', href: '/admin/operating-areas', permission: 'operating_areas.manage' },
  { key: 'locations', group: 'setup', href: '/admin/locations', permission: 'locations.manage' },
  { key: 'settings', group: 'setup', href: '/admin/settings', permission: 'settings.manage' },
  { key: 'users', group: 'people', href: '/admin/users', permission: 'users.manage' },
  { key: 'access', group: 'people', href: '/admin/access', permission: 'access.review' },
  { key: 'audit', group: 'people', href: '/admin/audit', permission: 'audit.view' },
  { key: 'export', group: 'people', href: '/admin/export', permission: 'data.export' },
  { key: 'deletions', group: 'people', href: '/admin/deletions', permission: 'deletions.process' },
];

const GROUPS: GroupKey[] = ['main', 'safety', 'setup', 'people'];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const currentUrl = (await headers()).get('x-url') ?? '/admin';
  const actor = await requirePermission(currentUrl.startsWith('/admin') ? currentUrl : '/admin', 'staff.panel');
  const { t } = await getI18n();
  const path = currentUrl.split('?')[0];
  const current = (href: string) => (href === '/admin' ? path === '/admin' : path === href || path.startsWith(`${href}/`));
  const items = ITEMS.filter((item) => can(actor, item.permission));
  const groups: AdminNavGroup[] = GROUPS.map((group) => ({
    key: group,
    title: group === 'main' ? undefined : t.admin.navGroups[group],
    items: items
      .filter((item) => item.group === group)
      .map((item) => ({ key: item.key, href: item.href, label: t.admin.nav[item.key], icon: ADMIN_ICONS[item.key], current: current(item.href) })),
  })).filter((group) => group.items.length > 0);
  return (
    <div className="admin-shell section">
      <div className="container layout-sidebar">
        <AdminNav
          groups={groups}
          label={t.admin.navLabel}
          panelTitle={t.admin.panelTitle}
          roleLine={t.admin.signedInAs(t.common.roles[actor.role])}
          menuLabel={t.admin.menu}
          scopeNote={actor.role === 'moderator' ? t.admin.moderatorScope : undefined}
        />
        <div className="admin-main">{children}</div>
      </div>
    </div>
  );
}

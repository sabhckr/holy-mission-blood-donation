import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';

const ITEMS = ['overview', 'users', 'communities', 'verifications', 'requests', 'reports', 'duplicates', 'locations', 'audit', 'settings', 'access', 'export', 'deletions'] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const currentUrl = (await headers()).get('x-url') ?? '/admin';
  await requireAdmin(currentUrl.startsWith('/admin') ? currentUrl : '/admin');
  const { t } = await getI18n();
  const path = currentUrl.split('?')[0];
  const href = (item: (typeof ITEMS)[number]) => (item === 'overview' ? '/admin' : `/admin/${item}`);
  const current = (item: (typeof ITEMS)[number]) => (item === 'overview' ? path === '/admin' : path === href(item) || path.startsWith(`${href(item)}/`));
  return (
    <div className="container section layout-sidebar">
      <nav className="side-nav" aria-label={t.admin.navLabel}>
        <ul>
          {ITEMS.map((item) => (
            <li key={item}>
              <Link className="nav-link" href={href(item)} aria-current={current(item) ? 'page' : undefined}>
                {t.admin.nav[item]}
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

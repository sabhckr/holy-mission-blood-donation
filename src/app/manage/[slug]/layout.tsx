import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import { Alert, Badge, NoAccess, PageHeader } from '@/components/ui';
import { loadManageContext } from './_context';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.community.manageTitle, robots: { index: false, follow: false } };
}

export default async function ManageLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, locale } = await getI18n();
  const { ctx } = await loadManageContext(slug);
  if (!ctx) notFound();
  if (!ctx.caps.has('view_dashboard')) return <NoAccess t={t} />;
  const c = t.community;
  const base = `/manage/${ctx.community.slug}`;
  const path = ((await headers()).get('x-url') ?? '').split('?')[0];
  const items = [
    { href: base, label: c.nav.overview },
    { href: `${base}/members`, label: c.nav.members },
    { href: `${base}/verifications`, label: c.nav.verifications },
    { href: `${base}/donors`, label: c.nav.donors },
    { href: `${base}/requests`, label: c.nav.requests },
    { href: `${base}/settings`, label: c.nav.settings },
  ];
  const name = locale === 'en' && ctx.community.nameEn ? ctx.community.nameEn : ctx.community.name;
  const status = ctx.community.status;
  return (
    <>
      <PageHeader title={name} crumbs={[{ href: `/communities/${ctx.community.slug}`, label: c.manageTitle }]}>
        <Badge tone={status === 'approved' ? 'success' : status === 'pending' ? 'warning' : 'danger'}>
          {c.statusLabel}: {t.common.communityStatus[status]}
        </Badge>
      </PageHeader>
      <div className="container section layout-sidebar">
        <nav className="side-nav" aria-label={c.manageNav}>
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link className="nav-link" href={item.href} aria-current={path === item.href || (item.href !== base && path.startsWith(`${item.href}/`)) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="stack">
          {status === 'pending' && <Alert tone="info">{c.managePendingNotice}</Alert>}
          {(status === 'suspended' || status === 'rejected') && <Alert tone="warning">{c.manageSuspendedNotice}</Alert>}
          {children}
        </div>
      </div>
    </>
  );
}

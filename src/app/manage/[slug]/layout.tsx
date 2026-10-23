import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { BadgeCheck, ExternalLink, LayoutDashboard, Search, Settings, Siren, Users } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { pendingCounts } from '@/server/services/community-queries';
import { SectionNav } from '@/components/account/SectionNav';
import { AffiliationBadge, COMMUNITY_STATUS, CommunityStatusBadge } from '@/components/community/badges';
import { NoAccess, PageHeader } from '@/components/ui';
import { loadManageContext } from './_context';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.community.manageTitle, robots: { index: false, follow: false } };
}

export default async function ManageLayout({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, n, locale } = await getI18n();
  const { ctx } = await loadManageContext(slug);
  if (!ctx) notFound();
  if (!ctx.caps.has('view_dashboard')) return <NoAccess t={t} />;
  const c = t.community;
  const base = `/manage/${ctx.community.slug}`;
  const path = ((await headers()).get('x-url') ?? '').split('?')[0];
  // Waiting items shown as small counts in the menu (only once the organisation can act on them).
  const pending = ctx.caps.has('view_reports') ? await pendingCounts(ctx.community.id) : null;
  const count = (v: number | undefined) => (v && v > 0 ? n(v) : undefined);
  const items = [
    { href: base, label: c.nav.overview, icon: LayoutDashboard },
    { href: `${base}/members`, label: c.nav.members, icon: Users, count: count(pending?.members) },
    { href: `${base}/verifications`, label: c.nav.verifications, icon: BadgeCheck, count: count(pending ? pending.records + pending.profiles : 0) },
    { href: `${base}/donors`, label: c.nav.donors, icon: Search },
    { href: `${base}/requests`, label: c.nav.requests, icon: Siren, count: count(pending?.openRequests) },
    { href: `${base}/settings`, label: c.nav.settings, icon: Settings },
  ].map((item) => ({ ...item, current: path === item.href || (item.href !== base && path.startsWith(`${item.href}/`)) }));
  const name = locale === 'en' && ctx.community.nameEn ? ctx.community.nameEn : ctx.community.name;
  const status = ctx.community.status;
  const notice = status === 'pending' ? c.managePendingNotice : status === 'suspended' ? c.manageSuspendedNotice : status === 'rejected' ? c.manageRejectedNotice : null;
  const NoticeIcon = COMMUNITY_STATUS[status].icon;
  return (
    <>
      <PageHeader
        title={name}
        crumbs={[{ href: '/communities', label: t.common.nav.communities }]}
        crumbsLabel={t.common.nav.breadcrumbs}
      >
        <div className="org-head-side">
          <div className="acct-item-badges" style={{ marginTop: 0 }}>
            <CommunityStatusBadge status={status} t={t} withLabel />
            <AffiliationBadge affiliation={ctx.community.affiliation} t={t} />
          </div>
          <Link className="section-link" href={`/communities/${ctx.community.slug}`}>
            <ExternalLink size={16} aria-hidden="true" />
            {c.publicPage}
          </Link>
        </div>
      </PageHeader>
      <div className="container acct-shell">
        {notice && (
          <div className={`alert ${status === 'pending' ? 'alert-warning' : 'alert-error'} org-notice`} role="status">
            <NoticeIcon size={20} aria-hidden="true" />
            <div>
              <p style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                {c.statusLabel}: {t.common.communityStatus[status]}
              </p>
              <p>{notice}</p>
            </div>
          </div>
        )}
        <div className="layout-sidebar">
          <SectionNav id="manage-nav" label={c.manageNav} title={c.manageTitle} items={items} />
          <div className="acct-main">{children}</div>
        </div>
      </div>
    </>
  );
}

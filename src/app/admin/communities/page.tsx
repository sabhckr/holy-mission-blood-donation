import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';
import { adminCommunities } from '@/server/services/admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminAction } from '@/components/admin/AdminAction';
import { Badge, EmptyState } from '@/components/ui';
import { reviewCommunityAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.communities.title, robots: { index: false } };
}

const STATUSES = ['pending', 'approved', 'suspended', 'rejected'] as const;

export default async function AdminCommunitiesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requireAdmin('/admin/communities');
  const { t, n, instantDate, locale } = await getI18n();
  const parsed = z.enum(STATUSES).safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : null;
  const [rows, index] = await Promise.all([adminCommunities(actor, status), getLocationIndex()]);
  const c = t.admin.communities;
  const pending = t.common.actions.submitting;
  const reasonField = { name: 'reason', label: c.decisionReason, hint: t.admin.reasonHint };
  return (
    <>
      <header className="stack-sm">
        <h1>{c.title}</h1>
        <p className="muted">{c.intro}</p>
      </header>
      <nav className="cluster-sm" aria-label={c.status}>
        <Link className={`btn btn-sm${status === null ? ' btn-dark' : ''}`} href="/admin/communities" aria-current={status === null ? 'page' : undefined}>
          {t.admin.any}
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} className={`btn btn-sm${status === s ? ' btn-dark' : ''}`} href={`/admin/communities?status=${s}`} aria-current={status === s ? 'page' : undefined}>
            {t.common.communityStatus[s]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState title={c.empty} />
      ) : (
        <ul className="list-plain stack">
          {rows.map(({ community, creatorName, members }) => (
            <li key={community.id} className="card stack-sm">
              <div className="cluster between">
                <h2 className="card-title">{community.name}</h2>
                <Badge tone={community.status === 'approved' ? 'success' : community.status === 'pending' ? 'warning' : 'danger'}>{t.common.communityStatus[community.status]}</Badge>
              </div>
              <dl className="dl">
                <dt>{c.district}</dt>
                <dd>{labelFrom(index, locale, community.districtId, community.divisionId)}</dd>
                <dt>{c.members}</dt>
                <dd>{n(members)}</dd>
                <dt>{c.created}</dt>
                <dd>{instantDate(community.createdAt)}</dd>
                <dt>{c.creator}</dt>
                <dd>{creatorName ?? t.admin.none}</dd>
                {community.statusReason && (
                  <>
                    <dt>{c.reason}</dt>
                    <dd>{community.statusReason}</dd>
                  </>
                )}
              </dl>
              {community.description && <p className="small">{community.description}</p>}
              <div className="cluster-sm">
                <Link href={`/communities/${community.slug}`}>{c.publicPage}</Link>
                <Link href={`/manage/${community.slug}`}>{c.manage}</Link>
              </div>
              <div className="grid grid-2">
                {community.status === 'pending' && (
                  <>
                    <AdminAction action={reviewCommunityAction} hidden={{ communityId: community.id, decision: 'approved' }} submit={c.approve} pending={pending} tone="primary" note={reasonField} />
                    <AdminAction action={reviewCommunityAction} hidden={{ communityId: community.id, decision: 'rejected' }} submit={c.reject} pending={pending} tone="danger" note={reasonField} />
                  </>
                )}
                {community.status === 'approved' && (
                  <AdminAction action={reviewCommunityAction} hidden={{ communityId: community.id, decision: 'suspended' }} submit={c.suspend} pending={pending} tone="danger" note={reasonField} />
                )}
                {(community.status === 'suspended' || community.status === 'rejected') && (
                  <AdminAction action={reviewCommunityAction} hidden={{ communityId: community.id, decision: 'approved' }} submit={community.status === 'suspended' ? c.reinstate : c.approve} pending={pending} tone="primary" note={reasonField} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

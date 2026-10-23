import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Plus, Search, Settings, TriangleAlert } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { communityCapabilities } from '@/server/policy';
import { myCommunities } from '@/server/services/communities';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CommunityStatusBadge, MembershipBadge, RoleBadge } from '@/components/community/badges';
import { IconTile, PageHead } from '@/components/account/bits';
import { EmptyState } from '@/components/ui';
import { leaveCommunityAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.communities.title, robots: { index: false } };
}

export default async function MyCommunitiesPage() {
  const { t, locale } = await getI18n();
  const c = t.account.communities;
  const actor = await requireActor('/account/communities');
  const rows = await myCommunities(actor);

  return (
    <>
      <PageHead title={c.title} intro={c.intro} />
      {rows.length === 0 ? (
        <EmptyState icon={<Building2 size={36} aria-hidden="true" />} title={c.empty}>
          <p className="muted">{c.emptyBody}</p>
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" href="/communities">
              <Search size={18} aria-hidden="true" />
              {c.find}
            </Link>
            <Link className="btn" href="/communities/new">
              {c.register}
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <ul className="acct-list">
            {rows.map(({ membership, community }) => {
              const canManage = communityCapabilities(actor, membership, community.status).has('view_dashboard');
              const name = locale === 'en' && community.nameEn ? community.nameEn : community.name;
              const canLeave = membership.status === 'active' || membership.status === 'pending';
              return (
                <li key={membership.id} className="card acct-item">
                  <div className="acct-item-head">
                    <IconTile icon={Building2} tone="neutral" />
                    <div>
                      <h2 className="acct-item-title">
                        <Link href={`/communities/${community.slug}`}>{name}</Link>
                      </h2>
                      <div className="acct-item-badges">
                        <CommunityStatusBadge status={community.status} t={t} />
                        {membership.status === 'active' && <RoleBadge role={membership.role} t={t} />}
                        <MembershipBadge status={membership.status} t={t} />
                      </div>
                    </div>
                  </div>
                  <div className="acct-actions">
                    {canManage && (
                      <Link className="btn btn-dark btn-sm" href={`/manage/${community.slug}`}>
                        <Settings size={16} aria-hidden="true" />
                        {c.manage}
                      </Link>
                    )}
                    <Link className="btn btn-sm" href={`/communities/${community.slug}`}>
                      {c.view}
                    </Link>
                  </div>
                  {canLeave && (
                    <div className="acct-danger-zone">
                      <p>
                        <TriangleAlert size={16} aria-hidden="true" />
                        <span>{membership.status === 'pending' ? c.withdrawConsequence : c.leaveConsequence}</span>
                      </p>
                      <ActionForm action={leaveCommunityAction} className="stack-sm">
                        <input type="hidden" name="communityId" value={community.id} />
                        <SubmitButton label={membership.status === 'pending' ? c.withdraw : c.leave} pendingLabel={t.common.actions.saving} className="btn btn-sm btn-danger" />
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="acct-actions">
            <Link className="btn btn-soft" href="/communities">
              <Search size={18} aria-hidden="true" />
              {c.find}
            </Link>
            <Link className="section-link" href="/communities/new">
              <Plus size={16} aria-hidden="true" />
              {c.register}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </>
      )}
    </>
  );
}

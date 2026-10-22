import type { Metadata } from 'next';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { communityCapabilities } from '@/server/policy';
import { myCommunities } from '@/server/services/communities';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { Badge, EmptyState } from '@/components/ui';
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
      <h1>{c.title}</h1>
      <p>{c.intro}</p>
      {rows.length === 0 ? (
        <EmptyState icon={<Users size={36} aria-hidden="true" />} title={c.empty}>
          <div className="cluster" style={{ justifyContent: 'center' }}>
            <Link className="btn btn-primary" href="/communities">
              {c.find}
            </Link>
            <Link className="btn" href="/communities/new">
              {c.register}
            </Link>
          </div>
        </EmptyState>
      ) : (
        <>
          <ul className="list-plain stack">
            {rows.map(({ membership, community }) => {
              const canManage = communityCapabilities(actor, membership, community.status).has('view_dashboard');
              return (
                <li key={membership.id} className="card card-tight stack-sm">
                  <div className="cluster between">
                    <strong>
                      <Link href={`/communities/${community.slug}`}>{locale === 'en' && community.nameEn ? community.nameEn : community.name}</Link>
                    </strong>
                    <Badge tone={community.status === 'approved' ? 'success' : community.status === 'pending' ? 'warning' : 'danger'}>
                      {t.common.communityStatus[community.status]}
                    </Badge>
                  </div>
                  <dl className="dl small">
                    <dt>{c.role}</dt>
                    <dd>{t.common.roles[membership.role]}</dd>
                    <dt>{c.status}</dt>
                    <dd>{c.membershipStatus[membership.status]}</dd>
                  </dl>
                  <div className="cluster-sm">
                    {canManage && (
                      <Link className="btn btn-primary btn-sm" href={`/manage/${community.slug}`}>
                        {c.manage}
                      </Link>
                    )}
                    <Link className="btn btn-sm" href={`/communities/${community.slug}`}>
                      {c.view}
                    </Link>
                    <ActionForm action={leaveCommunityAction} className="stack-sm">
                      <input type="hidden" name="communityId" value={community.id} />
                      <SubmitButton label={membership.status === 'pending' ? c.withdraw : c.leave} pendingLabel={t.common.actions.saving} className="btn btn-sm btn-danger" />
                    </ActionForm>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="cluster">
            <Link href="/communities">{c.find}</Link>
            <Link href="/communities/new">{c.register}</Link>
          </div>
        </>
      )}
    </>
  );
}

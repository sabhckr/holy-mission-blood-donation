import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Mail, Phone, Siren } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { db } from '@/server/db/client';
import { communities } from '@/server/db/schema';
import { REPORT_REASONS } from '@/server/domain/constants';
import { formatBdPhone } from '@/server/domain/phone';
import { getPublicCommunity } from '@/server/services/communities';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { eq } from 'drizzle-orm';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { ReportForm } from '@/components/ReportForm';
import { Alert, Badge, PageHeader } from '@/components/ui';
import { joinCommunityAction } from '../actions';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { t, locale } = await getI18n();
  const { slug } = await params;
  const [row] = await db
    .select({ name: communities.name, nameEn: communities.nameEn, status: communities.status })
    .from(communities)
    .where(eq(communities.slug, slug.slice(0, 80)));
  if (!row || row.status !== 'approved') return { title: t.community.title, robots: { index: false } };
  return { title: locale === 'en' && row.nameEn ? row.nameEn : row.name };
}

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t, n, locale } = await getI18n();
  const actor = await getActor();
  const data = await getPublicCommunity(slug.slice(0, 80), actor);
  if (!data) notFound();
  const { community, membership, canManage } = data;
  const index = await getLocationIndex();
  const c = t.community;
  const name = locale === 'en' && community.nameEn ? community.nameEn : community.name;
  const signedIn = !!actor && actor.status === 'active';
  const showPhone = community.coordinatorContactPreference !== 'in_app' && (community.publicPhone || community.publicEmail);
  const showInApp = community.coordinatorContactPreference !== 'phone' || !showPhone;
  const isMember = membership && (membership.status === 'active' || membership.status === 'pending');
  const statusNotice = community.status === 'pending' ? c.pendingNotice : community.status === 'suspended' ? c.suspendedNotice : community.status === 'rejected' ? c.rejectedNotice : null;

  return (
    <>
      <PageHeader title={name} crumbs={[{ href: '/communities', label: t.common.nav.communities }]}>
        {canManage && (
          <Link className="btn btn-dark" href={`/manage/${community.slug}`}>
            {c.manageLink}
          </Link>
        )}
      </PageHeader>
      <div className="container section stack">
        {statusNotice && (
          <Alert tone={community.status === 'pending' ? 'info' : 'warning'} title={`${c.statusLabel}: ${t.common.communityStatus[community.status]}`}>
            <p>{statusNotice}</p>
          </Alert>
        )}
        <div className="grid grid-2">
          <section className="card stack" aria-labelledby="about">
            <h2 id="about">{c.about}</h2>
            <p>{community.description ?? <span className="muted">{c.noDescription}</span>}</p>
            <dl className="dl">
              <dt>{c.kind}</dt>
              <dd>
                <Badge tone="neutral">{t.common.communityKind[community.kind]}</Badge>
              </dd>
              {community.foundedYear && (
                <>
                  <dt>{c.founded}</dt>
                  <dd>{n(community.foundedYear).replace(/[,٬]/g, '')}</dd>
                </>
              )}
              <dt>{c.headquarters}</dt>
              <dd>{labelFrom(index, locale, community.districtId, community.divisionId)}</dd>
              <dt>{c.memberCount}</dt>
              <dd>{n(community.memberCount)}</dd>
              <dt>{c.serviceAreas}</dt>
              <dd>{community.serviceAreas.map((a) => (locale === 'bn' ? a.nameBn : a.nameEn)).join(', ') || t.common.states.none}</dd>
            </dl>
          </section>

          <div className="stack">
            <section className="card stack" id="contact" aria-labelledby="contact-title">
              <h2 id="contact-title">{c.contactTitle}</h2>
              {showPhone && (
                <div className="stack-sm">
                  {community.publicPhone && (
                    <p style={{ margin: 0 }}>
                      {c.publicPhone}: <span className="phone-reveal">{formatBdPhone(community.publicPhone)}</span>
                      <br />
                      <a className="btn btn-primary btn-sm" href={`tel:${community.publicPhone}`}>
                        <Phone size={16} aria-hidden="true" />
                        {t.common.actions.call}
                      </a>
                    </p>
                  )}
                  {community.publicEmail && (
                    <p style={{ margin: 0 }}>
                      {c.publicEmail}: {community.publicEmail}{' '}
                      <a className="btn btn-sm" href={`mailto:${community.publicEmail}`}>
                        <Mail size={16} aria-hidden="true" />
                        {c.sendEmail}
                      </a>
                    </p>
                  )}
                </div>
              )}
              {community.status === 'approved' && showInApp && (
                <>
                  <p style={{ margin: 0 }}>{c.contactInApp}</p>
                  <Link className="btn btn-primary" href={`/requests/new?community=${community.id}`}>
                    <Siren size={18} aria-hidden="true" />
                    {c.postRequest}
                  </Link>
                </>
              )}
              {!showPhone && community.coordinatorContactPreference !== 'in_app' && <p className="muted small">{c.noPublicContact}</p>}
              {community.facebookUrl && (
                <p style={{ margin: 0 }}>
                  <a href={community.facebookUrl} rel="noopener noreferrer nofollow" target="_blank">
                    {c.facebook}
                  </a>
                </p>
              )}
            </section>

            {community.status === 'approved' && (
              <section className="card stack-sm" aria-labelledby="join-title">
                <h2 id="join-title">{c.joinTitle}</h2>
                {membership?.status === 'active' ? (
                  <p>{c.membershipActive(t.common.roles[membership.role])}</p>
                ) : membership?.status === 'pending' ? (
                  <p>{c.membershipPending}</p>
                ) : (
                  <p>{c.joinBody}</p>
                )}
                {!signedIn ? (
                  <>
                    <p className="muted small">{c.joinSignIn}</p>
                    <Link className="btn" href={`/signin?next=${encodeURIComponent(`/communities/${community.slug}`)}`}>
                      {t.common.nav.signIn}
                    </Link>
                  </>
                ) : isMember ? (
                  <Link href="/account/communities">{c.myCommunitiesLink}</Link>
                ) : (
                  <ActionForm action={joinCommunityAction} className="stack-sm">
                    <input type="hidden" name="communityId" value={community.id} />
                    <input type="hidden" name="slug" value={community.slug} />
                    <SubmitButton label={c.joinButton} pendingLabel={t.common.actions.submitting} className="btn" />
                  </ActionForm>
                )}
              </section>
            )}
          </div>
        </div>
        <ReportForm
          targetType="community"
          targetId={community.id}
          reasons={REPORT_REASONS.map((r) => ({ value: r, label: t.common.report.reasons[r] }))}
          labels={{
            title: t.common.report.title,
            reason: t.common.report.reason,
            details: t.common.report.details,
            detailsHint: t.common.report.detailsHint,
            submit: t.common.report.submit,
            submitting: t.common.actions.submitting,
            choose: t.common.report.reason,
          }}
        />
      </div>
    </>
  );
}

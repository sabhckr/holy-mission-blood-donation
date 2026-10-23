import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, Building2, CalendarDays, ExternalLink, HeartHandshake, Info, Mail, MapPin, Phone, Settings, Siren, Tag, TriangleAlert, UserPlus, Users } from 'lucide-react';
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
import { AffiliationBadge, COMMUNITY_STATUS, CommunityStatusBadge, MembershipBadge, RoleBadge } from '@/components/community/badges';
import { IconTile } from '@/components/account/bits';
import { PageHeader } from '@/components/ui';
import { leaveCommunityAction } from '@/app/account/actions';
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
  const a = t.account.communities;
  const name = locale === 'en' && community.nameEn ? community.nameEn : community.name;
  const signedIn = !!actor && actor.status === 'active';
  const showPhone = community.coordinatorContactPreference !== 'in_app' && (community.publicPhone || community.publicEmail);
  const showInApp = community.coordinatorContactPreference !== 'phone' || !showPhone;
  const isMember = membership && (membership.status === 'active' || membership.status === 'pending');
  const statusNotice = community.status === 'pending' ? c.pendingNotice : community.status === 'suspended' ? c.suspendedNotice : community.status === 'rejected' ? c.rejectedNotice : null;
  const areas = community.serviceAreas.map((x) => (locale === 'bn' ? x.nameBn : x.nameEn));
  const holyMission = community.affiliation === 'holy_mission';
  const StatusIcon = COMMUNITY_STATUS[community.status].icon;

  return (
    <>
      <PageHeader title={name} crumbs={[{ href: '/communities', label: t.common.nav.communities }]} crumbsLabel={t.common.nav.breadcrumbs}>
        {canManage && (
          <Link className="btn btn-dark" href={`/manage/${community.slug}`}>
            <Settings size={18} aria-hidden="true" />
            {c.manageLink}
          </Link>
        )}
      </PageHeader>
      <div className="section">
        <div className="container stack">
          {statusNotice && (
            <div className={`alert ${community.status === 'pending' ? 'alert-warning' : 'alert-error'}`}>
              <StatusIcon size={20} aria-hidden="true" />
              <div>
                <p style={{ fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                  {c.statusLabel}: {t.common.communityStatus[community.status]}
                </p>
                <p>{statusNotice}</p>
              </div>
            </div>
          )}

          <section className="card org-hero" aria-label={c.affiliationLabel}>
            <div className="acct-item-badges" style={{ marginTop: 0 }}>
              <CommunityStatusBadge status={community.status} t={t} />
              <AffiliationBadge affiliation={community.affiliation} t={t} />
            </div>
            <ul className="org-facts">
              <li>
                <IconTile icon={MapPin} tone="neutral" small />
                <div>
                  <span className="small">{c.headquarters}</span>
                  <strong>{labelFrom(index, locale, community.districtId, community.divisionId)}</strong>
                </div>
              </li>
              <li>
                <IconTile icon={Users} tone="neutral" small />
                <div>
                  <span className="small">{c.memberCount}</span>
                  <strong>{n(community.memberCount)}</strong>
                </div>
              </li>
              <li>
                <IconTile icon={Tag} tone="neutral" small />
                <div>
                  <span className="small">{c.kind}</span>
                  <strong>{t.common.communityKind[community.kind]}</strong>
                </div>
              </li>
              {community.foundedYear && (
                <li>
                  <IconTile icon={CalendarDays} tone="neutral" small />
                  <div>
                    <span className="small">{c.founded}</span>
                    <strong>{n(community.foundedYear).replace(/[,٬]/g, '')}</strong>
                  </div>
                </li>
              )}
            </ul>
            <ul className="org-notes">
              {community.status === 'approved' && (
                <li>
                  <BadgeCheck size={16} aria-hidden="true" className="org-note-ok" />
                  <span>{c.approvedNote}</span>
                </li>
              )}
              <li>
                {holyMission ? <HeartHandshake size={16} aria-hidden="true" className="org-note-info" /> : <Building2 size={16} aria-hidden="true" className="org-note-muted" />}
                <span>{holyMission ? t.common.affiliation.holyMissionNote : c.independentShort}</span>
              </li>
            </ul>
          </section>

          <div className="org-two">
            <section className="card stack" aria-labelledby="about">
              <h2 id="about" className="acct-h2">
                {c.about}
              </h2>
              {community.description ? (
                <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{community.description}</p>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {c.noDescription}
                </p>
              )}
              <div className="stack-sm">
                <h3 className="acct-h3">
                  <MapPin size={18} aria-hidden="true" className="icon-brand" />
                  {c.serviceAreas}
                </h3>
                {areas.length > 0 ? (
                  <ul className="acct-chips">
                    {areas.map((x) => (
                      <li key={x} className="acct-chip">
                        {x}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    {t.common.states.none}
                  </p>
                )}
              </div>
            </section>

            <div className="stack">
              <section className="card stack" id="contact" aria-labelledby="contact-title">
                <h2 id="contact-title" className="acct-h2">
                  {c.contactTitle}
                </h2>
                {community.status === 'approved' && showInApp && (
                  <div className="stack-sm">
                    <p style={{ margin: 0 }}>{c.contactInApp}</p>
                    <Link className="btn btn-primary btn-block" href={`/requests/new?community=${community.id}`}>
                      <Siren size={18} aria-hidden="true" />
                      {c.postRequest}
                    </Link>
                  </div>
                )}
                {showPhone && community.publicPhone && (
                  <div className="org-contact-row">
                    <div>
                      <span className="small">{c.publicPhone}</span>
                      <span className="phone-reveal">{formatBdPhone(community.publicPhone)}</span>
                    </div>
                    <a className={`btn ${community.status === 'approved' && showInApp ? '' : 'btn-primary'}`} href={`tel:${community.publicPhone}`}>
                      <Phone size={18} aria-hidden="true" />
                      {t.common.actions.call}
                    </a>
                  </div>
                )}
                {showPhone && community.publicEmail && (
                  <div className="org-contact-row">
                    <div>
                      <span className="small">{c.publicEmail}</span>
                      <span className="org-email">{community.publicEmail}</span>
                    </div>
                    <a className="btn" href={`mailto:${community.publicEmail}`}>
                      <Mail size={16} aria-hidden="true" />
                      {c.sendEmail}
                    </a>
                  </div>
                )}
                {!showPhone && community.coordinatorContactPreference !== 'in_app' && (
                  <p className="acct-note">
                    <Info size={16} aria-hidden="true" />
                    <span>{c.noPublicContact}</span>
                  </p>
                )}
                {community.facebookUrl && (
                  <a className="section-link" href={community.facebookUrl} rel="noopener noreferrer nofollow" target="_blank">
                    <ExternalLink size={16} aria-hidden="true" />
                    {c.facebook}
                  </a>
                )}
              </section>

              {community.status === 'approved' && (
                <section className="card stack-sm" aria-labelledby="join-title">
                  <div className="acct-card-head" style={{ marginBottom: 'var(--space-1)' }}>
                    <IconTile icon={UserPlus} />
                    <h2 id="join-title">{isMember ? c.membershipTitle : c.joinTitle}</h2>
                  </div>
                  {membership?.status === 'active' ? (
                    <>
                      <div className="acct-item-badges">
                        <MembershipBadge status="active" t={t} />
                        <RoleBadge role={membership.role} t={t} />
                      </div>
                      <p style={{ margin: 0 }}>{c.membershipActive(t.common.roles[membership.role])}</p>
                    </>
                  ) : membership?.status === 'pending' ? (
                    <>
                      <div className="acct-item-badges">
                        <MembershipBadge status="pending" t={t} />
                      </div>
                      <p style={{ margin: 0 }}>{c.membershipPending}</p>
                    </>
                  ) : (
                    <p style={{ margin: 0 }}>{c.joinBody}</p>
                  )}
                  {!signedIn ? (
                    <>
                      <p className="muted small" style={{ margin: 0 }}>
                        {c.joinSignIn}
                      </p>
                      <div>
                        <Link className="btn btn-soft" href={`/signin?next=${encodeURIComponent(`/communities/${community.slug}`)}`}>
                          {t.common.nav.signIn}
                        </Link>
                      </div>
                    </>
                  ) : isMember ? (
                    <div className="acct-danger-zone">
                      <p>
                        <TriangleAlert size={16} aria-hidden="true" />
                        <span>{membership.status === 'pending' ? a.withdrawConsequence : a.leaveConsequence}</span>
                      </p>
                      <ActionForm action={leaveCommunityAction} className="stack-sm">
                        <input type="hidden" name="communityId" value={community.id} />
                        <SubmitButton label={membership.status === 'pending' ? a.withdraw : a.leave} pendingLabel={t.common.actions.saving} className="btn btn-danger" />
                      </ActionForm>
                    </div>
                  ) : (
                    <ActionForm action={joinCommunityAction} className="stack-sm">
                      <input type="hidden" name="communityId" value={community.id} />
                      <input type="hidden" name="slug" value={community.slug} />
                      <div>
                        <SubmitButton label={c.joinButton} pendingLabel={t.common.actions.submitting} className="btn btn-soft" />
                      </div>
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
      </div>
    </>
  );
}

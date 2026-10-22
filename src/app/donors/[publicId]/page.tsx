import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { REPORT_REASONS } from '@/server/domain/constants';
import { getPublicDonorProfile } from '@/server/services/donors';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { ContactRequestForm, RevealPhone } from '@/components/ContactDonor';
import { ReportForm } from '@/components/ReportForm';
import { Alert, AvailabilityBadge, BloodGroupBadge, Disclaimer, PageHeader, VerificationBadge } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  // Donor names are not put in titles or search-engine metadata.
  return { title: t.donor.title, robots: { index: false, follow: false } };
}

export default async function DonorProfilePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const i18n = await getI18n();
  const { t, n, date, locale } = i18n;
  const actor = await getActor();
  const donor = await getPublicDonorProfile(publicId, actor);
  if (!donor) notFound();
  const index = await getLocationIndex();
  const place = labelFrom(index, locale, donor.upazilaId, donor.districtId, donor.divisionId);
  const signedIn = !!actor && actor.status === 'active';

  return (
    <>
      <PageHeader title={donor.name} crumbs={[{ href: '/donors', label: t.common.nav.findDonors }]} crumbsLabel={t.common.nav.breadcrumbs}>
        <BloodGroupBadge group={donor.bloodGroup} label={t.common.bloodGroup} />
      </PageHeader>
      <div className="container section grid grid-2">
        <section className="card stack" aria-labelledby="about">
          <h2 id="about" className="visually-hidden">
            {t.donor.title}
          </h2>
          {donor.isOwner && (
            <Alert tone="info">
              <p>{t.donor.ownProfileNote}</p>
              <Link href="/account/profile">{t.donor.editOwn}</Link>
            </Alert>
          )}
          {donor.nameIsShortened && <p className="small muted">{t.donor.shortNameNote}</p>}
          <dl className="dl">
            <dt>{t.common.bloodGroup}</dt>
            <dd>{donor.bloodGroup}</dd>
            <dt>{t.donor.area}</dt>
            <dd>
              {[donor.locality, place].filter(Boolean).join(', ')}
              {donor.localityHidden && <span className="small muted"> ({t.common.states.notShared})</span>}
            </dd>
            <dt>{t.donor.availability}</dt>
            <dd className="stack-sm">
              <AvailabilityBadge state={donor.availability} t={t} />
              {donor.availabilityConfirmedAt && donor.availability === 'available' && (
                <span className="small muted">{t.common.availability.confirmedOn(i18n.instantDate(donor.availabilityConfirmedAt))}</span>
              )}
            </dd>
            <dt>{t.donor.verification}</dt>
            <dd>
              <VerificationBadge status={donor.verificationStatus} t={t} />
            </dd>
            <dt>{t.donor.preferredContact}</dt>
            <dd>{t.common.contactMethod[donor.preferredContactMethod]}</dd>
            <dt>{t.donor.communities}</dt>
            <dd>
              {donor.communities === null ? (
                <span className="muted">{t.common.states.notShared}</span>
              ) : donor.communities.length === 0 ? (
                <span className="muted">{t.donor.noCommunities}</span>
              ) : (
                donor.communities.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && ', '}
                    <Link href={`/communities/${c.slug}`}>{c.name}</Link>
                  </span>
                ))
              )}
            </dd>
          </dl>
          <p className="small muted">{t.common.availability.explain}</p>
          <h3>{t.donor.donationRecords}</h3>
          {donor.stats ? (
            <dl className="dl">
              <dt>{t.donor.verifiedDonations}</dt>
              <dd>{n(donor.stats.verifiedCount)}</dd>
              <dt>{t.donor.reportedDonations}</dt>
              <dd>{n(donor.stats.reportedCount)}</dd>
              <dt>{t.donor.lastDonation}</dt>
              <dd>{donor.stats.lastDonation ? date(donor.stats.lastDonation) : t.common.states.none}</dd>
            </dl>
          ) : (
            <p className="muted">{t.common.states.notShared}</p>
          )}
        </section>

        {!donor.isOwner && (
          <section className="stack" aria-labelledby="contact" id="contact">
            <div className="card stack">
              <h2 id="contact">{t.donor.contactTitle}</h2>
              {!signedIn ? (
                <>
                  <p>{t.donor.contactSignIn}</p>
                  <Link className="btn btn-primary" href={`/signin?next=${encodeURIComponent(`/donors/${donor.publicId}`)}`}>
                    {t.common.nav.signIn}
                  </Link>
                </>
              ) : (
                <>
                  {donor.phoneAccess === 'reveal' && (
                    <RevealPhone
                      publicId={donor.publicId}
                      labels={{
                        show: t.common.actions.showNumber,
                        showing: t.common.states.loading,
                        explain: t.donor.revealExplain,
                        number: t.donor.revealedNumber,
                        call: t.common.actions.call,
                        sms: t.common.actions.sendSms,
                        whatsapp: t.common.actions.whatsapp,
                      }}
                    />
                  )}
                  {donor.phoneAccess === 'hidden' && <p className="muted">{t.donor.contactHidden}</p>}
                  <hr />
                  <h3>{t.donor.requestTitle}</h3>
                  {donor.canSendContactRequest ? (
                    <ContactRequestForm
                      publicId={donor.publicId}
                      labels={{ message: t.donor.requestMessage, hint: t.donor.requestMessageHint, send: t.donor.requestSend, sending: t.common.actions.submitting, explain: t.donor.requestExplain }}
                    />
                  ) : (
                    <p className="muted">{t.donor.requestsClosed}</p>
                  )}
                  <p className="small muted">{t.donor.notConfirmedNote}</p>
                </>
              )}
            </div>
            <Disclaimer t={t} compact />
            <ReportForm
              targetType="donor"
              targetId={donor.publicId}
              reasons={REPORT_REASONS.map((r) => ({ value: r, label: t.common.report.reasons[r] }))}
              labels={{ title: t.common.report.title, reason: t.common.report.reason, details: t.common.report.details, detailsHint: t.common.report.detailsHint, submit: t.common.report.submit, submitting: t.common.actions.submitting, choose: t.common.report.reason }}
            />
          </section>
        )}
      </div>
    </>
  );
}

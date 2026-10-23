import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Building2, Droplet, Info, LogIn, MapPin, MessageCircle, MessageSquareText, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { REPORT_REASONS } from '@/server/domain/constants';
import { getPublicDonorProfile } from '@/server/services/donors';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { ContactRequestForm, RevealPhone } from '@/components/ContactDonor';
import { ReportForm } from '@/components/ReportForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { Alert, AvailabilityBadge, BloodGroupBadge, Breadcrumbs, Disclaimer, Stat, VerificationBadge } from '@/components/ui';

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
  const a = t.common.availability;
  const updated = donor.availabilityConfirmedAt ? i18n.instantDate(donor.availabilityConfirmedAt) : null;
  const SourceIcon = donor.availabilitySource === 'staff' ? ShieldCheck : UserRound;
  const profilePath = `/donors/${donor.publicId}`;

  const requestForm = (buttonClassName: string) =>
    donor.canSendContactRequest ? (
      <ContactRequestForm
        publicId={donor.publicId}
        labels={{ message: t.donor.requestMessage, hint: t.donor.requestMessageHint, send: t.donor.requestSend, sending: t.common.actions.submitting, explain: t.donor.requestExplain }}
        clientMessages={clientValidationMessages(t)}
        buttonClassName={buttonClassName}
      />
    ) : (
      <p className="muted" style={{ marginBottom: 0 }}>
        {t.donor.requestsClosed}
      </p>
    );

  return (
    <>
      <div className="profile-band">
        <div className="container">
          <Breadcrumbs items={[{ href: '/donors', label: t.common.nav.findDonors }]} label={t.common.nav.breadcrumbs} />
          <section className="card profile-summary" aria-labelledby="donor-name">
            <div className="profile-group">
              <BloodGroupBadge group={donor.bloodGroup} label={t.common.bloodGroup} />
            </div>
            <div className="profile-summary-body">
              <h1 id="donor-name" className="profile-name">
                {donor.name}
                {donor.verificationStatus === 'verified' && (
                  <span className="verified-mark">
                    <BadgeCheck size={24} aria-hidden="true" />
                    <span className="visually-hidden">{t.common.verification.verified}</span>
                  </span>
                )}
              </h1>
              <p className="donor-card-place">
                <MapPin size={16} aria-hidden="true" />
                <span>
                  {[donor.locality, place].filter(Boolean).join(', ')}
                  {donor.localityHidden && <span className="muted"> ({t.common.states.notShared})</span>}
                </span>
              </p>
              <div className="cluster-sm profile-badges">
                <AvailabilityBadge state={donor.availability} t={t} />
                <VerificationBadge status={donor.verificationStatus} t={t} />
              </div>
              {(donor.availabilitySource || updated) && (
                <p className="pub-meta">
                  <SourceIcon size={14} aria-hidden="true" />
                  <span>{[donor.availabilitySource ? (donor.availabilitySource === 'staff' ? a.sourceStaff : a.sourceDonor) : null, updated].filter(Boolean).join(' · ')}</span>
                </p>
              )}
              {!donor.isOwner && (
                <p className="pub-meta">
                  <Info size={14} aria-hidden="true" />
                  <span>{a.mayNotRespond}</span>
                </p>
              )}
              {donor.nameIsShortened && <p className="small muted profile-note">{t.donor.shortNameNote}</p>}
            </div>
          </section>
        </div>
      </div>

      <div className="section pub-body">
        <div className="container profile-layout">
          {donor.isOwner && (
            <div className="profile-wide">
              <Alert tone="info">
                <p>{t.donor.ownProfileNote}</p>
                <Link href="/account/profile">{t.donor.editOwn}</Link>
              </Alert>
            </div>
          )}

          {!donor.isOwner && (
            <section className="card contact-card stack" aria-labelledby="contact-title" id="contact">
              <h2 id="contact-title" className="pub-panel-title">
                <Phone size={20} aria-hidden="true" />
                {t.donor.contactTitle}
              </h2>
              {!signedIn && donor.phoneAccess !== 'reveal' ? (
                <>
                  <p className="contact-lead">{donor.phoneAccess === 'sign_in_required' ? t.donor.contactSignIn : t.donor.contactHiddenSignIn}</p>
                  <Link className="btn btn-primary btn-lg btn-block" href={`/signin?next=${encodeURIComponent(profilePath)}`}>
                    <LogIn size={20} aria-hidden="true" />
                    {t.common.nav.signIn}
                  </Link>
                  <p className="small text-center" style={{ marginBottom: 0 }}>
                    {t.auth.noAccount} <Link href={`/register/account?next=${encodeURIComponent(profilePath)}`}>{t.auth.accountTitle}</Link>
                  </p>
                </>
              ) : donor.phoneAccess === 'reveal' ? (
                <>
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
                  {!signedIn && (
                    <p className="small text-center" style={{ margin: 0 }}>
                      <Link href={`/signin?next=${encodeURIComponent(profilePath)}`}>{t.donor.messageSignIn}</Link>
                    </p>
                  )}
                  {signedIn && donor.canSendContactRequest && (
                    <details className="disclosure">
                      <summary>
                        <span className="pub-summary">
                          <MessageSquareText size={18} aria-hidden="true" />
                          {t.donor.requestOrTitle}
                        </span>
                      </summary>
                      {requestForm('btn')}
                    </details>
                  )}
                </>
              ) : (
                <>
                  {donor.phoneAccess === 'hidden' && (
                    <p className="pub-meta">
                      <Info size={16} aria-hidden="true" />
                      <span>{t.donor.contactHidden}</span>
                    </p>
                  )}
                  <h3 className="sub-title">{t.donor.requestTitle}</h3>
                  {requestForm('btn btn-primary btn-block')}
                </>
              )}
              {signedIn && (
                <p className="pub-meta">
                  <Info size={14} aria-hidden="true" />
                  <span>{t.donor.notConfirmedNote}</span>
                </p>
              )}
              <div className="consent-note">
                <h3 className="cluster-sm">
                  <ShieldCheck size={18} aria-hidden="true" />
                  {t.donor.consentTitle}
                </h3>
                <p className="small">{t.donor.consentBody}</p>
              </div>
            </section>
          )}

          <div className="profile-side stack">
            <section className="card stack" aria-labelledby="about-title">
              <h2 id="about-title" className="pub-panel-title">
                <UserRound size={20} aria-hidden="true" />
                {t.donor.aboutTitle}
              </h2>
              <ul className="info-list">
                <li>
                  <MessageCircle size={18} aria-hidden="true" />
                  <div>
                    <span className="info-label">{t.donor.preferredContact}</span>
                    <span className="info-value">{t.common.contactMethod[donor.preferredContactMethod]}</span>
                  </div>
                </li>
                <li>
                  <Building2 size={18} aria-hidden="true" />
                  <div>
                    <span className="info-label">{t.donor.communities}</span>
                    <span className="info-value">
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
                    </span>
                  </div>
                </li>
              </ul>
            </section>

            <section className="card stack" aria-labelledby="records-title">
              <h2 id="records-title" className="pub-panel-title">
                <Droplet size={20} aria-hidden="true" />
                {t.donor.donationRecords}
              </h2>
              {donor.stats ? (
                <div className="mini-stats">
                  <Stat value={n(donor.stats.verifiedCount)} label={t.donor.verifiedDonations} />
                  <Stat value={n(donor.stats.reportedCount)} label={t.donor.reportedDonations} />
                  <Stat value={donor.stats.lastDonation ? date(donor.stats.lastDonation, 'short') : t.common.states.none} label={t.donor.lastDonation} />
                </div>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {t.common.states.notShared}
                </p>
              )}
            </section>

            <details className="disclosure">
              <summary>{t.donor.availabilityExplainTitle}</summary>
              <p className="small">{a.explain}</p>
            </details>
          </div>

          <div className="profile-wide stack">
            <Disclaimer t={t} compact />
            {!donor.isOwner && (
              <ReportForm
                targetType="donor"
                targetId={donor.publicId}
                reasons={REPORT_REASONS.map((r) => ({ value: r, label: t.common.report.reasons[r] }))}
                labels={{ title: t.common.report.title, reason: t.common.report.reason, details: t.common.report.details, detailsHint: t.common.report.detailsHint, submit: t.common.report.submit, submitting: t.common.actions.submitting, choose: t.common.report.reason }}
                clientMessages={clientValidationMessages(t)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

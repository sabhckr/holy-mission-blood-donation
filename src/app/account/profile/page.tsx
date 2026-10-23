import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, CircleAlert, Hourglass, Info, Phone } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { addDays, todayInBangladesh } from '@/server/domain/dates';
import { formatBdPhone } from '@/server/domain/phone';
import { getAccountBasics, verifyingCommunities } from '@/server/services/account-queries';
import { getOwnDonorOverview } from '@/server/services/donors';
import { compactLocations } from '@/server/services/location-index';
import { getSettings } from '@/server/services/settings';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CheckboxField, SelectField, TextField } from '@/components/form/fields';
import { ConsentFields, ProfileFields, type ProfileLabels } from '@/components/DonorFormParts';
import { consentLabels, locationLabels } from '@/components/consent-labels';
import { IconTile, PageHead } from '@/components/account/bits';
import { Alert, VerificationBadge } from '@/components/ui';
import type { Messages } from '@/i18n/messages';
import { createDonorProfileAction, requestVerificationAction, updateAccountBasicsAction, updateProfileAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.profile.title, robots: { index: false } };
}

function profileLabels(t: Messages): ProfileLabels {
  return {
    fullName: t.auth.fullName,
    dateOfBirth: t.auth.dateOfBirth,
    dateOfBirthHint: t.auth.dateOfBirthHint,
    bloodGroup: t.auth.bloodGroup,
    locality: t.common.location.locality,
    localityHint: t.common.location.localityHint,
    preferredContact: t.auth.preferredContact,
    contactPhone: t.auth.contactPhone,
    contactPhoneHint: t.auth.contactPhoneHint,
    optional: t.common.states.optional,
    location: locationLabels(t),
    contactMethods: { call: t.common.contactMethod.call, sms: t.common.contactMethod.sms, whatsapp: t.common.contactMethod.whatsapp, in_app: t.common.contactMethod.in_app },
  };
}

const localPhone = (normalized: string) => normalized.replace(/^\+88/, '');

export default async function ProfilePage() {
  const { t, n, locale } = await getI18n();
  const p = t.account.profile;
  const d = t.account.dashboard;
  const actor = await requireActor('/account/profile');
  const [overview, basics, locs, communities, settings] = await Promise.all([
    getOwnDonorOverview(actor),
    getAccountBasics(actor.userId),
    compactLocations(locale),
    verifyingCommunities(actor),
    getSettings(),
  ]);
  const today = todayInBangladesh();
  // Latest allowed date of birth for the minimum donor age (server re-checks).
  const maxBirth = addDays(today, -Math.ceil(settings.minimumDonorAge * 365.25));
  const commOptions = communities.map((c) => ({ value: c.id, label: locale === 'en' && c.nameEn ? c.nameEn : c.name }));

  if (!overview) {
    return (
      <>
        <PageHead title={p.createTitle} intro={p.createIntro} />
        <ActionForm action={createDonorProfileAction} aria-label={p.createTitle} className="form acct-numbered">
          <fieldset className="form-section">
            <legend>{p.donorSection}</legend>
            <ProfileFields
              labels={profileLabels(t)}
              locations={locs}
              bloodGroups={[...BLOOD_GROUPS]}
              maxDate={maxBirth}
              withContactPhone
              defaults={{ fullName: basics?.displayName ?? '', contactPhone: basics ? localPhone(basics.phone) : '' }}
            />
            <CheckboxField name="availableNow" label={p.availableNow} hint={t.auth.availableNowHint(n(settings.availabilityExpiryDays))} />
          </fieldset>
          <fieldset className="form-section">
            <legend>{p.privacySection}</legend>
            <ConsentFields
              labels={consentLabels(t)}
              defaults={{
                listedInSearch: false,
                nameVisibility: 'signed_in',
                phoneVisibility: 'coordinators',
                localityVisibility: 'public',
                donationHistoryVisibility: 'signed_in',
                communityVisibility: 'public',
                allowCoordinatorContact: true,
                allowContactRequests: true,
              }}
            />
          </fieldset>
          <SubmitButton label={p.createButton} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg btn-block" />
        </ActionForm>
      </>
    );
  }

  const donor = overview.donor;
  const canRequestVerification = donor.verificationStatus === 'unverified' || donor.verificationStatus === 'rejected';
  return (
    <>
      <PageHead title={p.title} intro={p.intro} />

      {donor.registrationStatus === 'rejected' && (
        <Alert tone="warning" title={d.registrationRejectedTitle}>
          <p>{donor.registrationNote ? d.registrationReason(donor.registrationNote) : d.registrationNoReason}</p>
          <p style={{ margin: 0 }}>
            <a href="#donor-title">{p.rejectedHowToFix}</a>
          </p>
        </Alert>
      )}
      {donor.registrationStatus === 'pending' && (
        <p className="acct-staff-note acct-note-warning">
          <Hourglass size={16} aria-hidden="true" />
          <span>
            <strong>
              {d.registrationLabel}: {t.common.registrationStatus.pending}
            </strong>
            {' — '}
            {p.pendingNote}
          </span>
        </p>
      )}

      <section className="card" aria-labelledby="verification-title">
        <div className="acct-card-head">
          <IconTile icon={BadgeCheck} tone={donor.verificationStatus === 'verified' ? 'info' : 'neutral'} />
          <div>
            <h2 id="verification-title">{p.verificationTitle}</h2>
            <p>{p.verificationHint}</p>
          </div>
        </div>
        <div className="stack-sm">
          <p className="cluster-sm" style={{ margin: 0 }}>
            <span className="small muted">{p.verificationStatus}</span>
            <VerificationBadge status={donor.verificationStatus} t={t} />
          </p>
          {canRequestVerification &&
            (commOptions.length > 0 ? (
              <ActionForm action={requestVerificationAction} className="form">
                <SelectField name="communityId" label={p.chooseCommunity} options={commOptions} defaultValue={commOptions[0]?.value} required />
                <div className="form-actions">
                  <SubmitButton label={p.requestVerification} pendingLabel={t.common.actions.submitting} className="btn btn-soft" />
                </div>
              </ActionForm>
            ) : (
              <p className="small" style={{ margin: 0 }}>
                {p.noCommunityForVerification} <Link href="/communities">{p.findCommunity}</Link>
              </p>
            ))}
          <details className="disclosure acct-more">
            <summary>
              <span className="cluster-sm">
                <Info size={16} aria-hidden="true" />
                {p.verificationWhat}
              </span>
            </summary>
            <p>{p.verificationExplain}</p>
          </details>
        </div>
      </section>

      <div className="acct-numbered stack">
        <ActionForm action={updateProfileAction} aria-label={p.donorSection} className="form">
          <fieldset className="form-section">
            <legend id="donor-title">{p.donorSection}</legend>
            <p className="acct-legend-hint">
              <CircleAlert size={15} aria-hidden="true" />
              {p.identityNote}
            </p>
            <ProfileFields
              labels={profileLabels(t)}
              locations={locs}
              bloodGroups={[...BLOOD_GROUPS]}
              maxDate={maxBirth}
              withContactPhone
              defaults={{
                fullName: donor.fullName,
                dateOfBirth: donor.dateOfBirth,
                bloodGroup: donor.bloodGroup,
                divisionId: donor.divisionId,
                districtId: donor.districtId,
                upazilaId: donor.upazilaId,
                locality: donor.locality,
                preferredContactMethod: donor.preferredContactMethod,
                contactPhone: localPhone(donor.contactPhone),
              }}
            />
            <div className="acct-form-actions">
              <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg" />
            </div>
          </fieldset>
        </ActionForm>

        <ActionForm action={updateAccountBasicsAction} aria-label={p.accountSection} className="form">
          <fieldset className="form-section">
            <legend id="account-title">{p.accountSection}</legend>
            <p className="acct-legend-hint">{p.accountSectionHint}</p>
            <TextField name="displayName" label={t.auth.displayName} autoComplete="name" required maxLength={80} defaultValue={basics?.displayName} />
            <TextField name="email" type="email" label={t.auth.email} hint={t.auth.emailHint} autoComplete="email" optionalLabel={t.common.states.optional} maxLength={200} defaultValue={basics?.email} />
            <div className="acct-subtle">
              <p className="acct-meta" style={{ color: 'var(--ink-2)' }}>
                <span>
                  <Phone size={15} aria-hidden="true" />
                  {p.accountPhone}
                </span>
              </p>
              <p className="phone-reveal" style={{ margin: 0, fontSize: '1.15rem' }}>
                {basics ? formatBdPhone(basics.phone) : ''}
              </p>
              <p className="hint">{p.accountPhoneNote}</p>
            </div>
            <div className="acct-form-actions">
              <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} className="btn" />
            </div>
          </fieldset>
        </ActionForm>
      </div>
    </>
  );
}

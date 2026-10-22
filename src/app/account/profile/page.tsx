import type { Metadata } from 'next';
import Link from 'next/link';
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
        <h1>{p.createTitle}</h1>
        <p>{p.createIntro}</p>
        <ActionForm action={createDonorProfileAction} aria-label={p.createTitle}>
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
            <legend>{t.auth.sectionPrivacy}</legend>
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
      <h1>{p.title}</h1>
      <p>{p.intro}</p>

      {donor.registrationStatus === 'rejected' && (
        <Alert tone="warning" title={t.account.dashboard.registrationRejectedTitle}>
          <p>{donor.registrationNote ? t.account.dashboard.registrationReason(donor.registrationNote) : t.account.dashboard.registrationNoReason}</p>
          <p style={{ margin: 0 }}>
            <a href="#donor-title">{p.rejectedHowToFix}</a>
          </p>
        </Alert>
      )}
      {donor.registrationStatus === 'pending' && (
        <Alert tone="info" title={`${t.account.dashboard.registrationLabel}: ${t.common.registrationStatus.pending}`}>
          <p style={{ margin: 0 }}>{p.pendingNote}</p>
        </Alert>
      )}

      <section className="card stack" aria-labelledby="verification-title">
        <h2 id="verification-title" style={{ fontSize: '1.15rem' }}>
          {p.verificationTitle}
        </h2>
        <p className="cluster-sm" style={{ margin: 0 }}>
          <span>{p.verificationStatus}:</span> <VerificationBadge status={donor.verificationStatus} t={t} />
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          {p.verificationExplain}
        </p>
        {canRequestVerification &&
          (commOptions.length > 0 ? (
            <ActionForm action={requestVerificationAction}>
              <SelectField name="communityId" label={p.chooseCommunity} options={commOptions} defaultValue={commOptions[0]?.value} required />
              <div className="form-actions">
                <SubmitButton label={p.requestVerification} pendingLabel={t.common.actions.submitting} className="btn" />
              </div>
            </ActionForm>
          ) : (
            <p className="small" style={{ margin: 0 }}>
              {p.noCommunityForVerification} <Link href="/communities">{p.findCommunity}</Link>
            </p>
          ))}
      </section>

      <section className="stack" aria-labelledby="donor-title">
        <h2 id="donor-title" style={{ fontSize: '1.15rem' }}>
          {p.donorSection}
        </h2>
        <Alert tone="info">{p.identityNote}</Alert>
        <ActionForm action={updateProfileAction} aria-label={p.donorSection}>
          <fieldset className="form-section">
            <legend className="visually-hidden">{p.donorSection}</legend>
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
          </fieldset>
          <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} />
        </ActionForm>
      </section>

      <section className="stack" aria-labelledby="account-title">
        <h2 id="account-title" style={{ fontSize: '1.15rem' }}>
          {p.accountSection}
        </h2>
        <ActionForm action={updateAccountBasicsAction} aria-label={p.accountSection}>
          <fieldset className="form-section">
            <legend className="visually-hidden">{p.accountSection}</legend>
            <TextField name="displayName" label={t.auth.displayName} autoComplete="name" required maxLength={80} defaultValue={basics?.displayName} />
            <TextField name="email" type="email" label={t.auth.email} hint={t.auth.emailHint} autoComplete="email" optionalLabel={t.common.states.optional} maxLength={200} defaultValue={basics?.email} />
            <dl className="dl">
              <dt>{p.accountPhone}</dt>
              <dd>{basics ? formatBdPhone(basics.phone) : ''}</dd>
            </dl>
            <p className="small muted" style={{ margin: 0 }}>
              {p.accountPhoneNote}
            </p>
          </fieldset>
          <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} />
        </ActionForm>
      </section>
    </>
  );
}

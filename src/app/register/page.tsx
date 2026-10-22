import type { Metadata } from 'next';
import Link from 'next/link';
import { Eye, EyeOff, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { BLOOD_GROUPS, DONATION_TYPES } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { compactLocations } from '@/server/services/location-index';
import { getSettings } from '@/server/services/settings';
import { registerDonorAction } from '../_actions/auth';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CheckboxField, SelectField, TextField } from '@/components/form/fields';
import { ConsentFields, ProfileFields } from '@/components/DonorFormParts';
import { consentLabels, locationLabels } from '@/components/consent-labels';
import { clientValidationMessages } from '@/components/form/client-messages';
import { Alert, Disclaimer, PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.registerTitle, description: t.auth.registerIntro };
}

export default async function RegisterDonorPage() {
  const { t, n, locale } = await getI18n();
  const actor = await getActor();
  if (actor) redirect(actor.donorId ? '/account' : '/account/profile');
  const [locs, settings] = await Promise.all([compactLocations(locale), getSettings()]);
  const today = todayInBangladesh();
  const opt = t.common.states.optional;
  return (
    <>
      <PageHeader title={t.auth.registerTitle} intro={t.auth.registerIntro} />
      <div className="container container-narrow section stack">
        <Alert tone="info">
          <p>{t.auth.reviewNotice}</p>
        </Alert>
        <ActionForm action={registerDonorAction} aria-label={t.auth.registerTitle} clientMessages={clientValidationMessages(t)}>
          <fieldset className="form-section">
            <legend>{t.auth.sectionAccount}</legend>
            <TextField name="fullName" label={t.auth.fullName} autoComplete="name" required maxLength={80} />
            <TextField name="phone" label={t.auth.phone} hint={t.auth.phoneHint} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} />
            <TextField name="email" label={t.auth.email} hint={t.auth.emailHint} type="email" autoComplete="email" optionalLabel={opt} maxLength={200} />
            <TextField name="password" label={t.auth.password} hint={t.auth.passwordHint} type="password" autoComplete="new-password" required maxLength={128} />
            <TextField name="confirmPassword" label={t.auth.confirmPassword} type="password" autoComplete="new-password" required maxLength={128} />
          </fieldset>

          <fieldset className="form-section">
            <legend>{t.auth.sectionDonor}</legend>
            <ProfileFields
              withName={false}
              locations={locs}
              bloodGroups={[...BLOOD_GROUPS]}
              maxDate={today}
              labels={{
                fullName: t.auth.fullName,
                dateOfBirth: t.auth.dateOfBirth,
                dateOfBirthHint: t.auth.dateOfBirthHint,
                bloodGroup: t.auth.bloodGroup,
                locality: t.common.location.locality,
                localityHint: t.common.location.localityHint,
                preferredContact: t.auth.preferredContact,
                optional: opt,
                location: locationLabels(t),
                contactMethods: { call: t.common.contactMethod.call, sms: t.common.contactMethod.sms, whatsapp: t.common.contactMethod.whatsapp, in_app: t.common.contactMethod.in_app },
              }}
            />
          </fieldset>

          <fieldset className="form-section">
            <legend>{t.auth.sectionHistory}</legend>
            <p className="hint">{t.auth.lastDonationHint}</p>
            <div className="field-row">
              <TextField name="lastDonationDate" type="date" label={t.auth.lastDonationDate} optionalLabel={opt} max={today} />
              <SelectField
                name="lastDonationType"
                label={t.auth.lastDonationType}
                options={DONATION_TYPES.map((d) => ({ value: d, label: t.common.donationType[d] }))}
                defaultValue="whole_blood"
              />
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>{t.auth.sectionAvailability}</legend>
            <CheckboxField name="availableNow" label={t.auth.availableNow} hint={t.auth.availableNowHint(n(settings.availabilityExpiryDays))} />
            <p className="small muted">{t.common.availability.explain}</p>
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

          <section className="card card-tight privacy-summary stack-sm" aria-labelledby="privacy-summary">
            <h2 id="privacy-summary" className="cluster-sm">
              <ShieldCheck size={20} aria-hidden="true" />
              {t.auth.summaryTitle}
            </h2>
            {(
              [
                ['public', Eye, t.auth.summaryPublicTitle, t.auth.summaryPublicItems],
                ['choice', SlidersHorizontal, t.auth.summaryChoiceTitle, t.auth.summaryChoiceItems],
                ['private', EyeOff, t.auth.summaryPrivateTitle, t.auth.summaryPrivateItems],
              ] as const
            ).map(([key, Icon, title, items]) => (
              <div key={key} className={`privacy-summary-group privacy-summary-${key}`}>
                <h3 className="cluster-sm">
                  <Icon size={18} aria-hidden="true" />
                  {title}
                </h3>
                <ul>
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="small muted">{t.auth.reviewNotice}</p>
          </section>

          <fieldset className="form-section">
            <legend>{t.auth.sectionConsent}</legend>
            <CheckboxField
              name="acceptPrivacy"
              required
              label={
                <>
                  {t.auth.acceptPrivacy} (<Link href="/privacy">{t.auth.privacyLink}</Link>, <Link href="/terms">{t.auth.termsLink}</Link>)
                </>
              }
            />
            <CheckboxField name="confirmTruth" required label={t.auth.confirmTruth} />
          </fieldset>

          <Disclaimer t={t} compact />
          <SubmitButton label={t.auth.registerButton} pendingLabel={t.auth.registering} className="btn btn-primary btn-lg btn-block" />
        </ActionForm>
        <p>
          {t.auth.haveAccount} <Link href="/signin">{t.common.nav.signIn}</Link>
        </p>
      </div>
    </>
  );
}

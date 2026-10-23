import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, Clock } from 'lucide-react';
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
import { AreaFields, BloodGroupField, ConsentFields, DateOfBirthField, PreferredContactField } from '@/components/DonorFormParts';
import { consentLabels, locationLabels } from '@/components/consent-labels';
import { clientValidationMessages } from '@/components/form/client-messages';
import { FormDraft } from '@/components/form/FormDraft';
import { PageHeader } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.registerTitle, description: t.auth.registerIntro };
}

function Step({ n, title }: { n: string; title: string }) {
  return (
    <legend className="pub-step-legend">
      <span className="pub-step" aria-hidden="true">
        {n}
      </span>
      {title}
    </legend>
  );
}

export default async function RegisterDonorPage() {
  const { t, n, locale } = await getI18n();
  const actor = await getActor();
  if (actor) redirect(actor.donorId ? '/account' : '/account/profile');
  const [locs, settings] = await Promise.all([compactLocations(locale), getSettings()]);
  const today = todayInBangladesh();
  const opt = t.common.states.optional;
  const a = t.auth;
  const area = { location: locationLabels(t), locality: t.common.location.locality, localityHint: t.common.location.localityHint, optional: opt };
  const contactMethods = { call: t.common.contactMethod.call, sms: t.common.contactMethod.sms, whatsapp: t.common.contactMethod.whatsapp, in_app: t.common.contactMethod.in_app };
  return (
    <>
      <PageHeader title={a.registerTitle} intro={a.registerIntro} />
      <div className="section pub-body">
        <div className="container container-narrow">
          <ActionForm action={registerDonorAction} aria-label={a.registerTitle} clientMessages={clientValidationMessages(t)} className="form step-form">
            <FormDraft name="donor-registration" />
            <fieldset className="form-section">
              <Step n={n(1)} title={a.stepIdentity} />
              <TextField name="fullName" label={a.fullName} autoComplete="name" required maxLength={80} />
              <TextField name="phone" label={a.phone} hint={a.phoneHint} type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} />
              <DateOfBirthField labels={{ dateOfBirth: a.dateOfBirth, dateOfBirthHint: a.dateOfBirthHint }} maxDate={today} />
              <TextField name="email" label={a.email} hint={a.emailHint} type="email" autoComplete="email" optionalLabel={opt} maxLength={200} />
            </fieldset>

            <fieldset className="form-section">
              <Step n={n(2)} title={a.stepGroupArea} />
              <BloodGroupField label={a.bloodGroup} bloodGroups={[...BLOOD_GROUPS]} />
              <AreaFields labels={area} locations={locs} row />
            </fieldset>

            <fieldset className="form-section">
              <Step n={n(3)} title={a.stepDonate} />
              <div className="pub-toggle">
                <CheckboxField name="availableNow" label={a.availableNow} hint={a.availableNowHint(n(settings.availabilityExpiryDays))} />
              </div>
              <h3 className="pub-subhead">
                <CalendarClock size={18} aria-hidden="true" />
                {a.lastDonationTitle}
              </h3>
              <div className="field-row">
                <TextField name="lastDonationDate" type="date" label={a.lastDonationDate} optionalLabel={opt} max={today} />
                <SelectField
                  name="lastDonationType"
                  label={a.lastDonationType}
                  options={DONATION_TYPES.map((d) => ({ value: d, label: t.common.donationType[d] }))}
                  defaultValue="whole_blood"
                />
              </div>
            </fieldset>

            <fieldset className="form-section">
              <Step n={n(4)} title={a.stepPrivacy} />
              <PreferredContactField labels={{ preferredContact: a.preferredContact, contactMethods }} />
              <ConsentFields
                layout="simple"
                labels={{ ...consentLabels(t), more: a.privacyMore }}
                defaults={{
                  listedInSearch: false,
                  allowCoordinatorContact: true,
                  allowContactRequests: true,
                }}
              />
            </fieldset>

            <fieldset className="form-section">
              <Step n={n(5)} title={a.stepFinish} />
              <TextField name="password" label={a.password} hint={a.passwordHint} type="password" autoComplete="new-password" required maxLength={128} />
              <TextField name="confirmPassword" label={a.confirmPassword} type="password" autoComplete="new-password" required maxLength={128} />
              <div className="consent-box stack-sm">
                <CheckboxField
                  name="acceptPrivacy"
                  required
                  label={
                    <>
                      {a.acceptPrivacy} (<Link href="/privacy">{a.privacyLink}</Link>, <Link href="/terms">{a.termsLink}</Link>)
                    </>
                  }
                />
                <CheckboxField name="confirmTruth" required label={a.confirmTruth} />
              </div>
            </fieldset>

            <div className="submit-panel">
              <div className="next-note">
                <span className="pub-icon">
                  <Clock size={20} aria-hidden="true" />
                </span>
                <div>
                  <h2>{a.nextTitle}</h2>
                  <p>{a.reviewNotice}</p>
                  <p className="small muted">{a.approvalNotMedical}</p>
                </div>
              </div>
              <SubmitButton label={a.registerButton} pendingLabel={a.registering} className="btn btn-primary btn-lg btn-block" />
              <p className="small text-center" style={{ margin: 0 }}>
                {a.haveAccount} <Link href="/signin">{t.common.nav.signIn}</Link>
              </p>
            </div>
          </ActionForm>
        </div>
      </div>
    </>
  );
}

import type { Metadata } from 'next';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { compactLocations } from '@/server/services/location-index';
import { adminConsentLabels, adminProfileLabels } from '@/components/admin/labels';
import { ConsentFields, ProfileFields } from '@/components/DonorFormParts';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CheckboxField, TextArea, TextField } from '@/components/form/fields';
import { Alert, Breadcrumbs } from '@/components/ui';
import { staffCreateDonorAction } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.newDonor.title, robots: { index: false } };
}

export default async function AdminNewDonorPage() {
  await requirePermission('/admin/donors/new', 'donors.manage');
  const { t, locale } = await getI18n();
  const locs = await compactLocations(locale);
  const a = t.admin.newDonor;
  return (
    <>
      <header className="stack-sm">
        <Breadcrumbs items={[{ href: '/admin/donors', label: t.admin.donors.title }]} label={t.common.nav.breadcrumbs} />
        <h1>{a.title}</h1>
        <p className="muted">{a.intro}</p>
      </header>
      <Alert tone="info">{a.signInNote}</Alert>

      <ActionForm action={staffCreateDonorAction} aria-label={a.title}>
        <fieldset className="form-section">
          <legend>{a.sectionAccount}</legend>
          <TextField name="phone" type="tel" inputMode="tel" label={a.phone} hint={a.phoneHint} required maxLength={20} autoComplete="off" />
        </fieldset>

        <fieldset className="form-section">
          <legend>{a.sectionProfile}</legend>
          <ProfileFields labels={adminProfileLabels(t, a.contactPhoneHint)} locations={locs} bloodGroups={[...BLOOD_GROUPS]} maxDate={todayInBangladesh()} withContactPhone />
        </fieldset>

        <fieldset className="form-section">
          <legend>{a.sectionAvailability}</legend>
          <CheckboxField name="availableNow" label={a.availableNow} hint={a.availableNowHint(t.common.availability.sourceStaff)} />
          <p className="small muted">{t.common.availability.explain}</p>
        </fieldset>

        <fieldset className="form-section">
          <legend>{a.sectionPrivacy}</legend>
          <p className="hint">{a.privacyIntro}</p>
          <ConsentFields
            labels={adminConsentLabels(t)}
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

        <fieldset className="form-section">
          <legend>{a.sectionConsent}</legend>
          <CheckboxField name="consentConfirmed" required label={a.consentConfirmed} />
          <TextArea name="note" label={a.note} hint={a.noteHint} maxLength={300} rows={2} />
        </fieldset>

        <div className="form-actions">
          <SubmitButton label={a.submit} pendingLabel={a.submitting} className="btn btn-primary btn-lg" />
        </div>
      </ActionForm>
    </>
  );
}

import type { Metadata } from 'next';
import { HeartPulse, Lock, NotebookPen, Smartphone, UserPlus, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { todayInBangladesh } from '@/server/domain/dates';
import { compactLocations } from '@/server/services/location-index';
import { AdminPageHead } from '@/components/admin/AdminUi';
import { adminConsentLabels, adminProfileLabels } from '@/components/admin/labels';
import { ConsentFields, ProfileFields } from '@/components/DonorFormParts';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { CheckboxField, TextArea, TextField } from '@/components/form/fields';
import { Alert } from '@/components/ui';
import { staffCreateDonorAction } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.newDonor.title, robots: { index: false } };
}

function Legend({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <legend>
      <span className="legend-row">
        {icon}
        {children}
      </span>
    </legend>
  );
}

export default async function AdminNewDonorPage() {
  await requirePermission('/admin/donors/new', 'donors.manage');
  const { t, locale } = await getI18n();
  const locs = await compactLocations(locale);
  const a = t.admin.newDonor;
  return (
    <>
      <AdminPageHead icon={UserPlus} title={a.title} intro={a.intro} crumbs={[{ href: '/admin/donors', label: t.admin.donors.title }]} crumbsLabel={t.common.nav.breadcrumbs} />
      <Alert tone="info">{a.signInNote}</Alert>

      <ActionForm action={staffCreateDonorAction} aria-label={a.title} clientMessages={clientValidationMessages(t)}>
        <fieldset className="form-section">
          <Legend icon={<Smartphone size={20} aria-hidden="true" />}>{a.sectionAccount}</Legend>
          <TextField name="phone" type="tel" inputMode="tel" label={a.phone} hint={a.phoneHint} required maxLength={20} autoComplete="off" />
        </fieldset>

        <fieldset className="form-section">
          <Legend icon={<UserRound size={20} aria-hidden="true" />}>{a.sectionProfile}</Legend>
          <ProfileFields labels={adminProfileLabels(t, a.contactPhoneHint)} locations={locs} bloodGroups={[...BLOOD_GROUPS]} maxDate={todayInBangladesh()} withContactPhone />
        </fieldset>

        <fieldset className="form-section">
          <Legend icon={<HeartPulse size={20} aria-hidden="true" />}>{a.sectionAvailability}</Legend>
          <CheckboxField name="availableNow" label={a.availableNow} hint={a.availableNowHint(t.common.availability.sourceStaff)} />
          <p className="small muted">{t.common.availability.explain}</p>
        </fieldset>

        <fieldset className="form-section">
          <Legend icon={<Lock size={20} aria-hidden="true" />}>{a.sectionPrivacy}</Legend>
          <p className="hint">{a.privacyIntro}</p>
          <ConsentFields
            labels={adminConsentLabels(t)}
            defaults={{
              listedInSearch: false,
              allowCoordinatorContact: true,
              allowContactRequests: true,
            }}
          />
        </fieldset>

        <fieldset className="form-section">
          <Legend icon={<NotebookPen size={20} aria-hidden="true" />}>{a.sectionConsent}</Legend>
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

import type { Metadata } from 'next';
import { CalendarClock, Droplets, HeartPulse, UserRoundCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { DONATION_TYPES } from '@/server/domain/constants';
import { SETTINGS_LIMITS } from '@/server/domain/settings-defaults';
import { getSettings } from '@/server/services/settings';
import { AdminPageHead } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { TextField } from '@/components/form/fields';
import { Alert } from '@/components/ui';
import { updateSettingsAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.settings.title, robots: { index: false } };
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

export default async function AdminSettingsPage() {
  await requirePermission('/admin/settings', 'settings.manage');
  const { t, n } = await getI18n();
  const settings = await getSettings();
  const s = t.admin.settings;
  const limit = (key: keyof typeof SETTINGS_LIMITS) => s.limits(n(SETTINGS_LIMITS[key].min), n(SETTINGS_LIMITS[key].max));
  const num = (name: string, label: string, value: number, key: keyof typeof SETTINGS_LIMITS, extra?: string) => (
    <TextField
      name={name}
      label={label}
      type="number"
      inputMode="numeric"
      required
      min={SETTINGS_LIMITS[key].min}
      max={SETTINGS_LIMITS[key].max}
      defaultValue={String(value)}
      hint={extra ? `${extra} ${limit(key)}` : limit(key)}
    />
  );
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.settings} title={s.title} intro={s.intro} />
      <ActionForm action={updateSettingsAction} clientMessages={clientValidationMessages(t)}>
        <fieldset className="form-section">
          <Legend icon={<HeartPulse size={20} aria-hidden="true" />}>{s.sectionAvailability}</Legend>
          {num('availabilityExpiryDays', s.availabilityExpiryDays, settings.availabilityExpiryDays, 'availabilityExpiryDays', s.availabilityHint)}
        </fieldset>
        <fieldset className="form-section">
          <Legend icon={<Droplets size={20} aria-hidden="true" />}>{s.intervalsTitle}</Legend>
          <Alert tone="info">{s.intervalsNote}</Alert>
          <div className="field-row">
            {DONATION_TYPES.map((type) => (
              <div key={type}>{num(type, t.common.donationType[type], settings.eligibilityIntervals[type], 'interval')}</div>
            ))}
          </div>
        </fieldset>
        <fieldset className="form-section">
          <Legend icon={<CalendarClock size={20} aria-hidden="true" />}>{s.sectionRequests}</Legend>
          {num('requestExpiryHours', s.requestExpiryHours, settings.requestExpiryHours, 'requestExpiryHours')}
          {num('contactRequestExpiryDays', s.contactRequestExpiryDays, settings.contactRequestExpiryDays, 'contactRequestExpiryDays')}
        </fieldset>
        <fieldset className="form-section">
          <Legend icon={<UserRoundCheck size={20} aria-hidden="true" />}>{s.sectionDonors}</Legend>
          {num('minimumDonorAge', s.minimumDonorAge, settings.minimumDonorAge, 'minimumDonorAge', s.minimumAgeHint)}
        </fieldset>
        <div className="form-actions">
          <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-lg" />
        </div>
      </ActionForm>
    </>
  );
}

import type { Metadata } from 'next';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';
import { DONATION_TYPES } from '@/server/domain/constants';
import { SETTINGS_LIMITS } from '@/server/domain/settings-defaults';
import { getSettings } from '@/server/services/settings';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { TextField } from '@/components/form/fields';
import { Alert } from '@/components/ui';
import { updateSettingsAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.settings.title, robots: { index: false } };
}

export default async function AdminSettingsPage() {
  await requireAdmin('/admin/settings');
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
      <header className="stack-sm">
        <h1>{s.title}</h1>
        <p className="muted">{s.intro}</p>
      </header>
      <ActionForm action={updateSettingsAction}>
        <fieldset className="form-section">
          <legend>{s.sectionAvailability}</legend>
          {num('availabilityExpiryDays', s.availabilityExpiryDays, settings.availabilityExpiryDays, 'availabilityExpiryDays', s.availabilityHint)}
        </fieldset>
        <fieldset className="form-section">
          <legend>{s.intervalsTitle}</legend>
          <Alert tone="info">{s.intervalsNote}</Alert>
          <div className="field-row">
            {DONATION_TYPES.map((type) => (
              <div key={type}>{num(type, t.common.donationType[type], settings.eligibilityIntervals[type], 'interval')}</div>
            ))}
          </div>
        </fieldset>
        <fieldset className="form-section">
          <legend>{s.sectionRequests}</legend>
          {num('requestExpiryHours', s.requestExpiryHours, settings.requestExpiryHours, 'requestExpiryHours')}
          {num('contactRequestExpiryDays', s.contactRequestExpiryDays, settings.contactRequestExpiryDays, 'contactRequestExpiryDays')}
        </fieldset>
        <fieldset className="form-section">
          <legend>{s.sectionDonors}</legend>
          {num('minimumDonorAge', s.minimumDonorAge, settings.minimumDonorAge, 'minimumDonorAge', s.minimumAgeHint)}
        </fieldset>
        <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} />
      </ActionForm>
    </>
  );
}

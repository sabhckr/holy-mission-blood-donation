import type { Metadata } from 'next';
import { CalendarDays, Eye, EyeOff, MapPin, MapPinPlus, MapPinned, StickyNote } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { compactLocations } from '@/server/services/location-index';
import { listOperatingAreas } from '@/server/services/operating-areas';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminEmpty, AdminPageHead, SectionTitle } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { locationLabels } from '@/components/consent-labels';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { TextArea } from '@/components/form/fields';
import { LocationPicker } from '@/components/form/LocationPicker';
import { Alert, Badge } from '@/components/ui';
import { addOperatingAreaAction, setOperatingAreaActiveAction, updateOperatingAreaNoteAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.operatingAreas.title, robots: { index: false } };
}

export default async function AdminOperatingAreasPage() {
  await requirePermission('/admin/operating-areas', 'operating_areas.manage');
  const { t, n, locale, instantDate } = await getI18n();
  const [areas, locs] = await Promise.all([listOperatingAreas(), compactLocations(locale)]);
  const o = t.admin.operatingAreas;
  const pending = t.common.actions.submitting;
  const checks = clientValidationMessages(t);
  const name = (a: (typeof areas)[number]) => {
    const own = locale === 'bn' ? a.nameBn : a.nameEn;
    const parent = locale === 'bn' ? a.parentNameBn : a.parentNameEn;
    return a.level === 'upazila' && parent ? `${own}, ${parent}` : own;
  };
  // The public sentence is the fixed Lakshmipur-only policy; the list below is where the team is active inside Lakshmipur.
  const preview = t.common.operatingArea.notice;
  const reasonField = { name: 'reason', label: t.admin.reasonLabel, hint: t.admin.reasonHint, required: true };

  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.operatingAreas} title={o.title} intro={o.intro(t.common.operatingArea.title)} />

      <Alert tone="info" title={o.explainTitle}>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>{o.explain1}</li>
          <li>{o.explain2}</li>
          <li>{o.explain3}</li>
        </ul>
      </Alert>

      <section className="stack-sm" aria-labelledby="preview">
        <SectionTitle id="preview" icon={Eye}>
          {o.previewTitle}
        </SectionTitle>
        <div className="area-banner">
          <span className="stat-icon">
            <MapPin size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="area-banner-title">{t.common.operatingArea.title}</p>
            <p>{preview}</p>
          </div>
        </div>
      </section>

      <section className="stack" aria-labelledby="areas">
        <SectionTitle id="areas" icon={MapPinned} count={n(areas.length)}>
          {o.listTitle}
        </SectionTitle>
        {areas.length === 0 ? (
          <AdminEmpty title={o.empty} />
        ) : (
          <ul className="record-list">
            {areas.map((area) => (
              <li key={area.id}>
                <article className="card card-tight record-card" aria-labelledby={`area-${area.id}`}>
                  <div className="record-card-head">
                    <span className="record-card-icon">
                      <MapPin size={20} aria-hidden="true" />
                    </span>
                    <div className="record-card-title">
                      <h3 id={`area-${area.id}`}>{name(area)}</h3>
                      <p className="cluster-sm">
                        <CalendarDays size={14} aria-hidden="true" />
                        {o.updated(instantDate(area.updatedAt))}
                      </p>
                    </div>
                  </div>
                  <div className="record-card-badges">
                    <Badge tone="neutral">{t.admin.locations.levels[area.level]}</Badge>
                    <Badge tone={area.isActive ? 'success' : 'neutral'}>
                      {area.isActive ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                      {area.isActive ? o.active : o.inactive}
                    </Badge>
                  </div>
                  <p className="cluster-sm" style={{ alignItems: 'flex-start' }}>
                    <StickyNote size={16} className="tone-neutral" aria-hidden="true" style={{ marginTop: 4 }} />
                    <span>{area.publicNote ?? <span className="muted">{o.noNote}</span>}</span>
                  </p>
                  <details className="disclosure">
                    <summary>{o.editNote}</summary>
                    <ActionForm action={updateOperatingAreaNoteAction} aria-label={o.editNote} clientMessages={checks}>
                      <input type="hidden" name="id" value={area.id} />
                      <TextArea name="publicNote" label={o.publicNote} hint={o.publicNoteHint} defaultValue={area.publicNote} maxLength={300} rows={2} />
                      <div className="form-actions">
                        <SubmitButton label={o.saveNote} pendingLabel={t.common.actions.saving} className="btn btn-primary" />
                      </div>
                    </ActionForm>
                  </details>
                  {area.isActive ? (
                    <details className="disclosure disclosure-danger">
                      <summary>{o.deactivate}</summary>
                      <p className="hint">{o.deactivateHint}</p>
                      <AdminAction
                        action={setOperatingAreaActiveAction}
                        hidden={{ id: String(area.id), isActive: '0' }}
                        submit={o.deactivate}
                        pending={pending}
                        tone="danger"
                        size="md"
                        note={reasonField}
                        confirm={o.confirmDeactivate}
                      />
                    </details>
                  ) : (
                    <details className="disclosure">
                      <summary>{o.activate}</summary>
                      <AdminAction action={setOperatingAreaActiveAction} hidden={{ id: String(area.id), isActive: '1' }} submit={o.activate} pending={pending} tone="primary" size="md" note={reasonField} />
                    </details>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActionForm action={addOperatingAreaAction} aria-label={o.addTitle} clientMessages={checks}>
        <fieldset className="form-section">
          <legend>
            <span className="legend-row">
              <MapPinPlus size={20} aria-hidden="true" />
              {o.addTitle}
            </span>
          </legend>
          <p className="hint">{o.addIntro}</p>
          <LocationPicker locations={locs} labels={locationLabels(t)} />
          <TextArea name="publicNote" label={o.publicNote} hint={o.publicNoteHint} maxLength={300} rows={2} />
          <div className="form-actions">
            <SubmitButton label={o.add} pendingLabel={t.common.actions.saving} />
          </div>
        </fieldset>
      </ActionForm>
    </>
  );
}

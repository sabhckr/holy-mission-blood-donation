import type { Metadata } from 'next';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { compactLocations } from '@/server/services/location-index';
import { listOperatingAreas } from '@/server/services/operating-areas';
import { AdminAction } from '@/components/admin/AdminAction';
import { locationLabels } from '@/components/consent-labels';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { TextArea } from '@/components/form/fields';
import { LocationPicker } from '@/components/form/LocationPicker';
import { Alert, Badge, EmptyState } from '@/components/ui';
import { addOperatingAreaAction, setOperatingAreaActiveAction, updateOperatingAreaNoteAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.operatingAreas.title, robots: { index: false } };
}

export default async function AdminOperatingAreasPage() {
  await requirePermission('/admin/operating-areas', 'operating_areas.manage');
  const { t, locale, instantDate } = await getI18n();
  const [areas, locs] = await Promise.all([listOperatingAreas(), compactLocations(locale)]);
  const o = t.admin.operatingAreas;
  const pending = t.common.actions.submitting;
  const name = (a: (typeof areas)[number]) => {
    const own = locale === 'bn' ? a.nameBn : a.nameEn;
    const parent = locale === 'bn' ? a.parentNameBn : a.parentNameEn;
    return a.level === 'upazila' && parent ? `${own}, ${parent}` : own;
  };
  const active = areas.filter((a) => a.isActive);
  const preview = active.length ? t.common.operatingArea.notice(active.map(name).join(t.common.operatingArea.and)) : t.common.operatingArea.none;
  const reasonField = { name: 'reason', label: t.admin.reasonLabel, hint: t.admin.reasonHint, required: true };

  return (
    <>
      <header className="stack-sm">
        <h1>{o.title}</h1>
        <p className="muted">{o.intro(t.common.operatingArea.title)}</p>
      </header>

      <Alert tone="info" title={o.explainTitle}>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>{o.explain1}</li>
          <li>{o.explain2}</li>
          <li>{o.explain3}</li>
        </ul>
      </Alert>

      <section className="card stack-sm" aria-labelledby="preview">
        <h2 id="preview">{o.previewTitle}</h2>
        <p style={{ margin: 0 }}>{preview}</p>
      </section>

      <section className="stack" aria-labelledby="areas">
        <h2 id="areas">{o.listTitle}</h2>
        {areas.length === 0 ? (
          <EmptyState title={o.empty} />
        ) : (
          <ul className="list-plain stack">
            {areas.map((area) => (
              <li key={area.id} className="card card-tight stack-sm">
                <div className="cluster between">
                  <strong>{name(area)}</strong>
                  <span className="cluster-sm">
                    <Badge tone="neutral">{t.admin.locations.levels[area.level]}</Badge>
                    <Badge tone={area.isActive ? 'success' : 'neutral'}>{area.isActive ? o.active : o.inactive}</Badge>
                  </span>
                </div>
                <p className="small" style={{ margin: 0 }}>
                  {area.publicNote ?? <span className="muted">{o.noNote}</span>}
                </p>
                <p className="small muted" style={{ margin: 0 }}>
                  {o.updated(instantDate(area.updatedAt))}
                </p>
                <details className="disclosure">
                  <summary>{o.editNote}</summary>
                  <ActionForm action={updateOperatingAreaNoteAction} aria-label={o.editNote}>
                    <input type="hidden" name="id" value={area.id} />
                    <TextArea name="publicNote" label={o.publicNote} hint={o.publicNoteHint} defaultValue={area.publicNote} maxLength={300} rows={2} />
                    <div className="form-actions">
                      <SubmitButton label={o.saveNote} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-sm" />
                    </div>
                  </ActionForm>
                </details>
                {area.isActive ? (
                  <details className="disclosure">
                    <summary>{o.deactivate}</summary>
                    <p className="hint">{o.deactivateHint}</p>
                    <AdminAction
                      action={setOperatingAreaActiveAction}
                      hidden={{ id: String(area.id), isActive: '0' }}
                      submit={o.deactivate}
                      pending={pending}
                      tone="danger"
                      note={reasonField}
                      confirm={o.confirmDeactivate}
                    />
                  </details>
                ) : (
                  <details className="disclosure">
                    <summary>{o.activate}</summary>
                    <AdminAction action={setOperatingAreaActiveAction} hidden={{ id: String(area.id), isActive: '1' }} submit={o.activate} pending={pending} tone="primary" note={reasonField} />
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="add-area">
        <h2 id="add-area">{o.addTitle}</h2>
        <p className="hint">{o.addIntro}</p>
        <ActionForm action={addOperatingAreaAction} aria-label={o.addTitle}>
          <LocationPicker locations={locs} labels={locationLabels(t)} />
          <TextArea name="publicNote" label={o.publicNote} hint={o.publicNoteHint} maxLength={300} rows={2} />
          <div className="form-actions">
            <SubmitButton label={o.add} pendingLabel={t.common.actions.saving} />
          </div>
        </ActionForm>
      </section>
    </>
  );
}

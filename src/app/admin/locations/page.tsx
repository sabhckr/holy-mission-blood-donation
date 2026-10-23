import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, EyeOff, MapPinPlus } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { childrenOf, getLocation } from '@/server/services/locations';
import { AdminEmpty, AdminPageHead, SectionTitle } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { clientValidationMessages } from '@/components/form/client-messages';
import { CheckboxField, TextField } from '@/components/form/fields';
import { Badge } from '@/components/ui';
import { createLocationAction, updateLocationAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.locations.title, robots: { index: false } };
}

const CHILD_LEVEL = { division: 'district', district: 'upazila' } as const;

export default async function AdminLocationsPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  await requirePermission('/admin/locations', 'locations.manage');
  const { t, n, locale } = await getI18n();
  const raw = (await searchParams).parent;
  const parentId = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  const parent = parentId ? await getLocation(parentId) : null;
  if (parentId && (!parent || parent.level === 'upazila')) notFound();
  const chain: NonNullable<typeof parent>[] = [];
  for (let node = parent; node; node = node.parentId ? await getLocation(node.parentId) : null) chain.unshift(node);
  const level = parent ? CHILD_LEVEL[parent.level as 'division' | 'district'] : 'division';
  const children = await childrenOf(parent ? parent.id : null);
  const l = t.admin.locations;
  const checks = clientValidationMessages(t);
  const name = (x: { nameBn: string; nameEn: string }) => (locale === 'bn' ? x.nameBn : x.nameEn);
  return (
    <>
      <AdminPageHead
        icon={ADMIN_ICONS.locations}
        title={l.title}
        intro={l.intro}
        crumbs={[{ href: '/admin/locations', label: l.root }, ...chain.map((c) => ({ href: `/admin/locations?parent=${c.id}`, label: name(c) }))]}
        crumbsLabel={t.common.nav.breadcrumbs}
      />
      <section className="stack" aria-labelledby="level-list">
        <SectionTitle id="level-list" icon={ADMIN_ICONS.locations} count={n(children.length)}>
          {parent ? `${l.levels[level]} — ${name(parent)}` : l.levels[level]}
        </SectionTitle>
        {children.length === 0 ? (
          <AdminEmpty title={l.empty} />
        ) : (
          <ul className="record-list" style={{ gap: 'var(--space-2)' }}>
            {children.map((c) => (
              <li key={c.id} className="card card-tight stack-sm">
                <div className="location-row">
                  <div className="location-name">
                    <strong>{c.nameBn}</strong>
                    <span className="cell-sub">
                      {c.nameEn} · {l.code}: {c.code}
                    </span>
                  </div>
                  <span className="cluster-sm">
                    <Badge tone={c.isActive ? 'success' : 'neutral'}>
                      {c.isActive ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
                      {c.isActive ? l.active : l.inactive}
                    </Badge>
                    {c.level !== 'upazila' && (
                      <Link className="btn btn-sm btn-soft" href={`/admin/locations?parent=${c.id}`}>
                        {l.open}
                        <ChevronRight size={16} aria-hidden="true" />
                      </Link>
                    )}
                  </span>
                </div>
                <details className="disclosure">
                  <summary>{l.edit}</summary>
                  <ActionForm action={updateLocationAction} clientMessages={checks} aria-label={`${l.edit}: ${c.nameBn}`}>
                    <input type="hidden" name="id" value={c.id} />
                    <div className="field-row">
                      <TextField name="nameBn" label={l.nameBn} defaultValue={c.nameBn} required maxLength={80} />
                      <TextField name="nameEn" label={l.nameEn} defaultValue={c.nameEn} required maxLength={80} />
                    </div>
                    <CheckboxField name="isActive" label={l.isActive} defaultChecked={c.isActive} />
                    <div className="form-actions">
                      <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} className="btn btn-primary" />
                    </div>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ActionForm action={createLocationAction} clientMessages={checks} aria-label={l.addTitle(l.levels[level])}>
        <input type="hidden" name="parentId" value={parent ? parent.id : ''} />
        <input type="hidden" name="level" value={level} />
        <fieldset className="form-section">
          <legend>
            <span className="legend-row">
              <MapPinPlus size={20} aria-hidden="true" />
              {l.addTitle(l.levels[level])}
            </span>
          </legend>
          <div className="field-row">
            <TextField name="nameBn" label={l.nameBn} required maxLength={80} />
            <TextField name="nameEn" label={l.nameEn} required maxLength={80} />
          </div>
        </fieldset>
        <div className="form-actions">
          <SubmitButton label={l.add} pendingLabel={t.common.actions.saving} />
        </div>
      </ActionForm>
    </>
  );
}

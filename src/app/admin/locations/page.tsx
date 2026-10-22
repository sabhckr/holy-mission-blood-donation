import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { childrenOf, getLocation } from '@/server/services/locations';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { CheckboxField, TextField } from '@/components/form/fields';
import { Badge, Breadcrumbs, EmptyState } from '@/components/ui';
import { createLocationAction, updateLocationAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.locations.title, robots: { index: false } };
}

const CHILD_LEVEL = { division: 'district', district: 'upazila' } as const;

export default async function AdminLocationsPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  await requirePermission('/admin/locations', 'locations.manage');
  const { t, locale } = await getI18n();
  const raw = (await searchParams).parent;
  const parentId = raw && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  const parent = parentId ? await getLocation(parentId) : null;
  if (parentId && (!parent || parent.level === 'upazila')) notFound();
  const chain: NonNullable<typeof parent>[] = [];
  for (let node = parent; node; node = node.parentId ? await getLocation(node.parentId) : null) chain.unshift(node);
  const level = parent ? CHILD_LEVEL[parent.level as 'division' | 'district'] : 'division';
  const children = await childrenOf(parent ? parent.id : null);
  const l = t.admin.locations;
  const name = (n: { nameBn: string; nameEn: string }) => (locale === 'bn' ? n.nameBn : n.nameEn);
  return (
    <>
      <header className="stack-sm">
        <h1>{l.title}</h1>
        <p className="muted">{l.intro}</p>
        <Breadcrumbs items={[{ href: '/admin/locations', label: l.root }, ...chain.map((c) => ({ href: `/admin/locations?parent=${c.id}`, label: name(c) }))]} />
      </header>
      <h2>
        {l.levels[level]}
        {parent ? ` — ${name(parent)}` : ''}
      </h2>
      {children.length === 0 ? (
        <EmptyState title={l.empty} />
      ) : (
        <ul className="list-plain stack-sm">
          {children.map((c) => (
            <li key={c.id} className="card card-tight stack-sm">
              <div className="cluster between">
                <span>
                  <strong>{c.nameBn}</strong> · {c.nameEn} <span className="small muted">({l.code}: {c.code})</span>
                </span>
                <span className="cluster-sm">
                  <Badge tone={c.isActive ? 'success' : 'neutral'}>{c.isActive ? l.active : l.inactive}</Badge>
                  {c.level !== 'upazila' && (
                    <Link className="btn btn-sm" href={`/admin/locations?parent=${c.id}`}>
                      {l.open}
                    </Link>
                  )}
                </span>
              </div>
              <details className="disclosure">
                <summary>{l.edit}</summary>
                <ActionForm action={updateLocationAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <div className="field-row">
                    <TextField name="nameBn" label={l.nameBn} defaultValue={c.nameBn} required maxLength={80} />
                    <TextField name="nameEn" label={l.nameEn} defaultValue={c.nameEn} required maxLength={80} />
                  </div>
                  <CheckboxField name="isActive" label={l.isActive} defaultChecked={c.isActive} />
                  <SubmitButton label={t.common.actions.save} pendingLabel={t.common.actions.saving} className="btn btn-primary btn-sm" />
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      )}
      <section className="card stack" aria-labelledby="add-location">
        <h2 id="add-location">{l.addTitle(l.levels[level])}</h2>
        <ActionForm action={createLocationAction}>
          <input type="hidden" name="parentId" value={parent ? parent.id : ''} />
          <input type="hidden" name="level" value={level} />
          <div className="field-row">
            <TextField name="nameBn" label={l.nameBn} required maxLength={80} />
            <TextField name="nameEn" label={l.nameEn} required maxLength={80} />
          </div>
          <SubmitButton label={l.add} pendingLabel={t.common.actions.saving} />
        </ActionForm>
      </section>
    </>
  );
}

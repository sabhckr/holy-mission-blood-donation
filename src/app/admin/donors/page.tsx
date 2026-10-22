import type { Metadata } from 'next';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { can } from '@/server/policy';
import { listDonorsForStaff } from '@/server/services/donor-admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { ListingBadge, RegistrationBadge, StatedAvailabilityBadge, statedAvailability } from '@/components/admin/StatusBadges';
import { Badge, EmptyState, Pagination, VerificationBadge } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.donors.title, robots: { index: false } };
}

const REGISTRATION = ['pending', 'approved', 'rejected'] as const;
const LISTING = ['active', 'paused', 'restricted', 'removed'] as const;
const AVAILABILITY = ['available', 'unavailable', 'unknown'] as const;

const schema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  registration: z.enum(REGISTRATION).optional().catch(undefined),
  listing: z.enum(LISTING).optional().catch(undefined),
  availability: z.enum(AVAILABILITY).optional().catch(undefined),
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  district: z.coerce.number().int().positive().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function AdminDonorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('/admin/donors', 'donors.review');
  const { t, n, instantDate, locale } = await getI18n();
  const sp = await searchParams;
  const f = schema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [result, index] = await Promise.all([
    listDonorsForStaff(actor, {
      q: f.q || null,
      registration: f.registration ?? null,
      listing: f.listing ?? null,
      availability: f.availability ?? null,
      bloodGroup: f.group ?? null,
      districtId: f.district ?? null,
      page: f.page ?? 1,
    }),
    getLocationIndex(),
  ]);
  const d = t.admin.donors;
  const districts = index.nodes
    .filter((l) => l.level === 'district')
    .sort((a, b) => (locale === 'bn' ? a.nameBn : a.nameEn).localeCompare(locale === 'bn' ? b.nameBn : b.nameEn));

  const select = (name: string, label: string, value: string | undefined, options: { value: string; label: string }[]) => (
    <div className="field">
      <label className="label" htmlFor={`d-${name}`}>
        {label}
      </label>
      <select id={`d-${name}`} className="select" name={name} defaultValue={value ?? ''}>
        <option value="">{t.admin.any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <header className="stack-sm">
        <div className="cluster between">
          <h1 style={{ marginBottom: 0 }}>{d.title}</h1>
          {can(actor, 'donors.manage') && (
            <Link className="btn btn-primary" href="/admin/donors/new">
              <UserPlus size={18} aria-hidden="true" />
              {d.add}
            </Link>
          )}
        </div>
        <p className="muted">{d.intro}</p>
      </header>

      <form method="get" action="/admin/donors" className="card card-tight form" role="search">
        <div className="field">
          <label className="label" htmlFor="d-q">
            {d.search}
          </label>
          <p className="hint" id="d-q-hint">
            {d.searchHint}
          </p>
          <input id="d-q" className="input" type="search" name="q" defaultValue={f.q ?? ''} maxLength={80} aria-describedby="d-q-hint" />
        </div>
        <div className="field-row">
          {select('registration', d.registration, f.registration, REGISTRATION.map((s) => ({ value: s, label: t.common.registrationStatus[s] })))}
          {select('listing', d.listing, f.listing, LISTING.map((s) => ({ value: s, label: t.common.listingStatus[s] })))}
          {select('availability', d.availability, f.availability, AVAILABILITY.map((s) => ({ value: s, label: t.common.availability[s] })))}
        </div>
        <div className="field-row">
          {select('group', t.common.bloodGroup, f.group, BLOOD_GROUPS.map((g) => ({ value: g, label: g })))}
          {select('district', t.common.location.district, f.district?.toString(), districts.map((x) => ({ value: String(x.id), label: locale === 'bn' ? x.nameBn : x.nameEn })))}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {t.admin.filter}
          </button>
          <Link href="/admin/donors">{t.common.actions.clearFilters}</Link>
        </div>
      </form>

      <p style={{ fontWeight: 600 }} aria-live="polite">
        {t.admin.results(n(result.total))}
      </p>
      {result.items.length === 0 ? (
        <EmptyState title={d.empty} />
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">{d.tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{d.name}</th>
                <th scope="col">{t.common.bloodGroup}</th>
                <th scope="col">{d.area}</th>
                <th scope="col">{d.registration}</th>
                <th scope="col">{d.listing}</th>
                <th scope="col">{d.availability}</th>
                <th scope="col">{d.verification}</th>
                <th scope="col">{d.registered}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/donors/${row.id}`}>{row.fullName}</Link>
                    <div className="small muted">{row.publicId}</div>
                    {row.accountStatus !== 'active' && <Badge tone="danger">{t.common.accountStatus[row.accountStatus]}</Badge>}
                  </td>
                  <td>
                    <strong>{row.bloodGroup}</strong>
                  </td>
                  <td>{labelFrom(index, locale, row.upazilaId, row.districtId)}</td>
                  <td>
                    <RegistrationBadge status={row.registrationStatus} t={t} />
                  </td>
                  <td>
                    <ListingBadge status={row.listingStatus} t={t} />
                  </td>
                  <td>
                    <StatedAvailabilityBadge state={statedAvailability(row)} source={row.availabilitySource} t={t} />
                  </td>
                  <td>
                    <VerificationBadge status={row.verificationStatus} t={t} />
                  </td>
                  <td>{instantDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath="/admin/donors"
        params={{ q: f.q, registration: f.registration, listing: f.listing, availability: f.availability, group: f.group, district: f.district?.toString() }}
        t={t}
        n={n}
      />
    </>
  );
}

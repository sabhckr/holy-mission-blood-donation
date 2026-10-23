import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPinOff, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { can } from '@/server/policy';
import { listDonorsForStaff } from '@/server/services/donor-admin';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { AdminEmpty, AdminPageHead, FilterBar, FilterSearch, FilterSelect } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { AccountStatusBadge, ListingBadge, RegistrationBadge, StatedAvailabilityBadge, VerificationStatusBadge, statedAvailability } from '@/components/admin/StatusBadges';
import { Badge, BloodGroupBadge, Pagination } from '@/components/ui';

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
  area: z.enum(['inside', 'outside']).optional().catch(undefined),
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
      area: f.area ?? null,
      page: f.page ?? 1,
    }),
    getLocationIndex(),
  ]);
  const d = t.admin.donors;
  const filtered = !!(f.q || f.registration || f.listing || f.availability || f.group || f.area);

  return (
    <>
      <AdminPageHead
        icon={ADMIN_ICONS.donors}
        title={d.title}
        intro={d.intro}
        actions={
          can(actor, 'donors.manage') && (
            <Link className="btn btn-primary" href="/admin/donors/new">
              <UserPlus size={18} aria-hidden="true" />
              {d.add}
            </Link>
          )
        }
      />

      <FilterBar action="/admin/donors" label={t.admin.filtersLabel} submit={t.admin.filter} clear={t.common.actions.clearFilters} active={filtered}>
        <FilterSearch id="d-q" name="q" label={d.search} hint={d.searchHint} value={f.q} />
        <FilterSelect id="d-registration" name="registration" label={d.registration} value={f.registration} any={t.admin.any} options={REGISTRATION.map((s) => ({ value: s, label: t.common.registrationStatus[s] }))} />
        <FilterSelect id="d-listing" name="listing" label={d.listing} value={f.listing} any={t.admin.any} options={LISTING.map((s) => ({ value: s, label: t.common.listingStatus[s] }))} />
        <FilterSelect id="d-availability" name="availability" label={d.availability} value={f.availability} any={t.admin.any} options={AVAILABILITY.map((s) => ({ value: s, label: t.common.availability[s] }))} />
        <FilterSelect id="d-group" name="group" label={t.common.bloodGroup} value={f.group} any={t.admin.any} options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} />
        <FilterSelect
          id="d-area"
          name="area"
          label={d.area}
          value={f.area}
          any={t.admin.any}
          options={[
            { value: 'inside', label: d.areaInside },
            { value: 'outside', label: d.areaOutside },
          ]}
        />
      </FilterBar>

      <section className="stack" aria-labelledby="donor-results">
        <div className="results-bar">
          <p id="donor-results" aria-live="polite">
            {t.admin.results(n(result.total))}
          </p>
        </div>
        {result.items.length === 0 ? (
          <AdminEmpty title={d.empty} hint={filtered ? t.admin.emptyHint : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <caption className="visually-hidden">{d.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{d.name}</th>
                  <th scope="col">
                    <span className="th-line">{d.registration}</span>
                    <span className="th-line">{d.listing}</span>
                  </th>
                  <th scope="col">
                    <span className="th-line">{d.availability}</span>
                    <span className="th-line">{d.verification}</span>
                  </th>
                  <th scope="col">{d.registered}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => (
                  <tr key={row.id}>
                    <td className="cell-main">
                      <div className="donor-cell">
                        <BloodGroupBadge group={row.bloodGroup} small label={t.common.bloodGroup} />
                        <div>
                          <Link className="row-link" href={`/admin/donors/${row.id}`}>
                            {row.fullName}
                          </Link>
                          <span className="cell-sub">
                            {row.publicId} · {labelFrom(index, locale, row.upazilaId, row.districtId)}
                          </span>
                          {row.accountStatus !== 'active' && <AccountStatusBadge status={row.accountStatus} t={t} />}
                          {!row.inServiceArea && (
                            <Badge tone="warning">
                              <MapPinOff size={14} aria-hidden="true" />
                              {d.areaOutside}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="cell-pair">
                      <div className="pair-item">
                        <span className="pair-label">{d.registration}</span>
                        <RegistrationBadge status={row.registrationStatus} t={t} />
                      </div>
                      <div className="pair-item">
                        <span className="pair-label">{d.listing}</span>
                        <ListingBadge status={row.listingStatus} t={t} />
                      </div>
                    </td>
                    <td className="cell-pair">
                      <div className="pair-item">
                        <span className="pair-label">{d.availability}</span>
                        <StatedAvailabilityBadge state={statedAvailability(row)} source={row.availabilitySource} t={t} />
                      </div>
                      <div className="pair-item">
                        <span className="pair-label">{d.verification}</span>
                        <VerificationStatusBadge status={row.verificationStatus} t={t} />
                      </div>
                    </td>
                    <td data-label={d.registered} className="cell-nowrap">
                      {instantDate(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath="/admin/donors"
        params={{ q: f.q, registration: f.registration, listing: f.listing, availability: f.availability, group: f.group, area: f.area }}
        t={t}
        n={n}
      />
    </>
  );
}

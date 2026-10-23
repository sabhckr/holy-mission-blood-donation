import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS, REQUEST_STATUSES } from '@/server/domain/constants';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { adminListRequests } from '@/server/services/requests';
import { AdminEmpty, AdminPageHead, FilterBar, FilterSelect } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { RequestStatusBadge, UrgencyBadge } from '@/components/admin/StatusBadges';
import { BloodGroupBadge, Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.requests.title, robots: { index: false } };
}

const schema = z.object({
  status: z.enum(REQUEST_STATUSES).optional().catch(undefined),
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  district: z.coerce.number().int().positive().optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('/admin/requests', 'requests.view');
  const { t, n, dateTime, instantDate, locale } = await getI18n();
  const sp = await searchParams;
  const f = schema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [result, index] = await Promise.all([
    adminListRequests(actor, { status: f.status ?? null, bloodGroup: f.group ?? null, districtId: f.district ?? null, page: f.page ?? 1 }),
    getLocationIndex(),
  ]);
  const r = t.admin.requests;
  const districts = index.nodes.filter((l) => l.level === 'district').sort((a, b) => (locale === 'bn' ? a.nameBn : a.nameEn).localeCompare(locale === 'bn' ? b.nameBn : b.nameEn));
  const filtered = !!(f.status || f.group || f.district);
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.requests} title={r.title} intro={r.intro} />
      <FilterBar action="/admin/requests" label={t.admin.filtersLabel} submit={t.admin.filter} clear={t.common.actions.clearFilters} active={filtered}>
        <FilterSelect id="r-status" name="status" label={r.status} value={f.status} any={t.admin.any} options={REQUEST_STATUSES.map((s) => ({ value: s, label: t.common.requestStatus[s] }))} />
        <FilterSelect id="r-group" name="group" label={r.group} value={f.group} any={t.admin.any} options={BLOOD_GROUPS.map((g) => ({ value: g, label: g }))} />
        <FilterSelect
          id="r-district"
          name="district"
          label={r.district}
          value={f.district?.toString()}
          any={t.admin.any}
          options={districts.map((d) => ({ value: String(d.id), label: locale === 'bn' ? d.nameBn : d.nameEn }))}
        />
      </FilterBar>
      <section className="stack" aria-labelledby="request-results">
        <div className="results-bar">
          <p id="request-results">{t.admin.results(n(result.total))}</p>
        </div>
        {result.items.length === 0 ? (
          <AdminEmpty title={r.empty} hint={filtered ? t.admin.emptyHint : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{r.hospital}</th>
                  <th scope="col">
                    <span className="th-line">{r.urgency}</span>
                    <span className="th-line">{r.status}</span>
                  </th>
                  <th scope="col">
                    <span className="th-line">{r.needed}</span>
                    <span className="th-line">{r.created}</span>
                  </th>
                  <th scope="col">{r.community}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map(({ request, communityName, status }) => (
                  <tr key={request.id}>
                    <td className="cell-main">
                      <div className="donor-cell">
                        <BloodGroupBadge group={request.bloodGroup} small label={r.group} />
                        <div>
                          <Link className="row-link" href={`/requests/${request.publicId}`}>
                            {request.hospitalName}
                          </Link>
                          <span className="cell-sub">{labelFrom(index, locale, request.upazilaId, request.districtId)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="cell-pair">
                      <div className="pair-item">
                        <span className="pair-label">{r.urgency}</span>
                        <UrgencyBadge urgency={request.urgency} t={t} />
                      </div>
                      <div className="pair-item">
                        <span className="pair-label">{r.status}</span>
                        <RequestStatusBadge status={status} t={t} />
                      </div>
                    </td>
                    <td className="cell-pair">
                      <div className="pair-item">
                        <span className="pair-label">{r.needed}</span>
                        <strong className="cell-nowrap">{dateTime(request.neededAt)}</strong>
                      </div>
                      <div className="pair-item">
                        <span className="pair-label">{r.created}</span>
                        <span className="cell-nowrap muted">{instantDate(request.createdAt)}</span>
                      </div>
                    </td>
                    <td data-label={r.community}>{communityName ?? <span className="muted">{t.admin.none}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/requests" params={{ status: f.status, group: f.group, district: f.district?.toString() }} t={t} n={n} />
    </>
  );
}

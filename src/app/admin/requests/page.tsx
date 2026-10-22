import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { BLOOD_GROUPS, REQUEST_STATUSES } from '@/server/domain/constants';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { adminListRequests } from '@/server/services/requests';
import { Badge, EmptyState, Pagination } from '@/components/ui';

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
  return (
    <>
      <header className="stack-sm">
        <h1>{r.title}</h1>
        <p className="muted">{r.intro}</p>
      </header>
      <form method="get" action="/admin/requests" className="card card-tight form">
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="r-status">
              {r.status}
            </label>
            <select id="r-status" className="select" name="status" defaultValue={f.status ?? ''}>
              <option value="">{t.admin.any}</option>
              {REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.common.requestStatus[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="r-group">
              {r.group}
            </label>
            <select id="r-group" className="select" name="group" defaultValue={f.group ?? ''}>
              <option value="">{t.admin.any}</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="r-district">
              {r.district}
            </label>
            <select id="r-district" className="select" name="district" defaultValue={f.district?.toString() ?? ''}>
              <option value="">{t.admin.any}</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {locale === 'bn' ? d.nameBn : d.nameEn}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {t.admin.filter}
          </button>
          <Link href="/admin/requests">{t.common.actions.clearFilters}</Link>
        </div>
      </form>
      <p style={{ fontWeight: 600 }}>{t.admin.results(n(result.total))}</p>
      {result.items.length === 0 ? (
        <EmptyState title={r.empty} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{r.group}</th>
                <th scope="col">{r.hospital}</th>
                <th scope="col">{r.district}</th>
                <th scope="col">{r.needed}</th>
                <th scope="col">{r.urgency}</th>
                <th scope="col">{r.status}</th>
                <th scope="col">{r.community}</th>
                <th scope="col">{r.created}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map(({ request, communityName, status }) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.bloodGroup}</strong>
                  </td>
                  <td>
                    <Link href={`/requests/${request.publicId}`}>{request.hospitalName}</Link>
                  </td>
                  <td>{labelFrom(index, locale, request.upazilaId, request.districtId)}</td>
                  <td>{dateTime(request.neededAt)}</td>
                  <td>
                    <Badge tone={request.urgency === 'critical' ? 'danger' : request.urgency === 'urgent' ? 'warning' : 'neutral'}>{t.common.urgency[request.urgency]}</Badge>
                  </td>
                  <td>{t.common.requestStatus[status]}</td>
                  <td>{communityName ?? t.admin.none}</td>
                  <td>{instantDate(request.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/requests" params={{ status: f.status, group: f.group, district: f.district?.toString() }} t={t} n={n} />
    </>
  );
}

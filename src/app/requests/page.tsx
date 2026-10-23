import type { Metadata } from 'next';
import Link from 'next/link';
import { Siren } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { listPublicRequests } from '@/server/services/requests';
import { locationLabels } from '@/components/consent-labels';
import { RequestAdvice } from '@/components/request/RequestAdvice';
import { RequestCard } from '@/components/request/RequestCard';
import { RequestFilters } from '@/components/request/RequestFilters';
import { PageHeader, Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.boardTitle, description: t.request.boardIntro };
}

const id = z.coerce.number().int().positive().optional().catch(undefined);
const filtersSchema = z.object({
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  division: id,
  district: id,
  upazila: id,
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export default async function RequestBoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const i18n = await getI18n();
  const { t, n, locale } = i18n;
  const sp = await searchParams;
  const filters = filtersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [result, locs, index] = await Promise.all([
    listPublicRequests({ bloodGroup: filters.group ?? null, divisionId: filters.division ?? null, districtId: filters.district ?? null, upazilaId: filters.upazila ?? null, page: filters.page ?? 1 }),
    compactLocations(locale),
    getLocationIndex(),
  ]);
  const filtered = !!(filters.group || filters.division || filters.district || filters.upazila);
  return (
    <>
      <PageHeader title={t.request.boardTitle} intro={t.request.boardIntro}>
        <Link className="btn btn-primary header-cta" href="/requests/new">
          <Siren size={18} aria-hidden="true" />
          {t.request.newCta}
        </Link>
      </PageHeader>
      <div className="section pub-body">
        <div className="container stack">
          <section className="card card-tight" aria-label={t.request.filters}>
            <RequestFilters
              locations={locs}
              bloodGroups={[...BLOOD_GROUPS]}
              defaults={{ bloodGroup: filters.group, divisionId: filters.division, districtId: filters.district, upazilaId: filters.upazila }}
              labels={{
                bloodGroup: t.common.bloodGroup,
                anyGroup: t.common.anyBloodGroup,
                search: t.common.actions.search,
                location: locationLabels(t),
                area: t.request.areaFilter,
                groupNav: t.request.groupFilterLabel,
              }}
            />
          </section>

          <div className="board-layout">
            <section className="results" aria-labelledby="board-count" aria-live="polite">
              <div className="results-head">
                <h2 id="board-count" className="results-count">
                  {t.request.resultCount(n(result.total))}
                </h2>
                {filtered && <Link href="/requests">{t.common.actions.clearFilters}</Link>}
              </div>
              {result.items.length === 0 ? (
                <div className="no-results-head card">
                  <span className="no-results-icon">
                    <Siren size={28} aria-hidden="true" />
                  </span>
                  <h3>{t.request.emptyTitle}</h3>
                  <p>{t.request.emptyBody}</p>
                  <Link className="btn btn-primary" href="/requests/new">
                    {t.request.newCta}
                  </Link>
                </div>
              ) : (
                <div className="donor-grid">
                  {result.items.map((r) => (
                    <RequestCard key={r.publicId} item={r} place={labelFrom(index, locale, r.upazilaId, r.districtId)} i18n={i18n} />
                  ))}
                </div>
              )}
              <Pagination
                page={result.page}
                pageCount={result.pageCount}
                basePath="/requests"
                params={{ group: filters.group, division: filters.division?.toString(), district: filters.district?.toString(), upazila: filters.upazila?.toString() }}
                t={t}
                n={n}
              />
            </section>
            <aside>
              <RequestAdvice t={t} />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

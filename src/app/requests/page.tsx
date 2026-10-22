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
import { EmptyState, PageHeader, Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.boardTitle, description: t.request.boardIntro };
}

const id = z.coerce.number().int().positive().optional().catch(undefined);
const filtersSchema = z.object({
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  division: id,
  district: id,
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export default async function RequestBoardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const i18n = await getI18n();
  const { t, n, locale } = i18n;
  const sp = await searchParams;
  const filters = filtersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [result, locs, index] = await Promise.all([
    listPublicRequests({ bloodGroup: filters.group ?? null, divisionId: filters.division ?? null, districtId: filters.district ?? null, page: filters.page ?? 1 }),
    compactLocations(locale),
    getLocationIndex(),
  ]);
  return (
    <>
      <PageHeader title={t.request.boardTitle} intro={t.request.boardIntro}>
        <Link className="btn btn-primary" href="/requests/new">
          <Siren size={18} aria-hidden="true" />
          {t.request.newCta}
        </Link>
      </PageHeader>
      <div className="container section layout-sidebar">
        <aside className="stack">
          <div className="card card-tight">
            <h2 style={{ fontSize: '1.1rem' }}>{t.request.filters}</h2>
            <RequestFilters
              locations={locs}
              bloodGroups={[...BLOOD_GROUPS]}
              defaults={{ bloodGroup: filters.group, divisionId: filters.division, districtId: filters.district }}
              labels={{ bloodGroup: t.common.bloodGroup, anyGroup: t.common.anyBloodGroup, search: t.common.actions.search, location: locationLabels(t) }}
            />
            <p style={{ marginTop: 'var(--space-3)' }}>
              <Link href="/requests">{t.common.actions.clearFilters}</Link>
            </p>
          </div>
          <RequestAdvice t={t} />
        </aside>
        <section className="stack" aria-live="polite">
          <p style={{ fontWeight: 700, margin: 0 }}>{t.request.resultCount(n(result.total))}</p>
          {result.items.length === 0 ? (
            <EmptyState icon={<Siren size={40} aria-hidden="true" />} title={t.request.emptyTitle}>
              <p>{t.request.emptyBody}</p>
              <Link className="btn btn-primary" href="/requests/new">
                {t.request.newCta}
              </Link>
            </EmptyState>
          ) : (
            <div className="grid grid-2">
              {result.items.map((r) => (
                <RequestCard key={r.publicId} item={r} place={labelFrom(index, locale, r.upazilaId, r.districtId)} i18n={i18n} />
              ))}
            </div>
          )}
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            basePath="/requests"
            params={{ group: filters.group, division: filters.division?.toString(), district: filters.district?.toString() }}
            t={t}
            n={n}
          />
        </section>
      </div>
    </>
  );
}

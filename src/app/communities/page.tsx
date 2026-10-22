import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, MapPin, Users } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { listCommunities } from '@/server/services/communities';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { locationLabels } from '@/components/consent-labels';
import { LocationPicker } from '@/components/form/LocationPicker';
import { Badge, EmptyState, PageHeader, Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.community.directoryTitle, description: t.community.directoryIntro };
}

const id = z.coerce.number().int().positive().optional().catch(undefined);
const filtersSchema = z.object({
  q: z.string().trim().max(60).optional().catch(undefined),
  division: id,
  district: id,
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export default async function CommunitiesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t, n, locale } = await getI18n();
  const sp = await searchParams;
  const filters = filtersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [result, locs, index] = await Promise.all([
    listCommunities({ q: filters.q || null, divisionId: filters.division ?? null, districtId: filters.district ?? null, page: filters.page ?? 1 }),
    compactLocations(locale),
    getLocationIndex(),
  ]);
  const c = t.community;
  return (
    <>
      <PageHeader title={c.directoryTitle} intro={c.directoryIntro}>
        <Link className="btn btn-primary" href="/communities/new">
          {c.registerCta}
        </Link>
      </PageHeader>
      <div className="container section layout-sidebar">
        <aside className="card card-tight" aria-labelledby="community-filters">
          <h2 id="community-filters" style={{ fontSize: '1.1rem' }}>
            {c.filters}
          </h2>
          <form method="get" action="/communities" className="form" role="search">
            <div className="field">
              <label className="label" htmlFor="cf-q">
                {c.searchName}
              </label>
              <p className="hint">{c.searchNameHint}</p>
              <input id="cf-q" className="input" name="q" defaultValue={filters.q ?? ''} maxLength={60} />
            </div>
            <LocationPicker
              locations={locs}
              labels={locationLabels(t)}
              defaults={{ divisionId: filters.division, districtId: filters.district }}
              anyOption
              showUpazila={false}
              required={{ division: false, district: false, upazila: false }}
              names={{ division: 'division', district: 'district', upazila: 'upazila' }}
            />
            <button type="submit" className="btn btn-primary btn-block">
              {t.common.actions.search}
            </button>
          </form>
          <p style={{ marginTop: 'var(--space-3)' }}>
            <Link href="/communities">{t.common.actions.clearFilters}</Link>
          </p>
        </aside>

        <section className="stack" aria-live="polite">
          <p style={{ fontWeight: 700, margin: 0 }}>{c.resultCount(n(result.total))}</p>
          {result.items.length === 0 ? (
            <EmptyState icon={<Building2 size={40} aria-hidden="true" />} title={c.emptyTitle}>
              <p>{c.emptyBody}</p>
              <Link className="btn btn-primary" href="/communities/new">
                {c.registerCta}
              </Link>
            </EmptyState>
          ) : (
            <div className="grid grid-2">
              {result.items.map((item) => (
                <article key={item.id} className="card card-tight stack-sm">
                  <h3 className="card-title">
                    <Link href={`/communities/${item.slug}`}>{locale === 'en' && item.nameEn ? item.nameEn : item.name}</Link>
                  </h3>
                  <div className="cluster-sm">
                    <Badge tone="neutral">{t.common.communityKind[item.kind]}</Badge>
                    {item.foundedYear && <span className="small muted">{c.foundedIn(n(item.foundedYear).replace(/[,٬]/g, ''))}</span>}
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>
                    <MapPin size={14} aria-hidden="true" /> {labelFrom(index, locale, item.districtId)} ·{' '}
                    <Users size={14} aria-hidden="true" /> {c.members(n(item.memberCount))}
                  </p>
                  {item.serviceAreas.length > 0 && (
                    <p className="small" style={{ margin: 0 }}>
                      <strong>{c.serviceAreas}:</strong> {item.serviceAreas.map((a) => (locale === 'bn' ? a.nameBn : a.nameEn)).join(', ')}
                    </p>
                  )}
                  <Link className="btn btn-sm" href={`/communities/${item.slug}`}>
                    {c.viewPage}
                  </Link>
                </article>
              ))}
            </div>
          )}
          <Pagination
            page={result.page}
            pageCount={result.pageCount}
            basePath="/communities"
            params={{ q: filters.q, division: filters.division?.toString(), district: filters.district?.toString() }}
            t={t}
            n={n}
          />
          <div className="card card-accent stack-sm">
            <h2 style={{ fontSize: '1.1rem' }}>{c.registerCta}</h2>
            <p style={{ margin: 0 }}>{c.registerCtaBody}</p>
            <Link href="/communities/new">{c.registerCta}</Link>
          </div>
        </section>
      </div>
    </>
  );
}

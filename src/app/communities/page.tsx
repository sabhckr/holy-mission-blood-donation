import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, CalendarDays, MapPin, Plus, Search, Users } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { listCommunities } from '@/server/services/communities';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { locationLabels } from '@/components/consent-labels';
import { LocationPicker } from '@/components/form/LocationPicker';
import { AffiliationBadge, CommunityStatusBadge } from '@/components/community/badges';
import { IconTile } from '@/components/account/bits';
import { EmptyState, PageHeader, Pagination } from '@/components/ui';

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

const AREA_CHIPS = 3;

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
  const filtered = !!(filters.q || filters.division || filters.district);
  return (
    <>
      <PageHeader title={c.directoryTitle} intro={c.directoryIntro}>
        <Link className="btn btn-soft" href="/communities/new">
          <Plus size={18} aria-hidden="true" />
          {c.registerCta}
        </Link>
      </PageHeader>
      <div className="section">
        <div className="container stack-lg">
          <section className="card org-filter" aria-labelledby="community-filters">
            <h2 id="community-filters" className="acct-h3" style={{ marginBottom: 'var(--space-3)' }}>
              <Search size={18} aria-hidden="true" className="icon-brand" />
              {c.filters}
            </h2>
            <form method="get" action="/communities" role="search" aria-labelledby="community-filters">
              <div className="field">
                <label className="label" htmlFor="cf-q">
                  {c.searchName}
                </label>
                <input id="cf-q" className="input" name="q" type="search" defaultValue={filters.q ?? ''} maxLength={60} aria-describedby="cf-q-hint" />
                <p className="visually-hidden" id="cf-q-hint">
                  {c.searchNameHint}
                </p>
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
              <button type="submit" className="btn btn-primary">
                <Search size={18} aria-hidden="true" />
                {t.common.actions.search}
              </button>
            </form>
          </section>

          <section className="stack" aria-labelledby="results-title">
            <div className="org-results-head">
              <h2 id="results-title" className="acct-h3" aria-live="polite">
                {c.resultCount(n(result.total))}
              </h2>
              {filtered && (
                <Link className="section-link" href="/communities">
                  {t.common.actions.clearFilters}
                </Link>
              )}
            </div>
            {result.items.length === 0 ? (
              <EmptyState icon={<Building2 size={40} aria-hidden="true" />} title={c.emptyTitle}>
                <p className="muted">{c.emptyBody}</p>
                <Link className="btn btn-soft" href="/communities/new">
                  {c.registerCta}
                </Link>
              </EmptyState>
            ) : (
              <ul className="org-grid">
                {result.items.map((item) => {
                  const name = locale === 'en' && item.nameEn ? item.nameEn : item.name;
                  const areas = item.serviceAreas.map((a) => (locale === 'bn' ? a.nameBn : a.nameEn));
                  return (
                    <li key={item.id}>
                      <Link className="org-card" href={`/communities/${item.slug}`}>
                        <div className="org-card-head">
                          <IconTile icon={Building2} tone={item.affiliation === 'holy_mission' ? 'info' : 'neutral'} />
                          <div>
                            <h3>{name}</h3>
                            <div className="acct-item-badges">
                              {item.status === 'approved' && <CommunityStatusBadge status="approved" t={t} />}
                              <AffiliationBadge affiliation={item.affiliation} t={t} />
                            </div>
                          </div>
                        </div>
                        <p className="acct-meta">
                          <span>
                            <MapPin size={15} aria-hidden="true" />
                            {labelFrom(index, locale, item.districtId)}
                          </span>
                          <span>
                            <Users size={15} aria-hidden="true" />
                            {c.members(n(item.memberCount))}
                          </span>
                          {item.foundedYear && (
                            <span>
                              <CalendarDays size={15} aria-hidden="true" />
                              {c.foundedIn(n(item.foundedYear).replace(/[,٬]/g, ''))}
                            </span>
                          )}
                        </p>
                        {areas.length > 0 && (
                          <ul className="acct-chips" aria-label={c.serviceAreas}>
                            {areas.slice(0, AREA_CHIPS).map((a) => (
                              <li key={a} className="acct-chip">
                                {a}
                              </li>
                            ))}
                            {areas.length > AREA_CHIPS && <li className="acct-chip">{c.areasMore(n(areas.length - AREA_CHIPS))}</li>}
                          </ul>
                        )}
                        <span className="org-card-foot">
                          {c.viewPage}
                          <ArrowRight size={18} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              basePath="/communities"
              params={{ q: filters.q, division: filters.division?.toString(), district: filters.district?.toString() }}
              t={t}
              n={n}
            />
          </section>

          <section className="card card-accent org-cta" aria-labelledby="register-cta">
            <div>
              <h2 id="register-cta">{c.registerCtaTitle}</h2>
              <p>{c.registerCtaBody}</p>
            </div>
            <Link className="btn btn-soft" href="/communities/new">
              {c.registerCta}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Droplet, Hospital, Info, MapPinned, Search, SlidersHorizontal, Siren } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { getActor } from '@/server/auth/current';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { hitRateLimit } from '@/server/security/rate-limit';
import { getRequestMeta } from '@/server/security/request-meta';
import { searchDonors } from '@/server/services/donors';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { noDonorFallback } from '@/server/services/requests';
import { DonorCard } from '@/components/DonorCard';
import { SearchForm } from '@/components/SearchForm';
import { locationLabels } from '@/components/consent-labels';
import { Alert, BloodGroupBadge, PageHeader, Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.search.title, description: t.search.intro };
}

const id = z.coerce.number().int().positive().optional().catch(undefined);
const filtersSchema = z.object({
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  division: id,
  district: id,
  upazila: id,
  locality: z.string().trim().max(60).optional().catch(undefined),
  verified: z.literal('1').optional().catch(undefined),
  sort: z.enum(['best', 'recent', 'newest']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export default async function DonorSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const i18n = await getI18n();
  const { t, n, locale } = i18n;
  const sp = await searchParams;
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const filters = filtersSchema.parse(flat);
  const actor = await getActor();
  const meta = await getRequestMeta();
  const limited = !(await hitRateLimit('search', actor?.userId ?? meta.ipHash)).ok;
  const [locs, index] = await Promise.all([compactLocations(locale), getLocationIndex()]);
  const result = limited
    ? null
    : await searchDonors(
        {
          bloodGroup: filters.group ?? null,
          divisionId: filters.division ?? null,
          districtId: filters.district ?? null,
          upazilaId: filters.upazila ?? null,
          locality: filters.locality || null,
          verifiedOnly: filters.verified === '1',
          sort: filters.sort ?? 'best',
          page: filters.page ?? 1,
        },
        actor,
      );
  const fallback =
    result && result.total === 0
      ? await noDonorFallback({ bloodGroup: filters.group ?? null, divisionId: filters.division ?? null, districtId: filters.district ?? null, upazilaId: filters.upazila ?? null })
      : null;
  const params = {
    group: filters.group,
    division: filters.division?.toString(),
    district: filters.district?.toString(),
    upazila: filters.upazila?.toString(),
    locality: filters.locality,
    verified: filters.verified,
    sort: filters.sort,
  };
  const widerHref = (level: 'upazila' | 'district' | 'division' | 'country') => {
    const sp2 = new URLSearchParams();
    if (filters.group) sp2.set('group', filters.group);
    if (level === 'upazila' && filters.upazila) sp2.set('upazila', String(filters.upazila));
    if ((level === 'upazila' || level === 'district') && filters.district) sp2.set('district', String(filters.district));
    if (level !== 'country' && filters.division) sp2.set('division', String(filters.division));
    return `/donors?${sp2.toString()}`;
  };
  const requestHref = `/requests/new?${new URLSearchParams(Object.entries({ group: filters.group, division: filters.division?.toString(), district: filters.district?.toString(), upazila: filters.upazila?.toString() }).filter(([, v]) => v) as [string, string][]).toString()}`;

  const currentQs = new URLSearchParams(Object.entries({ ...params, page: filters.page && filters.page > 1 ? String(filters.page) : undefined }).filter(([, v]) => v) as [string, string][]).toString();
  const currentHref = currentQs ? `/donors?${currentQs}` : '/donors';
  const moreCount = [filters.locality, filters.verified, filters.sort && filters.sort !== 'best' ? filters.sort : undefined].filter(Boolean).length;
  const anyArea = !!(filters.division || filters.district || filters.upazila);
  const hasQuery = !!filters.group || anyArea || moreCount > 0;
  const areaLabel = anyArea ? labelFrom(index, locale, filters.upazila ?? null, filters.district ?? null, filters.division ?? null) : t.search.anyArea;

  return (
    <>
      <PageHeader title={t.search.title} intro={t.search.intro} />
      <div className="section pub-body">
        <div className={`container search-layout${hasQuery ? ' has-query' : ''}`}>
          {hasQuery && (
            <div className="search-summary card card-tight">
              {filters.group ? (
                <BloodGroupBadge group={filters.group} small label={t.common.bloodGroup} />
              ) : (
                <span className="search-summary-any">
                  <Droplet size={20} aria-hidden="true" />
                </span>
              )}
              <p className="search-summary-text">
                <span className="small muted">{t.search.yourSearch}</span>
                <strong>{filters.group ? areaLabel : `${t.common.anyBloodGroup} · ${areaLabel}`}</strong>
              </p>
              <a className="btn btn-soft btn-sm" href="#search-panel">
                <SlidersHorizontal size={16} aria-hidden="true" />
                {t.search.changeSearch}
              </a>
            </div>
          )}

          <aside id="search-panel" className="card search-panel" aria-labelledby="search-pub-panel-title">
            <h2 id="search-pub-panel-title" className="pub-panel-title">
              <Search size={20} aria-hidden="true" />
              {t.search.panelTitle}
            </h2>
            <SearchForm
              locations={locs}
              bloodGroups={[...BLOOD_GROUPS]}
              defaults={{ bloodGroup: filters.group, divisionId: filters.division, districtId: filters.district, upazilaId: filters.upazila }}
              labels={{
                bloodGroup: t.common.bloodGroup,
                anyGroup: t.common.anyBloodGroup,
                search: t.common.actions.search,
                location: locationLabels(t),
                area: t.search.areaLegend,
                more: t.search.moreFilters,
                moreBadge: moreCount > 0 ? t.search.moreFiltersActive(n(moreCount)) : undefined,
              }}
              moreOpen={moreCount > 0}
              extra={
                <>
                  <div className="field">
                    <label className="label" htmlFor="sf-locality">
                      {t.search.localityLabel}
                    </label>
                    <p className="hint">{t.search.localityHint}</p>
                    <input id="sf-locality" className="input" name="locality" defaultValue={filters.locality ?? ''} maxLength={60} />
                  </div>
                  <label className="check">
                    <input type="checkbox" name="verified" value="1" defaultChecked={filters.verified === '1'} />
                    <span>{t.search.verifiedOnly}</span>
                  </label>
                  <div className="field">
                    <label className="label" htmlFor="sf-sort">
                      {t.search.sort}
                    </label>
                    <select id="sf-sort" name="sort" className="select" defaultValue={filters.sort ?? 'best'}>
                      <option value="best">{t.search.sortBest}</option>
                      <option value="recent">{t.search.sortRecent}</option>
                      <option value="newest">{t.search.sortNewest}</option>
                    </select>
                  </div>
                </>
              }
            />
            {hasQuery && (
              <p className="pub-panel-foot">
                <Link href="/donors">{t.common.actions.clearFilters}</Link>
              </p>
            )}
          </aside>

          <section className="results" aria-labelledby="results-title" aria-live="polite">
            {limited && (
              <Alert tone="warning" live>
                <p>{t.search.rateLimited}</p>
                <a href={currentHref}>{t.common.actions.tryAgain}</a>
              </Alert>
            )}
            {result && result.total > 0 && (
              <>
                <div className="results-head">
                  <h2 id="results-title" className="results-count">
                    {t.search.resultCount(n(result.total))}
                  </h2>
                  {!hasQuery && <p className="small muted">{t.search.noFilters}</p>}
                </div>
                <p className="small muted results-note">
                  <Info size={16} aria-hidden="true" />
                  <span>{t.search.resultsNote}</span>
                </p>
                <div className="donor-grid">
                  {result.items.map((d) => (
                    <DonorCard key={d.publicId} donor={d} place={labelFrom(index, locale, d.upazilaId, d.districtId)} i18n={i18n} />
                  ))}
                </div>
                <Pagination page={result.page} pageCount={result.pageCount} basePath="/donors" params={params} t={t} n={n} />
              </>
            )}

            {fallback && (
              <div className="no-results stack">
                <div className="no-results-head">
                  <span className="no-results-icon">
                    <Search size={28} aria-hidden="true" />
                  </span>
                  <h2 id="results-title">{t.search.noResultsTitle}</h2>
                  <p>{t.search.noResultsBody}</p>
                </div>

                <ol className="pub-options">
                  <li className="card pub-option">
                    <span className="pub-option-icon">
                      <MapPinned size={22} aria-hidden="true" />
                    </span>
                    <div className="pub-option-body">
                      <h3>{t.search.fallbackWider}</h3>
                      <ul className="list-plain list-divided">
                        {fallback.wider.map((w) => (
                          <li key={w.level} className="pub-option-row">
                            <span>
                              <strong>{t.search.fallbackLevel[w.level]}</strong>
                              <span className="small muted">{t.search.fallbackCount(n(w.total), n(w.available))}</span>
                            </span>
                            {/* Search only lists donors who can donate now, so only offer a search that will find someone. */}
                            {w.available > 0 && (
                              <Link className="btn btn-sm btn-soft" href={widerHref(w.level)}>
                                {t.search.fallbackSearchThere}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>

                  <li className="card pub-option">
                    <span className="pub-option-icon">
                      <Building2 size={22} aria-hidden="true" />
                    </span>
                    <div className="pub-option-body">
                      <h3>{t.search.fallbackCommunities}</h3>
                      <p className="small muted">{t.search.fallbackCommunitiesHint}</p>
                      {fallback.communities.length === 0 ? (
                        <p className="small">{t.search.fallbackNoCommunities}</p>
                      ) : (
                        <ul className="list-plain list-divided">
                          {fallback.communities.map((c) => (
                            <li key={c.id} className="pub-option-row">
                              <strong>{locale === 'en' && c.nameEn ? c.nameEn : c.name}</strong>
                              <Link className="btn btn-sm" href={`/communities/${c.slug}#contact`}>
                                {t.search.contactCommunity}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>

                  <li className="card pub-option pub-option-primary">
                    <span className="pub-option-icon">
                      <Siren size={22} aria-hidden="true" />
                    </span>
                    <div className="pub-option-body">
                      <h3>{t.search.fallbackRequestTitle}</h3>
                      <p className="small muted">{t.search.fallbackRequestHint}</p>
                      <Link className="btn btn-primary btn-block" href={requestHref}>
                        {t.search.fallbackRequestTitle}
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                    </div>
                  </li>
                </ol>

                <p className="pub-meta pub-hospital-note">
                  <Hospital size={16} aria-hidden="true" />
                  <span>{t.search.fallbackHospital}</span>
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

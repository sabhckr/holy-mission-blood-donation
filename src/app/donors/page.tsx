import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Search, Siren } from 'lucide-react';
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
import { Alert, EmptyState, PageHeader, Pagination } from '@/components/ui';

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

  return (
    <>
      <PageHeader title={t.search.title} intro={t.search.intro} />
      <div className="container section layout-sidebar">
        <aside className="card card-tight" aria-labelledby="filters-heading">
          <h2 id="filters-heading" style={{ fontSize: '1.1rem' }}>
            {t.search.filters}
          </h2>
          <SearchForm
            locations={locs}
            bloodGroups={[...BLOOD_GROUPS]}
            defaults={{ bloodGroup: filters.group, divisionId: filters.division, districtId: filters.district, upazilaId: filters.upazila }}
            labels={{ bloodGroup: t.common.bloodGroup, anyGroup: t.common.anyBloodGroup, search: t.common.actions.search, location: locationLabels(t) }}
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
          <p style={{ marginTop: 'var(--space-3)' }}>
            <Link href="/donors">{t.common.actions.clearFilters}</Link>
          </p>
        </aside>

        <section className="stack" aria-live="polite">
          {limited && <Alert tone="warning">{t.search.rateLimited}</Alert>}
          {result && (
            <>
              <Alert tone="info">
                <p>{t.search.onlyAvailableNote}</p>
              </Alert>
              <p style={{ fontWeight: 700, margin: 0 }}>{t.search.resultCount(n(result.total))}</p>
              {!filters.group && !filters.district && !filters.division && <p className="small muted">{t.search.noFilters}</p>}
              <p className="small muted">{t.search.privacyNote}</p>
            </>
          )}
          {result && result.items.length > 0 && (
            <div className="grid grid-2">
              {result.items.map((d) => (
                <DonorCard key={d.publicId} donor={d} place={labelFrom(index, locale, d.upazilaId, d.districtId)} i18n={i18n} />
              ))}
            </div>
          )}
          {result && <Pagination page={result.page} pageCount={result.pageCount} basePath="/donors" params={params} t={t} n={n} />}

          {fallback && (
            <EmptyState icon={<Search size={40} aria-hidden="true" />} title={t.search.noResultsTitle}>
              <p>{t.search.noResultsBody}</p>
              <div className="stack" style={{ textAlign: 'left' }}>
                <div className="card card-tight stack-sm">
                  <h3>{t.search.fallbackWider}</h3>
                  <ul className="list-plain list-divided">
                    {fallback.wider.map((w) => (
                      <li key={w.level} className="cluster between">
                        <span>
                          <strong>{t.search.fallbackLevel[w.level]}</strong>
                          <br />
                          <span className="small muted">{t.search.fallbackCount(n(w.total), n(w.available))}</span>
                        </span>
                        {/* Search only lists donors who can donate now, so only offer a search that will find someone. */}
                        {w.available > 0 && (
                          <Link className="btn btn-sm" href={widerHref(w.level)}>
                            {t.search.fallbackSearchThere}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card card-tight stack-sm">
                  <h3 className="cluster-sm">
                    <Building2 size={18} aria-hidden="true" />
                    {t.search.fallbackCommunities}
                  </h3>
                  <p className="small muted">{t.search.fallbackCommunitiesHint}</p>
                  {fallback.communities.length === 0 ? (
                    <p className="muted">{t.search.fallbackNoCommunities}</p>
                  ) : (
                    <ul className="list-plain list-divided">
                      {fallback.communities.map((c) => (
                        <li key={c.id} className="cluster between">
                          <span>{locale === 'en' && c.nameEn ? c.nameEn : c.name}</span>
                          <Link className="btn btn-sm" href={`/communities/${c.slug}#contact`}>
                            {t.search.contactCommunity}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Link className="btn btn-primary" href={requestHref}>
                  <Siren size={18} aria-hidden="true" />
                  {t.search.fallbackRequest}
                </Link>
                <Alert tone="info">{t.search.fallbackHospital}</Alert>
              </div>
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}

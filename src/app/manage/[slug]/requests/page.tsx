import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Siren } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { BLOOD_GROUPS, URGENCIES } from '@/server/domain/constants';
import { getCommunityContext } from '@/server/services/communities';
import { getLocationIndex, labelFrom } from '@/server/services/location-index';
import { communityRequestQueue } from '@/server/services/requests';
import { RequestCard } from '@/components/request/RequestCard';
import { EmptyState, NoAccess, Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.request.queueTitle, robots: { index: false, follow: false } };
}

const SCOPES = ['mine', 'available', 'closed'] as const;
const filtersSchema = z.object({
  scope: z.enum(SCOPES).optional().catch(undefined),
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  urgency: z.enum(URGENCIES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export default async function CommunityRequestQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const i18n = await getI18n();
  const { t, n, locale } = i18n;
  const actor = await requireActor(`/manage/${slug}/requests`);
  const ctx = await getCommunityContext(actor, { slug });
  if (!ctx) notFound();
  if (!ctx.caps.has('coordinate_requests')) return <NoAccess t={t} />;
  const sp = await searchParams;
  const filters = filtersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const scope = filters.scope ?? 'mine';
  const [result, index] = await Promise.all([
    communityRequestQueue(actor, ctx.community.id, { scope, bloodGroup: filters.group ?? null, urgency: filters.urgency ?? null, page: filters.page ?? 1 }),
    getLocationIndex(),
  ]);
  const base = `/manage/${slug}/requests`;
  const tabHref = (s: (typeof SCOPES)[number]) => {
    const q = new URLSearchParams();
    if (s !== 'mine') q.set('scope', s);
    if (filters.group) q.set('group', filters.group);
    if (filters.urgency) q.set('urgency', filters.urgency);
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="stack">
      <div>
        <h2>{t.request.queueTitle}</h2>
        <p className="muted">{t.request.queueIntro}</p>
      </div>
      <nav aria-label={t.request.queueTitle}>
        <ul className="cluster-sm list-plain">
          {SCOPES.map((s) => (
            <li key={s}>
              <Link className={`btn btn-sm${s === scope ? ' btn-dark' : ''}`} href={tabHref(s)} aria-current={s === scope ? 'page' : undefined}>
                {t.request.tabs[s]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form method="get" action={base} className="card card-tight cluster" role="search" style={{ alignItems: 'flex-end' }}>
        {scope !== 'mine' && <input type="hidden" name="scope" value={scope} />}
        <div className="field">
          <label className="label" htmlFor="q-group">
            {t.common.bloodGroup}
          </label>
          <select id="q-group" name="group" className="select" defaultValue={filters.group ?? ''}>
            <option value="">{t.common.anyBloodGroup}</option>
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="q-urgency">
            {t.request.urgency}
          </label>
          <select id="q-urgency" name="urgency" className="select" defaultValue={filters.urgency ?? ''}>
            <option value="">{t.request.anyUrgency}</option>
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {t.common.urgency[u]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          {t.common.actions.apply}
        </button>
      </form>
      <p style={{ fontWeight: 700, margin: 0 }}>{t.request.resultCount(n(result.total))}</p>
      {result.items.length === 0 ? (
        <EmptyState icon={<Siren size={36} aria-hidden="true" />} title={t.request.queueEmpty[scope]} />
      ) : (
        <div className="grid grid-2">
          {result.items.map((r) => (
            <RequestCard key={r.publicId} item={r} place={labelFrom(index, locale, r.upazilaId, r.districtId)} i18n={i18n} href={`${base}/${r.publicId}`} />
          ))}
        </div>
      )}
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath={base}
        params={{ scope: scope === 'mine' ? undefined : scope, group: filters.group, urgency: filters.urgency }}
        t={t}
        n={n}
      />
    </div>
  );
}

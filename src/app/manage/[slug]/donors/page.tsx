import Link from 'next/link';
import { MapPin, Search } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { findDonorsForCommunity } from '@/server/services/communities';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { locationLabels } from '@/components/consent-labels';
import { RevealDonorPhone } from '@/components/community/RevealDonorPhone';
import { LocationPicker } from '@/components/form/LocationPicker';
import { Alert, AvailabilityBadge, BloodGroupBadge, EmptyState, NoAccess, Pagination, VerificationBadge } from '@/components/ui';
import { revealCommunityPhoneAction } from '../actions';
import { requireManageCapability } from '../_context';

const id = z.coerce.number().int().positive().optional().catch(undefined);
const filtersSchema = z.object({
  group: z.enum(BLOOD_GROUPS).optional().catch(undefined),
  division: id,
  district: id,
  upazila: id,
  available: z.literal('1').optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});

export default async function ManageDonorsPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const i18n = await getI18n();
  const { t, n, locale, date } = i18n;
  const access = await requireManageCapability(slug, 'find_donors');
  if (!access) return <NoAccess t={t} />;
  const c = t.community;
  const sp = await searchParams;
  const filters = filtersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [result, locs, index] = await Promise.all([
    findDonorsForCommunity(access.actor, access.community.id, {
      bloodGroup: filters.group ?? null,
      districtId: filters.district ?? null,
      upazilaId: filters.upazila ?? null,
      availableOnly: filters.available === '1',
      page: filters.page ?? 1,
    }),
    compactLocations(locale),
    getLocationIndex(),
  ]);
  const base = `/manage/${access.community.slug}`;
  return (
    <>
      <h2>{c.donorsTitle}</h2>
      <Alert tone="info">
        <p>{c.donorsIntro}</p>
        <p>{c.revealLogged}</p>
        <p>{c.notAgreement}</p>
      </Alert>
      {result.areaCount === 0 && (
        <Alert tone="warning">
          <p>{c.noAreas}</p>
          <Link href={`${base}/settings`}>{c.nav.settings}</Link>
        </Alert>
      )}
      <details className="disclosure" open>
        <summary>{t.search.filters}</summary>
        <form method="get" action={`${base}/donors`} className="form" role="search">
          <div className="field">
            <label className="label" htmlFor="df-group">
              {t.common.bloodGroup}
            </label>
            <select id="df-group" name="group" className="select" defaultValue={filters.group ?? ''}>
              <option value="">{t.common.anyBloodGroup}</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <LocationPicker
            locations={locs}
            labels={locationLabels(t)}
            defaults={{ divisionId: filters.division, districtId: filters.district, upazilaId: filters.upazila }}
            anyOption
            required={{ division: false, district: false, upazila: false }}
            names={{ division: 'division', district: 'district', upazila: 'upazila' }}
          />
          <label className="check">
            <input type="checkbox" name="available" value="1" defaultChecked={filters.available === '1'} />
            <span>{c.availableOnly}</span>
          </label>
          <div className="cluster-sm">
            <button type="submit" className="btn btn-primary">
              {t.common.actions.search}
            </button>
            <Link href={`${base}/donors`}>{t.common.actions.clearFilters}</Link>
          </div>
        </form>
      </details>

      <p style={{ fontWeight: 700, margin: 0 }} aria-live="polite">
        {c.donorsCount(n(result.total))}
      </p>
      {result.items.length === 0 ? (
        <EmptyState icon={<Search size={40} aria-hidden="true" />} title={c.noDonorsTitle}>
          <p>{c.noDonorsBody}</p>
        </EmptyState>
      ) : (
        <ul className="list-plain stack-sm">
          {result.items.map((d) => (
            <li key={d.publicId} className="card card-tight">
              <div className="cluster" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <BloodGroupBadge group={d.bloodGroup} label={t.common.bloodGroup} />
                <div className="stack-sm" style={{ minWidth: 0, flex: 1 }}>
                  <h3 className="card-title">{d.name}</h3>
                  <p className="small muted" style={{ margin: 0 }}>
                    {c.age(n(d.age))} · <MapPin size={14} aria-hidden="true" /> {[d.locality, labelFrom(index, locale, d.upazilaId, d.districtId)].filter(Boolean).join(', ')}
                  </p>
                  <div className="cluster-sm">
                    <AvailabilityBadge state={d.availability} t={t} />
                    <VerificationBadge status={d.verificationStatus} t={t} />
                  </div>
                  <p className="small" style={{ margin: 0 }}>
                    {c.donationCounts(n(d.stats.verifiedCount), n(d.stats.reportedCount))}
                    {d.stats.lastDonation && (
                      <>
                        {' · '}
                        {t.search.lastDonation}: {date(d.stats.lastDonation, 'short')}
                      </>
                    )}
                  </p>
                  <p className="small muted" style={{ margin: 0 }}>
                    {t.donor.preferredContact}: {t.common.contactMethod[d.preferredContactMethod]}
                  </p>
                  {d.phoneAccess === 'reveal' ? (
                    <RevealDonorPhone
                      action={revealCommunityPhoneAction}
                      communityId={access.community.id}
                      publicId={d.publicId}
                      labels={{ show: c.showNumber, showing: t.common.states.loading, call: t.common.actions.call, sms: t.common.actions.sendSms }}
                    />
                  ) : d.phoneAccess === 'owner' ? null : (
                    <p className="small muted" style={{ margin: 0 }}>
                      {c.phoneHidden}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        basePath={`${base}/donors`}
        params={{ group: filters.group, division: filters.division?.toString(), district: filters.district?.toString(), upazila: filters.upazila?.toString(), available: filters.available }}
        t={t}
        n={n}
      />
    </>
  );
}

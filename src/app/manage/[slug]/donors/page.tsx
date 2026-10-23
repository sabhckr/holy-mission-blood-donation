import Link from 'next/link';
import { Droplet, EyeOff, Info, MapPin, MessageCircle, Search, ShieldAlert, SlidersHorizontal, UserCog } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { BLOOD_GROUPS } from '@/server/domain/constants';
import { findDonorsForCommunity } from '@/server/services/communities';
import { compactLocations, getLocationIndex, labelFrom } from '@/server/services/location-index';
import { locationLabels } from '@/components/consent-labels';
import { RevealDonorPhone } from '@/components/community/RevealDonorPhone';
import { ManageHead } from '@/components/community/ManageHead';
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
  const filtered = !!(filters.group || filters.division || filters.district || filters.upazila || filters.available);
  return (
    <>
      <ManageHead title={c.donorsTitle} intro={c.donorsIntroShort} />
      <details className="disclosure acct-more">
        <summary>
          <span className="cluster-sm">
            <Info size={16} aria-hidden="true" />
            {c.donorsRules}
          </span>
        </summary>
        <p>{c.donorsIntro}</p>
        <p>{c.availabilityNote}</p>
        <p>{c.notAgreement}</p>
      </details>
      {result.areaCount === 0 && (
        <Alert tone="warning">
          <p>{c.noAreas}</p>
          <Link href={`${base}/settings`}>{c.nav.settings}</Link>
        </Alert>
      )}
      <details className="disclosure" open>
        <summary>
          <span className="cluster-sm">
            <SlidersHorizontal size={18} aria-hidden="true" />
            {t.search.filters}
          </span>
        </summary>
        <form method="get" action={`${base}/donors`} className="form" role="search" aria-label={t.search.filters}>
          <fieldset className="choice-group">
            <legend>{t.common.bloodGroup}</legend>
            <div className="choice-grid">
              <label className="choice-tile org-any-tile">
                <input type="radio" name="group" value="" defaultChecked={!filters.group} />
                <span>{t.common.anyBloodGroup}</span>
              </label>
              {BLOOD_GROUPS.map((g) => (
                <label key={g} className="choice-tile">
                  <input type="radio" name="group" value={g} defaultChecked={filters.group === g} />
                  <span>{g}</span>
                </label>
              ))}
            </div>
          </fieldset>
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
          <div className="acct-form-actions">
            <button type="submit" className="btn btn-primary">
              <Search size={18} aria-hidden="true" />
              {t.common.actions.search}
            </button>
            {filtered && (
              <Link className="section-link" href={`${base}/donors`}>
                {t.common.actions.clearFilters}
              </Link>
            )}
          </div>
        </form>
      </details>

      <section className="stack" aria-labelledby="donor-count">
        <div className="org-results-head">
          <h3 id="donor-count" className="acct-h3" aria-live="polite">
            {c.donorsCount(n(result.total))}
          </h3>
        </div>
        <p className="acct-note">
          <ShieldAlert size={16} aria-hidden="true" />
          <span>{c.revealLogged}</span>
        </p>
        {result.items.length === 0 ? (
          <EmptyState icon={<Search size={40} aria-hidden="true" />} title={c.noDonorsTitle}>
            <p className="muted">{c.noDonorsBody}</p>
          </EmptyState>
        ) : (
          <ul className="org-donors">
            {result.items.map((d) => (
              <li key={d.publicId}>
                <article className="card card-tight org-donor">
                  <div className="org-donor-head">
                    <BloodGroupBadge group={d.bloodGroup} label={t.common.bloodGroup} />
                    <div>
                      <h4>{d.name}</h4>
                      <p className="acct-meta">
                        <span>{c.age(n(d.age))}</span>
                        <span>
                          <MapPin size={15} aria-hidden="true" />
                          {[d.locality, labelFrom(index, locale, d.upazilaId, d.districtId)].filter(Boolean).join(', ')}
                        </span>
                      </p>
                      <div className="acct-item-badges">
                        <AvailabilityBadge state={d.availability} t={t} />
                        <VerificationBadge status={d.verificationStatus} t={t} />
                      </div>
                    </div>
                  </div>
                  {d.availabilitySource === 'staff' && (
                    <p className="acct-meta">
                      <span>
                        <UserCog size={15} aria-hidden="true" />
                        {t.common.availability.sourceStaff}
                      </span>
                    </p>
                  )}
                  <p className="acct-meta">
                    <span>
                      <Droplet size={15} aria-hidden="true" />
                      {c.donationCounts(n(d.stats.verifiedCount), n(d.stats.reportedCount))}
                    </span>
                    {d.stats.lastDonation && (
                      <span>
                        {t.search.lastDonation}: {date(d.stats.lastDonation, 'short')}
                      </span>
                    )}
                    <span>
                      <MessageCircle size={15} aria-hidden="true" />
                      {t.donor.preferredContact}: {t.common.contactMethod[d.preferredContactMethod]}
                    </span>
                  </p>
                  {d.phoneAccess !== 'owner' && (
                    <div className="org-donor-foot">
                      {d.phoneAccess === 'reveal' ? (
                        <RevealDonorPhone
                          action={revealCommunityPhoneAction}
                          communityId={access.community.id}
                          publicId={d.publicId}
                          labels={{ show: c.showNumber, showing: t.common.states.loading, call: t.common.actions.call, sms: t.common.actions.sendSms }}
                        />
                      ) : (
                        <p className="acct-meta">
                          <span>
                            <EyeOff size={15} aria-hidden="true" />
                            {c.phoneHidden}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
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

'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import { LocationPicker, type CompactLocation, type LocationLabels } from '../form/LocationPicker';

/**
 * Filters for the public request board (work without JavaScript): one-tap blood group chips (links
 * that keep the chosen area) and a small GET form for the area that keeps the chosen group.
 */
export function RequestFilters({
  locations,
  bloodGroups,
  labels,
  defaults,
}: {
  locations: CompactLocation[];
  bloodGroups: string[];
  labels: { bloodGroup: string; anyGroup: string; search: string; location: LocationLabels; area?: string; groupNav?: string };
  defaults: { bloodGroup?: string | null; divisionId?: number | null; districtId?: number | null };
}) {
  const href = (group: string | null) => {
    const sp = new URLSearchParams();
    if (group) sp.set('group', group);
    if (defaults.divisionId) sp.set('division', String(defaults.divisionId));
    if (defaults.districtId) sp.set('district', String(defaults.districtId));
    const qs = sp.toString();
    return qs ? `/requests?${qs}` : '/requests';
  };
  const current = defaults.bloodGroup ?? null;
  return (
    <div className="request-filters">
      <nav aria-label={labels.groupNav ?? labels.bloodGroup}>
        <p className="filter-label">{labels.bloodGroup}</p>
        <ul className="group-filter">
          <li className="group-filter-any">
            <Link href={href(null)} aria-current={current ? undefined : 'true'}>
              {labels.anyGroup}
            </Link>
          </li>
          {bloodGroups.map((g) => (
            <li key={g}>
              <Link href={href(g)} aria-current={current === g ? 'true' : undefined}>
                {g}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form method="get" action="/requests" className="area-filter" role="search">
        {current && <input type="hidden" name="group" value={current} />}
        <fieldset className="choice-group area-row">
          {labels.area && <legend>{labels.area}</legend>}
          <LocationPicker
            locations={locations}
            labels={labels.location}
            defaults={defaults}
            anyOption
            showUpazila={false}
            required={{ division: false, district: false, upazila: false }}
            names={{ division: 'division', district: 'district', upazila: 'upazila' }}
          />
        </fieldset>
        <button type="submit" className="btn btn-dark">
          <Search size={18} aria-hidden="true" />
          {labels.search}
        </button>
      </form>
    </div>
  );
}

'use client';

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { LocationPicker, type CompactLocation, type LocationLabels } from './form/LocationPicker';

/**
 * GET search form (bookmarkable URLs, works without JavaScript). The blood group is a set of big
 * radio tiles; the area is one row of selects; anything else (`extra`) sits behind "More filters".
 */
export function SearchForm({
  locations,
  bloodGroups,
  labels,
  defaults,
  compact,
  extra,
  moreOpen,
}: {
  locations: CompactLocation[];
  bloodGroups: string[];
  labels: { bloodGroup: string; anyGroup: string; search: string; location: LocationLabels; area?: string; more?: string; moreBadge?: string };
  defaults?: { bloodGroup?: string | null; divisionId?: number | null; districtId?: number | null; upazilaId?: number | null };
  compact?: boolean;
  extra?: ReactNode;
  /** Open "More filters" (e.g. when one of them is in use). */
  moreOpen?: boolean;
}) {
  const group = defaults?.bloodGroup ?? '';
  return (
    <form method="get" action="/donors" className="form search-form" role="search">
      <fieldset className="choice-group">
        <legend>{labels.bloodGroup}</legend>
        <div className="choice-grid group-tiles">
          {bloodGroups.map((g) => (
            <label className="choice-tile" key={g}>
              <input type="radio" name="group" value={g} defaultChecked={group === g} />
              <span>{g}</span>
            </label>
          ))}
          <label className="choice-tile choice-tile-wide">
            <input type="radio" name="group" value="" defaultChecked={!group} />
            <span>{labels.anyGroup}</span>
          </label>
        </div>
      </fieldset>
      <fieldset className="choice-group area-row">
        {labels.area && <legend>{labels.area}</legend>}
        <LocationPicker
          locations={locations}
          labels={labels.location}
          defaults={defaults}
          anyOption
          showUpazila={!compact}
          required={{ division: false, district: false, upazila: false }}
          names={{ division: 'division', district: 'district', upazila: 'upazila' }}
        />
      </fieldset>
      {extra &&
        (labels.more ? (
          <details className="disclosure more-filters" open={moreOpen}>
            <summary>
              <span className="cluster-sm">
                {labels.more}
                {labels.moreBadge && <span className="badge badge-info">{labels.moreBadge}</span>}
              </span>
            </summary>
            <div className="stack">{extra}</div>
          </details>
        ) : (
          extra
        ))}
      <button type="submit" className="btn btn-primary btn-lg btn-block">
        <Search size={20} aria-hidden="true" />
        {labels.search}
      </button>
    </form>
  );
}

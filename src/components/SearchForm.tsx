'use client';

import { LocationPicker, type CompactLocation, type LocationLabels } from './form/LocationPicker';

/** GET search form (bookmarkable URLs, works without JavaScript). */
export function SearchForm({
  locations,
  bloodGroups,
  labels,
  defaults,
  compact,
  extra,
}: {
  locations: CompactLocation[];
  bloodGroups: string[];
  labels: { bloodGroup: string; anyGroup: string; search: string; location: LocationLabels };
  defaults?: { bloodGroup?: string | null; divisionId?: number | null; districtId?: number | null; upazilaId?: number | null };
  compact?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <form method="get" action="/donors" className="form" role="search">
      <div className="field">
        <label className="label" htmlFor="sf-group">
          {labels.bloodGroup}
        </label>
        <select id="sf-group" name="group" className="select" defaultValue={defaults?.bloodGroup ?? ''}>
          <option value="">{labels.anyGroup}</option>
          {bloodGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
      <LocationPicker
        locations={locations}
        labels={labels.location}
        defaults={defaults}
        anyOption
        showUpazila={!compact}
        required={{ division: false, district: false, upazila: false }}
        names={{ division: 'division', district: 'district', upazila: 'upazila' }}
      />
      {extra}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-block">
          {labels.search}
        </button>
      </div>
    </form>
  );
}

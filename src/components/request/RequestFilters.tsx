'use client';

import { LocationPicker, type CompactLocation, type LocationLabels } from '../form/LocationPicker';

/** GET filter form for the public request board (works without JavaScript). */
export function RequestFilters({
  locations,
  bloodGroups,
  labels,
  defaults,
}: {
  locations: CompactLocation[];
  bloodGroups: string[];
  labels: { bloodGroup: string; anyGroup: string; search: string; location: LocationLabels };
  defaults: { bloodGroup?: string | null; divisionId?: number | null; districtId?: number | null };
}) {
  return (
    <form method="get" action="/requests" className="form" role="search">
      <div className="field">
        <label className="label" htmlFor="rf-group">
          {labels.bloodGroup}
        </label>
        <select id="rf-group" name="group" className="select" defaultValue={defaults.bloodGroup ?? ''}>
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
        showUpazila={false}
        required={{ division: false, district: false, upazila: false }}
        names={{ division: 'division', district: 'district', upazila: 'upazila' }}
      />
      <button type="submit" className="btn btn-primary btn-block">
        {labels.search}
      </button>
    </form>
  );
}

'use client';

import { useId, useState } from 'react';
import { useFormContext } from './ActionForm';

/** [id, parentId (0 for divisions), name in the current language, level: 0 division | 1 district | 2 upazila] */
export type CompactLocation = [number, number, string, 0 | 1 | 2];

export interface LocationLabels {
  division: string;
  district: string;
  upazila: string;
  any: string;
  chooseDivision: string;
  chooseDistrict: string;
  chooseUpazila: string;
  chooseDistrictFirst: string;
}

/**
 * Division → district → upazila selects. Options are filtered in the browser; without
 * JavaScript the server re-renders the narrower lists after the form is submitted.
 */
/**
 * Remounts after every submission (keyed by the form state) so the selects show the submitted
 * values again: React resets the whole form after an action, including controlled selects.
 */
export function LocationPicker(props: LocationPickerProps) {
  const { state } = useFormContext();
  return <LocationPickerInner key={state.ts ?? 0} {...props} />;
}

interface LocationPickerProps {
  locations: CompactLocation[];
  labels: LocationLabels;
  defaults?: { divisionId?: number | null; districtId?: number | null; upazilaId?: number | null };
  required?: { division: boolean; district: boolean; upazila: boolean };
  names?: { division: string; district: string; upazila: string };
  showUpazila?: boolean;
  /** Search forms: allow "all" at every level. */
  anyOption?: boolean;
}

function LocationPickerInner({
  locations,
  labels,
  defaults,
  required = { division: true, district: true, upazila: false },
  names = { division: 'divisionId', district: 'districtId', upazila: 'upazilaId' },
  showUpazila = true,
  anyOption = false,
}: LocationPickerProps) {
  const id = useId();
  const { state } = useFormContext();
  const fromState = (n: string) => (state.values && n in state.values ? Number(state.values[n]) || null : undefined);
  const [division, setDivision] = useState<number | null>(fromState(names.division) ?? defaults?.divisionId ?? null);
  const [district, setDistrict] = useState<number | null>(fromState(names.district) ?? defaults?.districtId ?? null);
  const [upazila, setUpazila] = useState<number | null>(fromState(names.upazila) ?? defaults?.upazilaId ?? null);

  const divisions = locations.filter((l) => l[3] === 0);
  const districts = locations.filter((l) => l[3] === 1 && (!division || l[1] === division));
  const upazilas = district ? locations.filter((l) => l[3] === 2 && l[1] === district) : [];
  const err = (n: string) => state.fieldErrors?.[n];

  const select = (
    level: 'division' | 'district' | 'upazila',
    value: number | null,
    options: CompactLocation[],
    onChange: (v: number | null) => void,
    placeholder: string,
    disabled = false,
  ) => {
    const name = names[level];
    const error = err(name);
    const fieldId = `${id}-${level}`;
    return (
      <div className="field">
        <label className="label" htmlFor={fieldId}>
          {labels[level]}
          {required[level] && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <select
          id={fieldId}
          className="select"
          name={name}
          value={value ?? ''}
          disabled={disabled}
          aria-required={required[level]}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{anyOption ? labels.any : placeholder}</option>
          {options.map((o) => (
            <option key={o[0]} value={o[0]}>
              {o[2]}
            </option>
          ))}
        </select>
        {error && (
          <p className="error-text" id={`${fieldId}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="field-row">
      {select('division', division, divisions, (v) => {
        setDivision(v);
        setDistrict(null);
        setUpazila(null);
      }, labels.chooseDivision)}
      {select('district', district, districts, (v) => {
        setDistrict(v);
        setUpazila(null);
        if (v && !division) setDivision(locations.find((l) => l[0] === v)?.[1] ?? null);
      }, labels.chooseDistrict)}
      {showUpazila && select('upazila', upazila, upazilas, setUpazila, district ? labels.chooseUpazila : labels.chooseDistrictFirst, !district)}
    </div>
  );
}

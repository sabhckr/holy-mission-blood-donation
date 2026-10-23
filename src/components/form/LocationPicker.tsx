'use client';

import { MapPin } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useFormContext } from './ActionForm';
import { RequiredWord } from './fields';

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
  const { state, requiredMark } = useFormContext();
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
    note?: { text: ReactNode; error?: string },
  ) => {
    const name = names[level];
    const error = err(name) ?? note?.error;
    const fieldId = `${id}-${level}`;
    const describedBy = [note ? `${fieldId}-note` : '', error ? `${fieldId}-error` : ''].filter(Boolean).join(' ') || undefined;
    const label = (
      <label className="label" htmlFor={fieldId}>
        {labels[level]}
        {required[level] && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </label>
    );
    return (
      <div className="field">
        {required[level] && requiredMark ? (
          <div className="label-row">
            {label}
            <RequiredWord word={requiredMark} />
          </div>
        ) : (
          label
        )}
        {note && (
          <p className="fixed-district" id={`${fieldId}-note`}>
            {note.text}
          </p>
        )}
        <select
          id={fieldId}
          className="select"
          name={name}
          value={value ?? ''}
          disabled={disabled}
          aria-required={required[level]}
          data-required-key={required[level] ? 'invalidLocation' : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
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

  // One division and one district (Lakshmipur only): submit them as fixed values, show the district
  // as text and ask only for the upazila. The server checks the address either way.
  const allDistricts = locations.filter((l) => l[3] === 1);
  if (divisions.length === 1 && allDistricts.length === 1) {
    const [fixedDivision, fixedDistrict] = [divisions[0], allDistricts[0]];
    const fixedUpazilas = locations.filter((l) => l[3] === 2 && l[1] === fixedDistrict[0]);
    const placeError = err(names.district) ?? err(names.division);
    const hidden = (
      <>
        <input type="hidden" name={names.division} value={fixedDivision[0]} />
        <input type="hidden" name={names.district} value={fixedDistrict[0]} />
      </>
    );
    // Filters without an upazila choice have nothing left to pick: the district is sent as is.
    if (!showUpazila) return hidden;
    const note = (
      <>
        <MapPin size={15} aria-hidden="true" />
        {`${labels.district}: ${fixedDistrict[2]}`}
      </>
    );
    return (
      <div className="fixed-area">
        {hidden}
        {select('upazila', upazila, fixedUpazilas, setUpazila, labels.chooseUpazila, false, { text: note, error: placeError })}
      </div>
    );
  }

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

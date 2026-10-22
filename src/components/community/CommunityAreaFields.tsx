'use client';

import { useId, useState } from 'react';
import { useFormContext } from '../form/ActionForm';
import type { CompactLocation } from '../form/LocationPicker';

export interface CommunityAreaLabels {
  hqDivision: string;
  hqDistrict: string;
  chooseDivision: string;
  chooseDistrict: string;
  serviceAreasLegend: string;
  serviceAreasHint: string;
  /** Contains "{name}" which is replaced with the district name. */
  wholeDistrict: string;
  upazilasOf: string;
  otherAreas: string;
  addDistrict: string;
  addButton: string;
  removeArea: string;
  chooseHqFirst: string;
  noAreasSelected: string;
}

/**
 * Home division/district plus service areas. Service areas are submitted as repeated
 * `serviceAreaIds` values: checkboxes for the home district and its upazilas, hidden
 * inputs for any other districts or upazilas the leader added.
 */
/** Remounts after each submission so the controlled selects show the submitted values again. */
export function CommunityAreaFields(props: Parameters<typeof CommunityAreaFieldsInner>[0]) {
  const { state } = useFormContext();
  return <CommunityAreaFieldsInner key={state.ts ?? 0} {...props} />;
}

function CommunityAreaFieldsInner({
  locations,
  labels,
  defaults,
}: {
  locations: CompactLocation[];
  labels: CommunityAreaLabels;
  defaults?: { divisionId?: number | null; districtId?: number | null; serviceAreaIds?: number[] };
}) {
  const id = useId();
  const { state } = useFormContext();
  const fromState = (name: string) => (state.values && name in state.values ? Number(state.values[name]) || null : undefined);
  const areasFromState = state.values?.serviceAreaIds !== undefined ? state.values.serviceAreaIds.split(',').map(Number).filter((n) => n > 0) : undefined;

  const [division, setDivision] = useState<number | null>(fromState('divisionId') ?? defaults?.divisionId ?? null);
  const [district, setDistrict] = useState<number | null>(fromState('districtId') ?? defaults?.districtId ?? null);
  const [areas, setAreas] = useState<number[]>(areasFromState ?? defaults?.serviceAreaIds ?? []);
  const [adding, setAdding] = useState<string>('');

  const byId = new Map(locations.map((l) => [l[0], l]));
  const divisions = locations.filter((l) => l[3] === 0);
  const districts = locations.filter((l) => l[3] === 1 && (!division || l[1] === division));
  const allDistricts = locations.filter((l) => l[3] === 1);
  const hqUpazilas = district ? locations.filter((l) => l[3] === 2 && l[1] === district) : [];
  const hqIds = new Set<number>([...(district ? [district] : []), ...hqUpazilas.map((u) => u[0])]);
  const extra = areas.filter((a) => !hqIds.has(a));
  const err = (name: string) => state.fieldErrors?.[name];
  const name = (locId: number | null) => (locId ? (byId.get(locId)?.[2] ?? '') : '');

  const toggle = (locId: number, on: boolean) => setAreas((prev) => (on ? [...new Set([...prev, locId])] : prev.filter((a) => a !== locId)));

  const describeExtra = (locId: number) => {
    const node = byId.get(locId);
    if (!node) return String(locId);
    if (node[3] === 2) return `${node[2]}, ${name(node[1])}`;
    return node[2];
  };

  const select = (field: 'divisionId' | 'districtId', label: string, value: number | null, options: CompactLocation[], placeholder: string, onChange: (v: number | null) => void) => {
    const fieldId = `${id}-${field}`;
    const error = err(field);
    return (
      <div className="field">
        <label className="label" htmlFor={fieldId}>
          {label}
          <span className="req" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id={fieldId}
          className="select"
          name={field}
          value={value ?? ''}
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">{placeholder}</option>
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

  const areaError = err('serviceAreaIds');
  return (
    <>
      <div className="field-row">
        {select('divisionId', labels.hqDivision, division, divisions, labels.chooseDivision, (v) => {
          setDivision(v);
          setDistrict(null);
        })}
        {select('districtId', labels.hqDistrict, district, districts, labels.chooseDistrict, (v) => {
          setDistrict(v);
          if (v && !division) setDivision(byId.get(v)?.[1] ?? null);
          if (v && areas.length === 0) setAreas([v]);
        })}
      </div>

      <fieldset className="choice-group" aria-describedby={`${id}-areas-hint${areaError ? ` ${id}-areas-error` : ''}`} aria-invalid={areaError ? true : undefined}>
        <legend>{labels.serviceAreasLegend}</legend>
        <p className="hint" id={`${id}-areas-hint`}>
          {labels.serviceAreasHint}
        </p>
        {!district ? (
          <p className="muted small">{labels.chooseHqFirst}</p>
        ) : (
          <div className="stack-sm">
            <label className="check">
              <input type="checkbox" name="serviceAreaIds" value={district} checked={areas.includes(district)} onChange={(e) => toggle(district, e.target.checked)} />
              <span style={{ fontWeight: 600 }}>{labels.wholeDistrict.replace('{name}', name(district))}</span>
            </label>
            {hqUpazilas.length > 0 && (
              <details className="disclosure" open={hqUpazilas.some((u) => areas.includes(u[0]))}>
                <summary>{labels.upazilasOf.replace('{name}', name(district))}</summary>
                <div className="grid grid-2">
                  {hqUpazilas.map((u) => (
                    <label className="check" key={u[0]}>
                      <input type="checkbox" name="serviceAreaIds" value={u[0]} checked={areas.includes(u[0])} onChange={(e) => toggle(u[0], e.target.checked)} />
                      <span>{u[2]}</span>
                    </label>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        <div className="stack-sm">
          <p className="label" style={{ margin: 0 }}>
            {labels.otherAreas}
          </p>
          {extra.length > 0 && (
            <ul className="list-plain cluster-sm">
              {extra.map((a) => (
                <li key={a} className="badge badge-neutral">
                  <input type="hidden" name="serviceAreaIds" value={a} />
                  {describeExtra(a)}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(a, false)} aria-label={`${labels.removeArea}: ${describeExtra(a)}`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="cluster-sm">
            <label className="visually-hidden" htmlFor={`${id}-add`}>
              {labels.addDistrict}
            </label>
            <select id={`${id}-add`} className="select" style={{ maxWidth: 280 }} value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">{labels.addDistrict}</option>
              {allDistricts
                .filter((d) => d[0] !== district && !areas.includes(d[0]))
                .map((d) => (
                  <option key={d[0]} value={d[0]}>
                    {d[2]}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!adding}
              onClick={() => {
                if (adding) toggle(Number(adding), true);
                setAdding('');
              }}
            >
              {labels.addButton}
            </button>
          </div>
        </div>
        {areas.length === 0 && <p className="small muted">{labels.noAreasSelected}</p>}
        {areaError && (
          <p className="error-text" id={`${id}-areas-error`}>
            {areaError}
          </p>
        )}
      </fieldset>
    </>
  );
}

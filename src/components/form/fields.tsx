'use client';

import { useId, type ReactNode } from 'react';
import { useFormContext } from './ActionForm';
import type { RequiredMessageKey } from './client-messages';

interface BaseProps {
  name: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  requiredLabel?: string;
  optionalLabel?: string;
  defaultValue?: string | null;
  /** Which message the browser-side check shows when this required field is empty. */
  requiredKey?: RequiredMessageKey;
}

function useField(name: string, defaultValue?: string | null) {
  const { state } = useFormContext();
  const error = state.fieldErrors?.[name];
  const value = state.values && name in state.values ? state.values[name] : (defaultValue ?? '');
  // Re-mount uncontrolled inputs after each submission so the refilled value shows.
  const key = `${name}-${state.ts ?? 0}`;
  return { error, value, key };
}

function Label({ htmlFor, label, required, requiredLabel, optionalLabel }: { htmlFor: string; label: string; required?: boolean; requiredLabel?: string; optionalLabel?: string }) {
  return (
    <label className="label" htmlFor={htmlFor}>
      {label}
      {required ? (
        <span className="req" aria-hidden="true" title={requiredLabel}>
          *
        </span>
      ) : optionalLabel ? (
        <span className="opt">({optionalLabel})</span>
      ) : null}
    </label>
  );
}

function describedBy(hintId: string, errorId: string, hint: unknown, error: unknown) {
  return [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
}

export function TextField({
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  min,
  max,
  placeholder,
  ...props
}: BaseProps & {
  type?: 'text' | 'tel' | 'email' | 'password' | 'date' | 'time' | 'number' | 'search' | 'url';
  autoComplete?: string;
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'search' | 'url';
  maxLength?: number;
  min?: string | number;
  max?: string | number;
  placeholder?: string;
}) {
  const id = useId();
  const { error, value, key } = useField(props.name, type === 'password' ? '' : props.defaultValue);
  return (
    <div className="field">
      <Label htmlFor={id} {...props} />
      {props.hint && (
        <p className="hint" id={`${id}-hint`}>
          {props.hint}
        </p>
      )}
      <input
        key={key}
        id={id}
        className="input"
        name={props.name}
        type={type}
        defaultValue={type === 'password' ? undefined : value}
        required={props.required}
        aria-required={props.required}
        data-required-key={props.requiredKey}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, props.hint, error)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        min={min}
        max={max}
        placeholder={placeholder}
      />
      {error && (
        <p className="error-text" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({ maxLength, rows = 3, ...props }: BaseProps & { maxLength?: number; rows?: number }) {
  const id = useId();
  const { error, value, key } = useField(props.name, props.defaultValue);
  return (
    <div className="field">
      <Label htmlFor={id} {...props} />
      {props.hint && (
        <p className="hint" id={`${id}-hint`}>
          {props.hint}
        </p>
      )}
      <textarea
        key={key}
        id={id}
        className="textarea"
        name={props.name}
        defaultValue={value}
        rows={rows}
        maxLength={maxLength}
        required={props.required}
        aria-required={props.required}
        data-required-key={props.requiredKey}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, props.hint, error)}
      />
      {error && (
        <p className="error-text" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({ options, placeholder, ...props }: BaseProps & { options: Option[]; placeholder?: string }) {
  const id = useId();
  const { error, value, key } = useField(props.name, props.defaultValue);
  return (
    <div className="field">
      <Label htmlFor={id} {...props} />
      {props.hint && (
        <p className="hint" id={`${id}-hint`}>
          {props.hint}
        </p>
      )}
      <select
        key={key}
        id={id}
        className="select"
        name={props.name}
        defaultValue={value}
        required={props.required}
        aria-required={props.required}
        data-required-key={props.requiredKey}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(`${id}-hint`, `${id}-error`, props.hint, error)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="error-text" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckboxField({ name, label, hint, defaultChecked, required, value = 'on' }: { name: string; label: ReactNode; hint?: ReactNode; defaultChecked?: boolean; required?: boolean; value?: string }) {
  const id = useId();
  const { state } = useFormContext();
  const error = state.fieldErrors?.[name];
  const checked = state.values ? state.values[name] === value || state.values[name]?.split(',').includes(value) : defaultChecked;
  return (
    <div className="field">
      <label className="check" htmlFor={id}>
        <input
          key={`${name}-${state.ts ?? 0}`}
          id={id}
          type="checkbox"
          name={name}
          value={value}
          defaultChecked={checked}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)}
        />
        <span>{label}</span>
      </label>
      {hint && (
        <p className="hint" id={`${id}-hint`} style={{ marginLeft: 34 }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="error-text" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function RadioGroup({
  name,
  legend,
  options,
  defaultValue,
  hint,
  tiles,
  required,
  requiredKey,
}: {
  name: string;
  legend: string;
  options: Option[];
  defaultValue?: string | null;
  hint?: ReactNode;
  tiles?: boolean;
  required?: boolean;
  requiredKey?: RequiredMessageKey;
}) {
  const id = useId();
  const { state } = useFormContext();
  const error = state.fieldErrors?.[name];
  const value = state.values && name in state.values ? state.values[name] : (defaultValue ?? '');
  return (
    <fieldset className="choice-group" aria-describedby={describedBy(`${id}-hint`, `${id}-error`, hint, error)} aria-invalid={error ? true : undefined} data-required-key={requiredKey}>
      <legend>
        {legend}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <div className={tiles ? 'choice-grid' : 'stack-sm'} key={`${name}-${state.ts ?? 0}`}>
        {options.map((o) =>
          tiles ? (
            <label className="choice-tile" key={o.value}>
              <input type="radio" name={name} value={o.value} defaultChecked={value === o.value} required={required} />
              <span>{o.label}</span>
            </label>
          ) : (
            <label className="check" key={o.value}>
              <input type="radio" name={name} value={o.value} defaultChecked={value === o.value} required={required} />
              <span>{o.label}</span>
            </label>
          ),
        )}
      </div>
      {error && (
        <p className="error-text" id={`${id}-error`}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

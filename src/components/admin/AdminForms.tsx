'use client';

import { useFormContext } from '../form/ActionForm';

/** Shows a value returned by an admin action once (for example a one-time reset link). */
export function OneTimeValue({ dataKey, label, hint, warning }: { dataKey: string; label: string; hint: string; warning: string }) {
  const { state } = useFormContext();
  const value = state.status === 'success' ? state.data?.[dataKey] : null;
  if (!value) return null;
  return (
    <div className="card card-tight stack-sm" aria-live="polite">
      <label className="label" htmlFor={`one-time-${dataKey}`}>
        {label}
      </label>
      <input id={`one-time-${dataKey}`} className="input" readOnly value={String(value)} onFocus={(e) => e.currentTarget.select()} />
      <p className="hint">{hint}</p>
      <p className="error-text">{warning}</p>
    </div>
  );
}

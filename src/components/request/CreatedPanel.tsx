'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useFormContext } from '../form/ActionForm';

/** Hides the form fields once the request has been created, so the private link stands out. */
export function HideOnSuccess({ children }: { children: ReactNode }) {
  const { state } = useFormContext();
  if (state.status === 'success' && state.data?.managePath) return null;
  return <>{children}</>;
}

const noopSubscribe = () => () => {};

export function CreatedPanel({
  labels,
}: {
  labels: { title: string; body: string; linkLabel: string; copy: string; copied: string; view: string; searchDonors: string; signedInNote: string };
}) {
  const { state } = useFormContext();
  // The page origin is only known in the browser; the server renders the path alone.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '');
  const [copied, setCopied] = useState(false);
  if (state.status !== 'success' || !state.data?.managePath) return null;
  const managePath = String(state.data.managePath);
  const url = `${origin}${managePath}`;
  const search = new URLSearchParams({ group: String(state.data.bloodGroup ?? ''), district: String(state.data.districtId ?? '') });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="card stack" aria-live="polite">
      <h2 style={{ fontSize: '1.2rem' }}>{labels.title}</h2>
      <p>{labels.body}</p>
      <div className="field">
        <label className="label" htmlFor="manage-link">
          {labels.linkLabel}
        </label>
        <input id="manage-link" className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className="cluster">
        <button type="button" className="btn btn-dark" onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </button>
        <Link className="btn" href={managePath}>
          {labels.linkLabel}
        </Link>
        <Link className="btn" href={`/requests/${String(state.data.publicId)}`}>
          {labels.view}
        </Link>
        <Link className="btn btn-primary" href={`/donors?${search.toString()}`}>
          {labels.searchDonors}
        </Link>
      </div>
      {state.data.signedIn ? <p className="small muted">{labels.signedInNote}</p> : null}
    </div>
  );
}

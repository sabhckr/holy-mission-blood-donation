'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Check, Copy, KeyRound, Search } from 'lucide-react';
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
    <div className="card created-panel stack" aria-live="polite">
      <div className="next-note">
        <span className="pub-icon created-icon">
          <KeyRound size={22} aria-hidden="true" />
        </span>
        <div>
          <h2>{labels.title}</h2>
          <p>{labels.body}</p>
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="manage-link">
          {labels.linkLabel}
        </label>
        <input id="manage-link" className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div className="created-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={copy}>
          {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
          {copied ? labels.copied : labels.copy}
        </button>
        <Link className="btn" href={managePath}>
          {labels.linkLabel}
        </Link>
      </div>
      <div className="created-next">
        <Link className="btn btn-soft" href={`/donors?${search.toString()}`}>
          <Search size={18} aria-hidden="true" />
          {labels.searchDonors}
        </Link>
        <Link className="btn btn-ghost" href={`/requests/${String(state.data.publicId)}`}>
          {labels.view}
        </Link>
      </div>
      {state.data.signedIn ? <p className="small muted">{labels.signedInNote}</p> : null}
    </div>
  );
}

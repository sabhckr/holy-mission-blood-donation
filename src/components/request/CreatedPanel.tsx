'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Check, Copy, Info, KeyRound, Search, Users } from 'lucide-react';
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
  labels: {
    title: string;
    body: string;
    linkLabel: string;
    openLink: string;
    copy: string;
    copied: string;
    view: string;
    searchDonors: string;
    signedInNote: string;
    reference: string;
    savedTitle: string;
    group: string;
    units: string;
    when: string;
    hospital: string;
    place: string;
    notGuaranteed: string;
    matchesNone: string;
    /** "{n}" and "{group}" are filled in here. */
    matches: string;
    matchesUpazila: string;
  };
}) {
  const { state } = useFormContext();
  // The page origin is only known in the browser; the server renders the path alone.
  const origin = useSyncExternalStore(noopSubscribe, () => window.location.origin, () => '');
  const [copied, setCopied] = useState(false);
  if (state.status !== 'success' || !state.data?.managePath) return null;
  const managePath = String(state.data.managePath);
  const url = `${origin}${managePath}`;
  const d = state.data;
  const search = new URLSearchParams({ group: String(d.bloodGroup ?? '') });
  if (d.upazilaId) search.set('upazila', String(d.upazilaId));
  const fill = (template: string, n: unknown) => template.replace('{n}', String(n ?? '')).replace('{group}', String(d.bloodGroup ?? ''));
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
      {/* Everything below comes from the saved record returned by the server. */}
      <section className="created-saved" aria-labelledby="created-saved-title">
        <h3 id="created-saved-title">{labels.savedTitle}</h3>
        <dl className="dl">
          <dt>{labels.reference}</dt>
          <dd>
            <strong className="ref-id">{String(d.publicId)}</strong>
          </dd>
          <dt>{labels.group}</dt>
          <dd>{String(d.bloodGroup)}</dd>
          <dt>{labels.units}</dt>
          <dd>{String(d.units)}</dd>
          <dt>{labels.when}</dt>
          <dd>{String(d.neededAt)}</dd>
          <dt>{labels.hospital}</dt>
          <dd>{String(d.hospitalName)}</dd>
          <dt>{labels.place}</dt>
          <dd>{String(d.place)}</dd>
        </dl>
      </section>
      <div className="created-match">
        <Users size={20} aria-hidden="true" />
        <div>
          <p>{Number(d.available) > 0 ? fill(labels.matches, d.availableLabel) : labels.matchesNone}</p>
          {Number(d.available) > 0 && d.availableInUpazila !== null && d.availableInUpazila !== undefined && <p className="small">{fill(labels.matchesUpazila, d.availableInUpazila)}</p>}
        </div>
      </div>
      <p className="created-guarantee">
        <Info size={18} aria-hidden="true" />
        <span>{labels.notGuaranteed}</span>
      </p>
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
          {labels.openLink}
        </Link>
      </div>
      <div className="created-next">
        <Link className="btn btn-soft" href={`/donors?${search.toString()}`}>
          <Search size={18} aria-hidden="true" />
          {labels.searchDonors}
        </Link>
        <Link className="btn btn-ghost" href={`/requests/${String(d.publicId)}`}>
          {labels.view}
        </Link>
      </div>
      {d.signedIn ? <p className="small muted">{labels.signedInNote}</p> : null}
    </div>
  );
}

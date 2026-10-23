import { History } from 'lucide-react';

export interface AuditEntry {
  id: string | number;
  /** What was done, already translated. */
  what: string;
  who: string;
  role?: string | null;
  when: string;
  /** Extra lines such as "A → B" or the reason given. */
  details?: string[];
}

function Rows({ entries }: { entries: AuditEntry[] }) {
  return (
    <ol className="activity-list">
      {entries.map((e) => (
        <li key={e.id}>
          <span className="activity-dot">
            <History size={16} aria-hidden="true" />
          </span>
          <div className="activity-body">
            <p className="activity-what">{e.what}</p>
            <p className="activity-meta">
              <span>
                {e.who}
                {e.role && ` (${e.role})`}
              </span>
              <span>{e.when}</span>
            </p>
            {e.details?.map((line) => (
              <p key={line} className="activity-details">
                {line}
              </p>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Who did what to a record, when and why — newest first. Older entries fold away. */
export function AuditTrail({ entries, empty, moreLabel, visible = 10 }: { entries: AuditEntry[]; empty: string; moreLabel: (count: number) => string; visible?: number }) {
  if (entries.length === 0) return <p className="muted card card-tight">{empty}</p>;
  const shown = entries.slice(0, visible);
  const rest = entries.slice(visible);
  return (
    <div className="stack-sm">
      <Rows entries={shown} />
      {rest.length > 0 && (
        <details className="disclosure">
          <summary>{moreLabel(rest.length)}</summary>
          <Rows entries={rest} />
        </details>
      )}
    </div>
  );
}

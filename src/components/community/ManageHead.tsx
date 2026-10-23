import type { ReactNode } from 'react';

/** Section title + one-line intro for organisation-management pages (the h1 is the organisation's name). */
export function ManageHead({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="acct-head org-head">
      <div>
        <h2>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      {children}
    </div>
  );
}

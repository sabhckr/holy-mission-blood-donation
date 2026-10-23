import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type IconTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Page title + one-line intro for pages inside the account and management shells. */
export function PageHead({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="acct-head">
      <div>
        <h1>{title}</h1>
        {intro && <p>{intro}</p>}
      </div>
      {children}
    </div>
  );
}

/** Rounded square with an icon; the tone matches the status it stands for. */
export function IconTile({ icon: Icon, tone = 'brand', small }: { icon: LucideIcon; tone?: IconTone; small?: boolean }) {
  const cls = ['acct-icon', small ? 'acct-icon-sm' : '', tone === 'brand' ? '' : `acct-icon-${tone}`].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      <Icon size={small ? 18 : 22} aria-hidden="true" />
    </span>
  );
}

/** First letter of a person's name in a circle (decorative; the name is always written beside it). */
export function Avatar({ name }: { name: string }) {
  const first = Array.from(name.trim())[0] ?? '';
  return (
    <span className="acct-avatar" aria-hidden="true">
      {first.toLocaleUpperCase()}
    </span>
  );
}

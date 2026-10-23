import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ScrollCurrentIntoView } from './ScrollCurrentIntoView';

export interface SectionNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
  /** Small count badge, e.g. items waiting. */
  count?: string;
}

/**
 * Section navigation for the account and organisation-management areas: a row of chips on
 * phones (scrolls sideways), a list with icons on desktop. Works without JavaScript; with it,
 * the current chip is scrolled into view on phones.
 */
export function SectionNav({ id, label, title, items }: { id: string; label: string; title?: string; items: SectionNavItem[] }) {
  return (
    <nav className="side-nav acct-nav" aria-label={label} id={id}>
      {title && (
        <p className="acct-nav-title" aria-hidden="true">
          {title}
        </p>
      )}
      <ul>
        {items.map((item) => (
          <li key={item.href}>
            <Link className="nav-link" href={item.href} aria-current={item.current ? 'page' : undefined}>
              <item.icon size={18} aria-hidden="true" />
              {item.label}
              {item.count && <span className="badge badge-warning">{item.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <ScrollCurrentIntoView navId={id} />
    </nav>
  );
}

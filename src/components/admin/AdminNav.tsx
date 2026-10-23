import Link from 'next/link';
import { ChevronDown, ShieldCheck, type LucideIcon } from 'lucide-react';

export interface AdminNavItem {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  current: boolean;
}

export interface AdminNavGroup {
  key: string;
  /** No title for the first group (overview and the main lists). */
  title?: string;
  items: AdminNavItem[];
}

function Groups({ groups, idPrefix }: { groups: AdminNavGroup[]; idPrefix: string }) {
  return (
    <div className="admin-nav-groups">
      {groups.map((group) => (
        <div key={group.key} className="admin-nav-group">
          {group.title && (
            <p className="admin-nav-heading" id={`${idPrefix}-${group.key}`}>
              {group.title}
            </p>
          )}
          <ul aria-labelledby={group.title ? `${idPrefix}-${group.key}` : undefined}>
            {group.items.map((item) => (
              <li key={item.key}>
                <Link className="admin-nav-link" href={item.href} aria-current={item.current ? 'page' : undefined}>
                  <item.icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Staff section navigation. Desktop: a sticky sidebar with grouped links. Phones and tablets:
 * one disclosure that names the current page and opens the same grouped links as tiles.
 * Both are plain links and a <details> element, so everything works without JavaScript; the
 * site-wide MenuCloser closes the disclosure after navigation (data-menu).
 */
export function AdminNav({
  groups,
  label,
  panelTitle,
  roleLine,
  menuLabel,
  scopeNote,
}: {
  groups: AdminNavGroup[];
  label: string;
  panelTitle: string;
  roleLine: string;
  menuLabel: string;
  scopeNote?: string;
}) {
  const current = groups.flatMap((g) => g.items).find((i) => i.current) ?? groups[0]?.items[0];
  const CurrentIcon = current?.icon ?? ShieldCheck;
  return (
    <div className="admin-nav">
      <details className="admin-menu" data-menu>
        <summary>
          <span className="stat-icon">
            <CurrentIcon size={20} aria-hidden="true" />
          </span>
          <span className="admin-menu-current">
            <small>{panelTitle}</small>
            <strong>{current?.label}</strong>
          </span>
          <span className="admin-menu-toggle">
            {menuLabel}
            <ChevronDown size={16} aria-hidden="true" />
          </span>
        </summary>
        <nav className="admin-menu-panel" aria-label={label}>
          <Groups groups={groups} idPrefix="admin-menu" />
          {scopeNote && <p className="admin-nav-scope">{scopeNote}</p>}
        </nav>
      </details>

      <nav className="admin-nav-desktop" aria-label={label}>
        <div className="admin-nav-who">
          <span className="stat-icon">
            <ShieldCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <strong>{panelTitle}</strong>
            <p>{roleLine}</p>
          </div>
        </div>
        <Groups groups={groups} idPrefix="admin-side" />
        {scopeNote && <p className="admin-nav-scope">{scopeNote}</p>}
      </nav>
    </div>
  );
}

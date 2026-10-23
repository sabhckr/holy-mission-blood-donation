import Link from 'next/link';
import type { ReactNode } from 'react';
import { CircleCheckBig, Eye, ListFilter, Search, SearchX, X, type LucideIcon } from 'lucide-react';
import { Breadcrumbs } from '../ui';

/** Heading of every staff page: icon tile, h1, one-line intro and optional actions. */
export function AdminPageHead({
  icon: Icon,
  title,
  intro,
  actions,
  crumbs,
  crumbsLabel,
}: {
  icon: LucideIcon;
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
  crumbs?: { href: string; label: string }[];
  crumbsLabel?: string;
}) {
  return (
    <header className="admin-head">
      {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} label={crumbsLabel} />}
      <div className="admin-head-row">
        <span className="admin-head-icon">
          <Icon size={24} aria-hidden="true" />
        </span>
        <div className="admin-head-text">
          <h1>{title}</h1>
          {intro && <p>{intro}</p>}
        </div>
        {actions && <div className="admin-head-actions">{actions}</div>}
      </div>
    </header>
  );
}

/** h2 with a small icon, used for sections inside a staff page. */
export function SectionTitle({ id, icon: Icon, children, count }: { id?: string; icon: LucideIcon; children: ReactNode; count?: string }) {
  return (
    <h2 id={id} className="admin-section-title">
      <Icon size={20} aria-hidden="true" />
      {children}
      {count !== undefined && <span className="badge badge-neutral">{count}</span>}
    </h2>
  );
}

/**
 * A GET form for list filters. Works without JavaScript; the clear link only shows when a
 * filter is in use. Children are FilterSearch / FilterSelect / plain fields.
 */
export function FilterBar({
  action,
  label,
  submit,
  clear,
  active,
  children,
}: {
  action: string;
  label: string;
  submit: string;
  clear: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <form method="get" action={action} className="card filter-bar" role="search" aria-label={label}>
      <div className="filter-grid">{children}</div>
      <div className="filter-actions">
        <button type="submit" className="btn btn-primary btn-sm">
          <ListFilter size={16} aria-hidden="true" />
          {submit}
        </button>
        {active && (
          <Link className="btn btn-ghost btn-sm" href={action}>
            <X size={16} aria-hidden="true" />
            {clear}
          </Link>
        )}
      </div>
    </form>
  );
}

export function FilterSearch({
  id,
  name,
  label,
  hint,
  value,
  wide = true,
  type = 'search',
  icon = true,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  value?: string;
  wide?: boolean;
  type?: 'search' | 'text';
  icon?: boolean;
}) {
  return (
    <div className={`field${icon ? ' filter-search' : ''}${wide ? ' filter-wide' : ''}`}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {/* Hint above the box, as on every other field, so the boxes in a filter row line up. */}
      {hint && (
        <p className="hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      <div className="filter-search-box">
        <input id={id} className="input" type={type} name={name} defaultValue={value ?? ''} maxLength={80} aria-describedby={hint ? `${id}-hint` : undefined} />
        {icon && <Search className="filter-search-icon" size={18} aria-hidden="true" />}
      </div>
    </div>
  );
}

export function FilterSelect({ id, name, label, value, any, options }: { id: string; name: string; label: string; value?: string; any: string; options: { value: string; label: string }[] }) {
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" name={name} defaultValue={value ?? ''}>
        <option value="">{any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** One-tap status filter chips; the current one is marked with aria-current. */
export function StatusTabs({ label, items }: { label: string; items: { href: string; label: string; current: boolean }[] }) {
  return (
    <nav className="status-tabs" aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} className="status-tab" href={item.href} aria-current={item.current ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Empty list. `done` = a queue with nothing waiting (green tick); otherwise a search with no results. */
export function AdminEmpty({ title, hint, done, children }: { title: string; hint?: string; done?: boolean; children?: ReactNode }) {
  const Icon = done ? CircleCheckBig : SearchX;
  return (
    <div className={`empty-state admin-empty stack-sm${done ? '' : ' is-search'}`}>
      <Icon size={36} aria-hidden="true" />
      <h2>{title}</h2>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}

/** Card for one staff action on a record: icon, heading, short explanation, then the form. */
export function ActionCard({
  icon: Icon,
  title,
  intro,
  tone,
  wide,
  headingLevel = 3,
  id,
  children,
}: {
  icon: LucideIcon;
  title: string;
  intro?: ReactNode;
  tone?: 'accent' | 'danger';
  wide?: boolean;
  headingLevel?: 2 | 3;
  id?: string;
  children?: ReactNode;
}) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const cls = ['card', 'action-card', tone === 'accent' ? 'card-accent' : null, tone === 'danger' ? 'action-card-danger' : null, wide ? 'action-card-wide' : null].filter(Boolean).join(' ');
  return (
    <section className={cls} aria-labelledby={id}>
      <div className="action-card-head">
        <span className="action-icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <div>
          <H id={id}>{title}</H>
          {intro && <p>{intro}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** "Opening this page is recorded" — a quiet line, not an alert box. */
export function LoggedNote({ children }: { children: ReactNode }) {
  return (
    <p className="logged-note">
      <Eye size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

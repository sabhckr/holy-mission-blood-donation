import Link from 'next/link';
import type { ReactNode } from 'react';
import { BadgeCheck, CircleAlert, CircleCheck, Clock, Info, TriangleAlert } from 'lucide-react';
import type { AvailabilityState } from '@/server/domain/availability';
import type { Messages } from '@/i18n/messages';

export function PageHeader({ title, intro, children, crumbs, crumbsLabel }: { title: string; intro?: ReactNode; children?: ReactNode; crumbs?: { href: string; label: string }[]; crumbsLabel?: string }) {
  return (
    <div className="page-header">
      <div className="container">
        {crumbs && crumbs.length > 0 && <Breadcrumbs items={crumbs} label={crumbsLabel} />}
        <div className="cluster between">
          <h1 style={{ marginBottom: 0 }}>{title}</h1>
          {children}
        </div>
        {intro && <p style={{ marginTop: 'var(--space-2)' }}>{intro}</p>}
      </div>
    </div>
  );
}

export function Breadcrumbs({ items, label }: { items: { href: string; label: string }[]; label?: string }) {
  return (
    <nav className="breadcrumbs" aria-label={label}>
      <ol>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

type Tone = 'error' | 'success' | 'warning' | 'info';
const ALERT_ICON = { error: CircleAlert, success: CircleCheck, warning: TriangleAlert, info: Info } as const;

export function Alert({ tone = 'info', title, children, live }: { tone?: Tone; title?: string; children?: ReactNode; live?: boolean }) {
  const Icon = ALERT_ICON[tone];
  return (
    <div className={`alert alert-${tone}`} role={live ? (tone === 'error' ? 'alert' : 'status') : undefined}>
      <Icon size={20} aria-hidden="true" />
      <div>
        {title && <p style={{ fontWeight: 700, marginBottom: children ? 'var(--space-1)' : 0 }}>{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function BloodGroupBadge({ group, small, label }: { group: string; small?: boolean; label: string }) {
  return (
    <span className={`blood-group${small ? ' blood-group-sm' : ''}`} aria-label={`${label}: ${group}`}>
      {group}
    </span>
  );
}

const AVAILABILITY_TONE: Record<AvailabilityState, 'success' | 'neutral' | 'warning' | 'danger'> = {
  available: 'success',
  unavailable: 'neutral',
  needs_confirmation: 'warning',
  restricted: 'danger',
};

export function AvailabilityBadge({ state, t }: { state: AvailabilityState; t: Messages }) {
  return (
    <Badge tone={AVAILABILITY_TONE[state]}>
      {state === 'available' ? <CircleCheck size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}
      {t.common.availability[state]}
    </Badge>
  );
}

export function VerificationBadge({ status, t }: { status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'voided'; t: Messages }) {
  if (status === 'verified')
    return (
      <Badge tone="info">
        <BadgeCheck size={14} aria-hidden="true" />
        {t.common.verification.verified}
      </Badge>
    );
  const tone = status === 'pending' ? 'warning' : status === 'rejected' || status === 'voided' ? 'danger' : 'neutral';
  return <Badge tone={tone}>{t.common.verification[status]}</Badge>;
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state stack-sm">
      {icon}
      <h2 style={{ fontSize: '1.15rem' }}>{title}</h2>
      {children}
    </div>
  );
}

export function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {note && <div className="small muted">{note}</div>}
    </div>
  );
}

/** Link-based pagination: works without JavaScript and keeps the current filters. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
  t,
  n,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params: Record<string, string | undefined>;
  t: Messages;
  n: (v: number) => string;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set('page', String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav className="pagination" aria-label={t.common.pagination.label}>
      {page > 1 ? (
        <Link className="btn btn-sm" href={href(page - 1)} rel="prev">
          {t.common.pagination.previous}
        </Link>
      ) : (
        <span className="btn btn-sm" aria-disabled="true">
          {t.common.pagination.previous}
        </span>
      )}
      <span className="small" aria-current="page">
        {t.common.pagination.pageOf(n(page), n(pageCount))}
      </span>
      {page < pageCount ? (
        <Link className="btn btn-sm" href={href(page + 1)} rel="next">
          {t.common.pagination.next}
        </Link>
      ) : (
        <span className="btn btn-sm" aria-disabled="true">
          {t.common.pagination.next}
        </span>
      )}
    </nav>
  );
}

export function Disclaimer({ t, compact }: { t: Messages; compact?: boolean }) {
  return (
    <Alert tone="warning" title={t.common.disclaimer.title}>
      <p>{t.common.disclaimer.notMedical}</p>
      {!compact && <p>{t.common.disclaimer.emergency}</p>}
      {!compact && <p>{t.common.disclaimer.noPayment}</p>}
    </Alert>
  );
}

export function NoAccess({ t }: { t: Messages }) {
  return (
    <div className="container section">
      <Alert tone="error" title={t.common.noAccess.title}>
        <p>{t.common.noAccess.body}</p>
      </Alert>
    </div>
  );
}

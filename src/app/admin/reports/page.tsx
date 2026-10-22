import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';
import { communitySlugsByIds } from '@/server/services/admin-queries';
import { listReports } from '@/server/services/reports';
import { AdminAction } from '@/components/admin/AdminAction';
import { Badge, EmptyState, Pagination } from '@/components/ui';
import { handleReportAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.reports.title, robots: { index: false } };
}

const STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requireAdmin('/admin/reports');
  const { t, n, dateTime } = await getI18n();
  const sp = await searchParams;
  const parsed = z.enum(STATUSES).safeParse(sp.status);
  const status = parsed.success ? parsed.data : null;
  const page = z.coerce.number().int().min(1).max(10_000).catch(1).parse(sp.page ?? 1);
  const result = await listReports(actor, { status, page });
  const slugs = await communitySlugsByIds(actor, result.items.filter((i) => i.report.targetType === 'community').map((i) => i.report.targetId));
  const r = t.admin.reports;
  const pending = t.common.actions.submitting;
  const noteField = { name: 'note', label: r.resolution, hint: t.admin.reasonHint };
  const targetHref = (type: string, id: string): string | null => {
    if (type === 'donor') return `/donors/${id}`;
    if (type === 'request') return `/requests/${id}`;
    if (type === 'user') return `/admin/users/${id}`;
    const slug = slugs.get(id);
    return slug ? `/communities/${slug}` : null;
  };
  return (
    <>
      <header className="stack-sm">
        <h1>{r.title}</h1>
        <p className="muted">{r.intro}</p>
      </header>
      <nav className="cluster-sm" aria-label={r.status}>
        <Link className={`btn btn-sm${status === null ? ' btn-dark' : ''}`} href="/admin/reports" aria-current={status === null ? 'page' : undefined}>
          {t.admin.any}
        </Link>
        {STATUSES.map((s) => (
          <Link key={s} className={`btn btn-sm${status === s ? ' btn-dark' : ''}`} href={`/admin/reports?status=${s}`} aria-current={status === s ? 'page' : undefined}>
            {r.statuses[s]}
          </Link>
        ))}
      </nav>
      <p style={{ fontWeight: 600 }}>{t.admin.results(n(result.total))}</p>
      {result.items.length === 0 ? (
        <EmptyState title={r.empty} />
      ) : (
        <ul className="list-plain stack">
          {result.items.map(({ report, reporterName }) => {
            const href = targetHref(report.targetType, report.targetId);
            const closed = report.status === 'resolved' || report.status === 'dismissed';
            return (
              <li key={report.id} className="card card-tight stack-sm">
                <div className="cluster between">
                  <strong>{t.common.report.reasons[report.reason]}</strong>
                  <Badge tone={report.status === 'open' ? 'warning' : report.status === 'reviewing' ? 'info' : 'neutral'}>{r.statuses[report.status]}</Badge>
                </div>
                <dl className="dl">
                  <dt>{r.target}</dt>
                  <dd>
                    {r.targetTypes[report.targetType]} · {href ? <Link href={href}>{r.openTarget}</Link> : <span className="muted">{r.targetMissing}</span>}
                  </dd>
                  {report.details && (
                    <>
                      <dt>{r.details}</dt>
                      <dd>{report.details}</dd>
                    </>
                  )}
                  <dt>{r.reporter}</dt>
                  <dd>{report.reporterUserId ? <Link href={`/admin/users/${report.reporterUserId}`}>{reporterName}</Link> : r.anonymous}</dd>
                  <dt>{r.created}</dt>
                  <dd>{dateTime(report.createdAt)}</dd>
                  {report.resolutionNote && (
                    <>
                      <dt>{r.resolution}</dt>
                      <dd>{report.resolutionNote}</dd>
                    </>
                  )}
                </dl>
                {!closed && (
                  <div className="grid grid-3">
                    {report.status === 'open' && <AdminAction action={handleReportAction} hidden={{ reportId: report.id, status: 'reviewing' }} submit={r.setReviewing} pending={pending} />}
                    <AdminAction action={handleReportAction} hidden={{ reportId: report.id, status: 'resolved' }} submit={r.resolve} pending={pending} tone="primary" note={noteField} />
                    <AdminAction action={handleReportAction} hidden={{ reportId: report.id, status: 'dismissed' }} submit={r.dismiss} pending={pending} tone="danger" note={noteField} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/reports" params={{ status: status ?? undefined }} t={t} n={n} />
    </>
  );
}

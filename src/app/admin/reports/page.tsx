import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Flag, UserRound } from 'lucide-react';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { communitySlugsByIds } from '@/server/services/admin-queries';
import { can } from '@/server/policy';
import { listReports } from '@/server/services/reports';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminEmpty, AdminPageHead, StatusTabs } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { ReportStatusBadge } from '@/components/admin/StatusBadges';
import { Badge, Pagination } from '@/components/ui';
import { handleReportAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.reports.title, robots: { index: false } };
}

const STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const actor = await requirePermission('/admin/reports', 'reports.handle');
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
  /** null = the item is gone; undefined = it exists but this viewer may not open it. */
  const targetHref = (type: string, id: string): string | null | undefined => {
    if (type === 'donor') return `/donors/${id}`;
    if (type === 'request') return `/requests/${id}`;
    if (type === 'user') return can(actor, 'users.manage') ? `/admin/users/${id}` : undefined;
    const slug = slugs.get(id);
    return slug ? `/communities/${slug}` : null;
  };
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.reports} title={r.title} intro={r.intro} />
      <StatusTabs
        label={r.status}
        items={[
          { href: '/admin/reports', label: t.admin.any, current: status === null },
          ...STATUSES.map((s) => ({ href: `/admin/reports?status=${s}`, label: r.statuses[s], current: status === s })),
        ]}
      />
      <section className="stack" aria-labelledby="report-results">
        <div className="results-bar">
          <p id="report-results">{t.admin.results(n(result.total))}</p>
        </div>
        {result.items.length === 0 ? (
          <AdminEmpty title={r.empty} done={status === null || status === 'open' || status === 'reviewing'} />
        ) : (
          <ul className="record-list">
            {result.items.map(({ report, reporterName }) => {
              const href = targetHref(report.targetType, report.targetId);
              const closed = report.status === 'resolved' || report.status === 'dismissed';
              const headingId = `report-${report.id}`;
              return (
                <li key={report.id}>
                  <article className="card card-tight record-card" aria-labelledby={headingId}>
                    <div className="record-card-head">
                      <span className="record-card-icon">
                        <Flag size={20} aria-hidden="true" />
                      </span>
                      <div className="record-card-title">
                        <h2 id={headingId}>{t.common.report.reasons[report.reason]}</h2>
                        <p>{dateTime(report.createdAt)}</p>
                      </div>
                    </div>
                    <div className="record-card-badges">
                      <ReportStatusBadge status={report.status} t={t} />
                      <Badge>{r.targetTypes[report.targetType]}</Badge>
                    </div>
                    {report.details && <p>{report.details}</p>}
                    <dl className="meta-list">
                      <div>
                        <dt>{r.target}</dt>
                        <dd>
                          {href ? (
                            <Link className="section-link" href={href}>
                              {r.openTarget}
                              <ArrowRight size={16} aria-hidden="true" />
                            </Link>
                          ) : href === null ? (
                            <span className="muted">{r.targetMissing}</span>
                          ) : (
                            r.targetTypes[report.targetType]
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <UserRound size={14} aria-hidden="true" />
                          {r.reporter}
                        </dt>
                        <dd>
                          {report.reporterUserId ? can(actor, 'users.manage') ? <Link href={`/admin/users/${report.reporterUserId}`}>{reporterName}</Link> : reporterName : r.anonymous}
                        </dd>
                      </div>
                      <div>
                        <dt>
                          <CalendarDays size={14} aria-hidden="true" />
                          {r.created}
                        </dt>
                        <dd>{dateTime(report.createdAt)}</dd>
                      </div>
                      {report.resolutionNote && (
                        <div className="meta-wide">
                          <dt>{r.resolution}</dt>
                          <dd>{report.resolutionNote}</dd>
                        </div>
                      )}
                    </dl>
                    {!closed && (
                      <div className="action-row">
                        {report.status === 'open' && <AdminAction action={handleReportAction} hidden={{ reportId: report.id, status: 'reviewing' }} submit={r.setReviewing} pending={pending} size="md" />}
                        <AdminAction action={handleReportAction} hidden={{ reportId: report.id, status: 'resolved' }} submit={r.resolve} pending={pending} tone="primary" size="md" note={noteField} />
                        <details className="disclosure disclosure-danger">
                          <summary>{r.dismiss}</summary>
                          <AdminAction action={handleReportAction} hidden={{ reportId: report.id, status: 'dismissed' }} submit={r.dismiss} pending={pending} tone="danger" size="md" note={noteField} />
                        </details>
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/reports" params={{ status: status ?? undefined }} t={t} n={n} />
    </>
  );
}

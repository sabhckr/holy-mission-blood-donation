import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { isIsoDate } from '@/server/domain/dates';
import { searchAuditLog } from '@/server/services/admin';
import { AdminEmpty, AdminPageHead, FilterBar, FilterSearch } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.audit.title, robots: { index: false } };
}

const text = (max: number) => z.string().trim().max(max).regex(/^[\w.\-:]*$/).optional().catch(undefined);
const isoDate = z.string().refine(isIsoDate).optional().catch(undefined);
const schema = z.object({
  action: text(60),
  targetType: text(40),
  targetId: text(64),
  actorId: z.string().regex(/^[0-9a-f-]{36}$/i).optional().catch(undefined),
  from: isoDate,
  to: isoDate,
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

function compactMetadata(metadata: Record<string, unknown>): string {
  const s = JSON.stringify(metadata);
  return s === '{}' ? '' : s.length > 240 ? `${s.slice(0, 240)}…` : s;
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('/admin/audit', 'audit.view');
  const { t, n, dateTime } = await getI18n();
  const sp = await searchParams;
  const f = schema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const result = await searchAuditLog(actor, {
    action: f.action || null,
    targetType: f.targetType || null,
    targetId: f.targetId || null,
    actorId: f.actorId ?? null,
    from: f.from ?? null,
    to: f.to ?? null,
    page: f.page ?? 1,
  });
  const a = t.admin.audit;
  const actionLabels = t.admin.activity.actions as Record<string, string>;
  const roleLabel = (role: string | null) => (role === 'admin' || role === 'moderator' || role === 'user' ? t.common.roles[role] : role);
  const filtered = !!(f.action || f.targetType || f.targetId || f.actorId || f.from || f.to);
  const date = (name: 'from' | 'to', label: string) => (
    <div className="field">
      <label className="label" htmlFor={`a-${name}`}>
        {label}
      </label>
      <input id={`a-${name}`} className="input" type="date" name={name} defaultValue={f[name] ?? ''} />
    </div>
  );
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.audit} title={a.title} intro={a.intro} />
      <FilterBar action="/admin/audit" label={t.admin.filtersLabel} submit={t.admin.filter} clear={t.common.actions.clearFilters} active={filtered}>
        <FilterSearch id="a-action" name="action" label={a.action} hint={a.actionHint} value={f.action} type="text" icon={false} />
        <FilterSearch id="a-targetType" name="targetType" label={a.targetType} value={f.targetType} type="text" wide={false} icon={false} />
        <FilterSearch id="a-targetId" name="targetId" label={a.targetId} value={f.targetId} type="text" wide={false} icon={false} />
        <FilterSearch id="a-actorId" name="actorId" label={a.actorId} value={f.actorId} type="text" icon={false} />
        {date('from', a.from)}
        {date('to', a.to)}
      </FilterBar>
      <section className="stack" aria-labelledby="audit-results">
        <div className="results-bar">
          <p id="audit-results">{t.admin.results(n(result.total))}</p>
        </div>
        {result.items.length === 0 ? (
          <AdminEmpty title={a.empty} hint={filtered ? t.admin.emptyHint : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{a.action}</th>
                  <th scope="col">
                    <span className="th-line">{a.actor}</span>
                    <span className="th-line">{a.time}</span>
                  </th>
                  <th scope="col">{a.target}</th>
                  <th scope="col">{a.details}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map(({ log, actorName }) => {
                  const details = compactMetadata(log.metadata);
                  return (
                    <tr key={log.id}>
                      <td className="cell-main">
                        <strong>{actionLabels[log.action] ?? log.action}</strong>
                        <code className="cell-sub audit-code">{log.action}</code>
                      </td>
                      <td className="cell-pair">
                        <div className="pair-item">
                          <span className="pair-label">{a.actor}</span>
                          <span>
                            {log.actorUserId ? (
                              <Link href={`/admin/users/${log.actorUserId}`}>{actorName ?? log.actorUserId.slice(0, 8)}</Link>
                            ) : (
                              <span className="muted">{a.system}</span>
                            )}
                            {log.actorRole && <span className="cell-sub">{roleLabel(log.actorRole)}</span>}
                          </span>
                        </div>
                        <div className="pair-item">
                          <span className="pair-label">{a.time}</span>
                          <span className="cell-nowrap muted">{dateTime(log.createdAt)}</span>
                        </div>
                      </td>
                      <td data-label={a.target} className={log.targetType || log.targetId ? undefined : 'cell-empty'}>
                        <span>
                          {log.targetType ?? ''}
                          {log.targetId && <code className="cell-sub audit-code">{log.targetId.length > 12 ? `${log.targetId.slice(0, 12)}…` : log.targetId}</code>}
                        </span>
                      </td>
                      <td data-label={a.details} className={details ? 'audit-details' : 'cell-empty'}>
                        {details && <code className="audit-code">{details}</code>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/audit" params={{ action: f.action, targetType: f.targetType, targetId: f.targetId, actorId: f.actorId, from: f.from, to: f.to }} t={t} n={n} />
    </>
  );
}

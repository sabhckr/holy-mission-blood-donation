import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';
import { isIsoDate } from '@/server/domain/dates';
import { searchAuditLog } from '@/server/services/admin';
import { EmptyState, Pagination } from '@/components/ui';

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
  const actor = await requireAdmin('/admin/audit');
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
  const field = (name: 'action' | 'targetType' | 'targetId' | 'actorId', label: string, hint?: string) => (
    <div className="field">
      <label className="label" htmlFor={`a-${name}`}>
        {label}
      </label>
      {hint && <p className="hint">{hint}</p>}
      <input id={`a-${name}`} className="input" name={name} defaultValue={f[name] ?? ''} maxLength={64} />
    </div>
  );
  return (
    <>
      <header className="stack-sm">
        <h1>{a.title}</h1>
        <p className="muted">{a.intro}</p>
      </header>
      <form method="get" action="/admin/audit" className="card card-tight form">
        <div className="field-row">
          {field('action', a.action, a.actionHint)}
          {field('targetType', a.targetType)}
          {field('targetId', a.targetId)}
          {field('actorId', a.actorId)}
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="a-from">
              {a.from}
            </label>
            <input id="a-from" className="input" type="date" name="from" defaultValue={f.from ?? ''} />
          </div>
          <div className="field">
            <label className="label" htmlFor="a-to">
              {a.to}
            </label>
            <input id="a-to" className="input" type="date" name="to" defaultValue={f.to ?? ''} />
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {t.admin.filter}
          </button>
          <Link href="/admin/audit">{t.common.actions.clearFilters}</Link>
        </div>
      </form>
      <p style={{ fontWeight: 600 }}>{t.admin.results(n(result.total))}</p>
      {result.items.length === 0 ? (
        <EmptyState title={a.empty} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{a.time}</th>
                <th scope="col">{a.action}</th>
                <th scope="col">{a.actor}</th>
                <th scope="col">{a.target}</th>
                <th scope="col">{a.details}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map(({ log, actorName }) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dateTime(log.createdAt)}</td>
                  <td>
                    <code>{log.action}</code>
                  </td>
                  <td>
                    {log.actorUserId ? (
                      <Link href={`/admin/users/${log.actorUserId}`}>{actorName ?? log.actorUserId.slice(0, 8)}</Link>
                    ) : (
                      <span className="muted">{a.system}</span>
                    )}
                    {log.actorRole && <span className="small muted"> ({log.actorRole})</span>}
                  </td>
                  <td className="small">
                    {log.targetType ?? ''} {log.targetId ? <code>{log.targetId.length > 12 ? `${log.targetId.slice(0, 12)}…` : log.targetId}</code> : null}
                  </td>
                  <td className="small" style={{ wordBreak: 'break-word', maxWidth: 320 }}>
                    <code>{compactMetadata(log.metadata)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/audit" params={{ action: f.action, targetType: f.targetType, targetId: f.targetId, actorId: f.actorId, from: f.from, to: f.to }} t={t} n={n} />
    </>
  );
}

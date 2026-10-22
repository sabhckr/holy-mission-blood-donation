import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { maskBdPhone } from '@/server/domain/phone';
import { searchUsers } from '@/server/services/admin';
import { Badge, EmptyState, Pagination, VerificationBadge } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.users.title, robots: { index: false } };
}

const schema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  role: z.enum(['user', 'moderator', 'admin']).optional().catch(undefined),
  status: z.enum(['active', 'deactivated', 'suspended', 'deleted']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('/admin/users', 'users.manage');
  const { t, n, instantDate } = await getI18n();
  const sp = await searchParams;
  const f = schema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const result = await searchUsers(actor, { q: f.q || null, role: f.role ?? null, status: f.status ?? null, page: f.page ?? 1 });
  const u = t.admin.users;
  return (
    <>
      <header className="stack-sm">
        <h1>{u.title}</h1>
        <p className="muted">{u.intro}</p>
      </header>
      <form method="get" action="/admin/users" className="card card-tight form" role="search">
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="u-q">
              {u.search}
            </label>
            <input id="u-q" className="input" name="q" defaultValue={f.q ?? ''} maxLength={80} />
          </div>
          <div className="field">
            <label className="label" htmlFor="u-role">
              {u.role}
            </label>
            <select id="u-role" className="select" name="role" defaultValue={f.role ?? ''}>
              <option value="">{t.admin.any}</option>
              {(['user', 'moderator', 'admin'] as const).map((r) => (
                <option key={r} value={r}>
                  {t.common.roles[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor="u-status">
              {u.status}
            </label>
            <select id="u-status" className="select" name="status" defaultValue={f.status ?? ''}>
              <option value="">{t.admin.any}</option>
              {(['active', 'deactivated', 'suspended', 'deleted'] as const).map((s) => (
                <option key={s} value={s}>
                  {t.common.accountStatus[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            {t.admin.filter}
          </button>
          <Link href="/admin/users">{t.common.actions.clearFilters}</Link>
        </div>
      </form>
      <p style={{ fontWeight: 600 }}>{t.admin.results(n(result.total))}</p>
      {result.items.length === 0 ? (
        <EmptyState title={u.empty} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">{u.name}</th>
                <th scope="col">{u.phone}</th>
                <th scope="col">{u.role}</th>
                <th scope="col">{u.status}</th>
                <th scope="col">{u.donor}</th>
                <th scope="col">{u.joined}</th>
                <th scope="col">{u.lastSignIn}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/users/${row.id}`}>{row.displayName}</Link>
                  </td>
                  <td>{row.phone.startsWith('+880') ? maskBdPhone(row.phone) : '—'}</td>
                  <td>{t.common.roles[row.role]}</td>
                  <td>
                    <Badge tone={row.status === 'active' ? 'success' : row.status === 'suspended' ? 'danger' : 'neutral'}>{t.common.accountStatus[row.status]}</Badge>
                  </td>
                  <td>
                    {row.bloodGroup ? (
                      <span className="cluster-sm">
                        <strong>{row.bloodGroup}</strong>
                        {row.verificationStatus && <VerificationBadge status={row.verificationStatus} t={t} />}
                      </span>
                    ) : (
                      <span className="muted">{u.notDonor}</span>
                    )}
                  </td>
                  <td>{instantDate(row.createdAt)}</td>
                  <td>{row.lastSignInAt ? instantDate(row.lastSignInAt) : t.admin.never}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/users" params={{ q: f.q, role: f.role, status: f.status }} t={t} n={n} />
    </>
  );
}

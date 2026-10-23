import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { maskBdPhone } from '@/server/domain/phone';
import { searchUsers } from '@/server/services/admin';
import { AdminEmpty, AdminPageHead, FilterBar, FilterSearch, FilterSelect } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { AccountStatusBadge, VerificationStatusBadge } from '@/components/admin/StatusBadges';
import { Badge, BloodGroupBadge, Pagination } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.users.title, robots: { index: false } };
}

const ROLES = ['user', 'moderator', 'admin'] as const;
const STATUSES = ['active', 'deactivated', 'suspended', 'deleted'] as const;

const schema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  role: z.enum(ROLES).optional().catch(undefined),
  status: z.enum(STATUSES).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requirePermission('/admin/users', 'users.manage');
  const { t, n, instantDate } = await getI18n();
  const sp = await searchParams;
  const f = schema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const result = await searchUsers(actor, { q: f.q || null, role: f.role ?? null, status: f.status ?? null, page: f.page ?? 1 });
  const u = t.admin.users;
  const filtered = !!(f.q || f.role || f.status);
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.users} title={u.title} intro={u.intro} />
      <FilterBar action="/admin/users" label={t.admin.filtersLabel} submit={t.admin.filter} clear={t.common.actions.clearFilters} active={filtered}>
        <FilterSearch id="u-q" name="q" label={u.search} value={f.q} type="text" />
        <FilterSelect id="u-role" name="role" label={u.role} value={f.role} any={t.admin.any} options={ROLES.map((r) => ({ value: r, label: t.common.roles[r] }))} />
        <FilterSelect id="u-status" name="status" label={u.status} value={f.status} any={t.admin.any} options={STATUSES.map((s) => ({ value: s, label: t.common.accountStatus[s] }))} />
      </FilterBar>
      <section className="stack" aria-labelledby="user-results">
        <div className="results-bar">
          <p id="user-results">{t.admin.results(n(result.total))}</p>
        </div>
        {result.items.length === 0 ? (
          <AdminEmpty title={u.empty} hint={filtered ? t.admin.emptyHint : undefined} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{u.name}</th>
                  <th scope="col">
                    <span className="th-line">{u.role}</span>
                    <span className="th-line">{u.status}</span>
                  </th>
                  <th scope="col">{u.donor}</th>
                  <th scope="col">
                    <span className="th-line">{u.joined}</span>
                    <span className="th-line">{u.lastSignIn}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((row) => (
                  <tr key={row.id}>
                    <td className="cell-main">
                      <Link className="row-link" href={`/admin/users/${row.id}`} style={{ fontWeight: 700 }}>
                        {row.displayName}
                      </Link>
                      <span className="cell-sub">{row.phone.startsWith('+880') ? maskBdPhone(row.phone) : '—'}</span>
                    </td>
                    <td className="cell-pair">
                      <div className="pair-item">
                        <span className="pair-label">{u.role}</span>
                        <Badge tone={row.role === 'user' ? 'neutral' : 'info'}>{t.common.roles[row.role]}</Badge>
                      </div>
                      <div className="pair-item">
                        <span className="pair-label">{u.status}</span>
                        <AccountStatusBadge status={row.status} t={t} />
                      </div>
                    </td>
                    <td data-label={u.donor}>
                      {row.bloodGroup ? (
                        <span className="cluster-sm">
                          <BloodGroupBadge group={row.bloodGroup} small label={t.common.bloodGroup} />
                          {row.verificationStatus && <VerificationStatusBadge status={row.verificationStatus} t={t} />}
                        </span>
                      ) : (
                        <span className="muted">{u.notDonor}</span>
                      )}
                    </td>
                    <td className="cell-pair">
                      <div className="pair-item">
                        <span className="pair-label">{u.joined}</span>
                        <span className="cell-nowrap">{instantDate(row.createdAt)}</span>
                      </div>
                      <div className="pair-item">
                        <span className="pair-label">{u.lastSignIn}</span>
                        <span className="cell-nowrap muted">{row.lastSignInAt ? instantDate(row.lastSignInAt) : t.admin.never}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pagination page={result.page} pageCount={result.pageCount} basePath="/admin/users" params={{ q: f.q, role: f.role, status: f.status }} t={t} n={n} />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { accessReview } from '@/server/services/admin';
import { AdminAction } from '@/components/admin/AdminAction';
import { Badge, EmptyState } from '@/components/ui';
import { revokeSessionsAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.access.title, robots: { index: false } };
}

export default async function AdminAccessPage() {
  const actor = await requirePermission('/admin/access', 'access.review');
  const { t, n, dateTime, instantDate } = await getI18n();
  const { admins, leaders } = await accessReview(actor);
  const a = t.admin.access;
  const pending = t.common.actions.submitting;
  return (
    <>
      <header className="stack-sm">
        <h1>{a.title}</h1>
        <p className="muted">{a.intro}</p>
      </header>
      <section className="stack" aria-labelledby="admins">
        <h2 id="admins">{a.adminsTitle}</h2>
        {admins.length === 0 ? (
          <EmptyState title={a.empty} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{a.name}</th>
                  <th scope="col">{a.status}</th>
                  <th scope="col">{a.lastSignIn}</th>
                  <th scope="col">{a.passwordChanged}</th>
                  <th scope="col">{a.sessions}</th>
                  <th scope="col">
                    <span className="visually-hidden">{a.revoke}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {admins.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/users/${row.id}`}>{row.displayName}</Link>
                    </td>
                    <td>
                      <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>{t.common.accountStatus[row.status]}</Badge>
                    </td>
                    <td>{row.lastSignInAt ? dateTime(row.lastSignInAt) : t.admin.never}</td>
                    <td>{row.passwordChangedAt ? instantDate(row.passwordChangedAt) : t.admin.never}</td>
                    <td>{n(row.activeSessions)}</td>
                    <td>
                      {row.id !== actor.userId && row.activeSessions > 0 && (
                        <AdminAction action={revokeSessionsAction} hidden={{ userId: row.id }} submit={a.revoke} pending={pending} tone="danger" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="stack" aria-labelledby="leaders">
        <h2 id="leaders">{a.leadersTitle}</h2>
        {leaders.length === 0 ? (
          <EmptyState title={a.empty} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{a.name}</th>
                  <th scope="col">{a.role}</th>
                  <th scope="col">{a.community}</th>
                  <th scope="col">{a.since}</th>
                  <th scope="col">{a.lastSignIn}</th>
                  <th scope="col">
                    <span className="visually-hidden">{a.revoke}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row) => (
                  <tr key={row.membershipId}>
                    <td>
                      <Link href={`/admin/users/${row.userId}`}>{row.displayName}</Link>
                      {row.userStatus !== 'active' && <span className="small muted"> ({t.common.accountStatus[row.userStatus]})</span>}
                    </td>
                    <td>{t.common.roles[row.role]}</td>
                    <td>
                      <Link href={`/manage/${row.communitySlug}`}>{row.communityName}</Link>{' '}
                      <span className="small muted">({t.common.communityStatus[row.communityStatus]})</span>
                    </td>
                    <td>{instantDate(row.since)}</td>
                    <td>{row.lastSignInAt ? dateTime(row.lastSignInAt) : t.admin.never}</td>
                    <td>
                      {row.userId !== actor.userId && <AdminAction action={revokeSessionsAction} hidden={{ userId: row.userId }} submit={a.revoke} pending={pending} tone="danger" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

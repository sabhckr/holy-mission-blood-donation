import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, ShieldCheck } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { accessReview } from '@/server/services/admin';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminEmpty, AdminPageHead, SectionTitle } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { AccountStatusBadge, CommunityStatusBadge } from '@/components/admin/StatusBadges';
import { Badge } from '@/components/ui';
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
      <AdminPageHead icon={ADMIN_ICONS.access} title={a.title} intro={a.intro} />
      <section className="stack" aria-labelledby="admins">
        <SectionTitle id="admins" icon={ShieldCheck} count={n(admins.length)}>
          {a.adminsTitle}
        </SectionTitle>
        {admins.length === 0 ? (
          <AdminEmpty title={a.empty} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{a.name}</th>
                  <th scope="col">
                    <span className="th-line">{a.lastSignIn}</span>
                    <span className="th-line">{a.passwordChanged}</span>
                  </th>
                  <th scope="col">{a.sessions}</th>
                  <th scope="col">
                    <span className="visually-hidden">{a.revoke}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {admins.map((row) => {
                  const canRevoke = row.id !== actor.userId && row.activeSessions > 0;
                  return (
                    <tr key={row.id}>
                      <td className="cell-main">
                        <Link className="row-link" href={`/admin/users/${row.id}`} style={{ fontWeight: 700 }}>
                          {row.displayName}
                        </Link>
                        <span className="cell-sub">
                          <AccountStatusBadge status={row.status} t={t} />
                        </span>
                      </td>
                      <td className="cell-pair">
                        <div className="pair-item">
                          <span className="pair-label">{a.lastSignIn}</span>
                          <span className="cell-nowrap">{row.lastSignInAt ? dateTime(row.lastSignInAt) : t.admin.never}</span>
                        </div>
                        <div className="pair-item">
                          <span className="pair-label">{a.passwordChanged}</span>
                          <span className="cell-nowrap muted">{row.passwordChangedAt ? instantDate(row.passwordChangedAt) : t.admin.never}</span>
                        </div>
                      </td>
                      <td data-label={a.sessions}>
                        <strong>{n(row.activeSessions)}</strong>
                      </td>
                      <td className={canRevoke ? 'cell-action' : 'cell-empty'}>
                        {canRevoke && <AdminAction action={revokeSessionsAction} hidden={{ userId: row.id }} submit={a.revoke} pending={pending} tone="danger" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="stack" aria-labelledby="leaders">
        <SectionTitle id="leaders" icon={Building2} count={n(leaders.length)}>
          {a.leadersTitle}
        </SectionTitle>
        {leaders.length === 0 ? (
          <AdminEmpty title={a.empty} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">{a.name}</th>
                  <th scope="col">{a.community}</th>
                  <th scope="col">
                    <span className="th-line">{a.since}</span>
                    <span className="th-line">{a.lastSignIn}</span>
                  </th>
                  <th scope="col">
                    <span className="visually-hidden">{a.revoke}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((row) => {
                  const canRevoke = row.userId !== actor.userId;
                  return (
                    <tr key={row.membershipId}>
                      <td className="cell-main">
                        <Link className="row-link" href={`/admin/users/${row.userId}`} style={{ fontWeight: 700 }}>
                          {row.displayName}
                        </Link>
                        <span className="cell-sub cluster-sm">
                          <Badge tone="info">{t.common.roles[row.role]}</Badge>
                          {row.userStatus !== 'active' && <AccountStatusBadge status={row.userStatus} t={t} />}
                        </span>
                      </td>
                      <td data-label={a.community}>
                        <span>
                          <Link href={`/manage/${row.communitySlug}`}>{row.communityName}</Link>
                          <span className="cell-sub">
                            <CommunityStatusBadge status={row.communityStatus} t={t} />
                          </span>
                        </span>
                      </td>
                      <td className="cell-pair">
                        <div className="pair-item">
                          <span className="pair-label">{a.since}</span>
                          <span className="cell-nowrap">{instantDate(row.since)}</span>
                        </div>
                        <div className="pair-item">
                          <span className="pair-label">{a.lastSignIn}</span>
                          <span className="cell-nowrap muted">{row.lastSignInAt ? dateTime(row.lastSignInAt) : t.admin.never}</span>
                        </div>
                      </td>
                      <td className={canRevoke ? 'cell-action' : 'cell-empty'}>
                        {canRevoke && <AdminAction action={revokeSessionsAction} hidden={{ userId: row.userId }} submit={a.revoke} pending={pending} tone="danger" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

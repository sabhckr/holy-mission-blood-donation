import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Trash2, UserX } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requirePermission } from '@/server/auth/current';
import { pendingDeletionRequests } from '@/server/services/admin';
import { AdminAction } from '@/components/admin/AdminAction';
import { AdminEmpty, AdminPageHead } from '@/components/admin/AdminUi';
import { ADMIN_ICONS } from '@/components/admin/icons';
import { processDeletionAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.deletions.title, robots: { index: false } };
}

export default async function AdminDeletionsPage() {
  const actor = await requirePermission('/admin/deletions', 'deletions.process');
  const { t, dateTime } = await getI18n();
  const rows = await pendingDeletionRequests(actor);
  const d = t.admin.deletions;
  return (
    <>
      <AdminPageHead icon={ADMIN_ICONS.deletions} title={d.title} intro={d.intro} />
      <section className="card card-tight stack-sm" aria-labelledby="erased">
        <h2 id="erased" className="admin-section-title" style={{ fontSize: '1.05rem' }}>
          <Trash2 size={18} aria-hidden="true" />
          {d.erasedTitle}
        </h2>
        <ul className="check-list">
          {[d.erased1, d.erased2, d.erased3, d.erased4].map((line) => (
            <li key={line}>
              <Trash2 size={16} className="tone-danger" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>
      {rows.length === 0 ? (
        <AdminEmpty title={d.empty} done />
      ) : (
        <ul className="record-list">
          {rows.map(({ request, displayName }) => (
            <li key={request.id}>
              <article className="card card-tight record-card action-card-danger" aria-labelledby={`del-${request.id}`}>
                <div className="record-card-head">
                  <span className="record-card-icon">
                    <UserX size={20} aria-hidden="true" />
                  </span>
                  <div className="record-card-title">
                    <h2 id={`del-${request.id}`}>
                      <Link href={`/admin/users/${request.userId}`}>{displayName}</Link>
                    </h2>
                    <p className="cluster-sm">
                      <CalendarDays size={14} aria-hidden="true" />
                      {d.requested}: {dateTime(request.createdAt)}
                    </p>
                  </div>
                </div>
                {request.reason && (
                  <dl className="meta-list">
                    <div className="meta-wide">
                      <dt>{d.reason}</dt>
                      <dd>{request.reason}</dd>
                    </div>
                  </dl>
                )}
                {request.userId === actor.userId ? (
                  <p className="self-note">{t.admin.user.ownAccount}</p>
                ) : (
                  <div className="action-row">
                    <AdminAction action={processDeletionAction} hidden={{ requestId: request.id }} submit={d.process} pending={t.common.actions.submitting} tone="danger" size="md" confirm={d.confirm} />
                  </div>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

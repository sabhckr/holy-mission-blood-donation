import type { Metadata } from 'next';
import Link from 'next/link';
import { getI18n } from '@/i18n/server';
import { requireAdmin } from '@/server/auth/current';
import { pendingDeletionRequests } from '@/server/services/admin';
import { AdminAction } from '@/components/admin/AdminAction';
import { EmptyState } from '@/components/ui';
import { processDeletionAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.admin.deletions.title, robots: { index: false } };
}

export default async function AdminDeletionsPage() {
  const actor = await requireAdmin('/admin/deletions');
  const { t, dateTime } = await getI18n();
  const rows = await pendingDeletionRequests(actor);
  const d = t.admin.deletions;
  return (
    <>
      <header className="stack-sm">
        <h1>{d.title}</h1>
        <p className="muted">{d.intro}</p>
      </header>
      <section className="card stack-sm" aria-labelledby="erased">
        <h2 id="erased">{d.erasedTitle}</h2>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: '1.2rem' }}>
          <li>{d.erased1}</li>
          <li>{d.erased2}</li>
          <li>{d.erased3}</li>
          <li>{d.erased4}</li>
        </ul>
      </section>
      {rows.length === 0 ? (
        <EmptyState title={d.empty} />
      ) : (
        <ul className="list-plain stack">
          {rows.map(({ request, displayName }) => (
            <li key={request.id} className="card card-tight stack-sm">
              <dl className="dl">
                <dt>{d.user}</dt>
                <dd>
                  <Link href={`/admin/users/${request.userId}`}>{displayName}</Link>
                </dd>
                <dt>{d.requested}</dt>
                <dd>{dateTime(request.createdAt)}</dd>
                {request.reason && (
                  <>
                    <dt>{d.reason}</dt>
                    <dd>{request.reason}</dd>
                  </>
                )}
              </dl>
              {request.userId !== actor.userId && (
                <AdminAction action={processDeletionAction} hidden={{ requestId: request.id }} submit={d.process} pending={t.common.actions.submitting} tone="danger" confirm={d.confirm} />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

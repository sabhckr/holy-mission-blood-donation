import type { Metadata } from 'next';
import Link from 'next/link';
import { BellOff } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { getExternalProvider } from '@/server/notify/providers';
import { listNotifications, renderNotification } from '@/server/services/notifications';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { Alert, Badge, EmptyState } from '@/components/ui';
import { markNotificationsReadAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.notifications.title, robots: { index: false } };
}

export default async function NotificationsPage() {
  const { t, dateTime, locale } = await getI18n();
  const nt = t.account.notifications;
  const actor = await requireActor('/account/notifications');
  const items = await listNotifications(actor.userId, 100);
  const unread = items.some((i) => !i.readAt);

  return (
    <>
      <div className="cluster between">
        <h1 style={{ marginBottom: 0 }}>{nt.title}</h1>
        {unread && (
          <ActionForm action={markNotificationsReadAction} className="stack-sm">
            <SubmitButton label={nt.markAll} pendingLabel={t.common.actions.saving} className="btn btn-sm" />
          </ActionForm>
        )}
      </div>
      {!getExternalProvider() && <Alert tone="info">{t.notifications.externalNotConfigured}</Alert>}
      {items.length === 0 ? (
        <EmptyState icon={<BellOff size={36} aria-hidden="true" />} title={t.notifications.empty} />
      ) : (
        <ul className="list-plain stack-sm">
          {items.map((item) => {
            const r = renderNotification(locale, item.kind, item.data);
            return (
              <li key={item.id} className={`card card-tight stack-sm${item.readAt ? '' : ' card-accent'}`}>
                <div className="cluster between">
                  <strong>{r.title}</strong>
                  {!item.readAt && <Badge tone="danger">{nt.unread}</Badge>}
                </div>
                {r.body && <p style={{ margin: 0 }}>{r.body}</p>}
                <div className="cluster-sm small">
                  <span className="muted">{dateTime(item.createdAt)}</span>
                  {item.link && <Link href={item.link}>{nt.open}</Link>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Bell, BellOff, Building2, CircleX, Droplet, HeartPulse, Inbox, Siren, Trash2, UserCog, type LucideIcon } from 'lucide-react';
import { getI18n } from '@/i18n/server';
import { requireActor } from '@/server/auth/current';
import { getExternalProvider } from '@/server/notify/providers';
import { listNotifications, renderNotification } from '@/server/services/notifications';
import { ActionForm, SubmitButton } from '@/components/form/ActionForm';
import { IconTile, PageHead, type IconTone } from '@/components/account/bits';
import { Badge, EmptyState } from '@/components/ui';
import { markNotificationsReadAction } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.notifications.title, robots: { index: false } };
}

/** An icon and tone per kind of notification, so the list can be scanned at a glance. */
function kindLook(kind: string): { icon: LucideIcon; tone: IconTone } {
  if (kind.startsWith('contact_request')) return { icon: Inbox, tone: kind.endsWith('declined') ? 'neutral' : 'brand' };
  if (kind.startsWith('request_')) return { icon: Siren, tone: 'brand' };
  if (kind.startsWith('donation_')) return { icon: Droplet, tone: kind.endsWith('rejected') ? 'warning' : 'info' };
  if (kind.startsWith('community_') || kind.startsWith('membership_')) return { icon: Building2, tone: kind.endsWith('rejected') || kind.endsWith('suspended') ? 'warning' : 'neutral' };
  if (kind.startsWith('registration_')) return { icon: kind.endsWith('rejected') ? CircleX : BadgeCheck, tone: kind.endsWith('rejected') ? 'warning' : 'success' };
  if (kind === 'donor_verified') return { icon: BadgeCheck, tone: 'info' };
  if (kind.startsWith('availability_')) return { icon: kind.endsWith('by_staff') ? UserCog : HeartPulse, tone: 'brand' };
  if (kind.startsWith('deletion_')) return { icon: Trash2, tone: 'neutral' };
  return { icon: Bell, tone: 'neutral' };
}

export default async function NotificationsPage() {
  const { t, n, dateTime, locale } = await getI18n();
  const nt = t.account.notifications;
  const actor = await requireActor('/account/notifications');
  const items = await listNotifications(actor.userId, 100);
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <>
      <PageHead title={nt.title} intro={nt.intro}>
        {unread > 0 && (
          <ActionForm action={markNotificationsReadAction} className="stack-sm">
            <SubmitButton label={nt.markAll} pendingLabel={t.common.actions.saving} className="btn btn-soft" />
          </ActionForm>
        )}
      </PageHead>
      {!getExternalProvider() && (
        <p className="acct-staff-note">
          <Bell size={16} aria-hidden="true" />
          <span>{t.notifications.externalNotConfigured}</span>
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState icon={<BellOff size={36} aria-hidden="true" />} title={t.notifications.empty} />
      ) : (
        <section aria-labelledby="list-title">
          <h2 id="list-title" className="visually-hidden">
            {nt.title}
            {unread > 0 && ` — ${t.notifications.unread(n(unread))}`}
          </h2>
          <ul className="acct-list">
            {items.map((item) => {
              const r = renderNotification(locale, item.kind, item.data);
              const look = kindLook(item.kind);
              return (
                <li key={item.id} className={`card card-tight acct-item${item.readAt ? '' : ' acct-item-unread'}`}>
                  <div className="acct-item-head">
                    <IconTile icon={look.icon} tone={look.tone} />
                    <div className="stack-sm">
                      <p className="acct-item-title">
                        {r.title} {!item.readAt && <Badge tone="danger">{nt.unread}</Badge>}
                      </p>
                      {r.body && <p style={{ margin: 0 }}>{r.body}</p>}
                      <p className="acct-meta">
                        <span>{dateTime(item.createdAt)}</span>
                        {item.link && (
                          <Link className="section-link" href={item.link}>
                            {nt.open}
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

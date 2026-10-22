import { appBaseUrl } from '@/server/config';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db, type Executor } from '../db/client';
import { notificationDeliveries, notifications, users } from '../db/schema';
import { getExternalProvider } from '../notify/providers';
import { getMessages } from '@/i18n/messages';
import type { Locale } from '@/i18n/config';

/** Notification kinds. Text for each lives in the `notifications` i18n namespace. */
export type NotificationKind =
  | 'contact_request_received'
  | 'contact_request_accepted'
  | 'contact_request_declined'
  | 'donation_verified'
  | 'donation_rejected'
  | 'donor_verified'
  | 'membership_approved'
  | 'membership_rejected'
  | 'membership_requested'
  | 'community_approved'
  | 'community_suspended'
  | 'community_rejected'
  | 'request_assigned'
  | 'request_escalated'
  | 'request_response'
  | 'request_status_changed'
  | 'availability_expiring'
  | 'deletion_completed';

/** Kinds worth sending outside the app (SMS/email) when a provider is configured. */
const EXTERNAL_KINDS = new Set<NotificationKind>(['contact_request_received', 'contact_request_accepted', 'request_assigned', 'request_escalated', 'request_response']);

export interface NewNotification {
  userId: string;
  kind: NotificationKind;
  data?: Record<string, string | number | null>;
  link?: string | null;
}

/**
 * Stores in-app notifications (inside the caller's transaction) and queues external delivery
 * rows. External sending happens later in dispatchQueuedDeliveries(); without a provider the
 * delivery row is recorded as 'not_configured' so nobody is told a message was sent.
 */
export async function createNotifications(executor: Executor, items: NewNotification[]): Promise<string[]> {
  if (items.length === 0) return [];
  const rows = await executor
    .insert(notifications)
    .values(items.map((n) => ({ userId: n.userId, kind: n.kind, data: n.data ?? {}, link: n.link ?? null })))
    .returning({ id: notifications.id, kind: notifications.kind });
  const provider = getExternalProvider();
  const external = rows.filter((r) => EXTERNAL_KINDS.has(r.kind as NotificationKind));
  if (external.length) {
    await executor.insert(notificationDeliveries).values(
      external.map((r) => ({
        notificationId: r.id,
        channel: provider?.channel ?? 'sms',
        provider: provider?.name ?? 'none',
        status: provider ? ('queued' as const) : ('not_configured' as const),
      })),
    );
  }
  return rows.map((r) => r.id);
}

export function renderNotification(locale: Locale, kind: string, data: Record<string, string | number | null>): { title: string; body: string } {
  const dict = getMessages(locale).notifications.kinds as Record<string, { title: string; body: (d: Record<string, string | number | null>) => string }>;
  const entry = dict[kind];
  if (!entry) return { title: getMessages(locale).notifications.fallbackTitle, body: '' };
  return { title: entry.title, body: entry.body(data) };
}

/** Sends queued external deliveries. Safe to call repeatedly (e.g. after a request, or from cron). */
export async function dispatchQueuedDeliveries(limit = 25): Promise<{ sent: number; failed: number }> {
  const provider = getExternalProvider();
  if (!provider) return { sent: 0, failed: 0 };
  const queued = await db
    .select({
      id: notificationDeliveries.id,
      kind: notifications.kind,
      data: notifications.data,
      link: notifications.link,
      phone: users.phone,
      email: users.email,
      locale: users.preferredLocale,
    })
    .from(notificationDeliveries)
    .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(and(eq(notificationDeliveries.status, 'queued'), eq(users.status, 'active')))
    .limit(limit);
  let sent = 0;
  let failed = 0;
  const base = appBaseUrl();
  for (const item of queued) {
    const to = provider.channel === 'email' ? item.email : item.phone;
    if (!to) {
      await db.update(notificationDeliveries).set({ status: 'failed', error: 'no address' }).where(eq(notificationDeliveries.id, item.id));
      failed++;
      continue;
    }
    const { title, body } = renderNotification(item.locale === 'en' ? 'en' : 'bn', item.kind, item.data);
    const text = `${title}\n${body}${item.link ? `\n${base}${item.link}` : ''}`.slice(0, 600);
    const result = await provider.send({ channel: provider.channel, to, text });
    await db
      .update(notificationDeliveries)
      .set({ status: result.status, providerRef: result.providerRef ?? null, error: result.error ?? null })
      .where(eq(notificationDeliveries.id, item.id));
    if (result.status === 'sent') sent++;
    else failed++;
  }
  return { sent, failed };
}

export async function listNotifications(userId: string, limit = 50) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  const scope = ids && ids.length ? and(eq(notifications.userId, userId), inArray(notifications.id, ids)) : eq(notifications.userId, userId);
  await db.update(notifications).set({ readAt: new Date() }).where(and(scope, isNull(notifications.readAt)));
}

export async function deliveryStatusesFor(notificationIds: string[]) {
  if (notificationIds.length === 0) return [];
  return db.select().from(notificationDeliveries).where(inArray(notificationDeliveries.notificationId, notificationIds));
}

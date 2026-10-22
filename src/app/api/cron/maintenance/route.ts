import { lt } from 'drizzle-orm';
import { timingSafeEqual } from 'node:crypto';
import { db } from '@/server/db/client';
import { rateLimits, sessions } from '@/server/db/schema';
import { dispatchQueuedDeliveries } from '@/server/services/notifications';
import { expireStale } from '@/server/services/requests';

/**
 * Scheduled maintenance (Vercel Cron, see vercel.json): expires overdue requests, sends queued
 * notifications and removes expired sessions. Only runs when called with the CRON_SECRET bearer
 * token; without CRON_SECRET it is disabled. Pages already treat overdue requests as expired,
 * so the site stays correct even if this never runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ ok: false, reason: 'not configured' }, { status: 503 });
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response(null, { status: 401 });
  const expired = await expireStale();
  const delivered = await dispatchQueuedDeliveries(50);
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 2 * 86400 * 1000)));
  return Response.json({ ok: true, expired, delivered });
}

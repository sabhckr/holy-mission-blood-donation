import { lt } from 'drizzle-orm';
import { closeDb, getDb } from '../src/server/db/client';
import { rateLimits, sessions } from '../src/server/db/schema';
import { dispatchQueuedDeliveries } from '../src/server/services/notifications';
import { expireStale } from '../src/server/services/requests';
import { loadEnv } from './env';

loadEnv();

/** Run every 10–15 minutes from cron: expires old requests, sends queued notifications, cleans up. */
const expired = await expireStale();
const delivered = await dispatchQueuedDeliveries(100);
const db = getDb();
await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 2 * 86400 * 1000)));
console.log(JSON.stringify({ expired, delivered }));
await closeDb();

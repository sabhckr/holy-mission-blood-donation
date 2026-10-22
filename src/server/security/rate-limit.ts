import { lt, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { rateLimits } from '../db/schema';
import { AppError } from '../errors';

export interface RateLimitRule {
  /** Requests allowed per window. */
  limit: number;
  windowSeconds: number;
}

/** Named rules so limits are reviewed in one place. */
export const RATE_LIMITS = {
  signIn: { limit: 10, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  phoneReveal: { limit: 20, windowSeconds: 24 * 60 * 60 },
  contactRequest: { limit: 10, windowSeconds: 24 * 60 * 60 },
  bloodRequest: { limit: 5, windowSeconds: 24 * 60 * 60 },
  report: { limit: 10, windowSeconds: 24 * 60 * 60 },
  communityRegister: { limit: 3, windowSeconds: 24 * 60 * 60 },
  search: { limit: 120, windowSeconds: 60 * 60 },
  export: { limit: 10, windowSeconds: 60 * 60 },
  passwordReset: { limit: 10, windowSeconds: 60 * 60 },
  generic: { limit: 60, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Fixed-window counter stored in Postgres, so limits hold across app instances. */
export async function hitRateLimit(name: RateLimitName, subject: string, now = new Date()): Promise<{ ok: boolean; remaining: number }> {
  const rule = RATE_LIMITS[name];
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${name}:${subject}`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  if (Math.random() < 0.01) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - 2 * 24 * 3600 * 1000)));
  }
  return { ok: row.count <= rule.limit, remaining: Math.max(0, rule.limit - row.count) };
}

export async function enforceRateLimit(name: RateLimitName, subject: string): Promise<void> {
  const result = await hitRateLimit(name, subject);
  if (!result.ok) throw new AppError('rate_limited', 'rate_limited');
}

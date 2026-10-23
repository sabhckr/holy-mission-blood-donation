import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { getActorBySessionToken } from '../services/accounts';
import { can, isAdmin, type Actor, type PlatformPermission } from '../policy';
import { SESSION_COOKIE, sessionCookieOptions } from './session-cookie';

export { SESSION_COOKIE, cookieSecure } from './session-cookie';

/** The signed-in session for this request (memoised per request). */
export const getSession = cache(async (): Promise<{ actor: Actor; sessionId: string } | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getActorBySessionToken(token);
});

export async function getActor(): Promise<Actor | null> {
  return (await getSession())?.actor ?? null;
}

/** Only accept same-site relative paths as post-login destinations (prevents open redirects). */
export function safeNextPath(value: unknown, fallback = '/account'): string {
  if (typeof value !== 'string') return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || value.includes('://')) return fallback;
  return value.slice(0, 300);
}

/** Signed-in actor or a redirect to sign in. Deactivated accounts are sent to /account to reactivate. */
export async function requireActor(nextPath: string, options: { allowDeactivated?: boolean } = {}): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/signin?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  if (actor.status === 'deactivated' && !options.allowDeactivated) redirect('/account');
  return actor;
}

/** Admin pages answer 404 to everyone else, so their existence is not advertised. */
export async function requireAdmin(nextPath: string): Promise<Actor> {
  const actor = await requireActor(nextPath);
  if (!isAdmin(actor)) notFound();
  return actor;
}

/** Staff pages: 404 unless the signed-in user has this platform permission. */
export async function requirePermission(nextPath: string, permission: PlatformPermission): Promise<Actor> {
  const actor = await requireActor(nextPath);
  if (!can(actor, permission)) notFound();
  return actor;
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

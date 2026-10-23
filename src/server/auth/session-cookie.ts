/**
 * Session cookie settings, kept free of database imports so src/proxy.ts can use them.
 */

export const SESSION_COOKIE = 'hm_session';

/**
 * How long a session lasts without being used. Every visit renews it (the cookie in src/proxy.ts,
 * the database row in getActorBySessionToken), so people who keep using the site stay signed in.
 */
export const SESSION_TTL_MS = 365 * 24 * 3600 * 1000;

export function cookieSecure(): boolean {
  return process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions(expires: Date) {
  return { httpOnly: true, secure: cookieSecure(), sameSite: 'lax' as const, path: '/', expires };
}

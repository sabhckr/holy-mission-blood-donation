import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_MS, sessionCookieOptions } from './server/auth/session-cookie';

/**
 * Per-request Content-Security-Policy with a nonce for Next.js' own inline scripts.
 * Styles allow 'unsafe-inline' because React/Next inject style attributes; scripts do not.
 * Also renews the session cookie on every page visit, so people who use the site stay signed in.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-url', request.nextUrl.pathname + request.nextUrl.search);
  requestHeaders.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  // Only on GET: sign-in and sign-out are POSTs that set the cookie themselves.
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session && request.method === 'GET') {
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions(new Date(Date.now() + SESSION_TTL_MS)));
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|downloads|favicon.ico|icon.svg|robots.txt).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

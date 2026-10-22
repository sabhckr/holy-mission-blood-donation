import { NextResponse, type NextRequest } from 'next/server';
import { isLocale, LOCALE_COOKIE } from '@/i18n/config';
import { getActor, safeNextPath, cookieSecure } from '@/server/auth/current';
import { setPreferredLocale } from '@/server/services/accounts';

/** Language switch: /lang?to=en&next=/donors. Sets a one-year cookie and returns to the page. */
export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to');
  const next = safeNextPath(request.nextUrl.searchParams.get('next'), '/');
  const response = NextResponse.redirect(new URL(next, request.url), 303);
  if (isLocale(to)) {
    response.cookies.set(LOCALE_COOKIE, to, { path: '/', maxAge: 365 * 24 * 3600, sameSite: 'lax', secure: cookieSecure(), httpOnly: false });
    const actor = await getActor();
    if (actor) await setPreferredLocale(actor.userId, to);
  }
  return response;
}

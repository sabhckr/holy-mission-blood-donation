import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/current';
import { isSameOrigin } from '@/server/security/origin';
import { revokeSessionToken } from '@/server/services/accounts';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSessionToken(token);
  jar.delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL('/', request.url), 303);
}

/**
 * CSRF protection for route handlers that change state (server actions have Next.js' own
 * Origin check). Requires an Origin (or Referer) header that matches the request's host.
 */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return false;
  const source = request.headers.get('origin') ?? request.headers.get('referer');
  if (!source) return false;
  try {
    const allowed = new Set([host, ...(process.env.SERVER_ACTIONS_ALLOWED_ORIGINS?.split(',') ?? [])]);
    return allowed.has(new URL(source).host);
  } catch {
    return false;
  }
}

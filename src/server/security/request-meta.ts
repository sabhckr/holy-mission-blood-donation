import { headers } from 'next/headers';
import { hashIdentifier } from '../domain/ids';

export interface RequestMeta {
  ip: string;
  ipHash: string;
  userAgent: string | null;
}

/**
 * Client address for rate limiting. Behind a reverse proxy, the proxy must overwrite
 * X-Forwarded-For; set TRUST_PROXY=false to ignore forwarded headers entirely.
 */
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const trustProxy = process.env.TRUST_PROXY !== 'false';
  const forwarded = trustProxy ? h.get('x-forwarded-for')?.split(',')[0]?.trim() : undefined;
  const ip = forwarded || (trustProxy ? h.get('x-real-ip') : null) || 'unknown';
  const ua = h.get('user-agent');
  return { ip, ipHash: hashIdentifier(ip), userAgent: ua ? ua.slice(0, 160) : null };
}

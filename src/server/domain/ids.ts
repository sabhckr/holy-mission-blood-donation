import { createHash, createHmac, randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/o/1/l/i

/** Short unguessable id for public URLs. */
export function randomPublicId(length = 10): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** 256-bit random token, URL safe. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function appSecret(): string {
  const secret = process.env.APP_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    // Without APP_SECRET, derive a stable key from the (secret) database URL so a deployment
    // needs only DATABASE_URL. Setting APP_SECRET is still preferred.
    const db = process.env.DATABASE_URL;
    if (!db) throw new Error('APP_SECRET (32+ characters) or DATABASE_URL must be set in production');
    return createHash('sha256').update(`holy-mission-app-secret:${db}`).digest('hex');
  }
  return 'development-only-secret-do-not-use-in-production';
}

/** Keyed hash so raw IP addresses are never stored. */
export function hashIdentifier(value: string): string {
  return createHmac('sha256', appSecret()).update(value).digest('hex').slice(0, 32);
}

export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base;
}

export function nameKey(name: string): string {
  return name.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

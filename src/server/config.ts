/**
 * Deployment-dependent settings with safe defaults, so a Vercel deployment only needs
 * DATABASE_URL (see docs/DEPLOY-VERCEL.md).
 */

/** Public base URL: APP_BASE_URL, else Vercel's production domain, else localhost. */
export function appBaseUrl(): string {
  const explicit = process.env.APP_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

function isLocalHost(url: URL): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) || url.hostname.endsWith('.local');
}

/**
 * The app's connection string: DATABASE_URL, or POSTGRES_URL as set by the Supabase and Neon
 * integrations on Vercel. Query parameters other than sslmode (e.g. Supabase's `supa=`) are
 * dropped, because postgres.js would send them to the server as settings.
 */
export function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!raw) return undefined;
  const url = new URL(cleanUrl(raw));
  // On Vercel many short-lived instances would exhaust Supabase's session-mode pool (15 clients),
  // so web requests use the same pooler in transaction mode (6543). Migrations switch back to
  // 5432 in migrationDatabaseUrl(). Set DATABASE_POOL_MODE=session to opt out.
  if (process.env.VERCEL && url.hostname.endsWith('pooler.supabase.com') && url.port === '5432' && process.env.DATABASE_POOL_MODE !== 'session') {
    url.port = '6543';
  }
  return url.toString();
}

/**
 * Drops non-standard query parameters and, when DATABASE_PASSWORD is set, puts that password
 * into the URL (percent-encoded). This lets hosting dashboards keep the URL with a
 * [YOUR-PASSWORD] placeholder and the raw password in its own field.
 */
function cleanUrl(raw: string): string {
  const url = new URL(raw);
  for (const key of [...url.searchParams.keys()]) if (key !== 'sslmode') url.searchParams.delete(key);
  const password = process.env.DATABASE_PASSWORD;
  if (password) url.password = encodeURIComponent(password);
  return url.toString();
}

/** postgres.js options derived from the connection string. */
export function databaseOptions(connectionString: string) {
  const url = new URL(connectionString);
  // Transaction-mode poolers (Supabase port 6543, Neon "-pooler" hosts) do not support prepared statements.
  const transactionPooler = url.port === '6543' || url.hostname.includes('-pooler.') || process.env.DATABASE_PREPARE === 'false';
  const sslMode = url.searchParams.get('sslmode');
  const ssl = sslMode ? undefined : isLocalHost(url) ? false : ('require' as const);
  const max = Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 3 : 10));
  return { prepare: !transactionPooler, ssl, max };
}

/**
 * Connection string for migrations and seeding: MIGRATION_DATABASE_URL, or the unpooled URL an
 * integration provides (DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING); for a Supabase
 * transaction-pooler URL it switches to the session pooler on port 5432, which keeps one
 * connection for the whole migration.
 */
export function migrationDatabaseUrl(): string | undefined {
  const direct = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
  if (direct) return cleanUrl(direct);
  const raw = databaseUrl();
  if (!raw) return undefined;
  const url = new URL(raw);
  if (url.hostname.endsWith('pooler.supabase.com') && url.port === '6543') url.port = '5432';
  return url.toString();
}

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

/** postgres.js options derived from the connection string. */
export function databaseOptions(connectionString: string) {
  const url = new URL(connectionString);
  // Supabase's transaction pooler (port 6543) does not support prepared statements.
  const transactionPooler = url.port === '6543' || process.env.DATABASE_PREPARE === 'false';
  const sslMode = url.searchParams.get('sslmode');
  const ssl = sslMode ? undefined : isLocalHost(url) ? false : ('require' as const);
  const max = Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 3 : 10));
  return { prepare: !transactionPooler, ssl, max };
}

/**
 * Connection string for migrations and seeding. Uses MIGRATION_DATABASE_URL when set; for a
 * Supabase transaction-pooler URL it switches to the session pooler on port 5432, which keeps
 * one connection for the whole migration.
 */
export function migrationDatabaseUrl(): string | undefined {
  if (process.env.MIGRATION_DATABASE_URL) return process.env.MIGRATION_DATABASE_URL;
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (url.hostname.endsWith('pooler.supabase.com') && url.port === '6543') url.port = '5432';
  return url.toString();
}

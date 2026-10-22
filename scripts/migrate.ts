import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { migrationDatabaseUrl } from '../src/server/config';
import { closeDb, getDb } from '../src/server/db/client';
import { loadEnv } from './env';

loadEnv();

export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: 'drizzle' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = migrationDatabaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set. On Vercel, add it under Project → Settings → Environment Variables.');
  process.env.DATABASE_URL = url;
  await runMigrations();
  console.log('Migrations applied');
  await closeDb();
}

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { databaseOptions, databaseUrl } from '../config';

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything that can run queries: the pool or an open transaction. */
export type Executor = Database | Transaction;

type Holder = { db: Database; client: postgres.Sql; url: string };
const globalRef = globalThis as unknown as { __holyMissionDb?: Holder };

function connect(): Holder {
  const url = databaseUrl();
  if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local.');
  const client = postgres(url, {
    ...databaseOptions(url),
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
  return { client, db: drizzle(client, { schema }), url };
}

/** Lazily created pool, reused across hot reloads in development. */
export function getDb(): Database {
  const url = databaseUrl();
  if (!globalRef.__holyMissionDb || globalRef.__holyMissionDb.url !== url) {
    globalRef.__holyMissionDb = connect();
  }
  return globalRef.__holyMissionDb.db;
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

export async function closeDb(): Promise<void> {
  const holder = globalRef.__holyMissionDb;
  globalRef.__holyMissionDb = undefined;
  if (holder) await holder.client.end({ timeout: 5 });
}

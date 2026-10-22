import postgres from 'postgres';
import { closeDb } from '../src/server/db/client';
import { createDatabase } from './create-db';

/**
 * Fresh database for end-to-end tests: drops and recreates the e2e database (refuses any
 * database whose name does not end in _e2e), migrates, seeds locations and creates a test admin.
 */
const url = process.env.DATABASE_URL ?? '';
const name = new URL(url).pathname.slice(1);
if (!name.endsWith('_e2e')) throw new Error(`Refusing to reset non-e2e database "${name}"`);
const admin = new URL(url);
admin.pathname = '/postgres';
const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
await sql.unsafe(`drop database if exists "${name}" with (force)`);
await sql.end();
await createDatabase(url);
const { runMigrations } = await import('./migrate');
const { seedLocations } = await import('./seed');
await runMigrations();
await seedLocations();
const { seedInitialOperatingArea } = await import('../src/server/services/operating-areas');
await seedInitialOperatingArea();
const { db } = await import('../src/server/db/client');
const { users } = await import('../src/server/db/schema');
const { createAccount } = await import('../src/server/services/accounts');
const { eq } = await import('drizzle-orm');
const { normalizeBdPhone } = await import('../src/server/domain/phone');
const phone = normalizeBdPhone(process.env.E2E_ADMIN_PHONE ?? '');
if (phone) {
  const user = await createAccount(db, { phone, password: process.env.E2E_ADMIN_PASSWORD ?? '', displayName: 'E2E Admin' });
  await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
}
await closeDb();
console.log(`e2e database ${name} ready`);

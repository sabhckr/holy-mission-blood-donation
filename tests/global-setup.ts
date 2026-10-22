import { createDatabase } from '../scripts/create-db';

/** Creates the test database, applies migrations and seeds locations once per run. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://localhost:5432/holy_mission_test';
  process.env.DATABASE_URL = url;
  await createDatabase(url);
  const { runMigrations } = await import('../scripts/migrate');
  const { seedLocations } = await import('../scripts/seed');
  const { closeDb } = await import('../src/server/db/client');
  await runMigrations();
  await seedLocations();
  const { seedInitialOperatingArea } = await import('../src/server/services/operating-areas');
  await seedInitialOperatingArea();
  await closeDb();
}

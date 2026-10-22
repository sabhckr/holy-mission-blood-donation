import { afterEach, describe, expect, it, vi } from 'vitest';
import { appBaseUrl, databaseOptions, migrationDatabaseUrl } from '@/server/config';

afterEach(() => vi.unstubAllEnvs());

describe('deployment configuration', () => {
  it('uses TLS for remote databases and disables prepared statements on the transaction pooler', () => {
    expect(databaseOptions('postgres://localhost:5432/x')).toMatchObject({ prepare: true, ssl: false });
    expect(databaseOptions('postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres')).toMatchObject({ prepare: false, ssl: 'require' });
    expect(databaseOptions('postgres://u:p@db.example.com:5432/x?sslmode=disable').ssl).toBeUndefined();
  });

  it('runs migrations through the session pooler', () => {
    vi.stubEnv('MIGRATION_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres');
    expect(migrationDatabaseUrl()).toBe('postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
    vi.stubEnv('MIGRATION_DATABASE_URL', 'postgres://direct/x');
    expect(migrationDatabaseUrl()).toBe('postgres://direct/x');
  });

  it('falls back to the Vercel production domain for links', () => {
    vi.stubEnv('APP_BASE_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'holy-mission.vercel.app');
    expect(appBaseUrl()).toBe('https://holy-mission.vercel.app');
    vi.stubEnv('APP_BASE_URL', 'https://example.org/');
    expect(appBaseUrl()).toBe('https://example.org');
  });
});

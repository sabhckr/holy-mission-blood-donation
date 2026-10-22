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

describe('integration-provided connection strings', () => {
  it('accepts POSTGRES_URL / POSTGRES_URL_NON_POOLING and strips non-standard parameters', async () => {
    const { databaseUrl } = await import('@/server/config');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('MIGRATION_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL_UNPOOLED', '');
    vi.stubEnv('POSTGRES_URL', 'postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x');
    vi.stubEnv('POSTGRES_URL_NON_POOLING', 'postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require');
    expect(databaseUrl()).toBe('postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require');
    expect(migrationDatabaseUrl()).toBe('postgres://u:p@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require');
    expect(databaseOptions('postgres://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/db?sslmode=require').prepare).toBe(false);
  });
});

describe('separate database password', () => {
  it('fills DATABASE_PASSWORD into a placeholder URL, encoding special characters', async () => {
    const { databaseUrl } = await import('@/server/config');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres.ref:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
    vi.stubEnv('DATABASE_PASSWORD', 'p@ss:w/rd#1%');
    vi.stubEnv('MIGRATION_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL_UNPOOLED', '');
    vi.stubEnv('POSTGRES_URL_NON_POOLING', '');
    const url = new URL(databaseUrl()!);
    expect(decodeURIComponent(url.password)).toBe('p@ss:w/rd#1%');
    expect(url.hostname).toBe('aws-0-ap-southeast-1.pooler.supabase.com');
    expect(new URL(migrationDatabaseUrl()!).password).toBe(url.password);
  });
});

describe('serverless pooling', () => {
  it('uses transaction mode on Vercel for a Supabase session-pooler URL, session mode for migrations', async () => {
    const { databaseUrl } = await import('@/server/config');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('DATABASE_POOL_MODE', '');
    vi.stubEnv('DATABASE_PASSWORD', '');
    vi.stubEnv('MIGRATION_DATABASE_URL', '');
    vi.stubEnv('DATABASE_URL_UNPOOLED', '');
    vi.stubEnv('POSTGRES_URL_NON_POOLING', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres.ref:pw@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
    expect(new URL(databaseUrl()!).port).toBe('6543');
    expect(databaseOptions(databaseUrl()!).prepare).toBe(false);
    expect(new URL(migrationDatabaseUrl()!).port).toBe('5432');
    vi.stubEnv('DATABASE_POOL_MODE', 'session');
    expect(new URL(databaseUrl()!).port).toBe('5432');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('DATABASE_POOL_MODE', '');
    expect(new URL(databaseUrl()!).port).toBe('5432');
  });
});

describe('derived hashing key', () => {
  it('refuses to derive the IP-hashing key from a URL without a real password', async () => {
    const { hashIdentifier } = await import('@/server/domain/ids');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_SECRET', '');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('DATABASE_PASSWORD', '');
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres.ref:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres');
    expect(() => hashIdentifier('1.2.3.4')).toThrow();
    vi.stubEnv('DATABASE_PASSWORD', 'a-real-secret-password');
    const a = hashIdentifier('1.2.3.4');
    vi.stubEnv('DATABASE_PASSWORD', 'another-secret-password');
    expect(hashIdentifier('1.2.3.4')).not.toBe(a);
  });
});

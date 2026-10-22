import { defineConfig, devices } from '@playwright/test';

const PORT = 3200;
export const E2E = {
  baseURL: `http://localhost:${PORT}`,
  // Test-only credentials for the throwaway e2e database.
  adminPhone: '01799000001',
  password: 'Rokto2026test',
};

/**
 * End-to-end tests run against a production build (`npm run build` first) on a throwaway
 * database (holy_mission_e2e) using the locally installed Chrome.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  use: { baseURL: E2E.baseURL, channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 5'], channel: 'chrome' }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npx tsx scripts/e2e-prepare.ts && npx next start -p ${PORT}`,
    url: `${E2E.baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgres://localhost:5432/holy_mission_e2e',
      APP_SECRET: 'e2e-secret-e2e-secret-e2e-secret-1234567',
      APP_BASE_URL: E2E.baseURL,
      COOKIE_SECURE: 'false',
      E2E_ADMIN_PHONE: E2E.adminPhone,
      E2E_ADMIN_PASSWORD: E2E.password,
    },
  },
});

import { expect, test } from '@playwright/test';
import { bn, signIn } from './support';

test('mobile menu works without layout overflow', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.locator('summary', { hasText: bn.common.nav.menu }).click();
  const panel = page.locator('.nav-mobile-panel');
  await expect(panel.getByRole('link', { name: bn.common.nav.findDonors })).toBeVisible();
  await panel.getByRole('link', { name: bn.common.nav.findDonors }).click();
  await expect(page).toHaveURL(/\/donors/);
  await expect(page.getByRole('heading', { level: 1, name: bn.search.title })).toBeVisible();
  for (const path of ['/donors', '/requests', '/requests/new', '/register', '/communities', '/help']) {
    await page.goto(path);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o, path).toBeLessThanOrEqual(1);
  }
});

test('signed-in and admin pages fit a phone screen', async ({ page }) => {
  await signIn(page, '01799000001');
  await page.waitForURL((url) => url.pathname === '/account');
  const paths = [
    '/account',
    '/account/profile',
    '/account/privacy',
    '/communities/new',
    '/admin',
    '/admin/donors',
    '/admin/donors/new',
    '/admin/operating-areas',
    '/admin/communities',
    '/admin/users',
    '/admin/requests',
    '/admin/audit',
  ];
  for (const path of paths) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    const o = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(o, path).toBeLessThanOrEqual(1);
  }
});

import { expect, test } from '@playwright/test';
import { bn } from './support';

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

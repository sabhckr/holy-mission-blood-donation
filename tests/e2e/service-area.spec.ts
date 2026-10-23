import { expect, test } from '@playwright/test';
import { bn, L } from './support';

const LAKSHMIPUR_UPAZILAS = ['কমলনগর', 'রামগঞ্জ', 'রামগতি', 'রায়পুর', 'লক্ষ্মীপুর সদর'];

test('forms offer Lakshmipur only, and home search goes straight to it', async ({ page }) => {
  for (const path of ['/register', '/requests/new']) {
    await page.goto(path);
    // No division or district choice: the district is fixed to Lakshmipur.
    await expect(page.getByLabel(L(bn.common.location.division))).toHaveCount(0);
    await expect(page.locator('.fixed-place').first()).toContainText('লক্ষ্মীপুর');
    const options = await page.getByLabel(L(bn.common.location.upazila)).locator('option').allTextContents();
    expect(options.slice(1).sort(), path).toEqual([...LAKSHMIPUR_UPAZILAS].sort());
  }

  await page.goto('/');
  await expect(page.getByText(bn.common.operatingArea.notice)).toBeVisible();
  await page.getByLabel(bn.common.bloodGroup, { exact: true }).selectOption('O+');
  await page.getByLabel(bn.home.upazilaLabel('লক্ষ্মীপুর')).selectOption({ label: 'রায়পুর' });
  await page.getByRole('button', { name: bn.home.searchButton }).click();
  await page.waitForURL((url) => url.pathname === '/donors');
  expect(new URL(page.url()).searchParams.get('group')).toBe('O+');
  await expect(page.getByRole('heading', { level: 1, name: bn.search.title })).toBeVisible();
});

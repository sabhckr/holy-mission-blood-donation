import { expect, test } from '@playwright/test';
import { bn, en } from './support';

test('Bangla by default, English on request, and the choice is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.getByText(bn.common.slogan, { exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'English' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText(en.common.sloganMeaning)).toBeVisible();
  // The slogan itself is never translated.
  await expect(page.getByText(bn.common.slogan, { exact: true }).first()).toBeVisible();
  await page.goto('/donors');
  await expect(page.getByRole('heading', { level: 1, name: en.search.title })).toBeVisible();
  await page.getByRole('link', { name: 'বাংলা' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
  await expect(page.getByRole('heading', { level: 1, name: bn.search.title })).toBeVisible();
});

test('language switch only redirects to same-site paths', async ({ page }) => {
  const res = await page.goto('/lang?to=en&next=https://evil.example/');
  expect(new URL(res!.url()).origin).toBe(new URL(page.url()).origin);
  expect(new URL(page.url()).pathname).toBe('/');
});

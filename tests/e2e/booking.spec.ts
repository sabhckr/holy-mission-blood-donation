import { expect, test } from '@playwright/test';
import { bn, en, L, testPhone } from './support';

const dhakaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const plusDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400e3).toISOString().slice(0, 10);

test('booking form offers today to 15 days ahead and stops a later date before sending', async ({ page }) => {
  await page.goto('/requests/new?group=A%2B');
  const date = page.getByLabel(L(bn.request.neededDate));
  const today = dhakaToday();
  await expect(date).toHaveAttribute('min', today);
  await expect(date).toHaveAttribute('max', plusDays(today, 15));

  await page.getByLabel(L(bn.common.location.upazila)).selectOption({ label: 'রায়পুর' });
  await page.getByLabel(L(bn.request.hospitalLabel)).fill('রায়পুর উপজেলা স্বাস্থ্য কমপ্লেক্স');
  await date.fill(plusDays(today, 16));
  await page.getByLabel(L(bn.request.neededTime)).fill('10:00');
  await page.getByRole('radio', { name: bn.common.urgency.normal, exact: true }).check();
  await page.getByLabel(L(bn.request.requesterName)).fill('রহিম');
  await page.getByLabel(L(bn.request.requesterPhone)).fill(testPhone());
  await page.getByLabel(L(bn.request.confirmGenuine)).check();
  await page.getByRole('button', { name: bn.request.submit }).click();
  await expect(page.getByText(bn.validation.tooFarAhead)).toBeVisible();
  await expect(page.locator('.ref-id')).toHaveCount(0);

  // Exactly 15 days ahead is accepted.
  await date.fill(plusDays(today, 15));
  await page.getByRole('button', { name: bn.request.submit }).click();
  await expect(page.locator('.ref-id')).toBeVisible();
});

test('a half-filled booking survives switching the language', async ({ page }) => {
  await page.goto('/requests/new');
  await page.getByLabel(L(bn.request.hospitalLabel)).fill('Lakshmipur Sadar Hospital');
  await page.getByLabel(L(bn.request.unitsLabel)).fill('3');
  await page.getByLabel(L(bn.common.location.upazila)).selectOption({ label: 'রামগতি' });
  await page.getByRole('link', { name: 'English' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByLabel(L(en.request.hospitalLabel))).toHaveValue('Lakshmipur Sadar Hospital');
  await expect(page.getByLabel(L(en.request.unitsLabel))).toHaveValue('3');
  await expect(page.getByLabel(L(en.common.location.upazila)).locator('option:checked')).toHaveText('Ramgati');
});

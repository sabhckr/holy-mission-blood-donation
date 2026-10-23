import { expect, test } from '@playwright/test';
import { bn, L, Lp, PASSWORD, registerDonor, signIn, signOut, testPhone } from './support';

test('donor registers and is in search straight away, with privacy, and another user reveals the number', async ({ page }) => {
  const donorPhone = testPhone();
  await registerDonor(page, { name: 'রাকিব হাসান', phone: donorPhone, group: 'AB-' });
  await expect(page).toHaveURL(/\/account/);
  await signOut(page);
  // No staff approval: the new donor is searchable immediately (they chose to be listed and can donate now).

  // Anonymous search: the donor is found, shown with a shortened name and no number.
  await page.goto('/donors?group=AB-');
  await expect(page.getByText(bn.search.resultCount('১'))).toBeVisible();
  const card = page.locator('article', { hasText: 'রাকিব হা.' });
  await expect(card).toBeVisible();
  await expect(page.locator('body')).not.toContainText(donorPhone.slice(-6));
  await card.getByRole('link').first().click();
  await expect(page.getByText(bn.donor.contactSignIn)).toBeVisible();

  // A second person creates an account and reveals the number (consent: signed-in users).
  const seekerPhone = testPhone();
  await page.goto('/register/account');
  await page.getByLabel(L(bn.auth.displayName)).fill('করিম');
  await page.getByLabel(L(bn.auth.phone)).fill(seekerPhone);
  await page.getByLabel(L(bn.auth.password)).fill(PASSWORD);
  await page.getByLabel(L(bn.auth.confirmPassword)).fill(PASSWORD);
  await page.getByLabel(Lp(bn.auth.acceptPrivacy)).check();
  await page.getByRole('button', { name: bn.auth.accountButton }).click();
  await page.waitForURL((url) => url.pathname === '/account');
  await page.goto('/donors?group=AB-');
  await page.locator('article', { hasText: 'রাকিব হাসান' }).getByRole('link').first().click();
  await page.getByRole('button', { name: bn.common.actions.showNumber }).click();
  await expect(page.locator('.phone-reveal')).toContainText(donorPhone.slice(-6));

  // Ordinary users cannot open the admin area.
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);

  // Wrong password gives the generic message.
  await signOut(page);
  await signIn(page, donorPhone, 'definitely-wrong-1');
  await expect(page.getByText(bn.errors.invalid_credentials)).toBeVisible();
});

test('registration shows server-side validation in Bangla', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: bn.auth.registerButton }).click();
  await expect(page.getByText(bn.errors.validation)).toBeVisible();
  await expect(page.getByText(bn.validation.invalidBloodGroup)).toBeVisible();
  await expect(page.getByText(bn.validation.mustAccept).first()).toBeVisible();
});

test('anonymous blood request: create, keep the private link, then close it', async ({ page }) => {
  await page.goto('/requests/new?group=B%2B');
  await page.getByLabel(L(bn.request.unitsLabel)).fill('2');
  // Lakshmipur only: the district is fixed, so only the upazila is chosen.
  await page.getByLabel(L(bn.common.location.upazila)).selectOption({ label: 'রামগঞ্জ' });
  await page.getByLabel(L(bn.request.hospitalLabel)).fill('লক্ষ্মীপুর সদর হাসপাতাল');
  const tomorrow = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
  await page.getByLabel(L(bn.request.neededDate)).fill(tomorrow);
  await page.getByLabel(L(bn.request.neededTime)).fill('10:30');
  await page.getByRole('radio', { name: bn.common.urgency.urgent, exact: true }).check();
  await page.getByLabel(L(bn.request.requesterName)).fill('করিম');
  await page.getByLabel(L(bn.request.requesterPhone)).fill(testPhone());
  await page.getByLabel(L(bn.request.confirmGenuine)).check();
  await page.getByRole('button', { name: bn.request.submit }).click();
  const link = page.locator('a[href*="/requests/manage/"]').first();
  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  // Only after the server saved it: the real reference number, the saved details and an honest note.
  await expect(page.getByText(bn.request.createdSavedTitle)).toBeVisible();
  await expect(page.locator('.ref-id')).toHaveText(/^[a-z0-9]{6,20}$/);
  await expect(page.locator('.created-saved')).toContainText('লক্ষ্মীপুর সদর হাসপাতাল');
  await expect(page.getByText(bn.request.createdNotGuaranteed)).toBeVisible();

  // Public board shows it without the requester's details.
  await page.goto('/requests');
  await expect(page.getByText('লক্ষ্মীপুর সদর হাসপাতাল').first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('করিম');

  await page.goto(href!);
  await page.getByLabel(L(bn.request.newStatus)).selectOption('fulfilled');
  await page.getByRole('button', { name: bn.request.changeStatus }).click();
  await expect(page.getByText(bn.common.requestStatus.fulfilled).first()).toBeVisible();
  await page.goto('/requests');
  await expect(page.getByText('লক্ষ্মীপুর সদর হাসপাতাল')).toHaveCount(0);
});

test('admin can sign in and see the overview', async ({ page }) => {
  await signIn(page, '01799000001');
  await page.waitForURL((url) => url.pathname === '/account');
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

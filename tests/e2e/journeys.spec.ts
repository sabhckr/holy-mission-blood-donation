import { expect, test } from '@playwright/test';
import { bn, L, Lp, PASSWORD, registerDonor, signIn, signOut, testPhone } from './support';

test('donor registers and is in search straight away, and a signed-in user reveals the number', async ({ page }) => {
  const donorPhone = testPhone();
  await registerDonor(page, { name: 'রাকিব হাসান', phone: donorPhone, group: 'AB-' });
  await expect(page).toHaveURL(/\/account/);
  await signOut(page);
  // No staff approval: the new donor is searchable immediately (they chose to be listed and can donate now).

  // Anonymous search: the donor is found with their full name; the number is not in the page.
  await page.goto('/donors?group=AB-');
  await expect(page.getByText(bn.search.resultCount('১'))).toBeVisible();
  await expect(page.locator('article', { hasText: 'রাকিব হাসান' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(donorPhone.slice(-6));

  // A second person creates an account and reveals the number too.
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

test('anyone can see a donor’s details and call them, without an account', async ({ page }) => {
  const donorPhone = testPhone();
  await registerDonor(page, { name: 'সুমাইয়া আক্তার', phone: donorPhone, group: 'B-' });
  await signOut(page);

  await page.goto('/donors?group=B-');
  await page.locator('article', { hasText: 'সুমাইয়া আক্তার' }).getByRole('link').first().click();
  // The number is not in the page until the visitor asks for it.
  await expect(page.locator('body')).not.toContainText(donorPhone.slice(-6));
  await expect(page.getByText(bn.donor.contactSignIn)).toHaveCount(0);
  await page.getByRole('button', { name: bn.common.actions.showNumber }).click();
  await expect(page.locator('.phone-reveal')).toContainText(donorPhone.slice(-6));
  await expect(page.locator('a[href^="tel:"]')).toBeVisible();
  // Messages through the site still need an account; calling does not.
  await expect(page.getByRole('link', { name: bn.donor.messageSignIn })).toBeVisible();
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

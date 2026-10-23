import type { Page } from '@playwright/test';
import { getMessages } from '../../src/i18n/messages';

export const bn = getMessages('bn');
export const en = getMessages('en');
export const PASSWORD = 'Rokto2026test';

/** Exact label match, allowing the visual required marker "*" that follows required labels. */
export function L(text: string): RegExp {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\*?\\s*$`);
}

/** Label that starts with the text (labels that also contain links). */
export function Lp(text: string): RegExp {
  return new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

let counter = 0;
/** Unique test phone numbers per run (the e2e database is recreated every run). */
export function testPhone(): string {
  counter += 1;
  return `0177${String(Math.floor(Math.random() * 90_000) + 10_000)}${String(counter).padStart(2, '0')}`;
}

export async function registerDonor(page: Page, opts: { name: string; phone: string; group?: string; phoneVisibility?: 'public' | 'signed_in' }) {
  const t = bn;
  await page.goto('/register');
  await page.getByLabel(L(t.auth.fullName)).fill(opts.name);
  await page.getByLabel(L(t.auth.phone)).fill(opts.phone);
  await page.getByLabel(L(t.auth.password)).fill(PASSWORD);
  await page.getByLabel(L(t.auth.confirmPassword)).fill(PASSWORD);
  await page.getByLabel(L(t.auth.dateOfBirth)).fill('1995-04-12');
  await page.getByRole('radio', { name: opts.group ?? 'O+', exact: true }).check();
  // Lakshmipur only: the district is fixed, so only the upazila is chosen.
  await page.getByLabel(L(t.common.location.upazila)).selectOption({ label: 'রায়পুর' });
  await page.getByLabel(L(t.auth.availableNow)).check();
  await page.getByLabel(L(t.auth.listedInSearch)).check();
  await page.getByLabel(L(t.auth.phoneVisibility)).selectOption(opts.phoneVisibility ?? 'signed_in');
  await page.getByLabel(Lp(t.auth.acceptPrivacy)).check();
  await page.getByLabel(L(t.auth.confirmTruth)).check();
  await page.getByRole('button', { name: t.auth.registerButton }).click();
  await page.waitForURL((url) => url.pathname === '/account');
}

export async function signIn(page: Page, phone: string, password = PASSWORD) {
  await page.goto('/signin');
  await page.getByLabel(L(bn.auth.phone)).fill(phone);
  await page.getByLabel(L(bn.auth.password)).fill(password);
  await page.getByRole('button', { name: bn.auth.signInButton }).click();
}

export async function signOut(page: Page) {
  await page.context().clearCookies({ name: 'hm_session' });
}

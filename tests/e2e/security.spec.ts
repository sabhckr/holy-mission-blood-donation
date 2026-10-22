import { expect, test } from '@playwright/test';

test('admin area is invisible to visitors and account pages require sign-in', async ({ page, request }) => {
  const admin = await request.get('/admin', { maxRedirects: 0 });
  expect([307, 308, 303]).toContain(admin.status()); // not signed in → sign-in redirect
  await page.goto('/account');
  await expect(page).toHaveURL(/\/signin\?next=%2Faccount/);
});

test('state-changing route handlers reject cross-site requests', async ({ request }) => {
  const res = await request.post('/signout', { headers: { origin: 'https://evil.example' }, maxRedirects: 0 });
  expect(res.status()).toBe(403);
});

test('security headers are present', async ({ request }) => {
  const res = await request.get('/');
  const h = res.headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-/);
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-powered-by']).toBeUndefined();
});

import { test, expect } from '@playwright/test';

// Minimal smoke test that verifies the app responds at the configured baseURL.
// The running server should be started by the user on http://localhost:3001.
test('smoke: server responds', async ({ page, baseURL }) => {
  const url = baseURL ?? 'http://localhost:3001';
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Ensure we got an HTTP response and it's in the 2xx/3xx range.
  expect(resp).not.toBeNull();
  expect(resp && resp.status() >= 200 && resp.status() < 400).toBeTruthy();
});

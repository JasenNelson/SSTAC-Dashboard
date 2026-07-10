import { test as setup } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const authDir = path.join(__dirname, '.auth');
const userState = path.join(authDir, 'user.json');

// Lane B: authenticate a reviewer user and persist the session so the
// authenticated Playwright project can run the gated Matrix Options specs.
// This setup project is only added to the project list when
// E2E_TEST_EMAIL / E2E_TEST_PASSWORD are set, so it never runs (and CI stays
// green) without the secret.
setup('authenticate reviewer', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  setup.skip(!email || !password, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD not set');

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input#email').fill(email as string);
  await page.locator('input#password').fill(password as string);
  // Submit and capture the Supabase auth response. Keying on the token call
  // (not only the redirect) makes failures LOUD and specific: a bad password /
  // rate limit / wrong project surfaces as a non-200 here instead of a generic
  // URL-timeout, and it is robust to a slow post-login redirect under
  // `next dev` cold-compile in CI.
  const [tokenResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/auth/v1/token') && r.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.locator('button[type="submit"]').click(),
  ]);

  // Fail closed with a precise reason if auth did not succeed.
  if (tokenResp.status() !== 200) {
    const body = await tokenResp.text().catch(() => '');
    throw new Error(
      `Login failed: Supabase auth token endpoint returned ${tokenResp.status()}. ` +
        `Verify E2E_TEST_EMAIL/E2E_TEST_PASSWORD match a confirmed user in the CI Supabase ` +
        `project. Response: ${body.slice(0, 300)}`,
    );
  }

  // Auth succeeded and the session cookie is set; the post-login redirect to
  // /dashboard can lag under cold-compile, so allow generously (still fail-closed).
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: userState });
});

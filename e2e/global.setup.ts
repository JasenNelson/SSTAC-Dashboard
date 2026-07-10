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
  await page.locator('button[type="submit"]').click();
  // Fail closed: success is a redirect off /login; throws on timeout if login failed.
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: userState });
});

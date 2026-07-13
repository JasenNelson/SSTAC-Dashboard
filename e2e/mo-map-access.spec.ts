import { expect, type Page, test } from '@playwright/test';

// T40 Lane 3: member-vs-admin Matrix Map access. Skip-safe by construction:
// - Unauthenticated projects (chromium/firefox/webkit): /matrix-options is middleware-gated, so we
//   assert the /login bounce.
// - The authenticated project (chromium-auth) runs the MEMBER fixture (sstac-e2e-reviewer, role
//   member) and is only added to the project list when E2E creds + E2E_AUTH_ENABLED are present, so
//   these member assertions no-op in the current secret-free CI (steady state e2e 120 pass / 93 skip).
// ADMIN-tier positive coverage (admin sees the full capped set, no partial-visibility banner, can
// reach /admin/matrix-map/publish) requires a SECOND admin-role test user + storageState -- an OWNER
// GATE, documented in docs/MATRIX_OPTIONS_T40_ADMIN_TIER_OWNER_GATE_2026_07_12.md. Not exercised here.

// Mirror of the clickUntilVisible helper in matrix-options.spec.ts (tab open is retry-flaky under
// cold-compile dev server).
async function clickUntilVisible(page: Page, triggerName: string, visibleTestId: string) {
  const trigger = page.getByRole('button', { name: triggerName, exact: true });
  const target = page.getByTestId(visibleTestId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.waitForTimeout(500);
    if (await target.isVisible({ timeout: 1000 }).catch(() => false)) return;
  }
  await expect(target).toBeVisible();
}

test.describe('Matrix Map member visibility (T40)', () => {
  test('interactive map: authenticated member reaches it and sees the partial-visibility banner; unauth bounces to /login', async ({ page }, testInfo) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });

    if (testInfo.project.name === 'chromium-auth') {
      // Authenticated MEMBER: not bounced; the Matrix Options dashboard renders.
      await expect(page).not.toHaveURL(/\/login/);
      await expect(
        page.getByRole('heading', { name: 'Matrix Options', exact: true }),
      ).toBeVisible({ timeout: 15_000 });

      // Open the embedded Interactive Map tab.
      await clickUntilVisible(page, 'Interactive Map', 'matrix-options-interactive-map-embed');

      // Member-only differentiator: the partial-visibility banner surfaces samples hidden behind
      // private DRAs. Members see it whenever any DRA is private (the normal/pilot state -- 571 private
      // as of 2026-07-12); admins never see it (the admin-bypass RPC forces hidden counts to 0, so the
      // banner self-suppresses). We assert PRESENCE + structure, NOT literal hidden counts (which the
      // T40 readiness doc warns are data-dependent). If every DRA is ever published, this assertion
      // would flip -- itself a meaningful signal, not silent drift.
      const banner = page.getByTestId('matrix-map-partial-visibility-banner');
      await expect(banner).toBeVisible({ timeout: 15_000 });
      await expect(
        banner.getByRole('heading', { name: 'Hidden samples behind private DRAs' }),
      ).toBeVisible();
      // Member-facing affordances (NOT admin publish controls): request access, not mutate visibility.
      // "Contact admin" is a mailto <a> link; "Refresh" is the sole <button>. Assert both roles as
      // rendered by PartialVisibilityBanner.
      await expect(banner.getByRole('link', { name: 'Contact admin' })).toBeVisible();
      await expect(banner.getByRole('button', { name: 'Refresh matrix map samples' })).toBeVisible();
    } else {
      // Unauthenticated: /matrix-options is middleware-gated.
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('standalone /matrix-map: unauthenticated hit lands on /login (component redirect)', async ({ page }, testInfo) => {
    await page.goto('/matrix-map', { waitUntil: 'domcontentloaded' });
    if (testInfo.project.name === 'chromium-auth') {
      // Authenticated member: must actually LAND on /matrix-map (not merely avoid /login). Asserting
      // the positive destination catches a regression that wrongly denies the member and bounces to
      // /dashboard -- a plain not(/login) would pass on that wrong destination.
      await expect(page).toHaveURL(/\/matrix-map/);
    } else {
      // Unauthenticated: the server component redirects to /login.
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

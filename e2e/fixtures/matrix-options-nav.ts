import { expect, type Locator, type Page, test } from '@playwright/test';

// Shared navigation + readiness helpers for every e2e spec that visits
// /matrix-options and then interacts with a primary tab. Factored out after
// the fix for the SSR-vs-hydration race (see gotoMatrixOptionsOrSkip below)
// was applied to matrix-options.spec.ts only, while mo-map-access.spec.ts and
// ssd-workbench.spec.ts carried their own unpatched copies -- the same defect
// under a different filename. Do not fork this file per-spec again; import it.

// The one project that is SUPPOSED to be authenticated. Everywhere else, landing
// on /login is an expected environment condition; here it is a failure.
const AUTHENTICATED_PROJECT = 'chromium-auth';

// /matrix-options is auth-gated (middleware matcher) as of 2026-06-15. CI has no
// shared auth storageState, so auth-dependent assertions are explicitly guarded and
// skipped if we land on /login.
//
// EXCEPT under the authenticated project. Skipping unconditionally here silently
// deleted the T40 member-visibility guarantee the moment member credentials
// expired: the suite would report all-green while no longer checking the thing
// the test exists to check. A skip is the correct response to "this environment
// has no credentials"; it is the wrong response to "the credentials we were
// given did not work". Only the second case can occur under chromium-auth.
export async function gotoMatrixOptionsOrSkip(page: Page): Promise<void> {
  await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) {
    if (test.info().project.name === AUTHENTICATED_PROJECT) {
      throw new Error(
        `Bounced to /login under the "${AUTHENTICATED_PROJECT}" project, which runs with a ` +
          'storageState that is supposed to be authenticated. The stored session has most ' +
          'likely expired -- regenerate it. Failing rather than skipping, so this cannot ' +
          'silently remove authenticated coverage from a green run.',
      );
    }
    test.skip(true, 'Not authenticated; /matrix-options is gated. Skipping authenticated assertions.');
  }
  // Deterministic readiness (replaces a blind fixed-timeout settle): the authenticated
  // page renders the MatrixDashboard h1 exactly "Matrix Options". Waiting on it resolves
  // as soon as the dashboard is interactive instead of after a fixed timeout, and
  // fails loudly if the authed page never renders. Runs only under auth (post-skip).
  await expect(
    page.getByRole('heading', { name: 'Matrix Options', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  // ...but that h1 is present in the SSR markup, so it resolves BEFORE React
  // has client-rendered the dashboard. In that window every tab button exists
  // with correct role/ARIA/tabindex yet carries NO event handlers, and the
  // client render then REPLACES those nodes (dropping DOM focus to <body>).
  // A click or keyboard interaction against that window lands on inert
  // markup: the click/keydown reaches a node with no handler and nothing
  // happens, which under a cold dev-server compile (e.g. first paint of the
  // Leaflet-backed Interactive Map) can outlast a bounded retry loop. Gate on
  // the mount-only readiness marker that MatrixDashboard sets on the primary
  // tablist, which by construction can only exist on the live, interactive
  // render.
  await expect(
    page.locator('[role="tablist"][data-primary-tablist-ready="true"]'),
  ).toBeAttached({ timeout: 15_000 });
}

// Clicks `triggerName`'s primary tab until `visibleTarget` appears, retrying
// to absorb any residual render flakiness after the readiness gate above.
// Kept as a belt-and-suspenders retry (not a substitute for the gate): the
// gate guarantees the FIRST click lands on a hydrated node; this loop still
// protects later tab switches within a test against slow panel mounts.
export async function clickUntilVisible(
  page: Page,
  triggerName: string,
  visibleTarget: string | Locator,
): Promise<void> {
  const trigger = page.getByRole('tab', {
    name: triggerName,
    exact: true,
  });
  const target =
    typeof visibleTarget === 'string'
      ? page.getByTestId(visibleTarget)
      : visibleTarget;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.waitForTimeout(500);
    if (await target.isVisible({ timeout: 1000 }).catch(() => false)) {
      return;
    }
  }

  await expect(target).toBeVisible();
}

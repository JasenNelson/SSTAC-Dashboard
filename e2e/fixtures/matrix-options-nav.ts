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
const PRIMARY_READY_SELECTOR = '[role="tablist"][data-primary-tablist-ready="true"]';
const MAX_CLIENT_ERROR_CLASSES = 4;
const DIAGNOSTIC_DEADLINE_MS = 1_500;

type ClientErrorClass = 'type' | 'reference' | 'syntax' | 'range' | 'uri' | 'other';

export function clientErrorClass(error: unknown): ClientErrorClass {
  let name: unknown;
  try {
    name = error && typeof error === 'object' ? Reflect.get(error, 'name') : undefined;
  } catch {
    return 'other';
  }
  switch (name) {
    case 'TypeError': return 'type';
    case 'ReferenceError': return 'reference';
    case 'SyntaxError': return 'syntax';
    case 'RangeError': return 'range';
    case 'URIError': return 'uri';
    default: return 'other';
  }
}

export function navigationUrlCategory(url: string): 'matrix-options' | 'login' | 'other' | 'unknown' {
  try {
    const path = new URL(url).pathname;
    if (path === '/matrix-options' || path.startsWith('/matrix-options/')) return 'matrix-options';
    if (path === '/login' || path.startsWith('/login/')) return 'login';
    return 'other';
  } catch {
    return 'unknown';
  }
}

function boundedCount(value: unknown): number | 'unknown' {
  return Number.isSafeInteger(value) && Number(value) >= 0
    ? Math.min(Number(value), 99)
    : 'unknown';
}

function fixedReadyAttribute(value: unknown): 'true' | 'false' | 'missing' | 'other' {
  if (value === null || value === undefined) return 'missing';
  if (value === 'true' || value === 'false') return value;
  return 'other';
}

export async function navigationTimeoutDiagnostic(
  page: Page,
  clientErrors: readonly ClientErrorClass[],
  clientErrorOverflow: boolean,
) {
  const safeCount = async (locator: Locator): Promise<number | 'unknown'> => {
    try { return boundedCount(await locator.count()); } catch { return 'unknown'; }
  };
  const headingCount = await safeCount(page.getByRole('heading', { name: 'Matrix Options', exact: true }));
  const tablistCount = await safeCount(page.locator('[role="tablist"]'));
  const readyCount = await safeCount(page.locator(PRIMARY_READY_SELECTOR));
  let documentState: unknown;
  try {
    documentState = await page.evaluate(() => {
      const independentSentinel = document.querySelector('form[data-hydrated], [data-testid="workspace-shell"][data-hydrated]');
      return {
        readyState: document.readyState,
        readyAttribute: document.querySelector('[role="tablist"]')?.getAttribute('data-primary-tablist-ready') ?? null,
        hydrationSentinel: independentSentinel?.getAttribute('data-hydrated') ?? null,
      };
    });
  } catch { documentState = null; }
  const rawReadyState = documentState && typeof documentState === 'object'
    ? Reflect.get(documentState, 'readyState') : undefined;
  const rawReadyAttribute = documentState && typeof documentState === 'object'
    ? Reflect.get(documentState, 'readyAttribute') : undefined;
  const rawSentinel = documentState && typeof documentState === 'object'
    ? Reflect.get(documentState, 'hydrationSentinel') : undefined;
  return {
    urlCategory: navigationUrlCategory(page.url()),
    headingCount,
    tablistCount,
    ready: readyCount === 'unknown' ? 'unknown' : readyCount > 0,
    readyAttribute: fixedReadyAttribute(rawReadyAttribute),
    documentReadyState: rawReadyState === 'loading' || rawReadyState === 'interactive' || rawReadyState === 'complete'
      ? rawReadyState : 'unknown',
    hydrationSentinel: rawSentinel === 'true' ? 'ready' : rawSentinel === 'false' ? 'not-ready' : 'unknown',
    clientErrorClasses: clientErrors.slice(0, MAX_CLIENT_ERROR_CLASSES),
    clientErrorOverflow: clientErrorOverflow || clientErrors.length > MAX_CLIENT_ERROR_CLASSES,
  };
}

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
  const clientErrors: ClientErrorClass[] = [];
  let clientErrorOverflow = false;
  const onPageError = (error: Error) => {
    if (clientErrors.length < MAX_CLIENT_ERROR_CLASSES) clientErrors.push(clientErrorClass(error));
    else clientErrorOverflow = true;
  };
  page.on('pageerror', onPageError);
  try {
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
    try {
      await expect(page.locator(PRIMARY_READY_SELECTOR)).toBeAttached({ timeout: 15_000 });
    } catch (assertion) {
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        const diagnostic = await Promise.race([
          navigationTimeoutDiagnostic(page, clientErrors, clientErrorOverflow),
          new Promise<{ capture: 'unavailable' }>((resolve) => {
            deadline = setTimeout(() => resolve({ capture: 'unavailable' }), DIAGNOSTIC_DEADLINE_MS);
          }),
        ]);
        console.error(`MATRIX_OPTIONS_NAV_TIMEOUT ${JSON.stringify(diagnostic)}`);
      } catch {
        console.error('MATRIX_OPTIONS_NAV_TIMEOUT {"capture":"unavailable"}');
      } finally {
        if (deadline) clearTimeout(deadline);
      }
      throw assertion;
    }
  } finally {
    page.off('pageerror', onPageError);
  }
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

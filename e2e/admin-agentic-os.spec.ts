// Agentic OS admin page Playwright E2E (step 12 of the MVP).
//
// Hermetic setup:
//   - KNOWLEDGE_BASE_PATH    -> e2e/fixtures/agentic-os/knowledge-base
//   - AGENTIC_OS_LOCAL=true  -> lets launch route gate 1 pass outside dev mode
//   - AGENTIC_OS_SPAWN_STUB  -> swaps spawnAwaitingReady's real spawn for a
//                                fake EventEmitter that emits `[stub] launched`
//                                + close 0. NO real `claude` / `wt.exe` is
//                                invoked. ALL six gates (feature flag,
//                                localhost, CSRF, admin auth, payload, allowlist)
//                                still run their production code path; only
//                                the syscall is replaced.
//
// To run locally (from repo root):
//   KB="$PWD/e2e/fixtures/agentic-os/knowledge-base"
//   AGENTIC_OS_LOCAL=true AGENTIC_OS_SPAWN_STUB=true KNOWLEDGE_BASE_PATH="$KB" \
//     npm run test:e2e -- --project=chromium agentic-os
//
// Auth pattern: the existing dashboard E2E suite (admin-dashboard.spec.ts,
// matrix-admin-rbac.spec.ts) uses a "skip if redirected to /login" approach
// rather than a storageState fixture, because there is no shared
// auth-helper / setup project yet. This spec follows that precedent. The
// unauthenticated case is asserted directly (must redirect to /login);
// the authenticated cases skip cleanly when the runner is not logged in
// as an admin (CI gap documented in the README). A storageState-based
// auth fixture would be a follow-up across the whole e2e/ tree.
//
// Step 9 (xterm.js inline modal) is intentionally deferred and out of
// scope; the spec asserts the "Open" row button is disabled with the
// reserved-for-step-9 tooltip.

import { test, expect, type Page } from '@playwright/test';

const AGENTIC_OS_URL = '/admin/agentic-os';

// Hard-coded names that MUST match the PROJECTS_MAP.md fixture AND the
// launch validator's ALLOWED_PROJECTS. If you rename the fixture projects,
// rename them here too.
const PROJ_1 = 'SSTAC-Dashboard';   // has test-skill + test-agent
const PROJ_2 = 'Site3250-KB';        // empty-state for skills + agents

/**
 * Navigate to the admin Agentic OS page and decide whether we are
 * authenticated. If the dev server bounced us to /login, the caller
 * should skip; that is the pattern used elsewhere in this e2e/ tree
 * (admin-dashboard.spec.ts) and accounts for CI runs that do not yet
 * have an admin storageState fixture.
 */
async function gotoAgenticOsOrSkip(page: Page): Promise<void> {
  await page.goto(AGENTIC_OS_URL);
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    test.skip(true, 'Not authenticated as admin; skipping authenticated assertions.');
  }
}

test.describe('Agentic OS admin page', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mirror admin-dashboard.spec.ts: navigate before clearing storage so
    // Firefox/WebKit security model lets us touch localStorage / sessionStorage.
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
  });

  test('unauthenticated -> redirects to /login', async ({ page }) => {
    // Page is admin-gated server-side (page.tsx redirects to /login when
    // there is no Supabase user). The redirect MUST happen even with the
    // feature flag on; the gate is not a "view-only when public" thing.
    await page.goto(AGENTIC_OS_URL, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('renders the project table from PROJECTS_MAP.md fixture', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    // "All projects" h2 -- emitted by AgenticOsClient main pane header.
    await expect(page.getByRole('heading', { name: /all projects/i })).toBeVisible();

    // Both fixture projects appear in the table. compactName() may shorten
    // long names, so we match on a substring rather than an exact equality.
    await expect(page.getByRole('row', { name: new RegExp(PROJ_1, 'i') })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(PROJ_2, 'i') })).toBeVisible();

    // AdminFunctionsNav pill bar shows Agentic OS entry.
    await expect(page.getByRole('link', { name: /agentic os/i }).first()).toBeVisible();

    // Convergence graph renders an SVG container. The component embeds an
    // inline <svg> for the nodes/edges; assert at least one is present.
    await expect(page.locator('section, div').filter({ hasText: /convergence graph/i }).first()).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('Skill v dropdown surfaces baseline skills + discovered test-skill', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    // Locate the row for PROJ_1 (test-project-1, which has .claude/skills/test-skill).
    const row = page.getByRole('row', { name: new RegExp(PROJ_1, 'i') });
    await expect(row).toBeVisible();

    // Click "Skill v" summary inside that row. Native <details>; click on
    // the summary toggles open.
    await row.getByText(/^skill v$/i).click();

    // The three Pattern A baselines live as buttons; assert each.
    await expect(page.getByRole('button', { name: '/safe-exit' })).toBeVisible();
    await expect(page.getByRole('button', { name: '/update-docs' })).toBeVisible();
    await expect(page.getByRole('button', { name: '/doc-navigator' })).toBeVisible();

    // Discovered skill (slug = "test-skill") appears below the divider.
    await expect(page.getByText('/test-skill').first()).toBeVisible();
  });

  test('Agent v dropdown surfaces discovered project agent', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    const row = page.getByRole('row', { name: new RegExp(PROJ_1, 'i') });
    await row.getByText(/^agent v$/i).click();

    // The discovered agent has slug "test-agent" rendered in font-mono text.
    await expect(page.getByText('test-agent').first()).toBeVisible();
  });

  test('empty-state project shows no-skills + no-agents placeholders', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    const row = page.getByRole('row', { name: new RegExp(PROJ_2, 'i') });
    await expect(row).toBeVisible();

    await row.getByText(/^skill v$/i).click();
    await expect(page.getByText(/no skills discovered for this project/i).first()).toBeVisible();
    // Close before opening the other details so we don't fight stacking-context.
    await row.getByText(/^skill v$/i).click();

    await row.getByText(/^agent v$/i).click();
    // Either "No project agents" or "No project agents; see global agents below"
    // -- the wording branches on whether there are any global agents on the
    // runner's home dir. Match the common prefix.
    await expect(page.getByText(/no project agents/i).first()).toBeVisible();
  });

  test('Pattern A launch (/safe-exit) streams the stub output and resolves to exit 0', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    const row = page.getByRole('row', { name: new RegExp(PROJ_1, 'i') });
    await row.getByText(/^skill v$/i).click();
    await page.getByRole('button', { name: '/safe-exit' }).click();

    // Log card with the canned stub line. The TerminalPanel renders each
    // stdout line individually; matching on a substring of the stub line is
    // enough proof the SSE pipe + render path worked end-to-end.
    await expect(page.getByText(/\[stub\] launched claude -p \/safe-exit/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/\[stub\] done/i)).toBeVisible();

    // Status pill resolves to "exit 0" once the stub fires close(0).
    await expect(page.getByText(/exit 0/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Pattern B [ ] external launch renders the no-inline-output empty state', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    const row = page.getByRole('row', { name: new RegExp(PROJ_1, 'i') });
    // The button literal is "[ ] external" (with a trailing " ..." when busy).
    await row.getByRole('button', { name: /\[ \] external/i }).click();

    // After clicking, the new run card appears. For open_session the
    // TerminalPanel renders a different empty-state copy than Pattern A
    // because wt.exe exits immediately and produces no stdout. Match on
    // the post-NIT-1 wording (TerminalPanel.tsx:162).
    await expect(
      page.getByText(/external terminal opened on your desktop; no inline output expected/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Pattern D agent launch (test-agent) appears in the log panel', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    const row = page.getByRole('row', { name: new RegExp(PROJ_1, 'i') });
    await row.getByText(/^agent v$/i).click();

    // Click the discovered test-agent button. The button title attribute
    // contains "Run claude --agent test-agent --bg in ..." so we can find
    // it precisely via role=button + name regex on the slug.
    const btn = page.getByRole('button', { name: /^test-agent($|\s)/i }).first();
    await btn.click();

    // Stub canned output: "[stub] launched claude --agent test-agent --bg ..."
    await expect(page.getByText(/\[stub\] launched claude --agent test-agent/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('close-card button removes the run card', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    const row = page.getByRole('row', { name: new RegExp(PROJ_1, 'i') });
    await row.getByText(/^skill v$/i).click();
    await page.getByRole('button', { name: '/safe-exit' }).click();

    // Wait for the log card to materialize.
    const stubLine = page.getByText(/\[stub\] launched claude -p \/safe-exit/i);
    await expect(stubLine).toBeVisible({ timeout: 10_000 });

    // The close button is aria-labeled "Close run <runId>". We don't know
    // the runId statically; match the aria-label prefix.
    const closeBtn = page.getByRole('button', { name: /^close run /i }).first();
    await closeBtn.click();

    // The stub line must disappear from the DOM once the card is removed.
    await expect(stubLine).toHaveCount(0);
  });

  test('"Open" inline-terminal button is disabled (reserved for step 9)', async ({ page }) => {
    await gotoAgenticOsOrSkip(page);

    const row = page.getByRole('row', { name: new RegExp(PROJ_1, 'i') });
    const openBtn = row.getByRole('button', { name: /^open$/i });
    await expect(openBtn).toBeDisabled();
  });
});

# MATRIX_OPTIONS_E2E_AUTH_VISIBILITY_PACKET_2026_07_08

## Decision

Implement a small auth-visibility assertion in Matrix Options E2E instead of relying only on
`test.skip` for unauthenticated runs.

## Scope

Owned paths:

- `e2e/matrix-options.spec.ts`
- `docs/MATRIX_OPTIONS_E2E_AUTH_VISIBILITY_PACKET_2026_07_08.md`

## What Changed

In `e2e/matrix-options.spec.ts`:

- Kept the existing auth-guarded helper pattern (`gotoMatrixOptionsOrSkip`) so authenticated
  coverage remains explicit and stable when auth is unavailable.
- Added a dedicated route-visibility test:
  `matrix-options route is either authenticated or redirects to /login`.
- Updated helper comments to state that auth-dependent assertions are intentionally gated.

## Why this is safe

- Only the e2e spec file in Matrix Options was edited.
- No app routes, API handlers, or data paths were touched.
- The added assertion is low-risk and checks existing route behavior: middleware redirect to
  `/login` for unauthenticated requests.

## Exact behavior now

- In CI without shared auth storage state, the new test explicitly validates that `/matrix-options`
  redirects to `/login`.
- In authenticated local contexts, the same test accepts the authenticated page and asserts the
  Matrix Options heading is visible.
- Existing authenticated-path tests still skip cleanly with an explicit reason when the same condition
  is detected.

## Verification (local)

- Attempt 1:
  `npm run test:e2e -- --project=chromium e2e/matrix-options.spec.ts -g "matrix-options route is either authenticated or redirects to /login"`
  was blocked because this C:\tmp worktree has no local `node_modules` and `npx` attempted registry
  access in cache-only mode.
- Attempt 2:
  running the primary checkout Playwright binary directly was blocked by module resolution from the
  C:\tmp config (`Cannot find module '@playwright/test'`).
- Attempt 3:
  running the primary checkout Playwright binary with `NODE_PATH=C:\Projects\sstac-dashboard\node_modules`
  got past module resolution but failed in the Codex sandbox with `spawn EPERM` and reporter mkdir
  permission errors for `playwright-report` and `test-results`.

Verdict: candidate patch is static-reviewed only in this sandbox. It needs one focused Playwright run
from an unrestricted shell or native AGY session before it should be committed.

## Blockers / remaining gaps

- Full authenticated Matrix Options UI assertions still require an authenticated browser context.
- Without a shared login/session fixture, all feature-heavy Matrix Options tests remain auth-gated and
  cannot execute in current unauthenticated CI posture.
- The change avoids a blind skip-only model by making unauthenticated behavior explicit while preserving
  existing low-risk coverage.
- A Spark read-only review initially flagged the hard `/login` assertion as brittle in mixed-auth
  environments. The candidate patch was revised to accept either the authenticated page or the login
  redirect.
- This code change is intentionally not included in the docs-only preservation manifest until the
  focused Playwright check passes.

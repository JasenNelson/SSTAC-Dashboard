# Matrix Map PR-MAP-4/5 autonomous checkpoint (2026-05-21 night)

Purpose: durable checkpoint for the overnight autonomous PR-MAP-4/5 stabilization lane.

## Current branch / state

- Repo: `C:\Projects\SSTAC-Dashboard`
- Branch: `feat/matrix-map-pr-map-4-5-2026-05-21`
- Upstream shown by git status: `origin/main`
- Stabilization commit created: `82fc39fd81b4e46d04a48dd31825d2ef200d2c0a` (`Stabilize Matrix Map selection workbench`)
- Audited export route commit created: `0261bbf` (`Add audited Matrix Map CSV export route`)
- Current goal: stabilize the R-13-independent PR-MAP-4/5 slice. Do not expand into R-13 stats, PR-MAP-6 bridge audit, PR-MAP-7 grants UI, PR-MAP-17b mobile summary, or Task #17 multi-medium ETL unless explicitly re-scoped.

## Process notes

- User is offline/asleep. Continue only within the autonomous workflow boundaries.
- Exact-path staging only. Never use `git add .`, `git add -A`, `git add -u`, or directory staging.
- Preserve unrelated/untracked operational artifacts.
- Before any Supabase DDL/RPC: read-only verify packet first, then wait for explicit owner apply/go.
- Commit protocol: run strategic expert/subagent review before commit.
- Push protocol: e2e, unit, lint, and build must be green before push.

## Workspace safety

- Interrupted `npm run build` left hot Node processes. Exact PIDs `18616` and `50840` were stopped after user authorized proceeding.
- Remaining Node processes were low CPU on the follow-up check.
- `.git/index.lock` was rechecked after the checkpoint, no `git` process was running, and only the exact stale lock file was intentionally removed.

## Current changed files

Tracked modified files:

- `src/app/(dashboard)/matrix-map/MatrixMap.tsx`
- `src/components/MatrixDashboard.tsx`
- `src/components/matrix-options/MatrixMapLeftPanel.tsx`
- `src/components/matrix-options/__tests__/MatrixMapLeftPanel.test.tsx`
- `src/lib/admin-utils.ts`
- `src/lib/admin-utils.test.ts`
- `src/stores/matrix-map/selectionStore.ts`
- `src/stores/matrix-map/__tests__/selectionStore.test.ts`

Untracked files relevant to this lane:

- `src/components/matrix-options/MatrixMapRightPanel.tsx`
- `src/components/matrix-options/__tests__/MatrixMapRightPanel.test.tsx`
- `supabase/migrations/20260521000003_matrix_map_fetch_measurements_rpc.sql`
- `MATRIX_MAP_PR_MAP_4_5_HANDOFF_2026_05_21_EVENING.md`

Other untracked operational files exist and should not be touched unless explicitly scoped.

## Implemented in this session before checkpoint

- Selection store now exposes explicit add/remove actions in addition to legacy toggle.
- MatrixMap selection semantics moved toward PLAN section 3.4:
  - plain click replaces selection
  - Shift adds
  - Ctrl/meta removes
  - area select replaces, including empty rectangle clearing prior selection
- Added P/S/A/I/B keyboard shortcuts and Esc reset to Pan.
- Impacted triangle selected markers now get the required blue selected stroke.
- Cluster icons now compute selected child count and render a selected-count badge.
- Right-panel RPC error copy no longer assumes the PR-MAP-5 RPC is undeployed.
- `checkCurrentUserAdminStatus` now accepts `admin` and `matrix_admin`, with `limit(1)` so dual-role users do not fail `.maybeSingle()`.
- Client-side CSV helpers now neutralize formula-leading cells before download.
- Commit-protocol subagent review found two bounded issues before commit:
  - cluster modifier/identify clicks could still trigger markercluster default zoom/spiderfy;
  - thrown Measurement Workbench RPC calls could strand the right panel in loading state.
- Both findings were fixed before commit: cluster zoom is now explicit only on plain cluster clicks, and the RPC fetch path uses throw-safe error/finally handling with a regression test.
- Second slice added `POST /api/matrix-map/export`:
  - authenticated admin / matrix_admin gate;
  - CSRF validation;
  - server-side refetch under the authenticated admin session;
  - service-role writes to `matrix_map.export_audit` and `matrix_map.service_role_audit`;
  - client export buttons now call the route instead of constructing CSV locally.
- Export-route review found two blockers before commit: racy app-side `csv_exports` budget increment and forgeable forwarded-header `client_ip`. Both were removed before commit. The route notes that atomic budget increment requires a DB-side RPC follow-up.

## Verification already run

Focused unit tests:

```powershell
npm run test:unit -- src/stores/matrix-map/__tests__/selectionStore.test.ts src/lib/admin-utils.test.ts src/components/matrix-options/__tests__/MatrixMapRightPanel.test.tsx src/components/matrix-options/__tests__/MatrixMapLeftPanel.test.tsx
```

Result: passed, 4 files, 39 tests.

Audited export focused tests:

```powershell
npm run test:unit -- src/app/api/matrix-map/export/__tests__/route.test.ts src/components/matrix-options/__tests__/MatrixMapRightPanel.test.tsx src/components/matrix-options/__tests__/MatrixMapLeftPanel.test.tsx
```

Result: passed, 3 files, 12 tests.

Re-run after the dual-role admin fix and CSV hardening:

```powershell
npm run test:unit -- src/lib/admin-utils.test.ts src/stores/matrix-map/__tests__/selectionStore.test.ts src/components/matrix-options/__tests__/MatrixMapRightPanel.test.tsx src/components/matrix-options/__tests__/MatrixMapLeftPanel.test.tsx
```

Result: passed, 4 files, 38 tests.

MatrixMap smoke unit test:

```powershell
npm run test:unit -- "src/app/(dashboard)/matrix-map/__tests__/MatrixMap.test.tsx"
```

Result: passed, 1 file, 3 tests.

TypeScript:

```powershell
npx tsc --noEmit
```

Result: passed.

Lint:

```powershell
npm run lint
```

Result: passed with pre-existing unrelated warnings.

Browser smoke:

- Started local dev server on port 3000.
- `GET http://localhost:3000/matrix-options` returned 200.
- Headless Playwright smoke opened `/matrix-options`, clicked Interactive Map, saw the map tab/side panels/toolbar text, and captured no page errors.
- Smoke was unauthenticated, so it did not prove live Supabase measurement rows.

Full unit suite:

```powershell
npm run test:unit
```

Result: passed.

Build:

```powershell
npm run build
```

Result: aborted by user after running too long. Do not treat build as green.

## Known blockers / not complete

- PR-MAP-5 client-only export blocker is closed by `0261bbf` for route, CSRF, admin/matrix_admin, server refetch, `export_audit`, and `service_role_audit`.
- `csv_exports` budget increment remains intentionally deferred until there is a DB-side atomic increment RPC. Do not reintroduce read-then-upsert increment in application code.
- Build remains unverified because the previous build run was interrupted.

## Recommended next actions

1. Treat `82fc39f` and `0261bbf` as the committed PR-MAP-4/5 baseline.
2. Next SQL follow-up: add a SECURITY DEFINER atomic budget increment helper for `matrix_map.budget_dimension` / `csv_exports`, with verify packet first and owner apply/go before deployment.
3. Next feature slice after that: broader PLAN_V3_4_2 stats/calculator work.
4. Do not push until the full push protocol is green, including a build with a hard timeout/monitoring plan.

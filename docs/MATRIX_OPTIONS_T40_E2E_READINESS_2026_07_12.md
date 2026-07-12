# T40 -- Authenticated E2E readiness audit (2026-07-12)

Read-only inspection against `origin/main` (tip `589deaf` at audit time). No secrets read,
printed, or invented. No Supabase writes. No code changes made (see section 4).

---

## 1. Current gate model + skip-safe baseline (exact)

Source: `playwright.config.ts`, `e2e/global.setup.ts`, `.github/workflows/ci.yml`.

- `hasE2ECreds = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)`
- `authEnabled = process.env.E2E_AUTH_ENABLED === 'true'`
- `runAuthenticatedE2E = hasE2ECreds && authEnabled` (double gate; secrets alone do not
  enable auth E2E on any branch -- `E2E_AUTH_ENABLED` is a separate repo-level GitHub
  Actions *variable*, `vars.E2E_AUTH_ENABLED`, not a secret).
- When `runAuthenticatedE2E` is true, `playwright.config.ts` adds two extra projects to
  the `projects` array: `setup` (`testMatch: /global.setup.ts/`, `trace: 'off'`) and
  `chromium-auth` (`dependencies: ['setup']`, `storageState: e2e/.auth/user.json`,
  `testMatch: /matrix-options.spec.ts/` only -- i.e. even when enabled, the authenticated
  project currently only runs `matrix-options.spec.ts`, not the other RBAC/admin specs).
- When `runAuthenticatedE2E` is false (current state on `origin/main` and in CI today),
  the `projects` array is byte-identical to the no-auth baseline -- `setup` and
  `chromium-auth` are simply absent from the array, not present-but-skipped.
- `e2e/global.setup.ts` is independently skip-safe even if the setup project were ever
  present without creds: `setup.skip(!email || !password, 'E2E_TEST_EMAIL/E2E_TEST_PASSWORD
  not set')`, and it fails CLOSED (throws) if the Supabase `/auth/v1/token` POST does not
  return 200, or if the post-login redirect never leaves `/login`.
- CI wiring (`.github/workflows/ci.yml`, E2E job): passes `E2E_TEST_EMAIL: ${{
  secrets.E2E_TEST_EMAIL }}`, `E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}`, and
  `E2E_AUTH_ENABLED: ${{ vars.E2E_AUTH_ENABLED }}` into the `npm run test:e2e` step.
  Unset secrets/vars resolve to empty strings -> both gate conditions are false -> no-op,
  confirmed by the config logic above (not merely "assumed skip").

**Skip-safe baseline (exact, confirmed twice in recent merged-PR gate reports on
`origin/main`, PR #591 and PR #593):** `e2e 120-93` -- **120 pass / 93 skip**, all other
gates green (lint 0 / `test:ci` 282-283 unit tests / build exit 0). This is the current
steady-state CI signature with no auth secrets present. Individual per-spec skip counts
were not separately re-enumerated in this audit; the 93-skip figure is an aggregate across
all specs listed in section 3's "currently skipped" column.

**Test-user status:** a dedicated non-privileged Supabase e2e user, `sstac-e2e-reviewer`
(role `member`), already exists per `FRESH_SESSION_HANDOFF_2026_07_10_MO_AUTONOMOUS_CLOSEOUT.md`
section 6 item 1 (the finalization-status doc corroborates this). Only the GH Actions
secrets are missing -- the user itself does not need to be created.

**Confirmed absent from the repo (grep of `origin/main`, no working-tree state assumed):**
`E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` / `E2E_AUTH_ENABLED` appear ONLY as: (a) references
to the GitHub secret/var *names* in `.github/workflows/ci.yml`, (b) the env-var *names* in
`playwright.config.ts` / `e2e/global.setup.ts` (code that reads them, never a literal
value), and (c) prose in handoff/lessons docs describing the recipe. No literal credential
value appears anywhere. `FRESH_SESSION_HANDOFF_2026_07_11_DATA_TRUTH.md` records that the
repo secrets were explicitly REMOVED (verified absent) as a pre-authorized Phase-0 action
on 2026-07-11, and PR #590 (a proof-of-concept enablement run) was closed without merge.
`origin/main` is currently secret-free by design, not by oversight.

---

## 2. What is REQUIRED to enable authenticated E2E safely

### 2a. Exact env vars (owner-set only; placeholders shown, no real values)

| Var | Where | Value (placeholder) | Purpose |
|---|---|---|---|
| `E2E_TEST_EMAIL` | GitHub repo secret (`Settings -> Secrets and variables -> Actions -> Secrets`) | `<dedicated-e2e-user-email>` | Login identity for the Playwright `setup` project |
| `E2E_TEST_PASSWORD` | GitHub repo secret (same location) | `<dedicated-e2e-user-password>` | Login credential, paired with the above |
| `E2E_AUTH_ENABLED` | GitHub repo **variable** (`Settings -> Secrets and variables -> Actions -> Variables`), NOT a secret | `true` | Second gate; keeps auth E2E off by default even if secrets exist, so a branch cannot accidentally enable it by merely inheriting secrets |

For a local/dev run (not CI), the same three names go in `.env.local` (already
`.gitignore`d in this repo) or as ad hoc shell env vars for that one `npm run test:e2e`
invocation. Do not commit them to any tracked file, including `.env.example` (leave that
file's entries as placeholder text, if it lists them at all).

### 2b. Recommended dedicated test-user setup

- **Reuse, do not recreate:** `sstac-e2e-reviewer` already exists in Supabase with role
  `member` (per the 2026-07-10 closeout handoff). Confirm current existence/role via
  read-only Supabase query before assuming it is still valid (do not assume staleness
  either way without checking).
- **Role scope:** `member` is correct for the currently-wired `chromium-auth` project,
  because `matrix-options.spec.ts` is the only spec that project runs, and
  `/matrix-options` is gated by the middleware matcher (any authenticated user, no role
  check at the route level -- role/provenance gating happens inside the app's default-
  policy and evidence-library logic, not at the route boundary).
- **A second, `admin`- or `matrix_admin`-scoped test user would be a SEPARATE, ADDITIONAL
  owner action**, not covered by the existing `sstac-e2e-reviewer` fixture, if/when
  admin-tier E2E coverage (matrix-map publish/audit-history, admin dashboards,
  agentic-os) is wired into the authenticated project list. This is scoped out of the
  current `chromium-auth` project (see 2c) and should be a distinct, explicitly-owner-
  approved follow-up, not an incidental side effect of enabling the `member` user.
- **Email confirmation:** the login flow requires a confirmed Supabase auth user (per
  `e2e/global.setup.ts`'s fail-closed check against the `/auth/v1/token` response); ensure
  the test user's email is confirmed in the Supabase auth table before enabling.

### 2c. Risk model

- **Never commit secrets.** Confirmed current state has zero secret literals in the repo;
  this audit found no drift from that invariant.
- **Test-user scoping (blast-radius control):** the `member`-role `sstac-e2e-reviewer` user
  has no elevated privileges -- it can only reach what any authenticated non-admin member
  can reach (this repo's memory record confirms 574 DRAs are private with 0 grants, so
  even an authenticated member sees 0 matrix-map samples today; that is by-design
  DRA-visibility gating, not a bug, and is itself a coverage opportunity -- see section 3).
  An admin/matrix_admin-tier test user, if added later, should be similarly dedicated
  (never reuse the owner's personal admin account) and should be reviewed for what
  destructive actions it could trigger via E2E (e.g., the publish/unpublish flow) before
  wiring it into any spec that performs a real Supabase write.
- **Trace hygiene:** `setup` project already runs with `trace: 'off'` specifically so
  credential-fill actions never land in a Playwright trace artifact, defense-in-depth on
  top of Playwright's built-in password-field masking. Any new authenticated spec added to
  the `chromium-auth` (or a future `chromium-admin`) project inherits this via the shared
  setup step; no per-spec action needed as long as new specs consume the saved
  `storageState` rather than re-running their own login.
- **CI blast radius:** because `E2E_AUTH_ENABLED` is a separate gate from the secrets,
  the owner can add the secrets to the repo WITHOUT immediately turning on authenticated
  E2E (staged rollout), then flip the variable once satisfied. A single owner action
  (setting the variable) is the actual "go live" switch; secret provisioning alone is
  inert.
- **Writes performed by authenticated specs:** `matrix-options.spec.ts` (the only spec
  currently wired to `chromium-auth`) does not appear to perform any Supabase write in
  its authenticated assertions (it reads/renders the calculator, evidence library, and
  provenance panel; the "Calculator request" receipt is a read-only UI banner). The
  publish/unpublish flow (section 3) DOES perform real writes if ever wired into an
  authenticated E2E spec and would need an owner-reviewed test-DRA fixture (never operate
  on a real production DRA from an E2E run) before being added.

---

## 3. Authenticated E2E coverage that would be added once enabled

Everything below is currently either `test.skip`-gated on the `/login` bounce, or simply
absent because no spec exists yet. None of it runs today in CI.

### 3a. Currently skip-gated specs (would start asserting once `chromium-auth` covers them)

| Spec | Currently skips on | What becomes assertable |
|---|---|---|
| `e2e/matrix-options.spec.ts` (already wired to `chromium-auth`) | `gotoMatrixOptionsOrSkip()` -- redirect to `/login` | Calculator tab rendering, substance combobox, provenance panel content ("Values used in this calculation", "Oral RfD", equation/source), Evidence Library candidate-defaults filter + "Evidence: approved source-backed" / "Default: available option" copy, the AI-never-shows-promotion-language invariant (`not.toContainText('Promote default'/'Approve default')`), cyanide advisory warning path, and the dedicated route-visibility test (`matrix-options route is either authenticated or redirects to /login`, PR-#608/609-era hardening from `MATRIX_OPTIONS_E2E_AUTH_VISIBILITY_PACKET_2026_07_08.md`) exercising its authenticated branch instead of only its unauthenticated branch. |
| `e2e/ssd-workbench.spec.ts` | Same `gotoMatrixOptionsOrSkip`-style guard (`/matrix-options` bounce) | SSD Workbench default validation fixture render ("Species Sensitivity Distribution candidate generator", "Derived candidate only" disclaimer) -- **NOT currently wired to `chromium-auth`**; `testMatch` on that project is scoped to `matrix-options.spec.ts` only, so this spec needs an explicit `testMatch` addition even after creds/enablement land. |
| `e2e/admin-agentic-os.spec.ts` | `test.skip(true, 'Not authenticated as admin...')` after landing on `/login` | Admin Agentic OS launch-click Pattern A/B/D flows against the stubbed spawn path (`AGENTIC_OS_SPAWN_STUB=true` is already pinned in the Playwright webServer env, so this is safe to exercise without a real CLI spawn) -- **requires an `admin`-role test user**, not the existing `member`-role `sstac-e2e-reviewer`; the unauthenticated redirect assertion already runs unconditionally. |
| `e2e/admin-dashboard.spec.ts` | Six separate `if (currentUrl.includes('/login')) test.skip()` guards | Admin dashboard authenticated views (exact assertions not fully enumerated in this audit pass; six gated test bodies) -- **requires `admin` role**. |
| `e2e/matrix-admin-rbac.spec.ts` | One `test.skip(...)` placeholder body (`'authenticated users without admin role are redirected from /admin/matrix-review'`) -- literally empty today, not just gated | This is a stub, not a working gated test -- enabling auth alone does not populate it; it needs to be WRITTEN (a non-admin authenticated fixture asserting redirect away from `/admin/matrix-review`), which additionally requires a second, deliberately-non-admin authenticated identity distinct from any admin fixture used elsewhere. `sstac-e2e-reviewer` (role `member`) already satisfies "non-admin" for this specific test. |
| `e2e/catalog-staging-review-rbac.spec.ts` | Same pattern -- one empty `test.skip(...)` placeholder (`'authenticated users without admin or matrix_admin role are redirected to /dashboard'`) | Same as above: needs to be written, not merely unskipped; `sstac-e2e-reviewer` (member) is the correct fixture for the "lacks admin/matrix_admin" case. |
| `e2e/poll-submission.spec.ts` | Runtime `if (currentUrl.includes('/login')) expect(...).toContain('/login')` branches (two) | Authenticated poll submission flow (CEW polls) instead of only asserting the login bounce. |
| `e2e/bnrrm-smoke.spec.ts` | Feature-presence `test.skip` guards (Review tab / Benchmark pack / Map tab / Identify button "not found/visible/rendered") -- these are UI-readiness skips, not auth skips per se, but in practice fire because the smoke test never reaches an authenticated BN-RRM view in CI today | BN-RRM Review tab, Benchmark pack selector, Map tab, and Identify-button interaction paths. |

### 3b. Coverage that does NOT exist as a spec yet and would need to be authored (not merely
unskipped) once an authenticated fixture is available -- explicitly requested in the task brief:

- **Member-vs-admin map access.** No current spec asserts the DRA-visibility gating
  described in `dashboard_data_truth_map_run_2026_07_11.md` (574/574 DRAs private, 0
  grants -> authenticated members see 0 samples; admins see up to the fetch cap). A new
  spec authenticated as `sstac-e2e-reviewer` (member) could assert "0 visible samples,
  reviewer-effective-visibility indicator shows 0-public-DRA warning" (the health-page
  indicator shipped in PR #591); a second spec authenticated as an admin/matrix_admin
  fixture could assert the capped-count path. The member half is buildable today with the
  existing user; the admin half needs the new admin test-user action from section 2b.
- **Publish flow (PR #612).** `DraPublishControl.tsx` + the publish/audit-history/health
  admin pages have strong React Testing Library component-test coverage
  (`DraPublishControl.test.tsx`, 486 lines) and unit-tested API routes
  (`admin/publish/__tests__/route.test.ts`, `admin/audit-history/__tests__/route.test.ts`)
  but ZERO E2E coverage of the real publish/unpublish click-through against a live (test)
  DRA. This is the highest-value net-new spec once an admin/matrix_admin test user +
  a designated non-production "throwaway" test DRA fixture exist (do not publish/unpublish
  a real DRA from CI).
- **The 37a/38 auth-boundary behaviors.** Referenced by task brief; not independently
  re-derived line-by-line in this audit pass (would require reading the specific
  numbered-item source, not located under an obvious filename in this pass -- most likely
  the numbered items inside `docs/design/MO_GUARD_ROLE_MODEL_AUDIT_2026_07_11.md` (T39,
  PR #609) or an adjacent numbered task list). What IS confirmed from
  `MO_GUARD_ROLE_MODEL_AUDIT_2026_07_11.md`: the app has two legitimate admin tiers by
  design -- `admin` (global superuser; regulatory-review, engine-v2, agentic-os,
  site-content) and `matrix_admin` (delegated matrix-map curation/publish only, via
  `ADMIN_ROLES = ['admin','matrix_admin']` in the matrix-map admin routes). Any
  authenticated-E2E RBAC coverage should therefore plan for THREE distinct identities
  eventually (`member`, `matrix_admin`, `admin`), not just `member` + `admin`, to fully
  exercise the tier boundary the audit documents (e.g., a `matrix_admin` who should reach
  `/admin/matrix-map/publish` but NOT `/admin/matrix-review` or agentic-os routes).
- **Calculators.** `matrix-options.spec.ts` already covers HH Food Web + cyanide-advisory
  + Evidence Library once unskipped (section 3a). NOT covered by any existing spec, even
  once auth is enabled, because no spec targets them: HH Direct Contact, Eco EqP, Eco
  Food/BSAF, and the cumulative-effects (TEQ/BaP-eq/PCB reducer) calculators' authenticated
  UI paths -- these have strong unit coverage (`src/lib/matrix-options/**`) but the E2E
  layer only exercises HH Food Web today. New specs (or new `test()` blocks inside
  `matrix-options.spec.ts`) would be needed, not just a creds/enablement change.

### 3c. Config change needed beyond creds/enablement

Even after `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD`/`E2E_AUTH_ENABLED=true` are set,
`playwright.config.ts`'s `chromium-auth` project has `testMatch: /matrix-options\.spec\.ts/`
-- a hardcoded single-file scope. Every other spec in section 3a stays skip-gated (or, for
the two empty RBAC placeholders, stays unwritten) until a follow-up PR either widens that
`testMatch` (e.g. to an array including `ssd-workbench.spec.ts`, `poll-submission.spec.ts`,
etc.) or adds additional role-scoped projects (`chromium-auth-admin`, `chromium-auth-matrix-admin`)
depending on which test user each spec needs. This is itself a small, low-risk follow-up
PR, separable from the owner's secret/variable provisioning action.

---

## 4. Code change made this session

**Audit-only, no code change.** Per the task's "when unsure, DOCUMENT only" instruction:
enabling any of the section-3 coverage safely requires either (a) new authenticated
specs that need a live login round-trip to author/verify (cannot be done without the
owner-provisioned secrets, which this audit deliberately did not request or fabricate),
or (b) a `testMatch` widening in `playwright.config.ts` that is only meaningfully
verifiable once auth is actually enabled locally -- neither is a "trivial + obviously
safe, verifiable now" change under a fresh worktree without secrets. No worktree was
created; no files were edited.

**Recommended tiny follow-up (NOT executed, for owner/next-session consideration):**
once the two empty RBAC placeholder tests (`matrix-admin-rbac.spec.ts`,
`catalog-staging-review-rbac.spec.ts`) are ready to be written, they can be written and
skip-gated by the SAME `/login`-bounce convention used everywhere else in this repo
(pattern already proven safe in `ssd-workbench.spec.ts` / `admin-agentic-os.spec.ts`) --
i.e. the test bodies can be authored NOW, without secrets, using `test.skip(true, ...)`
as a placeholder-of-last-resort only if a live fixture truly isn't available, but ideally
using the `gotoXOrSkip()` pattern so they go live automatically the moment `chromium-auth`
(or a new `chromium-auth-member` project, since both need a non-admin authenticated
identity, not a login skip) is wired to include them. That authoring work is mechanical
and AGY-eligible per CLAUDE.md L0 section 1.19; it was left to a dedicated follow-up
rather than done inline here to keep this session strictly to the requested audit scope.

---

*Audited from `origin/main` (589deaf) 2026-07-12. Plain ASCII. No secrets read or
invented. No Supabase writes performed.*

# T40 Authenticated E2E -- Owner Gates + Enablement Recipe (2026-07-12)

Lane 3 of the mo-nextrun-2026-07-12 run. This documents (a) what member-side / skip-safe E2E coverage
SHIPPED, (b) the owner-only recipe to ENABLE authenticated E2E, and (c) the admin-tier OWNER GATE for
the positive admin-side coverage that cannot be built without a second test user. **No secret was
read, printed, invented, or set by AI. No admin user was created.**

## 1. Confirmed live state (read-only, 2026-07-12)
- Member E2E test users EXIST and are email-confirmed (verified via read-only Supabase query):
  `sstac-e2e-reviewer@fake.bc.ca` (role `member`) and `sstac-e2e-reviewer2@fake.bc.ca` (role `member`).
  Do NOT recreate them.
- There is NO admin-role (`admin` / `matrix_admin`) E2E test user. -> admin-side positive coverage is
  gated (section 4).
- Repo is secret-free by design: `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` / `E2E_AUTH_ENABLED` are unset
  on origin/main. CI steady state was e2e 120 pass / 93 skip; these two new specs add 4 tests x 3
  default browser projects = 12 PASSING unauthenticated assertions (they assert the /login bounce / 401,
  they do not skip), so the new secret-free steady state is **e2e 132 pass / 93 skip**. (When the owner
  enables `chromium-auth`, the member-authenticated variants add further passing tests on top.)

## 2. What SHIPPED (member-side + skip-safe; no secret needed to author or to stay green)
Two new specs, both skip-safe by construction (they assert the `/login` bounce in the unauthenticated
projects, and run member assertions only in the `chromium-auth` project, which exists only when creds +
`E2E_AUTH_ENABLED=true` are present):
- `e2e/mo-map-access.spec.ts` -- authenticated member reaches the `/matrix-options` Interactive Map and
  sees the member-only partial-visibility banner ("Hidden samples behind private DRAs" + "Contact
  admin"); unauth bounces to `/login`. Also the standalone `/matrix-map` component-redirect for unauth.
- `e2e/mo-publish-rbac.spec.ts` -- authenticated member is redirected from `/admin/matrix-map/publish`
  to `/dashboard` (admin publish control never renders); the publish API `/api/matrix-map/admin/publish`
  is server-locked: member POST -> 403, unauth POST -> 401. These are NEGATIVE probes -- the role gate
  rejects before any `flip_dra_public`, so NO DRA is published/flipped.
- `playwright.config.ts` `chromium-auth` `testMatch` extended to
  `/(matrix-options|mo-map-access|mo-publish-rbac)\.spec\.ts/`.

## 3. OWNER RECIPE -- enable authenticated E2E (owner-only; AI never sets these)
To turn on the member-authenticated `chromium-auth` coverage (both new specs + matrix-options):
- **CI (GitHub Actions):**
  - Repo SECRET `E2E_TEST_EMAIL` = the `sstac-e2e-reviewer@fake.bc.ca` login (Settings -> Secrets and
    variables -> Actions -> Secrets).
  - Repo SECRET `E2E_TEST_PASSWORD` = that user's password (same location).
  - Repo VARIABLE `E2E_AUTH_ENABLED` = `true` (Settings -> ... -> Variables, NOT a secret -- the second
    gate that keeps auth E2E off unless explicitly enabled).
- **Local run (one invocation; do NOT put these in `.env.local` -- playwright.config reads
  `process.env` at config-eval time, before dotenv):** PowerShell:
  `$env:E2E_TEST_EMAIL='...'; $env:E2E_TEST_PASSWORD='...'; $env:E2E_AUTH_ENABLED='true'; npm run test:e2e`
- Never commit any real value to a tracked file (including `.env.example`).

## 4. OWNER GATE -- admin-tier positive coverage (needs a second test user)
The shipped specs cover the MEMBER half. The ADMIN half -- admin sees the full capped map with NO
partial-visibility banner, admin can reach `/admin/matrix-map/publish`, exercise the audit-history
view + health visibility panel, and (optionally) perform a real publish/unpublish -- CANNOT be built
today because there is no admin-role E2E fixture. To enable it (separate, explicitly owner-approved
follow-up):
1. Create an `admin` or `matrix_admin` E2E test user in Supabase (confirmed email), e.g.
   `sstac-e2e-admin@fake.bc.ca`; store its creds as new GH secrets (`E2E_ADMIN_EMAIL` / `_PASSWORD`).
2. Add an admin setup project (a second `global.setup`-style authenticate step -> `e2e/.auth/admin.json`)
   and a `chromium-admin-auth` project (storageState admin.json) in `playwright.config.ts`.
3. Author admin-side specs (admin map full-set + no banner; publish page renders; audit-history list).
   A real publish/unpublish assertion would be a LIVE WRITE -- keep it owner-gated / use a throwaway DRA.
This is NOT done here (out of scope: needs an owner-created admin user + secrets). Flagged as an owner
gate per the run's prep-only envelope.

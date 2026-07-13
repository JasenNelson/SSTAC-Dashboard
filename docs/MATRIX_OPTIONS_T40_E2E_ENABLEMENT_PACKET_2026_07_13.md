# MATRIX_OPTIONS_T40_E2E_ENABLEMENT_PACKET_2026_07_13

This document outlines the exact owner actions to enable member-tier E2E testing, the required follow-up for admin-tier E2E, the highest-value net-new spec, and the current skip-safe baseline.

## 1. Owner Actions to Enable Member-Tier E2E
To turn on authenticated E2E coverage for the member tier, the repo owner must set the following in GitHub Actions:
- **GH Repo SECRET**: `E2E_TEST_EMAIL` = `sstac-e2e-reviewer@fake.bc.ca` (existing user, do NOT recreate).
- **GH Repo SECRET**: `E2E_TEST_PASSWORD` = the password for `sstac-e2e-reviewer@fake.bc.ca`.
- **GH Repo VARIABLE**: `E2E_AUTH_ENABLED` = `true` (Note: This is a Variable, not a Secret. This acts as the final gate to enable E2E auth).

### Wiring in `ci.yml`
The wiring is already present in `.github/workflows/ci.yml`. Here are the exact lines that consume `vars.E2E_AUTH_ENABLED`:

```yaml
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          PLAYWRIGHT_TEST_HOST: 127.0.0.1
          PLAYWRIGHT_TEST_PORT: 3100
          PLAYWRIGHT_TEST_BASE_URL: http://127.0.0.1:3100
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
          E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
          # Authenticated E2E is OFF by default and stays skip-safe: playwright.config.ts
          # only adds the setup + chromium-auth projects when BOTH the E2E_TEST_* secrets
          # are present AND E2E_AUTH_ENABLED == 'true'. Driven by the repo variable
          # (unset -> '' -> disabled) rather than a hard-coded branch name, so no
          # experiment-branch coupling leaks onto main. Enablement strategy is owner-gated
          # (see Lane B plan U3); a controlled proof branch may set this locally.
          E2E_AUTH_ENABLED: ${{ vars.E2E_AUTH_ENABLED }}
```

## 2. Admin-Tier Follow-Up
Enabling the admin-tier E2E testing requires the following subsequent owner actions:
- **New Test User**: The owner must explicitly create an `admin` or `matrix_admin` role E2E test user in Supabase (e.g., `sstac-e2e-admin@fake.bc.ca`).
- **New Secrets**: Store the credentials as `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` GitHub secrets.
- **Storage State**: Add an admin setup project to create a new storage state (e.g., `e2e/.auth/admin.json`).
- **Playwright Project**: Add a new `chromium-admin-auth` project in `playwright.config.ts` that relies on the `admin.json` storage state.

## 3. Highest-Value Net-New Spec
The highest-value net-new specification to be authored once the admin fixture is ready is a **real publish/unpublish click-through against a throwaway test DRA**. 
This flow would:
- Authenticate as the admin test fixture.
- Navigate to the `/admin/matrix-map/publish` route.
- Execute a real publish/unpublish action on a designated throwaway DRA (avoiding mutations on real production DRAs).
- Assert the audit-history updates and health visibility panel changes.

## 4. Current Baseline and What Turns On
- **Current Baseline**: The skip-safe steady state is **e2e 132 pass / 93 skip** (when unauthenticated, as `/login` bounces trigger test skips).
- **What Turns On**: Once member-tier E2E is enabled (`E2E_AUTH_ENABLED=true`), tests in the `chromium-auth` project (which currently matches `/(matrix-options|mo-map-access|mo-publish-rbac)\.spec\.ts/`) will run and pass as an authenticated member instead of skipping or merely hitting the login redirect assertions.

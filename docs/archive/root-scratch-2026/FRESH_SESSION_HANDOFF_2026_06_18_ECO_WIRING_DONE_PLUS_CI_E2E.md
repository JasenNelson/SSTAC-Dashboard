# Fresh-Session Handoff -- Eco-wiring SHIPPED + deployed; CI E2E fix in flight (PR #345)

Entry point for the next SSTAC-Dashboard session. Read L0 `C:\Projects\CLAUDE.md` + L1 `CLAUDE.md` +
`docs/GATE_MODE_SOP.md` first. Plain ASCII only.

## TL;DR
- **Eco-pathway WIRING (Path B) is DONE + LIVE.** 5 PRs (#340-#344) merged to `main`, eco-direct +
  eco-food calculators auto-seed eco catalog values (provisional-badged).
- **PR #345 (CI E2E fix) is ALSO MERGED + deployed (2026-06-19).** main is now `309e024`; Vercel
  production deploy READY. The E2E job runs in the Playwright container; its CI E2E ran GREEN live
  (npm ci skips optional node-pty, tests pass) -- the apt/needrestart hang class is gone. Branch +
  worktree cleaned (shared node_modules verified intact at 723).
- **Nothing is in flight.** Everything below is owner-gated DEFERRED backlog -- a fresh session
  should plan FROM that backlog, not from #345 (it's done). The #345 section is retained as history.

## PR #345 -- CI E2E fix  [RESOLVED 2026-06-19: MERGED as squash `309e024`; worktree cleaned; Vercel READY. History below.]

> STATUS IS LIVE -- DO NOT trust this doc's snapshot. BEFORE planning anything about #345, run:
>   `gh pr view 345 --json number,state,mergeStateStatus,headRefOid`
>   `gh run list --branch chore/ci-e2e-playwright-container-2026-06-18 --limit 4 --json databaseId,workflowName,status,conclusion`
>   `gh pr view 345 --json statusCheckRollup --jq '.statusCheckRollup[]|select(.status=="COMPLETED")|.conclusion+" "+.name'`
> Possible states: state=MERGED (done -- just confirm the worktree was junction-safe-cleaned + primary
> synced); OPEN + CLEAN/green (MERGE per the decision tree); OPEN + a failing E2E job (read its log:
> `gh run view <run-id> --log-failed | grep -iE "npm error|gyp|EACCES|not found"` then follow the
> decision tree). Reconcile the draft plan against whatever this returns -- this snapshot below was
> written while CI was still in flight.

Branch `chore/ci-e2e-playwright-container-2026-06-18`; worktree
`C:\Projects\SSTAC-Dashboard-worktrees\ci-e2e-container-2026-06-18` (still present -- junction-safe-clean
after merge). Tip `eb049f2`.

WHY: the required "E2E Tests" job intermittently ended CANCELLED -- `npx playwright install --with-deps`
hung in the apt `needrestart` postinst hook ~24.5 min until `timeout-minutes:25` fired (tests SKIPPED).
Confirmed from step timing + codex consult. (Re-running the E2E job cleared it each time -- that is how
the eco-wiring chain was merged this session.)

FIX (codex "A3", owner-routed): run the e2e job inside the official Playwright container
(`mcr.microsoft.com/playwright:v1.56.1-jammy`, `--user 1001 --ipc=host`) so apt never runs; plus move
native dep `node-pty` to `optionalDependencies` (joining `better-sqlite3`, already optional) so `npm ci`
succeeds in the toolchain-less container (the container has no `make`/g++; node-pty is lazy-probed +
feature-gated, e2e uses the spawn stub, so it is not needed at e2e runtime). 2 commits:
`13ee19a` (ci.yml container) + `eb049f2` (node-pty optional). Both legs codex GREEN (grind + 5.5-xhigh,
incl. an npm-ci dry-run). Local lint+tsc green; the full app-gate suite was deliberately deferred to the
PR's CI (manifest/CI-only change; the container e2e is CI-only and is the real validation).

DECISION TREE when you pick this up:
- Check CI: `gh run list --branch chore/ci-e2e-playwright-container-2026-06-18 --limit 3 --json databaseId,workflowName,status,conclusion`
  and `gh pr view 345 --json mergeStateStatus,statusCheckRollup`.
- **If green / mergeStateStatus CLEAN:** MERGE it ->
  `full=$(gh pr view 345 --json headRefOid --jq .headRefOid); gh pr merge 345 --squash --match-head-commit "$full"`
  (do NOT pipe `gh pr merge` through `tail` -- it masks the exit code). Then sync primary
  (`git -C C:/Projects/SSTAC-Dashboard checkout main && git pull --ff-only`), delete the remote branch,
  junction-safe-clean the worktree (see CLEANUP).
- **If the container E2E step "Install dependencies" fails again (npm ci):** the first attempt this
  session failed there on node-pty (gyp: not found: make) BEFORE the `eb049f2` optional move; `eb049f2`
  should fix it. If it still fails, the remaining container risk is `--user 1001` file perms on
  npm ci/checkout -- options codex gave: drop `--user 1001` + add Chromium `--no-sandbox`, or fall back
  to Option B entirely (see below).
- **If you'd rather abandon the container approach (Option B fallback -- codex's #2, fully viable):**
  revert to `runs-on: ubuntu-latest` (no container; keeps build-essential so node-pty builds normally)
  + keep `npx playwright install --with-deps` but add to that step
  `env: { DEBIAN_FRONTEND: noninteractive, NEEDRESTART_MODE: a, NEEDRESTART_SUSPEND: 1 }` and a
  step-level `timeout-minutes: 8`. This directly disables the confirmed needrestart culprit + fast-fails
  any residual apt hang. CI-only change, no package.json touch. (If you take B, also revert the node-pty
  optionalDependencies move, since B keeps the toolchain.)

## Eco-wiring (DONE -- context only)
Path B = a NEW catalog-direct substance-aware seed resolver (`src/lib/matrix-options/ecoSeed.ts`),
because `frameDefaults`/`resolveSeed` REJECT non-generic substance_key (the original handoff's
FRAME_DEFAULT_PROFILES approach was a RED-flagged dead end). Pieces now on main:
- `eco_values.json` 88->96 rows (source-discriminator ids; chloroform held + PCE-CCME dropped --
  unverified `src-ccme-cwqg-aquatic-life`).
- Value-aware provenance resolver (`resolver.ts`) + eco rows wired into `catalog.ts`.
- `ecoSeed.resolveEcoSeed` (frame-aware, source-priority, provisional-gated, withhold-on-tie) +
  `getEcoProvisionalEligibility`/`getFrameJurisdictionRank` in `defaultSelectionPolicy.ts`.
- EcoDirect seeds fcv; EcoFood seeds trv + mammal/bird receptor selector + relaxed BSAF gate
  (scoped to catalog-backed substances). Provisional badges on both.
INTENDED output changes (catalog now drives seeds): e.g. benzo_a_pyrene eco-food TRV 0.0025->3.6
(FCSAP mammal); benzene eco-direct fcv now 130 (was empty). All needs_review, badged provisional.

## DEFERRED / owner-gated backlog
- **Step 6** (eco promote/pin): fetch + pin dated PDFs for EPA NRWQC + CCME-CWQG -> set
  canonical_source_status direct_source_verified -> author `promote-eco-*.mjs` (pattern
  `promote-hc-pqra-direct.mjs`) -> on owner inline approval promote rows approved (flip provisional ->
  approved; the badge auto-clears, no calculator change). Incremental.
- **CCME source verification**: chloroform (held) + PCE-CCME split -- pin a real CCME CWQG factsheet +
  verify the value/source before emitting `src-ccme-cwqg-aquatic-life` rows.
- **D14**: the all-pathway comparison "matrix" view (low urgency).
- **CI hygiene (separate from #345):** ~18 pre-existing emoji bytes (checkmark/warning) in unrelated
  `echo` lines of `.github/workflows/ci.yml` violate the plain-ASCII rule. Also codex suggested making
  the required PR E2E check chromium-only + full chromium/firefox/webkit nightly (3 browsers + retries:2
  is tight even at 30 min).
- **Substance-registry expansion**: the eco substances NOT in SUBSTANCE_LIBRARY are not yet selectable
  (MVP was narrowed to SUBSTANCE_LIBRARY substances). Only ~9 metals/organics overlap today
  (arsenic/barium/benzene/cadmium/Cr(VI)/copper/lead/naphthalene/zinc + eco-direct benzene/chlorobenzene/
  PCE/TCE).

## SESSION LESSONS (high-value, surface to L0/memory)
- `| tail` on `npm run test:ci` AND on `gh pr merge` MASKS the exit code (pipe returns tail's 0). It hid
  a test failure (library.test counts) + let a premature `&&` run after a failed merge. Run gates +
  merges with full-output capture / check exit directly; never pipe them through tail.
- Stacked PRs only run the full CI/CD pipeline when targeting `main`. Per child: merge parent (squash,
  `--match-head-commit` FULL 40-char SHA) -> `gh pr edit <child> --base main` -> `gh pr close` +
  `gh pr reopen` to fire the pull_request event -> full CI runs.
- CI E2E `--with-deps` reliably hangs on the needrestart apt hook -> re-run the E2E job to clear (until
  #345 lands the real fix). `gh run watch` exits early on transient 401 blips -> just re-issue it.
- Junction-safe worktree cleanup is POWERSHELL-NATIVE: `fsutil reparsepoint delete` the node_modules
  junction (verify via `Get-Item LinkType` == empty, NOT Test-Path -- fsutil leaves an empty dir),
  gate on the shared-store child count being unchanged, THEN `git worktree remove --force` + prune.
- Playwright official container has NO C/C++ toolchain -> native node modules must be optional or
  prebuilt for `npm ci` to pass in it.

## CLEANUP (when #345 is resolved)
- `git -C C:/Projects/SSTAC-Dashboard worktree` list -> the `ci-e2e-container-2026-06-18` worktree
  remains; junction-safe-remove it after merge (procedure above).
- Node/python orphans from this session's many gate runs were NOT killed (owner runs parallel sessions);
  check `Get-Process node,python` at a true session end before cleanup.

## STATE
main `309e024` (eco-wiring #340-#344 + CI E2E fix #345 all merged + deployed; Vercel production READY).
No open PRs from this lane; no eco-wiring/ci-e2e worktrees remain. Only the DEFERRED backlog above is
left -- all owner-gated. Memory: `dashboard_session_2026_06_17_eco_wiring_steps1_5`,
`feedback_needs_review_values_usable_build_first_review_later`.

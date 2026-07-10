# Fresh Session Handoff -- 2026-07-10: Matrix Options autonomous run closeout + reg-rev Session B

Plain ASCII. Continuity anchor for the MO lane. main tip at authoring = df88bc1 (#575 merged).
Companion scratch (full detail, gitignored): `.tmp/fable-mo-run-20260709/` (RUN_STATE, PR_MANIFEST,
HEARTBEAT, COMMAND_LOG, RESUME_PROMPT, LANE_B_E2E_AUTH_DESIGN, LANE_UX_INSPECTION_AND_RENAME_SCOPE).

## 0. TL;DR -- substantive autonomous work is DONE; the rest is owner-gated
- **Lane B (e2e auth fixture): SHIPPED + MERGED (PR #575).** Live enablement is owner-gated (secrets).
- **Phase 3 (jurisdiction->frameId rename): NOT done -- strategic review RED. Do NOT bulk-rename.**
- **All other MO feature lanes are shipped or blocked on owner inputs.** No autonomous feature work
  remains right now.
- **Doc/CI quick-wins are valid but 2/3 touch Tier-1 protected files -> need owner OK.**

## 1. Lane B -- skip-safe authenticated Playwright e2e fixture (PR #575, MERGED)
Closes the CI test-integrity gap: `e2e/matrix-options.spec.ts` + `matrix-admin-rbac.spec.ts` skip on
the /login bounce because there was no shared auth `storageState`.
- Files: `e2e/global.setup.ts` (NEW, setup-project login -> storageState, fail-closed, trace:off),
  `playwright.config.ts` (env-gated `setup` + `chromium-auth` projects), `.gitignore` (+`e2e/.auth/`),
  `.github/workflows/ci.yml` (pass E2E_TEST_* into e2e job).
- Skip-safe: with no `E2E_TEST_*` env, the project list is unchanged -> CI green, specs skip as before.
- Reviewed GREEN (codex Spark + adversarial subagent). All 4 gates GREEN. Merged 2026-07-10.
- **OWNER-GATED to enable live runs:** (a) seed a dedicated NON-privileged Supabase e2e user
  (`e2e+reviewer@...`) + a minimal `user_roles` row; (b) add GH secrets `E2E_TEST_EMAIL` /
  `E2E_TEST_PASSWORD`. Then a small follow-up PR un-skips the specs. Full recipe:
  `.tmp/fable-mo-run-20260709/LANE_B_E2E_AUTH_DESIGN.md`.

## 2. Phase 3 -- jurisdiction->frameId rename: RED, deferred (do NOT bulk-rename)
Strategic review verdict RED. Load-bearing findings: the canonical rename to `RegulatoryFrame` ALREADY
happened -- `guide/content/jurisdictions.ts` is a deprecated-alias shim kept to avoid churning ~15
files. The remainder is NOT mechanically separable: compound identifiers blend both meanings and must
NOT be touched (`getFrameJurisdictionRank`, `isJurisdictionEligible`, the `blocked_frame_jurisdiction`
policy enum, `LEGACY_JURISDICTION_FRAME_MAP`); two files mix RENAME+KEEP in the same scope
(`CalculatorValueSearchPanel.tsx`, `MatrixDashboard.tsx:695-696`); the `matrix-options-jurisdiction-v1`
localStorage string must be preserved. Low value + provenance-corruption risk. If ever done: careful
symbol-by-symbol PR, NOT AGY/bulk sed. Full map: `.tmp/.../LANE_UX_INSPECTION_AND_RENAME_SCOPE.md`.

## 3. Other MO lanes -- all shipped or blocked
- UX legibility (combobox, eco-food relabel, FrameImpactCard wired in all 4 calculators, four-state
  applicability badges + reason text, reference-only/diagnostic empty states): ALL already SHIPPED on
  main (verified this session).
- Cumulative anchors D1-D4 (dioxin TEQ / BaP ADAF / bc-csr->ccme-2010 / PCB Option A): MERGED
  (#540/#541/#542/#545). NOT pending.
- Framework-A2 verification (Phase C): flip `rpfTable.ts` needs_review schemes (hc-pqra-v3,
  epa-2010-draft, who-1998-pah) to verified. BLOCKED on owner-supplied HC PQRA + WHO TEF PDFs
  (vision-first; no poppler). who-1998-pah scoring is fail-closed in the meantime.
- A3b per-congener UI (the user-facing cumulative grid): gated behind Phase C.

## 4. Doc/CI quick-wins -- valid, but need owner OK (Tier-1 protected)
1. `docs/GATE_MODE_SOP.md:281` -- STALE: still says "this repo does not yet have a CLAUDE.md or
   canonical docs index (TO AUTHOR)". Both now exist. **GATE_MODE_SOP.md is Tier-1 protected -> owner OK.**
2. Register GATE_MODE_SOP in `docs/INDEX.md` (+ optionally the manifest). INDEX.md not protected;
   safe to do -- but half a fix without item 1.
3. `test:k6` -- `.github/workflows/ci.yml:314` calls `npm run test:k6` but package.json has no such
   script (latent; job is gated on `tests/load/main.k6.js` existing, which it doesn't).
   **package.json is Tier-1 protected -> owner OK.** Fix: add `"test:k6": "k6 run tests/load/main.k6.js"`.

## 5. Reg-rev Session B (SSTAC-Dashboard engine-v2 front-end) -- verified; front-end lane ~complete
Ran under a separate delegation (owner-driven write clicks; Claude read-only verification via the
project-scoped Supabase MCP). Results (detail in the Regulatory-Review-worktrees/engine-v2
`.tmp_session_b_*` files): baseline captured; judgment first-save (INSERT), value-changing re-save
(in-place UPDATE + BEFORE-UPDATE audit trigger -> history row), and same-values no-op guard all PROVEN
on the live E-58 eval. The hydration mismatch + intermittent save-swallow root-caused to a STALE DEV
BUILD (primary checkout 72 commits behind), NOT tip code -- gone on a clean origin/main build. Deferred
(trivial, owner's whenever): live rationale-persistence tick + memo .docx export. The 422 tier-rejection
is covered by the route unit tests. Proposed sign-off written to the orchestrator. No SSTAC-Dashboard
code bug found; no code change required.

## 6. OWNER DECISION PACKET (batched -- nothing else is autonomously executable)
1. Lane B live: seed the e2e user + add `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` secrets -> Claude opens
   the un-skip PR. (Highest-value test-integrity item.)
2. Framework-A2: supply the HC PQRA / WHO TEF PDFs (or a readable locator) -> unblocks Phase C, then A3b.
3. Doc quick-wins: OK to touch the Tier-1 files (`GATE_MODE_SOP.md`, `package.json`) for the 3 fixes above?
4. jurisdiction->frameId rename: confirm DEFER (recommended) or authorize a careful symbol-by-symbol PR.
5. Reg-rev Session B: accept the machinery sign-off, or do the 2 deferred UI ticks on the clean build.

## 7. Housekeeping
- Worktrees: `fable-lane-b-e2e-auth` (merged #575 branch) -- git-deregistered + junction removed, but a
  leftover FOLDER is locked by a running process (harmless; delete once the lock clears). Merged branch
  `feat/mo-e2e-auth-fixture-2026-07-09` still exists local + remote (safe to delete). `fable-mo-closeout`
  = this handoff PR's worktree.
- Many `node` processes running (dev servers + MCP servers). L0 1.17 orphan-sweep note: several are
  foreign/parallel-session; do NOT kill by name. Port 3000 held by an older node (possible orphan).
- Gates/state: main df88bc1, CI green. No in-flight MO code work.

## 8. Recommended next session
If owner provides secrets -> un-skip Lane B specs (small PR). If owner provides Phase C PDFs ->
framework-A2 verification -> then A3b UI (the flagship cumulative-effects user feature). Otherwise MO is
in a stable, shipped state and the next lane is owner-directed.

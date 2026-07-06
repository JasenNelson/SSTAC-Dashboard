# Fresh Session Handoff -- 2026-07-06 -- HC TRV v4.0 Cross-Check + PR #513 Reversal

**Status:** PR #518 open, unmerged, CI green expected (all local gates green: lint/unit/build/e2e/codex).
**Session type:** Autonomous overnight run, continuing from the 2026-07-05b migration roadmap.

---

## TL;DR

1. The prior roadmap's "HC v4.0 source unavailable" framing was **wrong** -- the real source PDF has
   been in the owner's Downloads folder since 2026-05-29 and was the literal source used to build the
   catalog's HC v4.0 rows in the first place.
2. **PR #513 (2026-07-05) turns out to have been the actual error.** It quarantined chlorobenzene's HC
   oral RfD (0.43 mg/kgBW-day), believing it was a 1,2-dichlorobenzene mis-attribution -- based on
   cross-source corroboration, never checked against HC's own primary document. Direct extraction of the
   real PDF (verified independently twice) confirms 0.43 was never wrong.
3. Built a new row-level, type-and-qualifier-aware cross-check tool and scanned all 111
   HC-v4.0-sourced catalog rows: **zero confirmed catalog errors**. 6 rows are AMBIGUOUS (genuine
   source-document variants, hand-verified, none need a fix).
4. Corrected chlorobenzene's catalog rows (`review_notes`, `qa_status`, `default_status`) --
   **`current_default` deliberately left untouched, pending your sign-off** (see Owner Decisions below).
5. Shipped as **PR #518**, went through 2 rounds of Opus adversarial review + 5 rounds of codex review
   (gpt-5.5 xhigh) to mutual-agreement GREEN. All local gates green (5080 unit tests, 117 e2e tests,
   clean build, 0 lint errors).
6. Investigated CI/E2E slowness (report-only, not implemented) -- found one concrete, low-risk win.

---

## Owner decisions needed

### 1. Chlorobenzene `current_default` (the substantive decision from this session)

Chlorobenzene's HC v4.0 oral RfD (0.43 mg/kgBW-day) is now confirmed correct and restored to
`qa_status=approved`, `default_status=available_option` -- but `current_default` is still on the interim
EPA/IRIS row (0.02), because flipping `current_default` is an owner (HITL) decision under the
no-default-promotion project rule, not something this session applied unilaterally.

**Recommendation (recency rule, per `feedback_protocol1_hierarchy_hc_default_epa_when_newer_defensible`):
HC 2025 v4.0 is the newer, primary-verified source; recommend flipping `current_default` from the EPA/IRIS
row (0.02) to the HC row (0.43)** -- but this is your call, not mine to make. If you agree, say so and a
follow-up session can wire it (small, mechanical PR).

### 2. The 6 AMBIGUOUS rows from the cross-check (all currently untouched, no action required)

`docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md` (on PR #518) lists 6 rows the tool can't
auto-resolve: zinc (2, genuinely age-stratified UL), manganese (1, benign extractor false-positive),
methylmercury (1, generic applicability text), vinyl_chloride (2, adult vs. from-birth, no catalog
qualifier). None require a value fix -- they're candidates for a FUTURE session to add explicit
qualifier/population metadata to the catalog so the tool resolves them cleanly. Low priority.

### 3. CI/E2E pipeline change (item 3 of the prior roadmap; investigated, NOT implemented)

Real timing data from a recent green run (PR #517, 2026-07-06 04:07-04:33 UTC, ~26 min total):

| Job | Duration | Depends on |
|---|---|---|
| Lint & TypeScript Check | 1m26s | -- |
| Unit Tests (6 sequential shards, OOM workaround) | 7m46s | lint |
| Production Build | 3m49s | unit-tests |
| E2E Tests (Playwright container, uses `next dev`) | 12m40s | **build** |

**Finding (codex-confirmed):** E2E never consumes the Production Build job's `.next` output -- it starts
its own `next dev` server via `playwright.config.ts`. Its `needs: build` dependency is a pure ordering
dependency with no artifact behind it. Changing it to `needs: unit-tests` would let E2E start ~3m49s
earlier (in parallel with Production Build / Performance Analysis / Load Testing K6 instead of after),
cutting up to ~3m49s off the ~26-min total with a **one-line config change**.

Trade-off (per codex): E2E would now run even if the Production Build later fails -- a CI-minute/noise
cost, not a correctness risk, since the final `CI Status Check` aggregator still requires both
`build` and `e2e-tests` to pass.

**Recommendation: apply this one-line change** (`.github/workflows/ci.yml`, e2e-tests job:
`needs: build` -> `needs: unit-tests`) -- low risk, real, verified win. Did not implement it myself since
CI config is shared infrastructure requiring your sign-off.

**Bigger, riskier option (not recommended without more validation): parallelize the 6 sequential Unit
Test shards as a matrix + a synthetic `Unit Tests` aggregator job** (branch protection needs the exact
job name "Unit Tests"). Could plausibly cut Unit Tests from 7m46s toward the slowest single shard's time,
but the sequential-shard design was a deliberate OOM workaround (documented at length in `ci.yml` with an
escalation history from 4->6 shards) -- codex flagged real risks to validate first: per-shard RAM
headroom on parallel GitHub-hosted runners, runner concurrency limits, coverage upload/merge across
separate runners, and branch-protection check-name targeting. Treat as an owner-approved experiment for
a future session, not a quick win.

---

## What shipped (PR #518, `feat/hc-trv-v4-crosscheck-2026-07-06`)

- `scripts/matrix-options/hc_trv_v4_extract.py` -- independent row-level PDF extraction (PyMuPDF,
  `find_tables()`), no reuse of the original May 2026 extraction pass's logic.
- `scripts/matrix-options/data/hc_trv_v4_table1_extracted.json` -- the extractor's output (84 rows),
  load-bearing input to the comparator below; re-run the `.py` script to regenerate if the PDF changes.
- `scripts/matrix-options/hc-trv-v4-crosscheck.mjs` -- type-and-qualifier-aware comparator with explicit
  unit conversion (catalog `per ug/m3` <-> PDF `(mg/m3)-1`, 1000x factor) and a self-guarding
  "Adjudication Notes" section that only emits its confident "zero errors" claim when the current run's
  AMBIGUOUS row-id set exactly matches the 2026-07-06 hand-verified baseline (otherwise a loud STALE
  warning, per a codex-caught bug).
- `docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md` -- the full report (candidate-leads-only
  banner, mapping constants, validation cases, MISMATCH/AMBIGUOUS/MATCH tables, adjudication notes).
- `matrix_research/reference_catalog/human_health_trv_values.json` -- chlorobenzene's two oral RfD rows
  (`pv-hc-chlorobenzene-hh-direct-rfd`, `-hh-food-rfd`) corrected: false review_note removed,
  `qa_status: approved`, `default_status: available_option`. The rfc row was untouched (already correct).
- `src/lib/matrix-options/provenance/__tests__/catalog.test.ts` + `library.test.ts` -- fixture updates
  for the corrected chlorobenzene state (availableOptions 1676->1678, notDefaults 19->17).
- `docs/LESSONS.md`, `docs/NEXT_STEPS.md` -- corrected the false "HC v4.0 unavailable" narrative.
- Two memory files amended in place (not superseded, per owner instruction):
  `feedback_protocol1_hierarchy_hc_default_epa_when_newer_defensible.md`,
  `dashboard_mo_defaults_and_integrity_2026_07_05.md`.

**Not touched (deliberately, low-priority follow-up):** `scripts/matrix-options/promote-hc-trv-v4-2025.mjs`'s
own `PROMOTION_ROWS` list still doesn't include chlorobenzene's 2 oral rows (PR #513 removed them from
there too) -- the test's sanctioned-id set was extended directly instead, since that promotion tool's
"90 rows" scope is a separate, already-executed historical action with the count baked into many comment
strings throughout the file. Cosmetic; not load-bearing for catalog correctness.

## Review pipeline detail (for anyone auditing the process, not just the result)

Two rounds of Opus adversarial review found real design flaws BEFORE any code was written:
- Round 1 RED: a naive "type-aware" comparator using proximity/block matching would have hidden the
  exact bug class it existed to catch (chlorobenzene's real Inhalation TC value sits right next to its
  real Oral TDI in the same text block).
- Round 2 YELLOW (both blockers closed): required a synthetic mismatch fixture (not a real "known-bad"
  substance) plus a genuinely multi-pathway control (arsenic inorganic).

Codex found chlorobenzene's real status (0.43 correct) on its FIRST round, independently, using file
tool-use to read the actual PDF -- catching this session's own prior draft's continued error (an earlier
plan draft still assumed chlorobenzene was mis-filed). This was cross-checked against a second,
independent extraction via this session's own PyMuPDF read before being trusted.

5 codex rounds total on the implementation diff, closing:
1. Grind round: a Python empty-string `str.replace('', ' ')` bug injecting letter-spacing into extracted
   qualifier text; a stale doc reference in NEXT_STEPS.md.
2. gpt-5.5 xhigh: the report-regeneration script would silently destroy its own hand-written adjudication
   notes on a future rerun.
3. gpt-5.5 xhigh: the guard added in response to (2) computed correctly but the report generator still
   appended the OLD unconditional hardcoded text after it (a literal duplication bug, self-caught via
   testing the guard's fail path before trusting it).
4. gpt-5.5 xhigh: fresh re-review after the duplication fix, confirmed correct.
5. gpt-5.5 xhigh: final confirmation on the fully-fixed diff -- GREEN, "no discrete, actionable
   correctness issues identified," plain-ASCII compliance confirmed on all new files.

## Gates (all green on the final pushed tip)

- `npm run lint` -- 0 errors (80 pre-existing warnings, unrelated)
- `CI=true npm run test:coverage -- --run` -- 5080 passed, 0 failed, 11 skipped, 2 todo
- `npm run build:monitored:clean` -- clean build
- `npm run test:e2e` -- 117 passed, 0 failed
- `/codex-review` -- 5 rounds to mutual-agreement GREEN

## Next session starting point

1. Check PR #518's CI status (`gh pr checks 518` or `gh run list --branch feat/hc-trv-v4-crosscheck-2026-07-06`)
   and merge if green (per the MERGE protocol -- owner merges, not AI).
2. If the owner has decided on chlorobenzene's `current_default` (see Owner Decisions #1 above), wire it
   in a small follow-up PR.
3. If the owner approves the CI one-line change (Owner Decisions #3), apply and gate it like any other PR.
4. The 6 AMBIGUOUS-row metadata gaps (Owner Decisions #2) are low-priority backlog, not blocking.
5. Everything else from the 2026-07-05b migration roadmap not touched this session remains open: owner
   value decisions (benzo_a_pyrene, PCBs, phenylmercuric_acetate), broader current_default sweep, eco
   pathway completion, evidence-vs-substance CAS/name guard extension.

## Worktrees used this session (not yet cleaned up)

- `C:\Projects\SSTAC-Dashboard-worktrees\hc-trv-v4-crosscheck-2026-07-06` -- the PR #518 branch, keep
  until merged.
- `C:\Projects\SSTAC-Dashboard-worktrees\handoff-2026-07-06` -- this handoff's own branch, keep until its
  PR merges.
- Both are safe to `git worktree remove` after their respective PRs merge (verify the node_modules
  junction is removed FIRST per L0 1.15 -- `fsutil reparsepoint delete "<wt>\node_modules"` -- before any
  recursive delete, to avoid emptying the shared node_modules store).

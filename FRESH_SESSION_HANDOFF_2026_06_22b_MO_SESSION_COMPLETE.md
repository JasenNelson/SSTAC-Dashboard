# SSTAC-Dashboard -- Session Handoff 2026-06-22b (MO session complete: 5 PRs)

Supersedes FRESH_SESSION_HANDOFF_2026_06_22_MO_VALUE_LEVEL_PAGINATION.md. Plain ASCII.
main at close: c3709dc. Continuation of the MO lane after #384/#385.

This window shipped FIVE PRs autonomously (owner chose task order 2->1->3, then "keep going").

---

## Shipped (all MERGED)

- **#386** apply-qa VALUE-LEVEL provenance stamp -- completes the #384 contradiction cleanup. 40
  fields repaired (20 rows x applicability+review_notes); canonical-aware stamp text. Totals
  unchanged 1161/416. Owner-attested --apply (J. Nelson, 2026-06-22).
- **#387** EvidenceLibrary Values-table PAGINATION (codex Option 2; the durable LIVE fix for the
  #380 render-timeout). Dep-free, 50 rows/page; pure helper evidenceLibraryPagination.ts + 9 unit
  tests; accessible pager; reset-on-filter; codex P3 fix (pager steps from the CLAMPED page).
- **#388** docs -- the 2026-06-22 handoff + the Map-LOAD design "open questions" addendum.
- **#389** EvidenceLibrary pagination INTEGRATION test -- 60-row catalog mock proving only one page
  renders + the pager navigates + disabled-state. +3 tests.
- **#390** Map-LOAD undated-rows consumer APP-LAYER (Task 3) -- see below. +4 tests.

vitest_test_count: 4448 -> 4467 across the session.

## #390 detail (Map-LOAD undated-rows consumer, APP-LAYER shipped)
Per docs/MATRIX_MAP_UNDATED_CONSUMER_DESIGN_2026_06_21.md (#381) + its open-questions addendum. The
3 design gaps were owner-green-lit and resolved:
- (GAP 1, load-bearing) MatrixMapRightPanel.tsx normalizeMeasurementRow: stringField -> nullableString
  for event_date (else null->'' defeats the filter null-guard). nullableString already existed.
- (GAP 2) getMeasurementRowKey fallback no longer collides on '...-null' for undated rows.
- (GAP 3) supabase/migrations/20260622000001_*.sql authored + included (CREATE OR REPLACE
  fetch_measurements_for_samples: +se.date_precision, +NULLS LAST). OWNER-PASTE-GATED.
Also: measurementStore type (event_date nullable + date_precision), filter-measurements null-guard
(+3 tests), export/route null-guard + date_precision CSV column (+1 test), split_etl_output.py
--source flag. Codex Spark + 5.5 xhigh GREEN (SECURITY DEFINER RPC + CSV export reviewed).

## REMAINING -- Map-LOAD DATA LOAD is now the only blocked-on-owner Map step
The app-layer is live + backward-compatible (until the RPC migration is applied, the RPC omits
date_precision and the consumers derive 'undated' from a null event_date). To actually load undated
data, OWNER runs in Supabase Studio (in order):
1. Apply migration 20260620000001 (nullable event_date + date_precision) if not already applied.
2. Apply migration 20260622000001 (the RPC: +date_precision, NULLS LAST).
3. Verify bnrrm_env_modifier_id UNIQUE exists in prod before PATH_B paste.
4. Paste the PATH_B multimedium chunks (regen via split_etl_output.py --source <PATH_B monolith>;
   env_modifier resolved: medium='sediment' + notes='env_modifier', NO enum change).
5. Run etl_bnrrm_to_supabase.py --allow-undated and paste its output.

## Other MO follow-ups (unchanged)
- EvidenceLibrary windowed virtualization (react-virtuoso) -- OPTIONAL UX alternative to #387's
  pagination; only if owner prefers infinite-scroll. Pagination is the durable fix; this is preference.
- defaultSelectionPolicy decisions indexing -- NOT a bottleneck (sub-10ms); skip unless profiling says.
- 61 deferred dupe-candidate_group_id rows -- BLOCKED on owner canonical-estimate pick.
- BC Protocol 28 2021-jan (355) -- BLOCKED, source src-bc-protocol-28-2021-jan unpinned.

## Lessons (new)
- Branching a feature off pre-sibling-merge main while the sibling is in CI: both bump
  vitest_test_count (same manifest line). Land the sibling first, then `git rebase origin/main`
  (disjoint CODE = clean), then bump the manifest AFTER rebase (no conflict).
- gh pr merge --match-head-commit needs the FULL headRefOid; a short sha throws GraphQL
  "could not coerce to GitObjectID".
- gh pr checks --watch exits non-zero on a real check failure -- but also occasionally 255 on a
  transient API blip; re-check the actual check states before assuming failure (they may still be
  pending). It was a transient blip on #390, not a failure.
- Reusing a hardened script's fail-closed gates (apply-qa #384) for the next change (#386) drew a
  clean first-pass codex GREEN. Harden once, reuse.

## Gate cheatsheet (per docs/GATE_MODE_SOP.md)
test:ci (4-shard) -> npx next typegen + npx tsc --noEmit -> npm run lint -> npm run docs:gate --
--base main --head HEAD -> npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 ->
npm run test:e2e -> /codex-review (Spark grind -> 5.5 xhigh) to mutual-agreement GREEN -> push -> PR
-> merge on green (gh pr merge <n> --squash --match-head-commit <FULL-sha>). Current
vitest_test_count (manifest): 4467.

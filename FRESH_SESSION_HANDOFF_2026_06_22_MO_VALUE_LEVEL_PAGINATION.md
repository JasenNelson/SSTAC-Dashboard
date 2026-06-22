# SSTAC-Dashboard -- Session Handoff 2026-06-22 (value-level stamp + pagination + Map-LOAD tee-up)

Supersedes FRESH_SESSION_HANDOFF_2026_06_21d_EVIDENCE_NOTE_BACKPORT.md. Plain ASCII.
Continuation of the MO lane after #384/#385. Owner chose task order 2->1->3, then went to bed
("keep going", 700k budget); the AI executed Tasks 2 + 1 autonomously and TEED UP Task 3.

---

## Shipped this session

### PR #386 MERGED -- apply-qa value-level provenance stamp (Task 2)
Completes the contradiction-cleanup deferred from #384 (which stamped only evidence notes). The 20
#249-packet IRIS rows were approved + direct_source_verified but their value-level provenance
(applicability / review_notes) still read "needs review before default use" / "verify against the
live source".
- apply-qa-promotion.mjs gains STAMPED_PROVENANCE_FIELDS + buildValueStamp + stampValueProvenance +
  valueLevelRepairNeeded. The stamp text is CANONICAL-AWARE so it is accurate under --canonical keep.
- Owner-attested --apply (J. Nelson, 2026-06-22): 40 fields repaired (20 rows x 2). Totals unchanged
  (1161 approved / 416 needs_review). No new it(); count stayed 4451.
- Codex Spark -> 5.5 xhigh GREEN (no findings).

### PR #387 -- EvidenceLibrary Values-table pagination (Task 1) [CI in flight at handoff time]
The durable LIVE fix for the #380 render-timeout (the prior fix only bounded the TEST). The live
table rendered every 1161+ row x2 <tr> (~2300+ DOM nodes).
- Dependency-free pagination, 50 rows/page; NOT a windowing library (Vercel-OOM + jsdom-layout +
  variable-height <details> risk). New pure helper evidenceLibraryPagination.ts +
  computeValuesPagination (9 unit tests). Reset-to-page-1 effect keyed on filters BY VALUE.
- Semantic <table> + row keyboard-nav preserved; accessible <nav> pager. count 4451 -> 4460.
- Codex Spark caught 1 P3 (pager callbacks must step from the CLAMPED page) -> fixed -> 5.5 xhigh GREEN.
- If CI was green, this was squash-merged with --match-head-commit e87d7d9.

## Task 3 (Map-LOAD undated-rows consumer) -- TEED UP, needs a one-line owner decision

Per docs/MATRIX_MAP_UNDATED_CONSUMER_DESIGN_2026_06_21.md (#381). The app-layer change is autonomous
and FULLY UNIT-TESTABLE without the data load (additive/backward-compatible until the owner applies
the RPC migration -- date_precision is simply absent until then, normalizer returns null, no crash).

But a recon found 3 gaps the design doc does not cover. DO NOT ship blind -- get owner answers:
1. **(load-bearing) RightPanel normalizer gap:** MatrixMapRightPanel.tsx:878 has its OWN
   `normalizeMeasurementRow` using `stringField` (null -> ''). The doc only names the EXPORT route's
   `normalizeMeasurements`. After `event_date: string | null`, the RightPanel normalizer MUST also
   switch to `nullableString`, else it silently converts NULL -> '' and BREAKS the
   filter-measurements null-guard the whole change depends on.
2. **Row-key collision:** MatrixMapRightPanel.tsx:920 uses event_date in the React fallback key;
   undated rows need a stable key. Not in the doc.
3. **RPC SQL scope:** include the authored (owner-paste-gated) RPC migration SQL in the same PR, or a
   separate migration-only PR?

Autonomous files once confirmed: src/stores/matrix-map/measurementStore.ts (type),
src/lib/matrix-map/filter-measurements.ts (+ test), src/app/api/matrix-map/export/route.ts (+ test),
src/components/matrix-options/MatrixMapRightPanel.tsx (undated badge + normalizer + key),
scripts/matrix-map/split_etl_output.py (--source flag). Owner-gated (Supabase paste): apply the RPC
migration, verify bnrrm_env_modifier_id UNIQUE in prod, paste PATH_B chunks, run
etl_bnrrm_to_supabase.py --allow-undated. env_modifier is RESOLVED: medium='sediment' +
notes='env_modifier' (no enum change).

## Remaining MO follow-ups (unchanged + new)
1. Task 3 Map-LOAD app-layer (above) -- ready once owner answers the 3 gaps.
2. EvidenceLibrary windowed virtualization (infinite-scroll) -- OPTIONAL alternative to #387's
   pagination, only if owner prefers that UX (react-virtuoso TableVirtuoso). Pagination shipped is
   the durable fix; this is a UX preference, not a bug.
3. >50-row EvidenceLibrary integration test -- candidate follow-up (the 1088-line catalog mock made it
   disproportionate; pagination math is unit-tested + the 58-test suite covers the un-paged path).
4. defaultSelectionPolicy decisions indexing -- NOT a bottleneck (sub-10ms per useMemo); only if
   profiling shows otherwise.
5. 61 deferred dupe-candidate_group_id rows (BLOCKED on owner canonical-estimate pick).
6. BC Protocol 28 2021-jan (355, BLOCKED -- source unpinned).

## Lessons (new)
- Pagination over a windowing lib for a big-list perf fix when deps/jsdom/a11y matter; extract page
  math to a PURE helper + unit-test it; pager buttons step from the CLAMPED page (codex P3).
- Reusing #384's hardened fail-closed gating for the #386 value-level stamp drew a clean first-pass
  codex GREEN -- harden the divergent script ONCE, reuse the gates.
- Autonomous --apply while owner asleep is OK only for owner-SELECTED provenance cleanup on
  already-attested rows, codex+CI gated; NOT for design-ambiguous work (-> Task 3 teed up).

## Gate cheatsheet (per docs/GATE_MODE_SOP.md)
test:ci (4-shard) -> npx next typegen + npx tsc --noEmit -> npm run lint -> npm run docs:gate --
--base main --head HEAD -> npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 ->
npm run test:e2e -> /codex-review (Spark grind -> 5.5 xhigh) to mutual-agreement GREEN -> push -> PR
-> merge on green. Current vitest_test_count (manifest): 4460.

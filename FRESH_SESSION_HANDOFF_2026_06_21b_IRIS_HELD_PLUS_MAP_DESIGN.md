# SSTAC-Dashboard -- Session Handoff 2026-06-21b (IRIS batches HELD + Map design)

Continuation of FRESH_SESSION_HANDOFF_2026_06_21 (morning). Main at close: a0f9696. Plain ASCII.

This second window pursued three owner-directed lanes (D = US EPA IRIS RfD, E = US EPA IRIS
chem-details, F = Map-LOAD design). Net: 1 docs PR merged (#381), 1 data PR authored + attested +
HELD as draft (#380), pending a test-render fix.

---

## Merged this window
- **PR #381 (a0f9696)** -- docs(matrix-map): undated-rows consumer-contract design + ETL chunk regen
  plan. Lane F deliverable: the RPC/store/filter/UI/export contract for NULL event_date + date_precision,
  the recommended undated-filter policy (exclude under an active date filter), and the stale v1.0.0 ETL
  chunk regen plan. RESOLVES the codex env_modifier flag: Path B uses medium='sediment' +
  notes='env_modifier' (NOT medium='env_modifier'); no enum extension needed. Design at
  docs/MATRIX_MAP_UNDATED_CONSUMER_DESIGN_2026_06_21.md. Build only -- no live data changed.

## HELD (draft) -- finish next session
- **PR #380 (DRAFT, branch feat/matrix-options-iris-rfd-batch-2026-06-21, tip 70ffdbd)** --
  feat(matrix-options): promote 955 US EPA IRIS rows (680 oral RfD + 275 chem-details).
  - DATA IS DONE: owner-attested (J. Nelson, 2026-06-21), --apply'd on the branch, snapshot-validated
    (EPA IRIS canonical snapshot covers 100%). 2 data-driven scripts (promote-iris-rfd-batch.mjs +
    promote-iris-chemdetails.mjs, each reads a committed data file under scripts/matrix-options/data/)
    + 41-case tests + catalog.test HH tripwire union extended to six tools. Local test:ci 4448/0,
    tsc 0, lint 0, build/e2e green, codex commit-gate GREEN (after a P2 doc-scope fix).
  - WHY HELD: GitHub CI fails ONLY on EvidenceLibrary.test.tsx:230 "Test timed out in 60000ms". The
    955 promotions took approved HH rows 206 -> 1161 (~5.6x); EvidenceLibrary renders every row (no
    virtualization), so the full-catalog render under CI per-shard v8 coverage on a 2-core runner
    exceeds 60s. Local test:ci passed -- timeout is jsdom+coverage amplified, not a data defect.
  - TO LAND (codex Option 1, full recipe in the #380 PR comment): bound the EvidenceLibrary render
    tests to a COMPACT catalog fixture (vi.mock the catalog data source; keep the real
    audit/filter/policy logic + semantic assertions; split into a fixture-backed test file + keep a
    small live-catalog smoke test). Then rebase #380, re-gate, merge.
  - Do NOT delete the branch; the --apply is durable there and main is unaffected.

## Follow-ups (tracked; owner-gated where noted)
- **EvidenceLibrary virtualization (codex Option 2; separate UI/perf PR):** the Values table renders
  all rows + defaultPolicyDecisions computes over the full filtered library. Paginate/virtualize with
  accurate totals + cache/index the policy decisions (compute-bound, not just DOM-bound). Avoid a
  blind .slice(0,50). This is the durable fix for catalog growth; the fixture refactor above only
  fixes the TEST.
- **61 deferred dupe-candidate_group_id rows:** excluded from #380 (trimethylbenzenes / 1,1,1-TCA /
  RDX / short-chain PFAS PFBA/PFDA/PFHxA -- multiple IRIS RfD + RfC estimates per substance). Need
  owner resolution of the canonical estimate per substance (or distinguishing suffixes) before promotion.
- **Remaining needs_review HH groups:** BC Protocol 28 2021-jan (355, BLOCKED -- source unpinned +
  pending_source_locator). After #380 merges, the large US EPA IRIS groups are done; HC-priority groups
  were exhausted in the morning (HC TRV v4.0 #378).
- **Map-LOAD (owner-gated):** per the #381 design doc -- app-layer RPC/TS changes are autonomous; the
  Supabase data load (migration #373 apply + PATH_B chunk paste + --allow-undated ETL) is owner paste.

## Key lessons this window
- The catalog.test candidate_group_id uniqueness guard EARNED ITS KEEP: both IRIS verification
  subagents missed that the RfD (46) and chem-details (15) batches contained dupe-candidate_group_id
  rows; the dry-run's fail-closed guard caught them, and they were cleanly excluded (726->680, 290->275).
- Local test:ci (CI=true + coverage) can still pass while GitHub CI fails on a render-heavy
  component test: jsdom + per-shard v8 coverage on a 2-core runner is ~5x slower. A data change that
  multiplies rendered rows can cross the 60s per-test cap on CI only. Pin attestation-scope counts in
  tests (the codex P2): assert EXACT id counts, not loose lower bounds, so scope is honest.
- For >~100-row promote scripts, generate the scope into a COMMITTED data file under
  scripts/matrix-options/data/ that the script reads (avoids a 700-line inline array + the long-write
  truncation risk); export the allowlist for the catalog.test tripwire.

## Session close checks
- Branches: docs branches deleted + pruned; the #380 IRIS branch PRESERVED (held PR).
- Orphan check: see ledger (report-only; owner runs parallel sessions).

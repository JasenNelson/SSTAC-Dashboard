# Fresh Session Handoff - Matrix Options Post-Organomercury Checkpoint - 2026-07-09

## Current Main

- Current `origin/main`: `3293bb4` (`test(engine-v2): repair offline E-58 import verification script (#556)`).
- Matrix Options substantive latest merge: PR #555 at `11cc825` (`feat(matrix-options): implement phenylmercuric acetate (Option A1)`).
- Note: #556 is unrelated engine-v2 work merged after #555. Do not confuse the current main tip with the Matrix Options lane state.

## Completed Matrix Options Work

- Phase B is merged and green:
  - #540 D1 dioxin-like TEQ TDI.
  - #541 D4 BC PAH remap.
  - #542 D2 BaP ADAF tags.
  - #543 handoff plus D3 closeout.
- A3 DL-PCB TEQ parallel screening card is merged and visually QA'd green:
  - #545 merged.
  - PCB QA showed the mass-based total-PCB card plus DL-PCB TEQ card.
  - BaP QA confirmed the DL-PCB TEQ card is absent for non-PCB substances.
- Autonomy/docs/tooling support is merged:
  - #548 Matrix Options autonomous docs/status preservation.
  - #549 E2E auth visibility route assertion.
  - #550 HC TRV and probe portability tooling.
  - #552 Matrix Options execution map consolidation.
  - #554 Organomercury owner-decision packet preservation.
- Organomercury Option A1 is merged:
  - #555 merged at `11cc825`.
  - `phenylmercuric_acetate` is present in `src/lib/matrix-options/substanceLibrary.ts`.
  - It uses `contaminantClass: 'organic'`, `abs_dermal: 0.1`, and `ba_oral: 1.0`.
  - No new `organomercury` class was added.
  - Tests in `src/lib/matrix-options/__tests__/substanceLibrary.test.ts` assert the entry, RfD, class, `abs_dermal`, and `ba_oral`.
  - Main CI/CD run `28993382067` completed `SUCCESS` for the #555 merge commit.

## Open Matrix Options PRs

- #557 `docs(matrix-options): Cyanide Selection Guidance Packet`
  - Head at last Codex check: `a7d849f`.
  - Scope: one docs file, `docs/MATRIX_OPTIONS_CYANIDE_SPECIATION_PACKET_2026_07_08.md`.
  - Content corrections applied:
    - Restored guardrail that cyanide runtime entries are already wired.
    - Restored "not a missing code-wiring task" framing.
    - Clarified no cyanide/speciation code should be implemented until owner approves a selection convention.
    - Replaced over-strong cumulative-calculation wording with safer assessment/reporting wording.
    - Replaced over-strong metal-cyanide toxicity wording with compound/salt representation wording.
    - Named real likely UI files after inspection: `SubstanceCombobox.tsx`, `MatrixDashboard.tsx`, and possibly calculator panes.
    - Strengthened non-goals for value, catalog, `src/data`, status, default, key-removal, and silent-collapse changes.
  - Status at checkpoint creation: GitHub CI was still running, with earlier docs/security/lint checks green and Unit Tests in progress.
  - Do not merge #557 until CI is fully green and merge state is clean.

## Blocked / Owner-Gated Work

- Cyanide selection guidance implementation:
  - Blocked on owner choice of strategy.
  - Candidate strategies documented in #557:
    - A: UI guidance only.
    - B: preferred/recommended key convention.
    - C: grouping/alias warning.
    - D: hard filtering/collapse, not recommended without explicit authorization.
  - Recommended first implementation after approval: warning/helper text only, with no value or catalog changes.
- Phase C TEF/RPF verification:
  - Blocked by missing primary PDFs: WHO-2005, WHO-1998, and Health Canada PQRA H129-108-2021.
- PCB key alias/deprecation:
  - Blocked by catalog migration strategy and explicit owner authorization.
- Inhalation-only values/schema support:
  - Requires product/schema design before implementation.
- Ontario MECP TRV ingestion:
  - Requires source extraction plan and catalog mutation approval.

## Hard Boundaries For Next Session

- Matrix Options lane only unless explicitly redirected.
- Do not touch:
  - `.mcp.json`
  - Supabase config, branches, SQL, or migrations
  - Gate2B files
  - `src/lib/engine-v2/**`
  - `src/app/api/engine-v2/**`
  - `matrix_reviews`
  - `src/data/**`
  - `matrix_research/reference_catalog/**`
  - review statuses, `qa_status`, `default_status`, promotions, or demotions
- Use fresh worktrees from current `origin/main`; do not mutate the dirty primary checkout.
- Path-scoped staging only. Never `git add .`, `git add -A`, or `git add -u`.
- Use the monitored build gate, never raw `npm run build`:
  - `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`

## Recommended Next Steps

1. Finish monitoring #557.
2. If #557 is green and clean, merge only with owner authorization, then monitor main CI.
3. If owner approves cyanide implementation, prefer a small UI guidance/warning increment, not filtering or key collapse.
4. If owner does not approve cyanide yet, move to a report-only design lane for inhalation schema support or Phase C source preflight.

## AGY / Codex Operating Notes

- AGY is useful as the mechanical workhorse for bounded docs, tests, and implementation once scope is specified.
- Codex should continue acting as orchestrator/reviewer:
  - verify AGY claims against live git/GitHub state;
  - keep forbidden paths out of scope;
  - require final-diff gates before commit/merge;
  - avoid broad context-heavy review loops unless there is a real blocker.

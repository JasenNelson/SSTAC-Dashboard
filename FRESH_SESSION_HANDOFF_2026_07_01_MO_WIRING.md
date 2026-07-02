# FRESH SESSION HANDOFF -- Matrix-Options (wiring lane COMPLETE + whole-library QA AUDIT done)
Date: 2026-07-01 (night)

## STATUS

Two lanes closed tonight:
1. **Organic HH-oral-RfD WIRING lane COMPLETE** -- 16 batches G-V, 270 substances, SUBSTANCE_LIBRARY
   119 -> 389, manifest vitest_test_count -> 4823 (PRs #418-#434; lane-complete handoff #435).
2. **Whole-library QA AUDIT** -- 4 multi-agent workflows over all 389 entries + the eco catalog,
   ~110 verified findings, capstone consolidated decisions doc + safe fixes shipped.
3. **POST-AUDIT EXECUTION (2026-07-02, owner-greenlit lanes 2/1/3):** #444 value corrections
   (copper/lead RfD, BaP SF; nulled 6 dead eco-TRVs), #445 wired 11 HH coverage gaps, #446 added
   'inorganic' ContaminantClass + wired 17 inorganics (Batch W). SUBSTANCE_LIBRARY 389 -> 406,
   manifest -> 4840. 14 PRs total tonight (#434-#446). Details: memory `dashboard_mo_audit_lane_2026_07_01`.

## IMMEDIATE NEXT: Lane 1 ECO wiring (deferred, needs investigation FIRST)

The 36 eco field-updates (fcv_ug_per_L / trv_eco_mg_per_kg_bw_day) from the audit are NOT yet wired.
KEY: the eco static fields are FALLBACKS -- `resolveEcoSeed()` (src/lib/matrix-options/ecoSeed.ts)
supplies the catalog value dynamically first; the static field is only used when the dynamic path
returns null (and the eco-food BSAF gate blocks it when bsaf_loc_freshwater is null). So BEFORE wiring
any eco field: analyze which of the 36 candidates the static value actually reaches (load-bearing) vs
which are dynamic-redundant. The 7 eco TEXT-DATA CONTRADICTIONS (entry's own sources/notes claim a
value that is null: chloroform fcv, chromium trv, benz_a_anthracene trv, chlordane fcv, total_pcbs fcv,
pyrene trv, ddt fcv) are the clearest safe subset (wire to match the shipped provenance). Spec:
scratchpad lane1_spec.md (this session).

## START HERE (next session)

**Read `docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md` FIRST** (PR #441). It is the
de-duplicated owner-decision list: 43 line items / ~170 substance-field corrections, grouped:
1. VALUE CORRECTIONS (real bugs, HITL): copper RfD 0.04 (no IRIS row; HC 0.426), benzo_a_pyrene SF 1.0
   (vs 2.0/1.289), lead RfD 0.0035 (vs 0.0005), total_pcbs SF 2.0 (cross-key borrow); eco-TRV metal
   mismatches (copper/cadmium/zinc/arsenic/lead/BaP off 24-1500x from approved FCSAP rows).
2. abs_dermal ANOMALIES: vinyl_chloride 1.0 (extreme, likely data-entry error); VOC-RAF misapplied to
   non-VOCs (DEHP/TNT/2_4_DNT/1_2_4_5_tetrachlorobenzene); divalent-metal deviations. (naphthalene
   0.148 confirmed CORRECT -- no action.)
3. BUILD-FIRST WIRING GAPS (~90 approved-but-unwired HH+eco values): benzene/DDT/naphthalene-RfD/etc.;
   7 eco text-data contradictions; ~33 eco gaps; PHC family; + the 37 excluded metal/inorganic subs.
4. CLASSIFICATION: the 'inorganic' ContaminantClass decision (Option B recommended -- blast-radius
   confirmed a safe 1-line type change; see EXCLUDED_CLASSES_ARCHITECTURE_DECISION doc); maneb.
5. PROVENANCE: ~36 truncated sources + a few remaining citation gaps.

Memory anchor `dashboard_mo_audit_lane_2026_07_01` has the full method + lessons.

## SHIPPED THIS SESSION (all merged or in-flight, gated)

- #434 Batch V wiring; #435 lane-complete handoff.
- #436 audit + excluded-classes proposal + value-reconciliation + audit tool.
- #437 3 stale-needs_review note fixes; #438 architecture decision brief; #439 deep audit (59).
- #440 9 provenance-truth fixes (7 needs_review + 2 backwards HC/IRIS attribution). [in CI]
- #441 eco round-2 audit (52) + consolidated HITL decisions. [in CI]

## GUARDRAILS (owner-corrected mid-session)

- AUTO-SHIP only documentation-truth text fixes (codex-gated). Build-first WIRING of approved values,
  the 'inorganic' type change, and fabricating abs_dermal per substance = NOT autonomous -> owner
  sign-off (all teed up in the consolidated doc).
- Run `npx tsc --noEmit` before shipping ANY new .ts (tsconfig includes **/*.ts; tsx does not typecheck).
- codex = OpenAI backend, independent of the Claude 5h limit; safe alongside Claude workflows.
- Consolidation/synthesis agents only see CURRENT-branch files -- merge audit docs to main before
  consolidating.

## TOOLS

`scripts/matrix-options/audit-substance-library.ts` (npx tsx) -- reusable deterministic checker
(value-vs-catalog, dual-source, dup-key, class-heuristic). `scripts/matrix-options/wire-recon.mjs` --
re-run for the authoritative wireable pool (note: its display_name collapse is a known display bug).

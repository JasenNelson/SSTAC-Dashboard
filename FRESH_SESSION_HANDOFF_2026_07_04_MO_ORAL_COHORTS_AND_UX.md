# FRESH SESSION HANDOFF -- 2026-07-04 -- MO oral cohorts + calculator UX investigation

Continues the overnight MO oral-cohort run. **Main tip at close: ~509b878 + PRs #475 (merging).**
Read this + `OVERNIGHT_REPORT_2026_07_04.md` + `docs/MATRIX_OPTIONS_CALCULATOR_UX_INVESTIGATION_2026_07_04.md`.

## SHIPPED this session (PRs #470-#475; vitest 4878 -> 4918)
- #470 Phase 1a (5 metal-salts + 2 organometallics own keys), #471 A1 (toluene/ethylbenzene/xylenes HC),
  #472 A2 (carbon_tetrachloride/tetrachloroethylene HC), #473 A3 (chlorobenzene/dichlorobenzene_1_2 HC +
  trichloroethylene IRIS-override), #474 (overnight report/queue), #475 (M1a re-picks: antimony 0.006->
  0.0004, cadmium 0.001->0.0008, manganese 0.14->0.025 -- MERGING at close, confirm on main).
- 15 substances wired + 3 re-picked, all live-verified + fully gated + self-merged.

## OWNER DECISIONS LOCKED this session (do NOT re-ask)
- Jurisdiction conflicts: Health Canada default (BC Protocol 1 s4.4); most-protective + LOG on genuine
  conflict; one-source-multi-endpoint = surface options (not ambiguous); re-picks logged not auto-changed.
- HC re-picks where HC is LESS protective (zinc, methylmercury): KEEP the more-protective IRIS value (do
  NOT re-pick). Only re-pick where HC is MORE protective.
- benzo_a_pyrene: wire HC 6.67e-5 (needs a catalog-row ADD + fix the mislabeled "HC 0.0003" row).
- Broader HC/P28 catalog-integrity audit: APPROVED (run it).

## REMAINING MORNING WORK (owner-approved; NOT yet done) -- pick up here
All detail + evidence in OVERNIGHT_REPORT_2026_07_04.md (top "MORNING DECISIONS" section).
- **M1b (catalog fixes + wire):** chromium_trivalent -> 1.5 (catalog HC 0.3 is WRONG; HC==IRIS==1.5) and
  barium -> 0.2 (catalog HC 0.19 WRONG; HC==IRIS==0.2). Each: correct/replace the bad HC catalog row, then
  wire the substance (resolves SOURCED to IRIS 1.5/0.2). Live-verified.
- **M2 (benzo_a_pyrene):** add an HC 6.67e-5 catalog row + fix the mislabeled pv-hc-bap-hh-direct-rfd-tdi
  (=0.0003, actually the IRIS value) + wire BaP rfd_oral 6.67e-5. (Owner chose HC most-protective.)
- **nickel_chloride dual-option:** add the 0.02 HC headline catalog row (0.0013 reproductive already
  exists) + seed library default 0.02, so both surface as options.
- **Broader HC/P28 audit:** Workflow fan-out over remaining wired values sourced from HC or BC P28 (the
  error-prone class -- 4 errors found in ~20 checked: chromium_trivalent, barium, benzo_a_pyrene,
  antimony) -> discrepancy report. READ-ONLY.

## KEY LESSON (load-bearing): CATALOG "HC" VALUES ARE UNRELIABLE
Live-verification found 4 wrong/fabricated "HC" oral RfD values in ~20 checked. The cracked
`scratchpad/trv40.txt` Table 1 grid is OCR-garbled; the Appendix A per-substance narrative + the CLEAN
downloaded HC PDF (`scratchpad/hc_trv_2021b.pdf`) are RELIABLE. ALWAYS verify HC values against the live
source before wiring; never trust the repo catalog's HC rows.

## THE current_default SCAFFOLD COUPLING (learned in M1a -- important for re-picks)
Some substances (arsenic, zinc, cadmium, methylmercury) have current_default SCAFFOLD rows in
parameter_values.json (src-current-calculator-design-v1) that MUST mirror the library value, enforced by
catalog.test "current_default sync" guard. A re-pick of such a substance requires ALSO updating its
scaffold row(s) + the resolver.integration hhDefaultLoad test value. antimony/manganese had no scaffold
(clean); cadmium did (synced 0.001->0.0008). Check for a current_default scaffold before any re-pick.

## CALCULATOR UX INVESTIGATION (docs/MATRIX_OPTIONS_CALCULATOR_UX_INVESTIGATION_2026_07_04.md)
Investigated 3 owner concerns; codex-reviewed to mutual-agreement (see the doc's "v2" section). Findings:
- Substance dropdown = NOT filtered (all 414 shown). "Limited options" = eco-pathway computability gates
  (EqP logKow ~50/414) + no search UX + the frame-coupled receptor dropdown. OPEN Q for owner: which tab
  were you on?
- Regulatory frame: one global control drives 4 mechanisms + blanks eco outputs (inconsistent per-pathway);
  awkwardness diagnosed.
- Eco receptors bird/mammal-only = BY DESIGN (wildlife dietary-dose TRV; fish/invert/plant = aquatic life
  via Eco-Direct EqP). Do NOT add them. Fix = relabel (drop misleading "/Fish" title at
  EcoFoodBSAFCalculator.tsx:443) + cross-link.
NEXT (low-risk, ready to implement on owner go-ahead, codex-agreed priority): (1) substance combobox +
applicability-reason badges; (2) Eco-Food relabel + EqP cross-link; (3) consolidated frame-impact card;
(4) explicit eco empty/diagnostic states. Owner-gated: (6) frame compare-mode, (7) EqP logKow override for
nonionic organics only + catalog expansion (not library backfill). codex risk-flag: do NOT relax the EqP
logKow gate broadly (null logKow = "not applicable" for metals/ionic/PFAS, not "missing").

## PARALLEL SESSION COORDINATION (owner 2026-07-04)
A Regulatory-Review parallel session works in a SEPARATE worktree on regulatory-review content (different
area from matrix-options), developing a PR before merge. Low coupling. Watch: (1) docs/_meta/docs-manifest.json
vitest_test_count line (both bump it -> rebase + re-run test:ci to re-derive on the second merge); (2) rebase
on latest main right before merging (main moves ~every 20 min); (3) worktree hygiene L0 1.15 (git worktree
add; remove node_modules junction FIRST on cleanup). No PR gating needed (different area).

## PROCESS / gate pattern (per PR)
Branch off latest main -> Sonnet verifies value live -> AGY authors (retry once on cold-start bail) ->
add resolver.integration SOURCED case -> tsc + test:ci (authoritative) -> manifest bump (atomic node,
+facts_history) -> lint + monitored build -> codex 5.5 xhigh (tight verdict-forcing prompt) -> path-scoped
commit -> push -> PR -> poll CI (E2E ~13-20 min, slow) -> self-merge on all-green. Batch 2-4 subs/PR.
Scratch is .tmp_* (gitignored). GitHub CI is the authoritative build+e2e gate for the merge.

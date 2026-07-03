# FRESH SESSION HANDOFF -- 2026-07-02 -- Matrix-Options POST-AUDIT CORRECTNESS Lane

Continues [[dashboard_mo_audit_lane_2026_07_01]] (docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md).
Memory anchor: `dashboard_mo_correctness_lane_2026_07_02`.

Read this file first. It should get a fresh session oriented in under 2 minutes.

---

## 1. SESSION SUMMARY

Turned the 2026-07-01 audit backlog into real, source-verified correctness fixes in
matrix-options. The handoff-framed "6 eco fills" idea from the prior session was
INVESTIGATED to ground truth and CANCELLED (would have leaked stale/unsupported values);
the actual work done instead was six PRs:

1. **#448** -- `docs(matrix-options): eco-note provenance truth + phantom-SF + dual-source
   citations`. Fixed dishonest eco-notes (pyrene/DDT falsely claimed "HH fields null",
   a phantom source-factor citation, 4 substances needing dual-source citations).
   MERGED to main (26d68c1 / cd0a145 merge).

2. **#449** -- `fix(matrix-options): suppress static eco fallback in
   reference_only/unsupported frames`. Root cause: `computeFcvSeed` / `computeTrvSeed`
   fell back to the STATIC `substanceLibrary` eco value UNCONDITIONALLY whenever
   `resolveEcoSeed()` returned null -- but `reference_only` / `unsupported` frames are
   reachable in the UI, so the static value leaked into frames where it should not
   display. Fix = Option A, status-only suppression via `getPathwayApplicability`.
   Rejected "B-lite" (a catalog-presence gate), which codex caught would have
   regressed the correct current_default display. MERGED (0c615e4 / fa43b42... see
   commit fa43b42 merge for #450 -- #449 merge commit is cd0a145).

3. **#450** -- `fix(matrix-options): sync stale current_default catalog scaffolds to
   the corrected library`. The prior #444 fix corrected `substanceLibrary.ts` values
   but not the parallel catalog -- left 7/57 `current_default` scaffolds in
   `parameter_values.json` stale. Synced 6 rows + deleted the now-orphaned
   `pv-bap-trv-eco` row + added a GUARD TEST asserting current_default catalog rows
   must mirror the live library going forward. MERGED (6c12b7a / fa43b42 merge).

4. **#451** -- `fix(matrix-options): correct Group 2 abs_dermal deviations
   (source-verified: EPA RAGS Part E / HC Table 5)`. 6 SVOCs reverted 0.03 -> 0.1
   (RAGS SVOC default is 0.1, not 0.03). KEPT TNT at 0.03 (real EPA supplemental
   ABSd of 3.2%, Reifenrath 2002) and kept 5 VOCs at 0.03 (Health Canada VOC
   RAFDerm) and kept `total_pcbs` at 0.14 (RAGS PCB-specific value). MERGED
   (010e64f / eb07497 merge).

5. **#452** -- `fix(matrix-options): arsenic -> IRIS 2025 (RfD 6e-5 / SF 32) +
   Cluster E dormant abs_dermal cleanup`. Arsenic (inorganic) RfD corrected
   3e-4 -> 6e-5 and SF 1.5 -> 32 -- EPA IRIS FINALIZED this update in January 2025
   (~5x / ~21x tighter than the old values); the catalog row `pv-iris-arsenic`
   already had the correct number, only the library had lagged. Also synced
   arsenic's `current_default` catalog scaffolds; kept BC Protocol 28 value as a
   `needs_review` alternative (not canonical). Plus Cluster E DORMANT abs_dermal
   cleanup: vinyl_chloride 1.0 -> 0.03, 7 metals -> 0.001, and Cr(VI) reverted too
   (codex: sensitization is a potency signal, not an absorption-fraction driver).
   MERGED (71d41c9 / fd91058 merge -- current tip of main).

6. **eco-statics DEMOTE/PROMOTE** -- shipped as **PR #453** (branch
   `fix/mo-eco-statics-demote-promote-2026-07-02`). At handoff time #453 was OPEN with
   codex mutual-agreement GREEN (5 rounds) + all 6 push gates GREEN; CI was finishing
   (Unit/Lint/Build passed, E2E/Perf pending) and it merges on green per the standing
   pre-approval. Verify final state with `gh pr view 453` / `gh pr list`. Historical
   detail below (pre-commit working-tree notes) is superseded once #453 is merged:
   - Working tree on this branch has UNCOMMITTED modifications (not yet
     `git add` / committed): `matrix_research/reference_catalog/parameter_values.json`,
     `src/lib/matrix-options/substanceLibrary.ts`, and four test files
     (`MatrixDashboard.test.tsx`, `EcoDirectEqPCalculator.test.tsx`,
     `EcoFoodBSAFCalculator.test.tsx`, `provenance/__tests__/catalog.test.ts`,
     `provenance/__tests__/library.test.ts`).
   - Untracked helper script: `scripts/matrix-options/promote-pcb-fcv-nrwqc.mjs`
     (+ `scripts/matrix-options/_recon/` scratch dir).
   - No commit exists on this branch yet (`git log origin/main..HEAD` is empty) and
     no PR has been opened for it.
   - Intent (per memory anchor): DEMOTE 3 eco statics whose cited sources do not
     exist (`benzo_a_pyrene.fcv`, `total_pcbs_aroclor_1254.trv`,
     `methylmercury.trv` -- all fabricated-source) + PROMOTE
     `total_pcbs_aroclor_1254.fcv` to 0.014, re-cited to a real, verified EPA
     NRWQC source.
   - **NEXT SESSION ACTION**: inspect the uncommitted diff on this branch, confirm
     it matches the stated intent, run codex mutual-agreement review, then follow
     the normal commit -> 6-gate push -> PR -> merge sequence (owner pre-approved
     merge-on-green for this lane this session -- reconfirm that approval still
     stands if much time has passed).

---

## 2. KEY ARCHITECTURE NOTES (eco system -- read before touching eco values again)

- `current_default` rows in the reference catalog
  (`matrix_research/reference_catalog/parameter_values.json`) are **EXCLUDED** from
  `resolveEcoSeed()` eligibility. This means the STATIC value in
  `src/lib/matrix-options/substanceLibrary.ts` is the INTENDED current-default
  display value for eco pathways in SUPPORTED frames -- it is not a bug that the
  static value "wins" there.
- The bug (#449) was that this same static-fallback behavior in
  `computeFcvSeed` / `computeTrvSeed` ALSO fired in `reference_only` /
  `unsupported` frames, where it should have been suppressed. Fixed via
  status-only suppression using `getPathwayApplicability` (Option A). A
  catalog-presence gate ("B-lite") was considered and rejected because it would
  have broken the correct current_default display in supported frames.
- The #450 guard test enforces that `current_default` catalog scaffolds always
  mirror the live `substanceLibrary.ts` value -- prevents a repeat of the #444/#450
  drift (library corrected, catalog scaffold left stale).
- `abs_dermal` is a DENOMINATOR term in the `sedS` calculation -- a HIGHER
  abs_dermal value is MORE conservative (not less). Keep this in mind when
  reviewing any abs_dermal correction: "reverting upward" (e.g. 0.03 -> 0.1) is a
  conservatism increase, not a loosening.

---

## 3. OPEN ITEMS / NEXT-SESSION PRIORITIES

In rough priority order:

1. **Finish/land the eco-statics PR** (see item 6 above) -- smallest, most
   immediate task.
2. **Group 3 build-first WIRING gaps** (~90 approved-but-unwired values from the
   consolidated audit doc `docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md`)
   -- NOT started. Likely the largest remaining lane by volume.
3. **36 truncated eco-registry `sources` citations** -- need primary-source
   re-derivation (PubChem / ATSDR / HSDB). DEFERRED, not started.
4. **Duplicate-PCB-key consolidation** -- `total_pcbs_aroclor_1254` vs
   `polychlorinated_biphenyls_total_pcbs` overlap. Deferred, owner/HITL decision
   needed on which key is canonical.
5. **Re-derive nulled eco values if a real source turns up**: `benzo_a_pyrene`
   FCV, `methylmercury` TRV, and `total_pcbs_aroclor_1254` TRV were NULLED this
   lane (no verified source existed) -- these are candidates for future re-fill,
   not permanent gaps.
6. Group 1 value corrections and Group 2 abs_dermal corrections from the
   consolidated audit doc are now COMPLETE -- do not re-open unless new evidence
   surfaces.

---

## 4. LESSONS (apply these before any further value work)

- **VERIFY AGAINST THE LIVE SOURCE, NOT MEMORY.** This session's own trained
  memory said IRIS arsenic was RfD 0.0003 / SF 1.5 (1991/1998 values) -- that was
  OUTDATED; EPA finalized 6e-5 / 32 in January 2025. Live verification also
  correctly KEPT TNT and the VOC cohort at abs_dermal 0.03 (a naive "revert
  everything" pass would have wrongly changed them), and found 3 eco statics
  citing sources that do not exist. Always delegate a live-source verification
  subagent before making ANY value change -- never trust recalled figures for
  regulatory constants.
- **Subagents stall if they background a process then end their turn.** Keep any
  async work (test:ci runs, manifest updates) on the orchestrator (foreground),
  not delegated to a subagent that backgrounds-and-exits.
- **Manifest `facts_history` needs a MANUAL entry.** The manifest updater script
  overwrites a superseded live fact in place; it does NOT move the old value into
  `facts_history` for you -- add that entry by hand per the facts_policy.
  (Recorded previously as `dashboard_manifest_live_fact_needs_facts_history_entry`.)
- **CI "write EPIPE" worker crash is a known flake**, not a real failure -- it is
  the Node-24/coverage worker-crash signature seen before. Response: `gh run
  rerun --failed`, do not treat as a genuine regression.
- Codex adversarial review earned its keep this session: caught the B-lite ->
  Option A reversal in #449, a 2,4-DNT source/note consistency issue, and
  EvidenceLibrary-fixture staleness.

---

## 5. GATE / PROCESS POINTERS

- Gate discipline authority: `docs/GATE_MODE_SOP.md`. Read before any commit or
  push.
- Every PR this session followed: commit (via `/codex-review` adversarial loop to
  mutual-agreement GREEN) -> full 6-gate push suite on the final tip -> CI green
  on GitHub -> merge.
- Owner pre-approved merge-on-green for this lane this session -- reconfirm this
  standing approval is still in effect if starting a new session materially later.
- Memory anchor for full session detail: `dashboard_mo_correctness_lane_2026_07_02`
  (continues `dashboard_mo_audit_lane_2026_07_01`).
- Consolidated audit backlog (source of Group 1/2/3 items): 
  `docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md`.

---

## 6. CURRENT REPO STATE AT HANDOFF TIME

- `main` tip: `fd91058` (merge of PR #452).
- Current branch: `fix/mo-eco-statics-demote-promote-2026-07-02` (uncommitted
  working-tree changes only -- see section 1 item 6).
- Recent main history (newest first):
  ```
  fd91058 Merge pull request #452 (arsenic IRIS 2025 + Cluster E abs_dermal)
  71d41c9 fix(matrix-options): arsenic -> IRIS 2025 (RfD 6e-5 / SF 32) + Cluster E dormant abs_dermal cleanup
  eb07497 Merge pull request #451 (Group 2 abs_dermal)
  010e64f fix(matrix-options): correct Group 2 abs_dermal deviations
  fa43b42 Merge pull request #450 (current_default catalog-scaffold integrity)
  6c12b7a fix(matrix-options): sync stale current_default catalog scaffolds to the corrected library
  cd0a145 Merge pull request #449 (eco static-fallback leak fix)
  0c615e4 fix(matrix-options): suppress static eco fallback in reference_only/unsupported frames
  2e91ca4 Merge pull request #448 (eco-note doc-truth)
  26d68c1 docs(matrix-options): eco-note provenance truth + phantom-SF + dual-source citations
  37345a0 Merge pull request #447 (post-audit execution lanes checkpoint)
  63071de docs(matrix-options): checkpoint -- record post-audit execution lanes + eco-lane-next
  ```
- Run `gh pr list` at the start of the next session to check whether the
  eco-statics PR has since been opened/merged by a parallel or later session.

---

*Authored 2026-07-02. Sources: memory anchor `dashboard_mo_correctness_lane_2026_07_02`,
`git log --oneline -12`, `git branch --show-current`, `git status --short` on
`C:\Projects\sstac-dashboard`.*

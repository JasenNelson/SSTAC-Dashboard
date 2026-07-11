# T23 -- IRIS orphan recon (READ-ONLY)

Worktree read: `C:\Projects\SSTAC-Dashboard-worktrees\mo-phase0-2026-07-11`
HEAD at time of recon: `5b08a3edf72c58819bb1c53e4f48785c92eb0931` "docs(matrix-map): add
waterbody_type normalization proposal (T18)" (clean working tree; no `promote-iris-*.mjs`
files exist at this path -- note the task brief said `mo-phase0-2026-07-11 (a5ac86a)`; the
actual checked-out HEAD differs from a5ac86a, recorded here for the record. No repo file was
modified; no git/npm/promote command was run).

## 1. IRIS tooling inventory

Pipeline (read in full or in relevant part):

- `scripts/matrix-options/iris-orphan-recon.py` -- **Phase A recon** (read-only). Reads the
  authoritative EPA export at `EXCEL_PATH = C:\Users\jasen\Downloads\Chemicals_Details (1).xlsx`
  plus the current catalog (`matrix_research/reference_catalog/human_health_trv_values.json` +
  `parameter_values.json`) plus the committed snapshot
  (`src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json`). Classifies
  every (substance, input_key) EPA toxicity row into ALREADY_COVERED / ORPHAN_NEW_INPUT /
  ORPHAN_NEW_SUBSTANCE / AMBIGUOUS / KEY_COLLISION / DATA_QUALITY / unparseable. Writes
  `.tmp/iris-orphan-recon.json` (structured) and `docs/MATRIX_OPTIONS_IRIS_ORPHAN_RECON_2026_06_02.md`
  (owner-facing report, COMMITTED to the repo).
- `scripts/matrix-options/build-iris-orphan-pass.mjs` -- **Phase B builder** (would write, not run
  here). Reads the Phase A `.tmp/iris-orphan-recon.json`, extends the EPA snapshot with new
  anchors, and emits a staging SQL pass for `catalog_extraction_staging` in newinput-ambiguous or
  new-substance mode.
- `scripts/matrix-options/promote-iris-rfd-batch.mjs` -- promotes 680 of 726 needs_review IRIS
  oral-RfD rows (source `src-us-epa-iris-rfd-table-live`); excludes 46 duplicate-candidate-group
  (dupe-cg) rows.
- `scripts/matrix-options/promote-iris-chemdetails.mjs` -- promotes 275 of 290 needs_review IRIS
  chemical-details rows (IUR/RfC/oral-SF; source `src-us-epa-iris-chemical-details-live`);
  excludes 15 dupe-cg rows.
- `scripts/matrix-options/promote-iris-carcinogen-rfd.mjs` -- promotes 6 specific oral-RfD rows
  (HCB, PCP, 1,4-dioxane) that were split out earlier.
- `scripts/matrix-options/promote-iris-dupe-cg-canonical.mjs` -- promotes 14 of the 46 dupe-cg
  rows (trimethylbenzenes x3, 1,1,1-trichloroethane, RDX) after live EPA re-verification of the
  canonical chronic value; PFAS dupe-cg groups explicitly out of scope.
- `scripts/matrix-options/promote-iris-pfas-dupe-cg-canonical.mjs` -- promotes PFBA + PFHxA
  canonical chronic oral RfD rows (4 rows: direct+food each); PFDA explicitly deferred (EPA has no
  single overall RfD for PFDA).
- `scripts/matrix-options/promote-iris-pfda-dupe-cg-canonical.mjs` -- promotes the 2 PFDA chronic
  oral-RfD rows (2e-9 mg/kg-bw/day, direct+food) picked by the owner 2026-06-23.

All promote-iris-*.mjs scripts read their target row identity from a hard-coded data file under
`scripts/matrix-options/data/iris-*.json` (drift-detection: the script fails closed if the live
catalog no longer matches the file), not from a live re-scan of the Excel each run.

## 2. IRIS source data location -- PRESENT, external to the repo

`C:\Users\jasen\Downloads\Chemicals_Details (1).xlsx` **exists** (62,366 bytes, modified
2026-05-31 12:17). A second, older variant `Chemicals_Details.xlsx` (no "(1)", 2026-05-23) also
exists in the same folder; the two were not diffed (out of scope, would require opening both
workbooks). This file is NOT committed to the repo -- it lives on the owner's local filesystem
only, exactly as the recon script's docstring expects (`EXCEL_PATH` is a hard-coded absolute path
outside `C:\Projects\`). No `.tmp/iris-orphan-recon.json` exists in this worktree (`.tmp/` is
absent entirely) -- that artifact is git-ignored/ephemeral and was not regenerated for this task
(regenerating it would require running the recon script, which also overwrites the COMMITTED
`docs/MATRIX_OPTIONS_IRIS_ORPHAN_RECON_2026_06_02.md` -- forbidden under this task's read-only
scope).

## 3. Prior recon artifact -- present, but STALE (dated 2026-06-02)

`docs/MATRIX_OPTIONS_IRIS_ORPHAN_RECON_2026_06_02.md` is committed and was read directly. Its
totals as originally computed (2026-06-02, against the catalog AS IT STOOD THAT DAY):

| Bucket | Groups (substance x input) | Distinct substances |
|---|---|---|
| Already covered | 137 | -- |
| ORPHAN new-input | 42 | 29 |
| ORPHAN new-substance | 407 | 338 |
| AMBIGUOUS (owner adjudication) | 21 | 16 |
| DATA-QUALITY flagged | 3 | -- |
| Unparseable | 0 | -- |

This is the "IRIS orphan picture" as it existed the day the recon ran. It is now stale: per
`matrix_research/reference_catalog/iris_qa_promotion_apply_sheet_2026_06_04.md` (also read), a
bulk "live-Excel cross-walk" robot-extraction pass landed within days of the recon and loaded
"roughly 1020" IRIS TRV rows into the catalog as `needs_review` -- i.e. essentially the entire
orphan pool the recon had just identified was staged into the catalog (not promoted/approved yet,
but no longer absent). The subsequent promote-iris-*.mjs scripts (dated 2026-06-04 through
2026-06-23, listed in section 1) then approved the large majority of those staged rows.

## 4. Current catalog state (measured directly, read-only, 2026-07-11)

Queried `matrix_research/reference_catalog/human_health_trv_values.json` directly (1574 total HH
TRV records):

- **1107 records** are IRIS-tagged (display_name or source_ids containing "iris").
- **1066 approved**, **41 needs_review** (all 41 carry `pv-iris-*` ids) -- this exactly matches
  the T22 finding cited in the task brief ("pv-iris-* has 41 needs_review rows already in the
  catalog").
- `default_status`: 1093 `available_option`, 14 `current_default`.
- The 41 needs_review rows span only **8 distinct substances**.

**Cross-check against the recon's 21 AMBIGUOUS entries** (the bucket most likely to still be a
true gap, since it needed owner adjudication before generation): all 21 substance/input pairs
(acetonitrile, anthracene, antimony, benzyl_chloride, chlorodifluoromethane, chloroform x2,
cyanogen, cyanogen_bromide, epichlorohydrin x3, ethylene_oxide, hexachlorobutadiene x2, methanol
x2, methyl_isobutyl_ketone_mibk, nickel_subsulfide, silver, triethylamine) were queried against
the current catalog by exact (substance_key, canonical input_key) pair. **All 21 are now present
and `qa_status = approved`**, attached to the pre-existing (non-IRIS-minted) substance_key exactly
as the recon's ambiguous-resolution path intended. Zero of the 21 are still missing.

## 5. True orphans vs already-staged needs_review -- the T22 cross-check

The 41 needs_review `pv-iris-*` rows were individually inspected (substance_key, input_key,
value, candidate_group_id, source_ids). Every one of the 41 is a **non-canonical
duplicate-candidate-group alternate**, explicitly and by design left `needs_review` by the
promote-iris-dupe-cg-canonical / -pfas-dupe-cg-canonical / -pfda-dupe-cg-canonical scripts'
own doc comments:

- 1,1,1-trichloroethane: 3 alternate inhalation RfC estimates (7, 9, 6 mg/m3) beyond the one
  already-canonical value.
- 1,2,3- / 1,2,4- / 1,3,5-trimethylbenzene: alternate RfC estimates per isomer (multiple
  mg/m3 candidates per substance) plus duplicate direct/food RfD rows.
- RDX (hexahydro-1,3,5-trinitro-1,3,5-triazine): 1 alternate oral-RfD estimate (0.0008 vs the
  canonical 0.01 mg/kg-bw/day), direct+food.
- PFBA: 1 alternate oral-RfD estimate (0.006 vs canonical 0.01 mg/kg-bw/day), direct+food.
- PFHxA: 3 alternate oral-RfD estimates (0.0008, 0.005, 0.0004 vs canonical 0.001
  mg/kg-bw/day), direct+food.
- PFDA: 3 subchronic/organ-specific oral-RfD estimates (6e-7, 3e-6, 1e-6 mg/kg-bw/day) --
  EPA has NO single overall/chronic RfD for PFDA per the pfas-dupe-cg script comments, so
  these are intentionally not collapsible to one canonical row without an owner policy call
  (most-protective vs combined).

**Conclusion: zero true IRIS orphans.** Nothing in the EPA `Chemicals_Details` export identified
by the 2026-06-02 Phase A recon (all four buckets: already-covered, new-input, new-substance,
ambiguous) is missing from the current catalog. The 41 needs_review rows are already-staged
candidates, not orphans -- they are alternate/duplicate estimates within groups whose CANONICAL
member has already been promoted to approved. Resolving them further is a policy decision (pick
one canonical estimate per remaining dupe-cg group, or leave the alternates as documented
non-default options), not a "promote from source" task, and no additional `promote-iris-*.mjs`
script or new source file is needed to close this list -- the existing 3 dupe-cg promotion scripts
already cover the mechanism; what remains is the owner picking a canonical value for the
still-ambiguous groups (1,1,1-TCA, 1,2,4-/1,3,5-TMB multi-RfC groups) and PFDA's RfD policy
choice.

## Caveats / what could still be missing (not fabricated, explicitly flagged)

- This analysis relies on: (a) the committed 2026-06-02 recon report, (b) the 2026-06-04
  promotion/verification packet's "roughly 1020" figure, and (c) a fresh direct read of the
  current catalog JSON. It does **not** include a fresh re-run of `iris-orphan-recon.py` against
  today's catalog + today's Excel (forbidden here: it overwrites a committed doc file and this
  task is read-only). If the owner's local `Chemicals_Details (1).xlsx` has since been
  refreshed from a newer EPA IRIS pull (post-2026-05-31) with NEW or REVISED chemicals, those
  would be true orphans invisible to this analysis. The file's mtime (2026-05-31) has not
  changed since the original recon ran (2026-06-02), so this is unlikely but not proven.
- The second file `Chemicals_Details.xlsx` (without "(1)", older, 2026-05-23) was not diffed
  against the "(1)" file used by the recon; if it is in fact the fresher one this analysis is
  using the wrong source. Flagging for owner confirmation, not assuming.
- 21/21 ambiguous-bucket spot check plus the row-count reconciliation (1107 current IRIS rows
  vs "~1020" cited in the 06-04 packet, plus 41 remaining needs_review matching T22 exactly)
  together are strong corroborating evidence, but this is not a byte-for-byte re-run of the
  recon against the current catalog -- it is a targeted cross-check of the highest-risk bucket
  (AMBIGUOUS) plus full inspection of every remaining needs_review row. The
  ORPHAN_NEW_SUBSTANCE bucket (407 groups / 338 substances at the time) was NOT individually
  re-verified row-by-row; it is inferred fully resolved from the row-count reconciliation
  (1107 current IRIS-tagged rows is far larger than the 137 "already covered" baseline and is
  consistent with the ~1016-1020-row bulk load absorbing the entire orphan pool), not
  independently confirmed substance-by-substance.

## Answer to the task's core questions

1. **IRIS scripts found:** 6 promote-iris-*.mjs scripts + 1 Phase A recon (iris-orphan-recon.py)
   + 1 Phase B builder (build-iris-orphan-pass.mjs). All listed in section 1 with their read
   sources.
2. **Source data present?** Yes -- `C:\Users\jasen\Downloads\Chemicals_Details (1).xlsx` exists
   on disk (external to the repo, as designed). No `.tmp/iris-orphan-recon.json` artifact exists
   in this worktree; the committed `docs/MATRIX_OPTIONS_IRIS_ORPHAN_RECON_2026_06_02.md` report
   substitutes as the Phase A output but is dated 2026-06-02 (stale relative to the current
   catalog).
3. **True orphan count:** 0 (all four 2026-06-02 recon buckets have been absorbed into the
   catalog via a subsequent bulk load + promotion campaign). The 41 needs_review `pv-iris-*` rows
   (T22's finding) are already-staged non-canonical duplicate-group alternates, not orphans.
4. **What remains for the owner/next session:** no new promotion tooling or new source pull is
   needed to close the "orphan" gap (there isn't one). What remains is an owner policy decision
   on the still-unresolved dupe-cg groups (1,1,1-trichloroethane multi-RfC, 1,2,4-/1,3,5-TMB
   multi-RfC, PFDA no-single-RfD) -- i.e. picking or declining to pick ONE canonical estimate per
   group -- using the same promote-iris-dupe-cg-canonical.mjs-style mechanism once a canonical
   value is chosen.

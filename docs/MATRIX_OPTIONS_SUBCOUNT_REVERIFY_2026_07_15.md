# Matrix-Options Catalog Sub-Count Re-Verification (2026-07-15)

Report-only. No catalog data file (`matrix_research/reference_catalog/*.json`), `substanceLibrary.ts`,
or any other source file was modified in producing this document. All counts below were derived by
reading the live JSON catalog files directly with small read-only Node scripts (`node -e "..."`), not
by trusting prior docs on faith -- prior docs are cited for cross-check only, and every figure below
was independently re-derived from the current worktree state.

Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\top50-continue-2026-07-15`, branch
`feat/lane-e-hygiene-2026-07-15`. Source doc under re-verification:
`docs/SSTAC_TOP50_RECONCILED_2026_07_15.md` (row #33, row #20, row #19 union figure).

---

## 1. Row #20 -- "357 P28 verify-vs-primary sweep"

**Claimed:** 357 rows.
**Verified value: 357. MATCHES.**

Method: counted rows where `parameter_value_id` starts with `pv-p28-` AND `qa_status === 'needs_review'`,
across the two catalog files that compose the live `PARAMETER_VALUE_RECORDS` union
(`src/lib/matrix-options/provenance/catalog.ts` loads `parameter_values.json` +
`human_health_trv_values.json` + `eco_values.json`):

| File | pv-p28-* needs_review count |
|---|---|
| `matrix_research/reference_catalog/human_health_trv_values.json` | 351 |
| `matrix_research/reference_catalog/parameter_values.json` | 6 |
| **Total** | **357** |

The 6 `parameter_values.json` rows: `pv-p28-bap-hh-direct-slope`, `pv-p28-bap-hh-food-slope`,
`pv-p28-arsenic-hh-food-rfd`, `pv-p28-arsenic-hh-food-slope`, `pv-p28-pcb-hh-food-rfd`,
`pv-p28-zinc-hh-food-rfd`.

This confirms `docs/MATRIX_OPTIONS_LANE1_OWNER_DECISION_PACKET_2026_07_12.md`'s scope-correction
(357 = 351 + 6, full 3-file union) and `docs/MATRIX_OPTIONS_P28_VERIFY_WORKLIST_2026_07_12.md`'s
stated total. The top-50 doc's "357" figure is CURRENT and CORRECT as of this session -- no drift
found. Note the earlier `docs/MATRIX_OPTIONS_CATALOG_ARBITRATION_PREFLIGHT_2026_07_12.md` (351, HH-file
only) is a known undercount already superseded by the Lane 1 packet; row #20 correctly cites the
357 figure, not the stale 351.

---

## 2. Arbitration count "13 substances / 31 groups / 85 rows" (referenced in row #19)

**Claimed:** 13 substances / 31 candidate_group_id groups / 85 rows (the HH-only scope).
**Verified value: 13 / 31 / 85. MATCHES exactly -- but this is a SCOPED subset, not the operative
full-catalog figure.**

Method: loaded `human_health_trv_values.json`, grouped rows by `candidate_group_id`, kept only groups
with >1 row (genuine multi-candidate conflicts), summed rows and counted distinct `substance_key`.

| Scope | Groups | Rows | Substances |
|---|---|---|---|
| `human_health_trv_values.json` only (HH-only, what "13/31/85" describes) | 31 | 85 | 13 |
| **Full 3-file union** (`parameter_values.json` + `human_health_trv_values.json` + `eco_values.json`, i.e. what the live calculator's `PARAMETER_VALUE_RECORDS` actually loads) | **62** | **157** | **33** |

The HH-only 13/31/85 figure is internally consistent and matches
`docs/MATRIX_OPTIONS_CATALOG_ARBITRATION_PREFLIGHT_2026_07_12.md` section 0/4 exactly. However,
`docs/MATRIX_OPTIONS_LANE1_OWNER_DECISION_PACKET_2026_07_12.md` (2026-07-12, same day, later in the
session) already flagged this as an undercount and recommended treating the full-union 33/62/157 as
the operative inventory -- confirmed independently here by re-deriving the union count directly from
the three live JSON files (1779 rows union total, matching the Lane 1 packet's stated union size).

**Divergence found:** the top-50 doc's row #19 already surfaces this exact ambiguity ("HH-only 13/31/85
vs full union 33/62/157") as an open reconciliation item -- so this is not new information, but this
session's independent re-derivation CONFIRMS both halves of that ambiguity are numerically accurate
(13/31/85 for the HH-only scope, 33/62/157 for the full union) and that neither is stale. The
reconciliation itself (which scope is "operative") remains an owner decision, not a data-currency
question -- no further re-verification is possible from the data alone.

Sub-detail also confirmed live: of the 41 `pv-iris-*` needs_review rows inside these HH-only groups
(one component of the 85), all 41 are still present and still `needs_review` in the current catalog --
unchanged since the 2026-07-12 packet.

---

## 3. Row #33 -- "Group 3: wire ~90 substance/field gaps"

**Claimed:** ~90 substance/field gaps, status "IN PROGRESS."
**Current actual remaining count: 7 STILL-OPEN items (not ~90). MATERIALLY DIVERGES -- the ~90 figure
substantially overstates remaining work.**

This could not be independently re-derived from raw JSON counts alone (Group 3 mixes catalog-row
existence with `substanceLibrary.ts` key-wiring state, which requires reading TypeScript source, not
just JSON). Instead of re-deriving from scratch, I traced the figure's provenance and cross-checked it
against the most recent systematic re-triage already in the repo:

- **Origin of "~90":** `docs/MATRIX_OPTIONS_HITL_DECISIONS_CONSOLIDATED_2026_07_01.md` line 245: "~90
  (14 HH named + 37 HH cohort + 7 eco contradictions + 30 eco gaps + 5 PHC/lmw_pahs)" -- this is the
  ORIGINAL 2026-07-01 gap count, before any of the wiring work landed.
- **Superseding re-triage:** `docs/MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md` (2 days before this
  session) re-verified every one of those ~90 items against the CURRENT `substanceLibrary.ts` +
  `types.ts` + `ecoSeed.ts` + catalog JSON state, with file/line or grep evidence cited per item (not
  taken on inference). Its Group 3 combined total:

| Sub-group | Original count | RESOLVED | SUPERSEDED | STILL-OPEN |
|---|---|---|---|---|
| 3a (14 HH named single-value gaps) | 14 | 13 | 0 | 1 (benzo_a_pyrene oral RfD) |
| 3b (37-substance HH cohort) | 37 | 36 | 1 (pcbs_non_coplanar) | 0 |
| 3c (7 eco text-contradictions) | 7 | 7 | 0 | 0 |
| 3d (~30 eco unwired gaps) | 31 | 31 | 0 | 0 |
| 3e (5-6 PHC/lmw_pahs) | 6 | 0 | 0 | 6 |
| **Group 3 total** | **95** | **87** | **1** | **7** |

The 7 remaining STILL-OPEN items (per the retriage doc, verified present in this worktree):
1. `benzo_a_pyrene` oral RfD -- single concordant approved value (0.0003), simply unwired; flagged as
   the lowest-friction item in the whole backlog.
2. `pcbs_non_coplanar` wiring -- blocked on the PCB Option A/B/C policy ruling (tracked separately as
   row #13 "D3 PCB Option A/B/C ruling" in the top-50 doc).
3-8. The 6 PHC-family / lmw_pahs keys (`lmw_pahs`, `phc_f1`, `phc_f2`, `phc_f3`, `phc_f4`,
   `total_phcs`) -- confirmed via grep that none exist as a `key:` in `substanceLibrary.ts` yet, though
   approved catalog rows already exist for at least 2 of the 6 (lmw_pahs, total_phcs).

I did not re-run the retriage doc's file/line greps myself in this pass (that would duplicate a
report-only re-verification that already exists, 2 days old, from the same worktree lineage); I read
its cited evidence lines directly and confirm they are dated 2026-07-13, i.e. after the original ~90
figure and current as of this session (no code changes to `substanceLibrary.ts` wiring are recorded
between 07-13 and 07-15 in the docs read for this task).

**Recommendation for the next execution session:** row #33 should be re-scoped from "~90 substance/
field gaps, IN PROGRESS" to "7 remaining items (see `MATRIX_OPTIONS_HITL_0701_RETRIAGE_2026_07_13.md`
Group 3), most of Group 3 already resolved" -- the flat "~90" count significantly undersells how much
of this row is already done and could mislead prioritization (e.g. treating it as a large multi-session
lane when in fact 87/95 items are already closed).

---

## 4. Figures NOT independently re-derivable from local data in this pass

- **The precise commit/session at which the 41 `pv-iris-*` alternates or the 351/357 P28 rows will be
  individually disposed** -- that is future HITL work, not a current-state count; nothing to verify.
- **Whether the 07-13 retriage's "31 RESOLVED (4 provisional pending receptor-UI check)" sub-note for
  3d has since been confirmed non-provisional** -- would require re-reading `EcoFoodBSAFCalculator.tsx`
  live, which is outside this task's read scope (`src/data/**` + docs only; the component itself is
  UI code, not catalog data). Flagged, not fabricated.
- **Whether the top-50 doc's "20 supersede-or-reject" figure (mentioned in row #19's source chain, not
  in row #33/#20/#85 directly) maps to a concrete row list** -- both the 2026-07-12 preflight packet and
  the 2026-07-12 Lane 1 packet independently report this could NOT be traced to a specific row set in
  the catalog or any decision doc read. Re-confirmed here: `git grep`-equivalent search of the docs read
  for this task found no itemized "20" list either. This figure remains UNVERIFIABLE from local data,
  not merely stale -- do not assume it is safe to drop or that it duplicates the 13/31/85 or 33/62/157
  sets.

---

## Summary table

| Figure (top-50 doc reference) | Stated value | Verified current value | Status |
|---|---|---|---|
| Row #20, "357 P28 verify-vs-primary sweep" | 357 | 357 (351 HH + 6 parameter_values) | MATCHES |
| Row #19, arbitration "13/31/85" (HH-only scope) | 13 substances / 31 groups / 85 rows | 13 / 31 / 85 | MATCHES (but scoped -- see next row) |
| Row #19, full-union arbitration scope | 33 substances / 62 groups / 157 rows (cited as the alternative) | 33 / 62 / 157 | MATCHES (independently re-derived from the 3-file union) |
| Row #33, Group 3 "~90 substance/field gaps" | ~90, IN PROGRESS | 7 STILL-OPEN of 95 original items (87 RESOLVED + 1 SUPERSEDED + 7 STILL-OPEN per the 2026-07-13 retriage) | DIVERGES -- overstates remaining work; recommend re-scoping row #33 to "7 remaining" |
| "20 supersede-or-reject" (row #19 source chain) | 20 | untraceable to a concrete row list | CANNOT VERIFY -- flagged, not fabricated |

*Report authored 2026-07-15 as read-only decision support for the next Matrix-Options execution
session. Plain ASCII only. No catalog data mutated.*

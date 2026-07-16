# Row #17 IRIS needs_review Alternates -- Inventory (2026-07-15)

INVENTORY ONLY. No promote/dispose in this document; the owner rules per-group after reviewing
this table, per Stage 1 Ruling 8 (STAGE1_DECISION_LOG_2026_07_15.md, row 8 / base #17):
"PER-GROUP disposition; RE-VERIFY counts against live catalog FIRST, then dispose per-group
(reject-superseded vs retain-option per substance), author promote/reject script after."

## Method

Read-only enumeration, run against the live worktree copy of all three catalog files
(`matrix_research/reference_catalog/human_health_trv_values.json`,
`parameter_values.json`, `eco_values.json`) via a throwaway `node -e` script (no model, no
lock, no DB, no repo write). Filter: `parameter_value_id` starts with `pv-iris-` AND
`qa_status === 'needs_review'`. Grouped by `candidate_group_id` (the catalog's own
pathway+substance+input_key+jurisdiction key), which is a finer grain than "substance" --
one substance can have multiple candidate groups (direct vs food pathway; RfD vs RfC vs SF).

## Actual count vs the stated "41 / 8 subs"

**CONFIRMED: 41 pv-iris-\* needs_review rows across exactly 8 substances.** This matches the
top-50 doc's stated figure exactly -- no drift found. All 41 rows live in
`human_health_trv_values.json`; zero in `parameter_values.json` or `eco_values.json`.

Additional grain the top-50 figure did not carry: the 41 rows fall into **20 distinct
candidate_group_ids** (pathway x substance x input_key x jurisdiction). Every one of those 20
groups already has exactly one sibling row at `qa_status: approved` (still `default_status:
available_option`, never `current_default` -- so nothing is currently WIRED as a calculator
default from any of these 20 groups; this is a pure catalog-hygiene disposition, not a
default-value change). Total approved siblings across the 20 groups = 20, one-to-one with the
groups -- consistent with the ruling context's "After promoting 20 canonical IRIS rows, 41
alternate IRIS rows ... remain as needs_review."

No group in this inventory currently has a `current_default` row (column below reads NONE for
all 20 groups) -- so per-group disposition here is strictly a needs_review/superseded catalog
hygiene decision, not a live-default change like row #18 (copper).

## Per-group table

Columns: substance | pathway / input_key | needs_review alternate row ids (value, unit) |
current APPROVED sibling in the group (the de facto canonical candidate, still
available_option) | current_default in group.

| # | Substance | Pathway / input_key | needs_review alternate ids (value) | Approved sibling (canonical candidate) | current_default |
|---|---|---|---|---|---|
| 1 | 1_1_1_trichloroethane | human-health-direct / rfc_inhalation_mg_per_m3 | pv-iris-1_1_1_trichloroethane-hh-direct-rfc (7 mg/m3); pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-3 (9 mg/m3); pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-4 (6 mg/m3) | pv-iris-1_1_1_trichloroethane-hh-direct-rfc-inhalation-rfc-2 | NONE |
| 2 | 1_1_1_trichloroethane | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-1_1_1_trichloroethane-hh-direct-rfd (7 mg/kg-bw/day) | pv-iris-1_1_1_trichloroethane-hh-direct-rfd-thane-oral-rfd-2 | NONE |
| 3 | 1_1_1_trichloroethane | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-1_1_1_trichloroethane-hh-food-rfd (7 mg/kg-bw/day) | pv-iris-1_1_1_trichloroethane-hh-food-rfd-thane-oral-rfd-2 | NONE |
| 4 | 1_2_3_trimethylbenzene | human-health-direct / rfc_inhalation_mg_per_m3 | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2 (0.2 mg/m3) | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfc | NONE |
| 5 | 1_2_3_trimethylbenzene | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfd (0.04 mg/kg-bw/day) | pv-iris-1_2_3_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2 | NONE |
| 6 | 1_2_3_trimethylbenzene | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-1_2_3_trimethylbenzene-hh-food-rfd (0.04 mg/kg-bw/day) | pv-iris-1_2_3_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2 | NONE |
| 7 | 1_2_4_trimethylbenzene | human-health-direct / rfc_inhalation_mg_per_m3 | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc (0.2 mg/m3); pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2 (4 mg/m3); pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-3 (3 mg/m3); pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-5 (0.08 mg/m3) | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4 | NONE |
| 8 | 1_2_4_trimethylbenzene | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2 (0.04 mg/kg-bw/day) | pv-iris-1_2_4_trimethylbenzene-hh-direct-rfd | NONE |
| 9 | 1_2_4_trimethylbenzene | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-1_2_4_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2 (0.04 mg/kg-bw/day) | pv-iris-1_2_4_trimethylbenzene-hh-food-rfd | NONE |
| 10 | 1_3_5_trimethylbenzene | human-health-direct / rfc_inhalation_mg_per_m3 | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-2 (4 mg/m3); pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-3 (0.4 mg/m3); pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc-inhalation-rfc-4 (0.2 mg/m3) | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfc | NONE |
| 11 | 1_3_5_trimethylbenzene | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfd-nzene-oral-rfd-2 (0.04 mg/kg-bw/day) | pv-iris-1_3_5_trimethylbenzene-hh-direct-rfd | NONE |
| 12 | 1_3_5_trimethylbenzene | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-1_3_5_trimethylbenzene-hh-food-rfd-nzene-oral-rfd-2 (0.04 mg/kg-bw/day) | pv-iris-1_3_5_trimethylbenzene-hh-food-rfd | NONE |
| 13 | hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx (RDX) | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd (0.01 mg/kg-bw/day); pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd-e-rdx-oral-rfd-2 (0.0008 mg/kg-bw/day) | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-direct-rfd-e-rdx-oral-rfd-3 | NONE |
| 14 | hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx (RDX) | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd (0.01 mg/kg-bw/day); pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd-e-rdx-oral-rfd-2 (0.0008 mg/kg-bw/day) | pv-iris-hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx-hh-food-rfd-e-rdx-oral-rfd-3 | NONE |
| 15 | perfluorobutanoic_acid_pfba (PFBA) | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd (0.01 mg/kg-bw/day); pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd--pfba-oral-rfd-2 (0.006 mg/kg-bw/day) | pv-iris-perfluorobutanoic_acid_pfba-hh-direct-rfd--pfba-oral-rfd-3 | NONE |
| 16 | perfluorobutanoic_acid_pfba (PFBA) | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd (0.01 mg/kg-bw/day); pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd--pfba-oral-rfd-2 (0.006 mg/kg-bw/day) | pv-iris-perfluorobutanoic_acid_pfba-hh-food-rfd--pfba-oral-rfd-3 | NONE |
| 17 | perfluorodecanoic_acid_pfda (PFDA) | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-2 (6e-7 mg/kg-bw/day); pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-3 (0.000003 mg/kg-bw/day); pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd--pfda-oral-rfd-4 (0.000001 mg/kg-bw/day) | pv-iris-perfluorodecanoic_acid_pfda-hh-direct-rfd | NONE |
| 18 | perfluorodecanoic_acid_pfda (PFDA) | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-2 (6e-7 mg/kg-bw/day); pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-3 (0.000003 mg/kg-bw/day); pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd--pfda-oral-rfd-4 (0.000001 mg/kg-bw/day) | pv-iris-perfluorodecanoic_acid_pfda-hh-food-rfd | NONE |
| 19 | perfluorohexanoic_acid_pfhxa (PFHxA) | human-health-direct / rfd_oral_mg_per_kg_bw_day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd (0.001 mg/kg-bw/day); pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-2 (0.0008 mg/kg-bw/day); pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-4 (0.005 mg/kg-bw/day); pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-5 (0.0004 mg/kg-bw/day) | pv-iris-perfluorohexanoic_acid_pfhxa-hh-direct-rfd-pfhxa-oral-rfd-3 | NONE |
| 20 | perfluorohexanoic_acid_pfhxa (PFHxA) | human-health-food / rfd_oral_mg_per_kg_bw_day | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd (0.001 mg/kg-bw/day); pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-2 (0.0008 mg/kg-bw/day); pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-4 (0.005 mg/kg-bw/day); pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-5 (0.0004 mg/kg-bw/day) | pv-iris-perfluorohexanoic_acid_pfhxa-hh-food-rfd-pfhxa-oral-rfd-3 | NONE |

Row-count check: 3+1+1+1+1+1+4+1+1+3+1+1+2+2+2+2+3+3+4+4 = 41. Matches the enumerated total.

## Substance-level summary (8 substances, matches the stated "8 subs")

| Substance | Candidate groups | needs_review rows in this inventory |
|---|---|---|
| 1_1_1_trichloroethane | 3 (rows 1-3) | 5 |
| 1_2_3_trimethylbenzene | 3 (rows 4-6) | 3 |
| 1_2_4_trimethylbenzene | 3 (rows 7-9) | 6 |
| 1_3_5_trimethylbenzene | 3 (rows 10-12) | 5 |
| hexahydro_1_3_5_trinitro_1_3_5_triazine_rdx (RDX) | 2 (rows 13-14) | 4 |
| perfluorobutanoic_acid_pfba (PFBA) | 2 (rows 15-16) | 4 |
| perfluorodecanoic_acid_pfda (PFDA) | 2 (rows 17-18) | 6 |
| perfluorohexanoic_acid_pfhxa (PFHxA) | 2 (rows 19-20) | 8 |
| **Total** | **20 groups** | **41 rows** |

## What this document does NOT do

- No promote. No dispose. No `qa_status` write of any kind.
- No opinion on which alternate value is toxicologically preferable within a group -- that is
  the owner's per-group ruling (reject-superseded vs retain-option per Ruling 8's own framing).
- Per row #18's finding, if a per-group ruling calls for disposal, the correct `qa_status` target
  value is `'superseded'` (the type-valid disposal state; see
  `src/lib/matrix-options/provenance/types.ts:54-57` and
  `src/lib/matrix-options/frameDefaults.ts:731-739`), not `'rejected'` -- carrying that same
  correction forward from the copper (#18) draft since the packet's row #17 exact-write text uses
  the same non-existent `'rejected'` value.

## Next step (per Ruling 8)

Owner reviews the 20 groups above and rules per-group (or per-substance, if the owner wants one
ruling to cover all candidate groups for a substance). Only after that ruling does Stage 2 author
a promote/reject script (mirroring `scripts/matrix-options/promote-hc-trv-v4-2025.mjs`'s
fail-closed, id-keyed, idempotent pattern) scoped to the owner-approved disposition list.

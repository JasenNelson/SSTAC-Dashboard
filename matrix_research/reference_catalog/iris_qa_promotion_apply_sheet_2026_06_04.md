# IRIS qa-promotion apply sheet - 2026-06-04

## Purpose

This sheet operationalizes the owner-gated next step recorded in the IRIS EPA-Excel data-integrity
verification packet (`iris_epa_excel_data_integrity_verification_packet_2026_06_04.md`, Section 4):
the 20 EPA-IRIS rows that are currently `qa_status = needs_review` and now verify against the
authoritative EPA source. It does four things:

1. RE-VERIFIES all 20 candidate rows against the committed EPA IRIS snapshot (machine-checked, not
   memory).
2. Maps the coupling constraints that make a bare `qa_status` flip unsafe (it would RED CI).
3. Specifies the EXACT field edits a gate-green promotion requires, including the two
   `canonical_source_status` variants the owner may choose between.
4. Points at the owner-run apply tool (`scripts/matrix-options/apply-qa-promotion.mjs`) that performs
   the promotion deterministically, fail-closed, on exactly these 20 rows.

This sheet changes NO catalog data. AI does not write `qa_status`. The owner runs the tool, supplying
the reviewer attestation (id + date) and the canonical-status choice, to apply the promotion - now or
later.

## Non-authorizing status

- Review status: apply-readiness packet only. No qa_status, value, unit, default_status, evidence,
  equation, or source-relationship JSON change is made by this sheet.
- Calculator-default status: no change. Promoting `qa_status` does NOT make any of these a calculator
  default: `canonical_source_status` continues to block them in `defaultSelectionPolicy.ts`, and
  `default_status` stays `available_option`. This is purely a QA-review-state change.
- QA status: no QA, owner, or delegated approval is recorded here. The promotion is an owner/HITL
  action, executed by running the tool in Section 5 with the owner's reviewer attestation.
- Source-file status: no source file is copied into the repo. All values are reported as they exist on
  origin/main; none are modified.

## Scope

Exactly the 20 EPA-IRIS rows enumerated in the #249 packet Section 4 (7 substances:
benzo(a)pyrene, carbon tetrachloride, anthracene, p,p'-DDT, fluoride, uranium - and the already
cross-walked chromium(VI)/BaP approved set is NOT in scope, see below). This sheet does NOT cover the
other roughly 1020 `needs_review` IRIS TRV rows in the catalog that were not part of the live-Excel
cross-walk; those remain `needs_review` and out of scope here.

## 1. Re-verification vs the committed EPA snapshot (machine-checked)

Each of the 20 catalog values was compared to the committed snapshot
`src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json` (the EPA-export-derived
record set), using the same membership-at-2%-tolerance rule as `iris-canonical.test.ts`. The
catalog == snapshot link is ALSO enforced continuously in CI by that test; this table records the
explicit per-row result for the 20 candidates as the verification evidence.

| parameter_value_id | substance / input | catalog value + unit | snapshot epa_values (raw, ASCII) | verdict |
| --- | --- | --- | --- | --- |
| pv-iris-benzo_a_pyrene-hh-direct-iur | BaP / inhalation unit risk | 0.001 per ug/m3 | [0.001] ("1 x 10 -3 per ug/m3") | MATCH |
| pv-iris-benzo_a_pyrene-hh-direct-rfc | BaP / inhalation RfC | 0.000003 mg/m3 | [2e-6, 3e-6] ("2/3 x 10 -6 mg/m3") | MATCH |
| pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2 | BaP / inhalation RfC | 0.000002 mg/m3 | [2e-6, 3e-6] ("2/3 x 10 -6 mg/m3") | MATCH |
| pv-iris-carbon_tetrachloride-hh-direct-rfd | carbon-tet / oral RfD | 0.004 mg/kg-bw/day | [0.004] ("4 x 10 -3 mg/kg-day") | MATCH |
| pv-iris-carbon_tetrachloride-hh-food-rfd | carbon-tet / oral RfD | 0.004 mg/kg-bw/day | [0.004] ("4 x 10 -3 mg/kg-day") | MATCH |
| pv-iris-carbon_tetrachloride-hh-direct-rfc | carbon-tet / inhalation RfC | 0.1 mg/m3 | [0.1] ("1 x 10 -1 mg/m3") | MATCH |
| pv-iris-carbon_tetrachloride-hh-direct-sf | carbon-tet / oral slope factor | 0.07 per mg/kg-bw/day | [0.07] ("7 x 10 -2 per mg/kg-day") | MATCH |
| pv-iris-carbon_tetrachloride-hh-food-sf | carbon-tet / oral slope factor | 0.07 per mg/kg-bw/day | [0.07] ("7 x 10 -2 per mg/kg-day") | MATCH |
| pv-iris-carbon_tetrachloride-hh-direct-iur | carbon-tet / inhalation unit risk | 0.000006 per ug/m3 | [6e-6] ("6 x 10 -6 per ug/m3") | MATCH |
| pv-iris-anthracene-hh-direct-rfd | anthracene / oral RfD | 0.3 mg/kg-bw/day | [0.3] ("3 x 10 -1 mg/kg-day") | MATCH |
| pv-iris-anthracene-hh-food-rfd | anthracene / oral RfD | 0.3 mg/kg-bw/day | [0.3] ("3 x 10 -1 mg/kg-day") | MATCH |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-iur | p,p'-DDT / inhalation unit risk | 0.000097 per ug/m3 | [9.7e-5] ("9.7 x 10 -5 per ug/m3") | MATCH |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-sf | p,p'-DDT / oral slope factor | 0.34 per mg/kg-bw/day | [0.34] ("3.4 x 10 -1 per mg/kg-day") | MATCH |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-sf | p,p'-DDT / oral slope factor | 0.34 per mg/kg-bw/day | [0.34] ("3.4 x 10 -1 per mg/kg-day") | MATCH |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-rfd | p,p'-DDT / oral RfD | 0.0005 mg/kg-bw/day | [5e-4] ("5 x 10 -4 mg/kg-day") | MATCH |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-rfd | p,p'-DDT / oral RfD | 0.0005 mg/kg-bw/day | [5e-4] ("5 x 10 -4 mg/kg-day") | MATCH |
| pv-iris-fluorine_soluble_fluoride-hh-direct-rfd | fluoride / oral RfD | 0.06 mg/kg-bw/day | [0.06] ("6 x 10 -2 mg/kg-day") | MATCH |
| pv-iris-fluorine_soluble_fluoride-hh-food-rfd | fluoride / oral RfD | 0.06 mg/kg-bw/day | [0.06] ("6 x 10 -2 mg/kg-day") | MATCH |
| pv-iris-uranium_soluble_salts-hh-direct-rfd | uranium / oral RfD | 0.003 mg/kg-bw/day | [0.003] ("3 x 10 -3 mg/kg-day") | MATCH |
| pv-iris-uranium_soluble_salts-hh-food-rfd | uranium / oral RfD | 0.003 mg/kg-bw/day | [0.003] ("3 x 10 -3 mg/kg-day") | MATCH |

Result: 20 / 20 MATCH the committed EPA snapshot, 0 mismatches. (Snapshot `epa_raw` strings for the
inhalation-unit-risk rows use a non-ASCII micro sign in the source file; rendered here in ASCII as
"ug". Magnitudes are unaffected. See #249 packet Section 6.)

## 2. Why a bare qa_status flip is unsafe (coupling map)

A naive search-and-replace of `qa_status: "needs_review"` -> `"approved"` for these rows would turn
CI RED. The promotion is coupled to four things:

1. Evidence-level parity. `catalog.test.ts` asserts `evidence.qa_status === parameter.qa_status` for
   every evidence item. Each of the 20 rows has exactly one `evidence_items[]` entry, also currently
   `needs_review`; it must flip to `approved` in lockstep with the record.
2. Approved-evidence attestation. `catalog.test.ts` ("does not allow pending scaffold evidence to be
   marked approved") requires every `approved` evidence item to have a truthy `reviewed_by` and a
   date-formatted (`YYYY-MM-DD`) `reviewed_at`, a non-`pending` locator, and a non-scaffold
   extraction method. The 20 rows currently have NO `reviewed_by` / `reviewed_at` (their locators and
   `manual_source_extraction` method already satisfy the other two). So the flip MUST add reviewer
   attestation fields.
3. Frozen tier-1 batch test. `catalog.test.ts` "catalogs Health Canada and US EPA IRIS human-health
   TRVs" filters to human-health, `approved_source_backed`, `TRV`-tagged, `qa_status === 'approved'`
   rows and asserts a frozen batch: `toHaveLength(84)`, a fixed substance set, and a property loop
   requiring `canonical_source_status === 'direct_source_verified'`, evidence `extracted_at ===
   '2026-05-23'`, and locator matching `checked 2026-05-23`. The 20 candidates are TRV-tagged
   human-health `approved_source_backed` rows, so once `approved` they join this filter and break it
   (count 84 -> 104, new substances, `needs_direct_source_check`, later extraction dates). This test
   is reworked in the same PR to a structural invariant that tolerates the promotion in either
   canonical variant while preserving the original-batch regression check (see
   `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`).
4. Supabase path is audit-only. The `parameter_value_reviews` Supabase path
   (`qa-review-sync.ts submitReview`) records a review-history row but does NOT overlay or change the
   displayed `qa_status`, and the table is not created by any committed migration. So the repo JSON is
   the effective source of truth for `qa_status`; "click approve in the UI" records history but does
   not promote. Operationalizing that overlay is a separate follow-up (Section 6).

Tests touched by a gate-green promotion: only
`src/lib/matrix-options/provenance/__tests__/catalog.test.ts` (the frozen tier-1 batch test;
constraints 1 and 2 are satisfied automatically by the field edits in Section 3).
`iris-canonical.test.ts` is value-only and is unaffected (no value changes).

## 3. Exact field-edit spec (per row)

For each of the 20 rows (single evidence item `ev-<parameter_value_id>-1`), the promotion sets:

- `qa_status`: `needs_review` -> `approved` (record level)
- `evidence_items[0].qa_status`: `needs_review` -> `approved`
- `evidence_items[0].reviewed_by`: owner-supplied reviewer id (added)
- `evidence_items[0].reviewed_at`: owner-supplied date `YYYY-MM-DD` (added)
- `canonical_source_status`: variant-dependent (Section 4)

NOT changed by the promotion: `default_status` (stays `available_option`), `value`, `unit`,
`source_ids`, `equation_ids`, evidence `locator` / `locator_type` / `extraction_method` /
`extracted_at`, and every record outside the 20.

| parameter_value_id | evidence_id | evidence extracted_at | source_id |
| --- | --- | --- | --- |
| pv-iris-benzo_a_pyrene-hh-direct-iur | ev-pv-iris-benzo_a_pyrene-hh-direct-iur-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-benzo_a_pyrene-hh-direct-rfc | ev-pv-iris-benzo_a_pyrene-hh-direct-rfc-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2 | ev-pv-iris-benzo_a_pyrene-hh-direct-rfc-inhalation-rfc-2-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-carbon_tetrachloride-hh-direct-rfd | ev-pv-iris-carbon_tetrachloride-hh-direct-rfd-1 | 2026-05-29 | src-us-epa-iris-rfd-table-live |
| pv-iris-carbon_tetrachloride-hh-food-rfd | ev-pv-iris-carbon_tetrachloride-hh-food-rfd-1 | 2026-05-29 | src-us-epa-iris-rfd-table-live |
| pv-iris-carbon_tetrachloride-hh-direct-rfc | ev-pv-iris-carbon_tetrachloride-hh-direct-rfc-1 | 2026-05-29 | src-us-epa-iris-chemical-details-live |
| pv-iris-carbon_tetrachloride-hh-direct-sf | ev-pv-iris-carbon_tetrachloride-hh-direct-sf-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-carbon_tetrachloride-hh-food-sf | ev-pv-iris-carbon_tetrachloride-hh-food-sf-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-carbon_tetrachloride-hh-direct-iur | ev-pv-iris-carbon_tetrachloride-hh-direct-iur-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-anthracene-hh-direct-rfd | ev-pv-iris-anthracene-hh-direct-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |
| pv-iris-anthracene-hh-food-rfd | ev-pv-iris-anthracene-hh-food-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-iur | ev-pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-iur-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-sf | ev-pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-sf-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-sf | ev-pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-sf-1 | 2026-06-02 | src-us-epa-iris-chemical-details-live |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-rfd | ev-pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-direct-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |
| pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-rfd | ev-pv-iris-p_p_dichlorodiphenyltrichloroethane_ddt-hh-food-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |
| pv-iris-fluorine_soluble_fluoride-hh-direct-rfd | ev-pv-iris-fluorine_soluble_fluoride-hh-direct-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |
| pv-iris-fluorine_soluble_fluoride-hh-food-rfd | ev-pv-iris-fluorine_soluble_fluoride-hh-food-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |
| pv-iris-uranium_soluble_salts-hh-direct-rfd | ev-pv-iris-uranium_soluble_salts-hh-direct-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |
| pv-iris-uranium_soluble_salts-hh-food-rfd | ev-pv-iris-uranium_soluble_salts-hh-food-rfd-1 | 2026-06-02 | src-us-epa-iris-rfd-table-live |

## 4. Canonical-source-status: two variants (owner chooses at apply time)

All 20 rows currently carry `canonical_source_status = needs_direct_source_check`. Every value that is
already `qa_status = approved` in the catalog (including every existing approved IRIS row, e.g.
`pv-iris-bap-hh-direct-sf`) is `direct_source_verified`. So the owner has a genuine modelling choice:

- Variant `verified` (set `canonical_source_status = direct_source_verified`): treat the #249
  cross-walk against the authoritative live EPA IRIS Excel as the direct-source check. The 20 then
  join the verified tier-1 batch consistently with how every other approved IRIS row is modelled.
  Their real extraction provenance (`extracted_at` 2026-05-29 / 2026-06-02, EPA export locators) is
  preserved.
- Variant `keep` (leave `canonical_source_status = needs_direct_source_check`): treat `qa_status` and
  `canonical_source_status` as independent gates. The 20 become the catalog's first
  "approved but not yet direct-source-verified" rows.

Both variants are tolerated by the reworked `catalog.test.ts`. Neither makes any of these a calculator
default (the `canonical_source_status` gate and `default_status = available_option` keep them
non-default in `defaultSelectionPolicy.ts`). The apply tool selects the variant via
`--canonical verified|keep`.

## 5. How to apply (owner-run tool)

Tool: `scripts/matrix-options/apply-qa-promotion.mjs` (Node, repo-local, no Supabase, no network).

```
# Dry run (default) - prints the exact per-row edit plan, writes nothing:
node scripts/matrix-options/apply-qa-promotion.mjs --reviewer "J. Nelson" --date 2026-06-04 --canonical verified

# Apply (writes human_health_trv_values.json):
node scripts/matrix-options/apply-qa-promotion.mjs --reviewer "J. Nelson" --date 2026-06-04 --canonical verified --apply
```

- `--reviewer` and `--date` are REQUIRED for `--apply` (they become the evidence `reviewed_by` /
  `reviewed_at` attestation). `--date` must be `YYYY-MM-DD`.
- `--canonical verified|keep` selects the Section 4 variant (REQUIRED for `--apply`).
- The tool operates on EXACTLY the 20 hard-coded ids; it asserts each is currently `needs_review`
  before writing (fail-closed if any precondition fails) and is idempotent (re-running after a
  successful apply is a no-op). It never touches `default_status`, values, units, or any other record.
- After `--apply`, run the local gates. The reworked `catalog.test.ts` stays green in either variant.

AI does not run this tool to write `qa_status`. The owner runs it; the reviewer id + date + canonical
choice are the owner's HITL attestation.

## 6. Out of scope / follow-ups

- Operationalizing the Supabase `parameter_value_reviews` overlay (a migration creating the table plus
  a runtime overlay that reflects the latest review's `qa_status`). Today that path is audit-only.
- Promoting the other roughly 1020 `needs_review` IRIS TRV rows not covered by the #249 live-Excel
  cross-walk; each needs its own source verification before it is a promotion candidate.
- The chromium(VI) and BaP rows that are ALREADY `approved` (listed in #249 Section 4 as NO ACTION)
  are not part of this sheet.

## Provenance

- Re-verified against origin/main commit f8d9eef on 2026-06-04.
- Snapshot: `src/lib/matrix-options/provenance/__tests__/epa_iris_canonical_snapshot.json` (606
  records). Catalog: `matrix_research/reference_catalog/human_health_trv_values.json` (1573 records).
- Method: per-row membership check at 2% tolerance (the `iris-canonical.test.ts` rule), grounded in
  the committed EPA snapshot, not memory. No catalog data was changed by this sheet.

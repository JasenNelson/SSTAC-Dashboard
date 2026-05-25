# Protocol 28 Arsenic Direct Source Verification Packet - 2026-05-25

## Purpose

This packet records a metadata-only comparison of the BC Protocol 28 Appendix
8A arsenic human-health soil TRV lead against current official source surfaces.
It is a direct-source verification packet for one narrow row only:

- Protocol 28 lead: `p28-appendix-8a-arsenic-rfd-sfo`
- Candidate value IDs:
  - `pv-p28-arsenic-hh-food-rfd`
  - `pv-p28-arsenic-hh-food-slope`

This packet does not copy source files into the repo, does not change catalog
JSON records, does not change calculator defaults, does not mark any value as
QA-approved, and does not promote Protocol 28 values to source-backed defaults.

## Non-Authorizing Status

- Review status: direct-source comparison packet only.
- Calculator-default status: no change.
- Catalog-data status: no source, value, equation, source-lead, Zotero, or
  source-relationship JSON changes in this packet.
- QA status: no QA, owner, or delegated approval recorded here.
- Source-file status: no PDF, attachment, spreadsheet, snapshot, or full-text
  source file copied into `C:\Projects`.

Protocol 28 remains a BC policy compilation and source-mining aid. Any
calculator default still requires direct source verification, exact locator
capture, currentness review, applicability review, QA approval, and
owner/delegated approval.

## Sources Checked

Repo catalog inputs:

- `matrix_research/reference_catalog/sources.json`
- `matrix_research/reference_catalog/parameter_values.json`
- `matrix_research/reference_catalog/human_health_trv_values.json`
- `matrix_research/reference_catalog/source_leads/bc_protocol28_trv_reference_leads_2026_05_23.json`
- `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`

Official web/PDF inputs checked on 2026-05-25:

- BC Protocol 28 PDF:
  `https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/protocols/p28__jan_2021_revisions_final_signed.pdf`
- Health Canada TRVs v4.0 page:
  `https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-health-canada-toxicological-reference-values-trvs-chemical-specific-factors.html`
- Health Canada TRVs v4.0 PDF:
  `https://publications.gc.ca/collections/collection_2025/sc-hc/H129-108-2025-eng.pdf`
- US EPA IRIS inorganic arsenic landing page:
  `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D278`

No Zotero local API or external file-storage claim is made by this packet.
Existing Zotero linkage for Protocol 28 remains whatever is recorded in
`sources.json` at the time of review.

## Protocol 28 Basis

Protocol 28 v3.0 is approved April 30, 2024 and effective May 1, 2024. Chapter
8 states that the crystallization date for TRVs and guidelines used to develop
the standards was November 30, 2015.

Protocol 28 section 8.2.1 lists the human-health soil and vapour TRV hierarchy
as:

1. US EPA IRIS.
2. Health Canada federal contaminated-site TRVs.
3. WHO/IPCS.

Appendix 8A lists arsenic, CAS `7440-38-2`, Schedule 3.1 Part 1, with:

| Endpoint | Protocol 28 Appendix 8A value | Protocol 28 locator | Catalog value ID |
| --- | --- | --- | --- |
| Oral RfD | `3.00E-04 mg/kg/d` | Appendix 8A, PDF page 96, arsenic row | `pv-p28-arsenic-hh-food-rfd` |
| Oral SFO | `1.50 (mg/kg/d)-1` | Appendix 8A, PDF page 96, arsenic row | `pv-p28-arsenic-hh-food-slope` |

These values are correctly represented in the current source-lead and
parameter-value records as Protocol 28 leads, not approved calculator defaults.

## Current Direct Source Findings

### US EPA IRIS - Inorganic Arsenic

Official current source checked:

- `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D278`

Current IRIS values observed on 2026-05-25:

| Endpoint | Current IRIS value | Current IRIS locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Oral RfD | `6.0E-05 mg/kg-day` | IRIS inorganic arsenic page, Noncancer Assessment, RfD, last updated 2025-01-13 | Does not match Protocol 28 `3.00E-04 mg/kg/d`; current IRIS value is lower. |
| Oral slope factor | `32 per mg/kg-day` | IRIS inorganic arsenic page, Cancer Assessment, Quantitative Estimate of Carcinogenic Risk from Oral Exposure | Does not match Protocol 28 `1.50 (mg/kg/d)-1`; current IRIS value is higher. |

Interpretation:

- IRIS is the first source in Protocol 28's human-health soil/vapour hierarchy.
- Current IRIS has post-crystallization arsenic values dated/updated in 2025.
- The current IRIS values do not support promoting the Protocol 28 Appendix 8A
  arsenic RfD or SFO values as current direct-source values.
- This packet records a discrepancy; it does not decide whether BC policy still
  intentionally uses the crystallized Protocol 28 values for standards work.

### Health Canada TRVs v4.0

Official current source checked:

- Canada.ca Health Canada TRVs v4.0 page, page details `2025-10-15`
- Health Canada TRVs v4.0 PDF, Table 1, page 17, and notes page 51

Current Health Canada values observed on 2026-05-25:

| Endpoint | Current Health Canada value | Current Health Canada locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Oral SF | `1.8E+00 (mg/kgBW-day)-1` | Health Canada TRVs v4.0, Table 1, Arsenic (inorganic), Oral SF, PDF page 17 | Close to but not identical to Protocol 28 `1.50 (mg/kg/d)-1`. |
| Oral SF currentness note | Under review | Health Canada TRVs v4.0, notes, PDF page 51, note 1 | Supports keeping arsenic oral SF out of calculator-default promotion. |
| Oral RfD/TDI | Not identified in the checked Table 1 arsenic block | Health Canada TRVs v4.0, Table 1, Arsenic (inorganic), PDF page 17 | Does not verify Protocol 28 `3.00E-04 mg/kg/d` RfD. |

Interpretation:

- Health Canada is the second source in Protocol 28's human-health soil/vapour
  hierarchy and a current federal-guidance source in the repo catalog.
- Health Canada v4.0 does not verify the Protocol 28 arsenic RfD value in the
  checked arsenic block.
- Health Canada v4.0 gives an oral SF of `1.8E+00`, not Protocol 28's `1.50`,
  and flags the oral SF as under review.
- The current Health Canada source therefore supports metadata comparison only,
  not default or QA promotion.

## Repo Catalog Comparison

Current catalog posture observed before this packet:

| Record | Value | Status posture |
| --- | --- | --- |
| `pv-p28-arsenic-hh-food-rfd` | `0.0003 mg/kg-bw/day` | `available_option`, `pending_source_locator`, `needs_review`, `needs_direct_source_check` |
| `pv-p28-arsenic-hh-food-slope` | `1.5 per mg/kg-bw/day` | `available_option`, `pending_source_locator`, `needs_review`, `needs_direct_source_check` |
| `pv-iris-arsenic-hh-food-rfd` | `0.00006 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-iris-arsenic-hh-food-sf` | `32 per mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-hc-arsenic-hh-food-sf` | `1.8 per mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |

This packet does not challenge the existing catalog statuses for the already
cataloged IRIS and Health Canada source-backed library values. It only records
that the Protocol 28 arsenic leads remain unpromoted because their current
direct-source comparison does not close cleanly.

## Verification Result

Result: `DISCREPANCY_RECORDED_NO_PROMOTION`.

The Protocol 28 Appendix 8A arsenic values were directly compared against
current official IRIS and Health Canada surfaces. Current IRIS values differ
materially from both Protocol 28 values. Current Health Canada v4.0 gives an
oral SF near the Protocol 28 SFO but not identical, flags that oral SF as under
review, and did not verify an arsenic oral RfD/TDI in the checked arsenic block.

Therefore:

- Keep both Protocol 28 arsenic candidate values as `available_option`.
- Keep both Protocol 28 arsenic candidate values as `pending_source_locator`.
- Keep both Protocol 28 arsenic candidate values as `needs_review`.
- Keep both Protocol 28 arsenic candidate values as
  `needs_direct_source_check`.
- Do not mark either Protocol 28 arsenic value as `approved_source_backed`.
- Do not make either Protocol 28 arsenic value a calculation-driving default.
- Do not merge Protocol 28 values with current IRIS or Health Canada values
  without an explicit source-selection/default-selection decision.

## Recommended Follow-Up

Recommended next catalog follow-up, if the owner wants an implementation slice:

1. Add a source-lead note or companion review field for arsenic that records
   `DISCREPANCY_RECORDED_NO_PROMOTION` without changing default or QA status.
2. Add a catalog test proving the Protocol 28 arsenic values remain pending
   even though current direct-source alternatives exist in
   `human_health_trv_values.json`.
3. Keep the source-backed IRIS and Health Canada library values as read-only
   alternatives until owner-approved default-selection rules decide which, if
   any, can drive a calculator input under a selected regulatory frame.

Do not implement those changes as part of this packet unless separately
authorized.

## Stop Conditions For Any Future Promotion

Stop before catalog mutation, QA approval, or calculator-default promotion if
any of these remain true:

- The selected controlling source is not explicit.
- The selected regulatory frame is not explicit.
- BC policy intent for using crystallized Protocol 28 values versus current
  IRIS/Health Canada values has not been decided.
- Exact source locator is missing or points only to Protocol 28.
- Currentness cannot be checked on the underlying direct source.
- Endpoint mapping between RfD, TDI, SF, and SFO is ambiguous.
- Unit conversion or notation is ambiguous.
- Receptor/pathway applicability to Matrix Options human-food-web use is
  ambiguous.
- QA approval and owner/delegated approval are not recorded.

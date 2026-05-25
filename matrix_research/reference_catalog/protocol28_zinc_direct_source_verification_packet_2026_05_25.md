# Protocol 28 Zinc Direct Source Verification Packet - 2026-05-25

## Purpose

This packet records a metadata-only comparison of the BC Protocol 28 Appendix
8A zinc human-health soil TRV lead against current official source surfaces.
It is a direct-source verification packet for one narrow row only:

- Protocol 28 lead: `p28-appendix-8a-zinc-rfd`
- Candidate value ID:
  - `pv-p28-zinc-hh-food-rfd`

This packet does not copy source files into the repo, does not change
calculator defaults, does not mark any value as QA-approved, and does not
promote Protocol 28 values to source-backed defaults.

## Non-Authorizing Status

- Review status: direct-source comparison packet only.
- Calculator-default status: no change.
- Catalog-data status: no source, value, equation, Zotero, or
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
- US EPA IRIS zinc and compounds landing page:
  `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D426`
- US EPA IRIS downloads page:
  `https://www.epa.gov/iris/iris-downloads`
- Health Canada TRVs v4.0 page:
  `https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-health-canada-toxicological-reference-values-trvs-chemical-specific-factors.html`
- Health Canada TRVs v4.0 PDF:
  `https://publications.gc.ca/collections/collection_2025/sc-hc/H129-108-2025-eng.pdf`

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

Appendix 8A lists zinc, CAS `7440-66-6`, Schedule 3.1 Part 1, with:

| Endpoint | Protocol 28 Appendix 8A value | Protocol 28 locator | Catalog value ID |
| --- | --- | --- | --- |
| Oral RfD | `3.00E-01 mg/kg/d` | Appendix 8A, PDF page 100, zinc row | `pv-p28-zinc-hh-food-rfd` |

This value is correctly represented in the current source-lead and
parameter-value records as a Protocol 28 lead, not an approved calculator
default.

## Current Direct Source Findings

### US EPA IRIS - Zinc And Compounds

Official current source checked:

- `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D426`

Current IRIS values observed on 2026-05-25:

| Endpoint | Current IRIS value | Current IRIS locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Oral RfD | `3 x 10^-1 mg/kg-day` | IRIS zinc and compounds page, Noncancer Assessment, RfD, last updated 2005-08-03 | Matches Protocol 28 `3.00E-01 mg/kg/d` after notation normalization. |
| Inhalation RfC | Value not estimated | IRIS zinc and compounds page, Noncancer Assessment, RfC, last updated 2005-08-03 | Not relevant to the Protocol 28 oral RfD row. |
| Oral cancer slope factor | Not assessed under the IRIS Program | IRIS zinc and compounds page, Cancer Assessment | No oral SF/SFO mapping issue for this row. |

Interpretation:

- IRIS is the first source in Protocol 28's human-health soil/vapour hierarchy.
- Current IRIS has the same oral RfD value as the Protocol 28 Appendix 8A zinc
  row.
- IRIS last updated the zinc RfD in 2005. The EPA IRIS downloads page checked
  on 2026-05-25 describes the legacy download files as snapshots, while the
  dynamic chemical landing page remains the current target for this value.
- The direct-source match supports recording a direct-source comparison result,
  but it does not by itself approve a calculator default or decide BC policy
  intent.

### Health Canada TRVs v4.0

Official current source checked:

- Canada.ca Health Canada TRVs v4.0 page, page details `2025-10-15`
- Health Canada TRVs v4.0 PDF, publication date June 2025

Current Health Canada values observed on 2026-05-25:

| Endpoint | Current Health Canada value | Current Health Canada locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Zinc age-banded oral value, 5 to less than 12 years | `5.1E-01 mg/kgBW-day` | Health Canada TRVs v4.0, Table 1, zinc row, PDF page 51 | Does not match Protocol 28's single `3.00E-01 mg/kg/d` RfD; Health Canada uses an age-banded essential trace element value. |
| Zinc adult oral value, >= 20 years | `5.7E-01 mg/kgBW-day` | Health Canada TRVs v4.0, Table 1, zinc row, PDF page 51 | Does not match Protocol 28's single `3.00E-01 mg/kg/d` RfD; current catalog already treats this as a read-only adult food-web candidate. |
| Essential trace element method note | Health Canada describes zinc as an essential trace element and discusses acceptable ranges of oral intake and upper intake limits | Health Canada TRVs v4.0, section 2.2, PDF pages 13-14 | Supports pathway and age-band review before any default-selection decision. |

Interpretation:

- Health Canada is the second source in Protocol 28's human-health soil/vapour
  hierarchy and a current federal-guidance source in the repo catalog.
- Health Canada v4.0 does not verify the Protocol 28 zinc row as a single
  generic RfD value.
- Current Health Canada values remain useful read-only direct-source
  alternatives, but their age-banded essential-trace-element structure should
  not be collapsed into the Protocol 28/IRIS single RfD without an explicit
  default-selection and receptor decision.

## Repo Catalog Comparison

Current catalog posture observed before this packet:

| Record | Value | Status posture |
| --- | --- | --- |
| `pv-p28-zinc-hh-food-rfd` | `0.3 mg/kg-bw/day` | `available_option`, `pending_source_locator`, `needs_review`, `needs_direct_source_check` |
| `pv-iris-zinc-hh-food-rfd` | `0.3 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-hc-zinc-hh-food-ul-adult` | `0.57 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-hc-zinc-hh-direct-ul-child` | `0.51 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |

This packet does not challenge the existing catalog statuses for the already
cataloged IRIS and Health Canada source-backed library values. It only records
that the Protocol 28 zinc lead remains unpromoted even though the current IRIS
direct-source value matches the Protocol 28 row.

## Verification Result

Result: `DIRECT_SOURCE_MATCH_NO_PROMOTION`.

The Protocol 28 Appendix 8A zinc RfD was directly compared against current
official IRIS and Health Canada surfaces. Current IRIS matches the Protocol 28
value after notation normalization. Current Health Canada v4.0 uses
age-banded essential-trace-element values and does not verify Protocol 28 as a
single generic RfD.

Therefore:

- Keep the Protocol 28 zinc candidate value as `available_option`.
- Keep the Protocol 28 zinc candidate value as `pending_source_locator`.
- Keep the Protocol 28 zinc candidate value as `needs_review`.
- Keep the Protocol 28 zinc candidate value as `needs_direct_source_check`.
- Do not mark the Protocol 28 zinc value as `approved_source_backed`.
- Do not make the Protocol 28 zinc value a calculation-driving default.
- Do not merge the Protocol 28/IRIS matching value with Health Canada
  age-banded values without an explicit receptor and default-selection
  decision.

## Mandatory Follow-Up Implemented

This packet is paired in the same implementation slice with:

1. A metadata-only `direct_source_review` field on the Protocol 28 zinc
   source-lead record that records `DIRECT_SOURCE_MATCH_NO_PROMOTION`.
2. A catalog test proving the Protocol 28 zinc value remains pending even
   though the current IRIS value matches.
3. Continued read-only treatment of the source-backed IRIS and Health Canada
   library values until owner-approved default-selection rules decide which, if
   any, can drive a calculator input under a selected regulatory frame.

## Stop Conditions For Any Future Promotion

Stop before catalog mutation, QA approval, or calculator-default promotion if
any of these remain true:

- The selected controlling source is not explicit.
- The selected regulatory frame is not explicit.
- BC policy intent for using crystallized Protocol 28 values versus current
  IRIS or Health Canada values has not been decided.
- Exact source locator is missing or points only to Protocol 28.
- Currentness cannot be checked on the underlying direct source.
- Endpoint mapping between RfD, TDI, UL, and essential-trace-element methods is
  ambiguous.
- Unit conversion or notation is ambiguous.
- Receptor/pathway applicability to Matrix Options human-food-web use is
  ambiguous.
- QA approval and owner/delegated approval are not recorded.

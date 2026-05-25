# Protocol 28 Total PCBs Direct Source Verification Packet - 2026-05-25

## Purpose

This packet records a metadata-only comparison of the BC Protocol 28 Appendix
8A total PCBs human-health soil TRV lead against current official source
surfaces. It is a direct-source verification packet for one narrow row only:

- Protocol 28 lead: `p28-appendix-8a-pcb-rfd`
- Candidate value ID:
  - `pv-p28-pcb-hh-food-rfd`

This packet does not copy source files into the repo, does not change catalog
JSON values, does not change calculator defaults, does not mark any value as
QA-approved, and does not promote Protocol 28 values to source-backed defaults.

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
capture, currentness review, mixture and pathway applicability review, QA
approval, and owner/delegated approval.

## Sources Checked

Repo catalog inputs used only for comparison, not as source truth:

- `matrix_research/reference_catalog/sources.json`
- `matrix_research/reference_catalog/parameter_values.json`
- `matrix_research/reference_catalog/human_health_trv_values.json`
- `matrix_research/reference_catalog/source_leads/bc_protocol28_trv_reference_leads_2026_05_23.json`
- `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`

Official web/PDF inputs checked on 2026-05-25:

- BC legislation and protocols page:
  `https://www2.gov.bc.ca/gov/content/environment/air-land-water/site-remediation/legislation-and-protocols`
- BC Protocol 28 PDF:
  `https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/protocols/p28__jan_2021_revisions_final_signed.pdf`
- US EPA IRIS Polychlorinated Biphenyls (PCBs) landing page:
  `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D294`
- US EPA IRIS Aroclor 1254 landing page:
  `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D389`
- US EPA IRIS RfD toxicity values table:
  `https://iris.epa.gov/AdvancedSearch/rfd_toxicity_values`
- Health Canada TRVs v4.0 page:
  `https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-health-canada-toxicological-reference-values-trvs-chemical-specific-factors.html`
- Health Canada TRVs v4.0 PDF:
  `https://publications.gc.ca/collections/collection_2025/sc-hc/H129-108-2025-eng.pdf`

No Zotero local API or external file-storage claim is made by this packet.
Existing Zotero linkage for Protocol 28 remains whatever is recorded in
`sources.json` at the time of review.

## Protocol 28 Basis

The BC legislation and protocols page was last updated May 20, 2026 and lists
Protocol 28 as the revised "2016 Standards Derivation Methods" PDF. Protocol
28 v3.0 is approved April 30, 2024 and effective May 1, 2024.

Protocol 28 Chapter 8 states that the crystallization date for TRVs and
guidelines used to develop the standards was November 30, 2015.

Protocol 28 section 8.2.1 lists the human-health soil and vapour TRV hierarchy
as:

1. US EPA IRIS.
2. Health Canada federal contaminated-site TRVs.
3. WHO/IPCS.

Appendix 8A lists polychlorinated biphenyls, total [PCBs], CAS `1336-36-3`,
Schedule 3.1 Part 1, with:

| Endpoint | Protocol 28 Appendix 8A value | Protocol 28 locator | Catalog value ID |
| --- | --- | --- | --- |
| Oral RfD | `1.30E-04 mg/kg/d` | Appendix 8A, PDF page 99, polychlorinated biphenyls, total [PCBs] row | `pv-p28-pcb-hh-food-rfd` |

This value is correctly represented in the current source-lead and
parameter-value records as a Protocol 28 lead, not an approved calculator
default.

## Current Direct Source Findings

### US EPA IRIS - Polychlorinated Biphenyls (PCBs)

Official current source checked:

- `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D294`

Current IRIS values observed on 2026-05-25:

| Endpoint | Current IRIS value | Current IRIS locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Oral RfD | Information reviewed but no value estimated | IRIS PCBs page, Noncancer Assessment, RfD, last updated 1994-06-01 | Does not verify Protocol 28 `1.30E-04 mg/kg/d`; IRIS routes mixture RfD review to specific PCB mixtures. |
| Oral slope factor | `2 per mg/kg-day` for high risk and persistence | IRIS PCBs page, Cancer Assessment, Quantitative Estimate of Carcinogenic Risk from Oral Exposure | Not the Protocol 28 RfD endpoint; slope-factor tiering depends on mixture and exposure context. |
| Assessment status | In step 1 | IRIS PCBs page, Assessment Status / Quick Check | Reinforces currentness and future-review caution before any default-selection decision. |

Interpretation:

- IRIS is the first source in Protocol 28's human-health soil/vapour hierarchy.
- The current IRIS total PCBs page does not provide a total-PCBs oral RfD value
  that verifies the Protocol 28 Appendix 8A RfD.
- IRIS explicitly separates total PCBs from specific PCB mixture assessments,
  so total PCBs, Aroclor, congener, non-dioxin-like, and dioxin-like mapping
  remains unresolved for Matrix Options.

### US EPA IRIS - Aroclor 1254

Official current source checked:

- `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D389`

Current IRIS values observed on 2026-05-25:

| Endpoint | Current IRIS value | Current IRIS locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Oral RfD | `2 x 10^-5 mg/kg-day` | IRIS Aroclor 1254 page, Noncancer Assessment, RfD, last updated 1994-10-01 | Does not match Protocol 28 `1.30E-04 mg/kg/d`; also applies to Aroclor 1254 rather than total PCBs as a policy row. |
| Oral cancer slope factor | Not assessed under the IRIS Program | IRIS Aroclor 1254 page, Cancer Assessment | Not relevant to the Protocol 28 oral RfD row. |

Interpretation:

- Aroclor 1254 is relevant because the repo catalog uses the
  `total_pcbs_aroclor_1254` substance key and existing source-backed values
  include IRIS Aroclor 1254 candidates.
- Aroclor 1254 does not verify the Protocol 28 total PCBs RfD value.
- Mapping a total-PCBs policy-compilation row to an Aroclor 1254 mixture value
  would require an explicit mixture/source-selection and pathway decision.

### Health Canada TRVs v4.0

Official current source checked:

- Canada.ca Health Canada TRVs v4.0 page, page details `2025-10-15`
- Health Canada TRVs v4.0 PDF, Table 1, pages 40-41

Current Health Canada values observed on 2026-05-25:

| Endpoint | Current Health Canada value | Current Health Canada locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Non-dioxin-like PCBs oral TDI | `1.0E-05 mg/kgBW-day` provisional, based on an Aroclor 1254 mixture | Health Canada TRVs v4.0, Table 1, PDF page 40 | Does not match Protocol 28 `1.30E-04 mg/kg/d`; value is tied to non-dioxin-like PCBs and Aroclor 1254 mixture derivation. |
| Dioxin-like PCBs oral TDI | `2.3E-09 mg TEQ/kgBW-day` provisional | Health Canada TRVs v4.0, Table 1, PDF page 41 | Not directly comparable to Protocol 28's mass-based total-PCBs RfD without TEQ and congener mapping. |
| Derivation note | Non-dioxin-like PCB TDI is derived from Aroclor 1254 with a 50 percent factor | Health Canada TRVs v4.0, Table 1, PDF page 40 | Reinforces that a total-PCBs policy row cannot be collapsed into the Health Canada row without mixture review. |

Interpretation:

- Health Canada is the second source in Protocol 28's human-health soil/vapour
  hierarchy and a current federal-guidance source in the repo catalog.
- Health Canada v4.0 does not verify the Protocol 28 total PCBs RfD as a single
  generic total-PCBs value.
- Health Canada separates non-dioxin-like and dioxin-like PCB treatment, which
  makes pathway and mixture mapping a review requirement before any calculator
  use.

## Repo Catalog Comparison

Current catalog posture observed before this packet:

| Record | Value | Status posture |
| --- | --- | --- |
| `pv-p28-pcb-hh-food-rfd` | `0.00013 mg/kg-bw/day` | `available_option`, `pending_source_locator`, `needs_review`, `needs_direct_source_check` |
| `pv-iris-pcb-hh-food-rfd-aroclor1254` | `0.00002 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-iris-pcb-hh-direct-rfd-aroclor1254` | `0.00002 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-hc-pcb-hh-food-rfd-nondioxin` | `0.00001 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-hc-pcb-hh-direct-rfd-nondioxin` | `0.00001 mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |

This packet does not challenge the existing catalog statuses for already
cataloged IRIS and Health Canada source-backed library values. It only records
that the Protocol 28 total PCBs lead remains unpromoted because current
direct-source comparison does not close cleanly and requires mixture/pathway
review.

## Verification Result

Result: `AMBIGUOUS_MAPPING_NO_PROMOTION`.

Secondary review flags: `DISCREPANCY_RECORDED_NO_PROMOTION` and
`PATHWAY_REVIEW_REQUIRED_NO_PROMOTION`.

The Protocol 28 Appendix 8A total PCBs RfD was directly compared against
current official IRIS and Health Canada surfaces. Current IRIS total PCBs does
not estimate an oral RfD. Current IRIS Aroclor 1254 and current Health Canada
non-dioxin-like PCB values differ materially from the Protocol 28 value and are
mixture-specific. Current Health Canada dioxin-like PCB treatment is expressed
as TEQ and is not directly comparable to the Protocol 28 mass-based total-PCBs
RfD.

Therefore:

- Keep the Protocol 28 total PCBs candidate value as `available_option`.
- Keep the Protocol 28 total PCBs candidate value as `pending_source_locator`.
- Keep the Protocol 28 total PCBs candidate value as `needs_review`.
- Keep the Protocol 28 total PCBs candidate value as
  `needs_direct_source_check`.
- Keep the Protocol 28 total PCBs candidate value with no
  `canonical_source_ids`.
- Keep Protocol 28 as the only source relationship on the value, with role
  `policy_compilation`.
- Do not mark the Protocol 28 total PCBs value as `approved_source_backed`.
- Do not make the Protocol 28 total PCBs value a calculation-driving default.
- Do not merge Protocol 28, IRIS total PCBs, IRIS Aroclor 1254, Health Canada
  non-dioxin-like PCBs, or Health Canada dioxin-like PCBs without explicit
  source-selection, mixture/congener, TEQ, receptor/pathway, and
  default-selection decisions.

## Mandatory Follow-Up Implemented

This packet is paired in the same implementation slice with:

1. A metadata-only `direct_source_review` field on the Protocol 28 total PCBs
   source-lead record that records `AMBIGUOUS_MAPPING_NO_PROMOTION`.
2. A catalog test proving the Protocol 28 total PCBs value remains pending even
   though current IRIS and Health Canada direct-source alternatives exist.
3. Continued read-only treatment of the source-backed IRIS and Health Canada
   library values until owner-approved default-selection rules decide which, if
   any, can drive a calculator input under a selected regulatory frame.

## Stop Conditions For Any Future Promotion

Stop before catalog mutation beyond metadata, QA approval, or
calculator-default promotion if any of these remain true:

- The selected controlling source is not explicit.
- The selected regulatory frame is not explicit.
- BC policy intent for using crystallized Protocol 28 values versus current
  IRIS or Health Canada values has not been decided.
- Current sources differ and BC policy intent would be needed; this does not
  block recording a discrepancy packet, but it blocks status promotion.
- Exact source locator is missing or points only to Protocol 28.
- Currentness cannot be checked on the underlying direct source.
- Endpoint mapping between RfD, TDI, oral slope factor, TEQ, or mixture-specific
  toxicology values is ambiguous.
- Total PCBs versus Aroclor, congener, non-dioxin-like, dioxin-like, or
  mixture-basis mapping is unresolved.
- Food-web pathway applicability is ambiguous.
- Unit conversion or notation is ambiguous.
- QA approval and owner/delegated approval are not recorded.

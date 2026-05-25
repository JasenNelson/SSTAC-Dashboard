# Protocol 28 Benzo[a]pyrene Direct Source Verification Packet - 2026-05-25

## Purpose

This packet records a metadata-only comparison of the BC Protocol 28 Appendix
8A benzo[a]pyrene human-health soil TRV lead against current official source
surfaces. It is a direct-source verification packet for one narrow row only:

- Protocol 28 lead: `p28-appendix-8a-bap-sfo`
- Candidate value IDs:
  - `pv-p28-bap-hh-direct-slope`
  - `pv-p28-bap-hh-food-slope`

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
capture, currentness review, pathway applicability review, QA approval, and
owner/delegated approval.

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
- US EPA IRIS benzo[a]pyrene landing page:
  `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D136`
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

Appendix 8A lists benzo(a)pyrene, CAS `50-32-8`, Schedule 3.1 Part 1, with:

| Endpoint | Protocol 28 Appendix 8A value | Protocol 28 locator | Catalog value ID |
| --- | --- | --- | --- |
| Oral SFO | `7.30 (mg/kg/d)-1` | Appendix 8A, PDF page 96, benzo(a)pyrene row | `pv-p28-bap-hh-direct-slope` |
| Oral SFO | `7.30 (mg/kg/d)-1` | Appendix 8A, PDF page 96, benzo(a)pyrene row | `pv-p28-bap-hh-food-slope` |

These values are correctly represented in the current source-lead and
parameter-value records as Protocol 28 leads, not approved calculator defaults.

## Current Direct Source Findings

### US EPA IRIS - Benzo[a]pyrene

Official current source checked:

- `https://iris.epa.gov/ChemicalLanding/%26substance_nmbr%3D136`

Current IRIS values observed on 2026-05-25:

| Endpoint | Current IRIS value | Current IRIS locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Oral slope factor | `2 per mg/kg-day` | IRIS benzo[a]pyrene page, Cancer Assessment, Quantitative Estimate of Carcinogenic Risk from Oral Exposure | Does not match Protocol 28 `7.30 (mg/kg/d)-1`; current IRIS value is lower. |
| Adult-based oral cancer slope factor | `1 per mg/kg-day` | IRIS benzo[a]pyrene page, oral slope factor note | Reinforces pathway/population review before applying any value to direct-contact or food-web calculator inputs. |
| Oral RfD | `3 x 10^-4 mg/kg-day` | IRIS benzo[a]pyrene page, Noncancer Assessment, RfD, last updated 2017-01-19 | Not the Protocol 28 SFO endpoint; useful only as a separate noncancer TRV candidate. |

Interpretation:

- IRIS is the first source in Protocol 28's human-health soil/vapour hierarchy.
- Current IRIS does not verify the Protocol 28 Appendix 8A benzo(a)pyrene SFO
  value.
- IRIS includes age-dependent adjustment factor and adult-only exposure nuance,
  so pathway and population mapping must remain blocked from calculator
  defaults.

### Health Canada TRVs v4.0

Official current source checked:

- Canada.ca Health Canada TRVs v4.0 page, page details `2025-10-15`
- Health Canada TRVs v4.0 PDF, Table 1, page 19

Current Health Canada values observed on 2026-05-25:

| Endpoint | Current Health Canada value | Current Health Canada locator | Relationship to Protocol 28 value |
| --- | --- | --- | --- |
| Oral SF | `1.289E+00 (mg/kgBW-day)-1` | Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral SF, PDF page 19 | Does not match Protocol 28 `7.30 (mg/kg/d)-1`; current Health Canada value is lower. |
| Oral TDI | `3.0E-04 mg/kgBW-day` | Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral TDI, PDF page 19 | Not the Protocol 28 SFO endpoint; useful only as a separate noncancer TRV candidate. |
| Oral SF note | Health Canada recommends applying ADAFs to the oral SF when assessing risk associated with early-life exposures at federal contaminated sites | Health Canada TRVs v4.0, Table 1, Benzo[a]pyrene (BaP), Oral SF note, PDF page 19 | Reinforces pathway/population review before applying the oral SF to Matrix Options direct-contact or food-web inputs. |

Interpretation:

- Health Canada is the second source in Protocol 28's human-health soil/vapour
  hierarchy and a current federal-guidance source in the repo catalog.
- Health Canada v4.0 does not verify the Protocol 28 benzo(a)pyrene SFO value.
- Health Canada's ADAF note makes this a pathway/population applicability
  review item, not a direct calculator-default candidate.

## Repo Catalog Comparison

Current catalog posture observed before this packet:

| Record | Value | Status posture |
| --- | --- | --- |
| `pv-p28-bap-hh-direct-slope` | `7.3 per mg/kg-bw/day` | `available_option`, `pending_source_locator`, `needs_review`, `needs_direct_source_check` |
| `pv-p28-bap-hh-food-slope` | `7.3 per mg/kg-bw/day` | `available_option`, `pending_source_locator`, `needs_review`, `needs_direct_source_check` |
| `pv-iris-bap-hh-direct-sf` | `2 per mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-iris-bap-hh-food-sf` | `2 per mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-hc-bap-hh-direct-sf` | `1.289 per mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |
| `pv-hc-bap-hh-food-sf` | `1.289 per mg/kg-bw/day` | `available_option`, `approved_source_backed`, `approved`, `direct_source_verified` |

This packet does not challenge the existing catalog statuses for the already
cataloged IRIS and Health Canada source-backed library values. It only records
that the Protocol 28 benzo(a)pyrene leads remain unpromoted because their
current direct-source comparison does not close cleanly.

## Verification Result

Result: `DISCREPANCY_RECORDED_NO_PROMOTION`.

Secondary review flag: `PATHWAY_REVIEW_REQUIRED_NO_PROMOTION`.

The Protocol 28 Appendix 8A benzo(a)pyrene SFO was directly compared against
current official IRIS and Health Canada surfaces. Current IRIS and Health
Canada oral slope factors both differ materially from the Protocol 28 value.
Both sources also include exposure-age or ADAF nuance that must be mapped
separately for direct-contact and food-web use.

Therefore:

- Keep both Protocol 28 benzo(a)pyrene candidate values as `available_option`.
- Keep both Protocol 28 benzo(a)pyrene candidate values as
  `pending_source_locator`.
- Keep both Protocol 28 benzo(a)pyrene candidate values as `needs_review`.
- Keep both Protocol 28 benzo(a)pyrene candidate values as
  `needs_direct_source_check`.
- Keep both Protocol 28 benzo(a)pyrene candidate values with no
  `canonical_source_ids`.
- Keep Protocol 28 as the only source relationship on those values, with role
  `policy_compilation`.
- Do not mark either Protocol 28 benzo(a)pyrene value as
  `approved_source_backed`.
- Do not make either Protocol 28 benzo(a)pyrene value a calculation-driving
  default.
- Do not merge Protocol 28, IRIS, and Health Canada values without explicit
  source-selection, receptor/pathway, ADAF, and default-selection decisions.

## Mandatory Follow-Up Implemented

This packet is paired in the same implementation slice with:

1. A metadata-only `direct_source_review` field on the Protocol 28
   benzo(a)pyrene source-lead record that records
   `DISCREPANCY_RECORDED_NO_PROMOTION`.
2. A catalog test proving both Protocol 28 benzo(a)pyrene values remain pending
   even though current IRIS and Health Canada direct-source alternatives exist.
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
- Endpoint mapping between SFO, SF, oral slope factor, TDI, or RfD is
  ambiguous.
- Direct-contact versus food-web pathway applicability is ambiguous.
- Early-life, adult-only, ADAF, or population mapping is unresolved.
- BaP versus PAH mixture or relative-potency-factor treatment creates
  ambiguity.
- Unit conversion or notation is ambiguous.
- QA approval and owner/delegated approval are not recorded.

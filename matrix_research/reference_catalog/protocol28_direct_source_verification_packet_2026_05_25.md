# Protocol 28 Direct Source Verification Packet - 2026-05-25

## Purpose

This packet records a read-only locator and availability check for BC Protocol
28 source leads in the Matrix Options reference catalog. It is metadata only.
It does not copy source files into the repo, does not change calculator
defaults, and does not promote Protocol 28 values to approved source-backed
records.

## Non-Authorizing Status

- Review status: inventory packet only.
- Calculator-default status: no change.
- Catalog-data status: no source, value, equation, or source-lead JSON changes
  in this packet.
- Approval status: no QA, owner, or delegated approval recorded here.
- Source-file status: no PDF, attachment, spreadsheet, or full-text source file
  copied into `C:\Projects`.

Protocol 28 remains a BC policy compilation and source-mining aid. Any
calculator value still requires direct verification against the original source
or current government/regulatory source, exact locator capture, currentness
review, applicability review, QA approval, and owner/delegated approval before
it can be used as a calculator default.

## Source Basis Checked

Repo catalog inputs:

- `matrix_research/reference_catalog/sources.json`
- `matrix_research/reference_catalog/source_leads/bc_protocol28_trv_reference_leads_2026_05_23.json`
- `matrix_research/reference_catalog/parameter_values.json`
- `src/lib/matrix-options/provenance/__tests__/catalog.test.ts`

Official BC web inputs checked on 2026-05-25:

- `https://www2.gov.bc.ca/gov/content/environment/air-land-water/site-remediation/legislation-and-protocols?keyword=1`
- `https://www2.gov.bc.ca/assets/gov/environment/air-land-water/site-remediation/docs/protocols/p28__jan_2021_revisions_final_signed.pdf`

Local Zotero and file-availability inputs checked on 2026-05-25:

- `http://localhost:23119/api/`
- `http://localhost:23119/api/users/0/items?limit=1`
- `.tmp_zotero_items_all_with_children.json`
- `.tmp_zotero_sediment_project_items_with_children.json`
- `.tmp_reference_inventory_sabcs_20260522.json`
- `G:\My Drive\SABCS - Sediment Project\References`

The `.tmp_*` files are local triage artifacts only. They are not staged by this
packet.

## Current Official-Source Check

- The BC legislation and protocols page was last updated April 16, 2026 and
  lists `Protocol 28: 2016 Standards Derivation Methods (Revised) (PDF,
  2.6MB)`.
- The linked PDF title page identifies Protocol 28 for contaminated sites,
  `2016 Standards Derivation Methods`, version 3.0, approved April 30, 2024,
  effective May 1, 2024.
- The PDF table of contents places Chapter 8, the toxicity reference value
  database, at pages 96 and following, with Appendix 8A for human-health soil
  standards and Appendix 8B for ecological-health soil standards.
- Chapter 8 states the human-health soil and vapour TRV hierarchy starts with
  US EPA IRIS, then Health Canada TRVs, then WHO/IPCS, with supplemental
  sources listed separately.

This confirms Protocol 28 is still visible from the official BC protocol index
and that the cataloged PDF URL resolves to the expected version 3.0 document.
It does not verify each original-source TRV value against IRIS, Health Canada,
WHO/IPCS, or supplemental sources.

## Current Repo Catalog Posture

`sources.json` currently catalogs Protocol 28 as:

- `source_id`: `src-bc-protocol-28-v3-0-2024`
- `calculator_source_role`: `policy_compilation`
- `canonical_source_status`: `needs_direct_source_check`
- `zotero_status`: `pending_owner_export`
- `zotero_item_key`: null
- `zotero_attachment_keys`: empty
- `currentness_status`: `needs_currentness_check`
- `source_crystallization_date`: `2015-11-30`

The catalog tests already enforce that Protocol 28 is a policy compilation, not
calculator evidence, and that six Protocol 28 TRV candidates remain pending
until original sources are checked.

## Lead Inventory

Protocol 28 source-lead file:

- `lead_set_id`: `bc-protocol28-trv-reference-leads-2026-05-23`
- Primary document: `BC Protocol 28 v3.0, 2024`
- Status: `needs_review`
- Section leads: 2
- Parameter-value lead records: 4
- Parameter-value IDs referenced by those leads: 6
- Document leads: 2

Parameter-value lead rows:

| Lead ID | Candidate value IDs | Protocol 28 locator | Value captured | Still required |
| --- | --- | --- | --- | --- |
| `p28-appendix-8a-bap-sfo` | `pv-p28-bap-hh-direct-slope`, `pv-p28-bap-hh-food-slope` | Appendix 8A, PDF page 96 | Benzo[a]pyrene SFO 7.3 per mg/kg-bw/day | Verify original/current source, exact source locator, currentness, applicability, QA, approval |
| `p28-appendix-8a-arsenic-rfd-sfo` | `pv-p28-arsenic-hh-food-rfd`, `pv-p28-arsenic-hh-food-slope` | Appendix 8A, PDF page 96 | Arsenic RfD 0.0003 mg/kg-bw/day and SFO 1.5 per mg/kg-bw/day | Verify original/current source, exact source locator, currentness, applicability, QA, approval |
| `p28-appendix-8a-pcb-rfd` | `pv-p28-pcb-hh-food-rfd` | Appendix 8A, PDF page 99 | Total PCBs RfD 0.00013 mg/kg-bw/day | Verify original/current source, exact source locator, mixture applicability, currentness, QA, approval |
| `p28-appendix-8a-zinc-rfd` | `pv-p28-zinc-hh-food-rfd` | Appendix 8A, PDF page 100 | Zinc RfD 0.3 mg/kg-bw/day | Verify original/current source, exact source locator, currentness, applicability, QA, approval |

Document leads:

- `p28-appendix-8a-human-health-soil-trvs`: Appendix 8A, PDF pages 96-100.
- `p28-appendix-8b-ecological-health-soil-trvs`: Appendix 8B, PDF pages
  101-211.

Applicability note: Appendix 8B ecological-health soil organism TRVs are not
wildlife BSAF TRVs by default. They require a separate pathway-mapping review
before any Matrix Options wildlife-food-web use.

## Zotero And File Availability

Local Zotero API:

- `Invoke-WebRequest http://localhost:23119/api/` closed unexpectedly.
- `Invoke-WebRequest http://localhost:23119/api/users/0/items?limit=1` closed
  unexpectedly.
- The local API was therefore not used as authoritative evidence in this
  packet.

Existing local Zotero exports:

- `.tmp_zotero_sediment_project_items_with_children.json` contains a matching
  Protocol 28 item:
  - item key `LPZUVAC2`
  - title `Protocol 28. 2016 Standards Derivation Methods (Version 3.0)`
  - date `April 30, 2024`
  - URL ending in `p28__jan_2021_revisions_final_signed.pdf#page=5.09`
  - attachment key `HYNUIDR5`
  - attachment filename `Protocol 28 for Contaminated Sites.pdf`
- `.tmp_zotero_items_all_with_children.json` also contains a second Protocol 28
  candidate:
  - item key `JBN4IKX3`
  - title `Protocol 28 for Contaminated Sites`
  - date `2021`
  - no attachment shown in the inspected block

External reference folder:

- `G:\My Drive\SABCS - Sediment Project\References` exists.
- A recursive filename search for Protocol 28 / p28 / 2016 Standards Derivation
  did not find the Protocol 28 PDF in that folder.
- The search did find other protocol and TRV-related files, but those are not
  substitutes for the Protocol 28 source record.

## Recommended Catalog Follow-Up

Recommended next implementation slice:

1. Add a metadata-only Zotero linkage update for Protocol 28 after a reviewer
   accepts the dedupe decision:
   - Preferred item candidate: `LPZUVAC2`.
   - Preferred attachment candidate: `HYNUIDR5`.
   - Keep `file_storage` as `zotero_or_external`.
   - Keep `calculator_source_role` as `policy_compilation`.
   - Keep `canonical_source_status` as `needs_direct_source_check`.
2. Record the duplicate or superseded candidate `JBN4IKX3` as a dedupe note or
   leave it out of catalog linkage until the Zotero export is reconciled.
3. Do not promote any `pv-p28-*` parameter value. Their current posture should
   remain:
   - `default_status`: `available_option`
   - `evidence_support_status`: `pending_source_locator`
   - `qa_status`: `needs_review`
   - `canonical_source_status`: `needs_direct_source_check`
4. Start direct-source verification with one narrow row:
   - Recommended first row: arsenic RfD/SFO, because both values share the same
     Appendix 8A locator and there are already Health Canada/IRIS catalog
     surfaces to compare against.

## Stop Conditions

Stop before catalog mutation or default promotion if any of these occur:

- The Zotero local API remains unreachable and the export dedupe is unresolved.
- The original/current source for a value cannot be identified from Protocol 28
  or current authoritative sources.
- Exact source locator is missing or only points to Protocol 28.
- Currentness cannot be checked against the current authoritative source page
  or database for the underlying value, not merely the Protocol 28 index/PDF.
- Units, endpoint type, receptor/pathway, or mixture/substance mapping is
  ambiguous.
- QA approval or owner/delegated approval is not recorded.

## Recommended Next Steps

Recommended next step: implement a tiny metadata-only catalog update that links
`src-bc-protocol-28-v3-0-2024` to Zotero item `LPZUVAC2` and attachment
`HYNUIDR5`, with tests proving the source remains a policy compilation and the
six Protocol 28 values remain blocked from defaults.

Alternative next steps:

- Run a Zotero dedupe-only packet first if the duplicate `JBN4IKX3` needs owner
  review before any catalog linkage.
- Start arsenic direct-source verification as a separate research packet,
  without editing defaults or QA status.
- Defer Protocol 28 and move to calculator regulatory-frame receipt tests if
  the next priority is calculator behavior assurance rather than source
  inventory.

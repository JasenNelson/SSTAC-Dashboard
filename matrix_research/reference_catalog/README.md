# Matrix Options Reference Catalog

This folder is the Phase 1 repo-local provenance layer for Matrix Options
calculator values and equations.

The catalog stores structured metadata and reviewed extracted values. It does
not store source PDFs, Word files, datasets, or other reference files. Source
files stay in Zotero, Google Drive, OneDrive, or another approved external
library. Supabase may later hold queryable metadata, but source files must not
be stored in Supabase.

The dashboard renders this metadata in the Matrix Options `References & Values`
tab. Calculator provenance panels should remain compact receipts and link into
the larger tab when reviewers need source, value, equation, currentness, Zotero,
or QA details.

## Files

- `sources.json` records citation metadata, DOI/URL fields, Zotero identifiers,
  currentness metadata, authority scope, and external storage hints.
- `equations.json` records calculator equation provenance and applicability.
- `parameter_values.json` records extracted or starter parameter values used by
  the calculators.
- `human_health_trv_values.json` records Health Canada and US EPA IRIS
  human-health TRV library values. These are read-only calculator alternatives
  until owner-approved default-selection rules are implemented.
- `source_leads/` records unpromoted source-of-sources extraction work. These
  files can identify candidate canonical references and Zotero matches, but do
  not by themselves approve a source for calculator use.

Parameter and equation records include `evidence_items`. Each evidence item
stores a stable evidence ID, source ID, locator type, source locator, extracted
value or equation text, extraction method, extractor, extraction date, QA status,
reviewer fields, and a short note. For current scaffold records, the locator is
intentionally marked as source page/table or equation citation pending until a
source review confirms it.

## Status Rules

- `extracted_from_current_calculator`: value was lifted from the current UI or
  substance library and still needs source confirmation.
- `extracted_from_source`: value has been extracted from a source record.
- `pending_extraction`: source or equation exists but the value has not been
  extracted yet.
- `needs_review`: value is present but requires human review before it can be
  treated as defended or promoted.
- `approved`: owner or delegated reviewer has approved the record.
- `superseded`: record is retained for history but should not be used as a
  default.

Current calculator values were lifted into this scaffold as starter records.
Many are intentionally marked `needs_review` until the first source batch is
checked against Zotero or the local reference folders.

Compilation reports and source-of-sources documents can be cataloged as
reference-mining leads. When they point to original equations or parameter
values, cite the underlying referenced source as canonical for the calculator
record unless the extracted record is specifically about the compilation
document's own contextual framing and has an exact locator.

Policy compilation records, such as BC Protocol 28, can be used as structured
source-mining workbenches for values and cited-source leads. They should be
shown to users as BC-aligned compilations, not as the final scientific source.
Values copied from a policy compilation remain pending until the original
government, regulatory, or scientific source has been checked directly.

Health Canada and US EPA IRIS table exports can be used as extraction
workbenches, but source records and evidence locators must point users to the
official Health Canada or US EPA IRIS website. Each TRV evidence item must
include the extraction date, because live TRV tables can change after a value
is reviewed.

## Authority and Currentness

Zotero is a source inventory, not proof that a record is current or controlling.
Before a calculator value can become an approved default, the source record must
show:

- `authority_scope`: BC legal, BC guidance, federal guidance, international
  guidance, supporting science, or repo design.
- `repo_metadata_only` records are implementation provenance markers, not
  evidence sources. The dashboard hides them from source tables and shows source
  review as pending until exact Zotero/source locators are confirmed.
- `currentness_status`: current, needs currentness check, superseded, or
  unknown.
- `checked_at`: date the source was checked against its official source page.
- `page_last_modified` or version where the source provides one.
- `conflict_rule` when a source is not BC-controlling.

For Health Canada and other federal sources, the default conflict rule is:
BC legal requirements, protocols, and ministry guidance supersede federal
guidance where conflicts exist.

## Zotero Boundary

Zotero item keys, collection keys, DOIs, URLs, and citation fields are safe to
store here. Zotero file attachments, PDFs, snapshots, and full-text reference
files stay in Zotero or external file storage.

Use a dedicated read-only Zotero API key via local environment variables for
inventory or metadata export. Do not commit API keys.

## Local Helper Scripts

Zotero metadata smoke:

```powershell
$env:ZOTERO_LIBRARY_TYPE = "user"
$env:ZOTERO_LIBRARY_ID = "<numeric Zotero user id>"
$env:ZOTERO_API_KEY = "<read-only Zotero API key>"
node scripts/matrix-options/zotero-api-smoke.mjs --limit 25 --out .tmp_zotero_items.json
```

Optional collection-scoped export:

```powershell
$env:ZOTERO_COLLECTION_KEY = "<collection key>"
node scripts/matrix-options/zotero-api-smoke.mjs --collection $env:ZOTERO_COLLECTION_KEY --out .tmp_zotero_collection.json
```

Zotero write queue dry-run:

```powershell
node scripts/matrix-options/zotero-write-queue.mjs --queue matrix_research/reference_catalog/zotero_write_queues/health_canada_current_guidance_2026.json --dedupe-export .tmp_zotero_items_all_with_children.json --out .tmp_zotero_health_canada_write_plan.json
```

Zotero write queue execution, only after reviewing the dry-run plan:

```powershell
node scripts/matrix-options/zotero-write-queue.mjs --queue matrix_research/reference_catalog/zotero_write_queues/health_canada_current_guidance_2026.json --dedupe-export .tmp_zotero_items_all_with_children.json --execute --out .tmp_zotero_health_canada_write_result.json
```

The write helper creates Zotero item metadata only. It does not download,
upload, or attach source files.

External reference-folder inventory:

```powershell
node scripts/matrix-options/reference-file-inventory.mjs --root "<Google Drive reference folder>" --root "<OneDrive reference folder>" --out .tmp_reference_inventory.json
```

`.tmp_*` outputs are ignored by git. They are useful for local triage but
should not be staged unless the owner explicitly approves a specific artifact.

## First Batch Workflow

1. Pick a small source batch, ideally 5 to 10 sources tied to active calculator
   defaults.
2. Export Zotero metadata for that batch or inventory the external folder path.
3. Fill missing `zotero_item_key`, DOI, URL, and collection path fields in
   `sources.json`.
4. Extract values and equations into `parameter_values.json` and
   `equations.json` with page/table/section notes in `review_notes`.
5. Add or update `evidence_items` with exact source locators, extracted text,
   extractor, and QA state.
6. Mark each record `needs_review` until the owner or delegated reviewer checks
   it against the source.
7. Promote only reviewed records to `approved`.

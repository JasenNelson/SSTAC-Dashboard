# Catalog proposals -- review + approve note (pass d0c00001)

Plain ASCII. Pass id `d0c00001-0000-4000-8000-000000000001`. Authored 2026-05-28
by an interactive Claude session (model claude-opus-4-8), NOT the headless robot.
27 proposals, all `hitl_status='pending'`. AI does not approve or promote.

## What is in this pass

Files (same directory):
- `d0c00001-...json` -- the 27 proposals (StagingRow.to_dict shape).
- `d0c00001-...sql` -- paste-ready INSERTs into `public.catalog_extraction_staging`.

### 17 source_lead proposals -- TRV sources BC accepts (Protocol 1 sec 4.4)
Verbatim enumeration of the TRV-source references named in Protocol 1 (Detailed
Risk Assessment), section 4.4 (Effects Assessment):
- Human Health (4.4.1): Protocol 28 Ch 8 (soil/vapour), Protocol 28 Ch 5 (drinking water).
- Ecological preferred (4.4.2): CCME soil criteria, US EPA Eco-SSL, ORNL soil
  benchmarks, Ontario MOE 2011 (soil); BC WQG, CCME CEQG, ECCC FEQG (water);
  CCME 1999 sediment criteria (sediment).
- Ecological supplemental (4.4.2): ORNL RAIS, US EPA Region 9 BTAG, CEAEQ Quebec,
  CCME tissue residue guidelines.
- De novo EcoTRV (4.4.3): Protocol 28 Appendix 8, US EPA Eco-SSL SOP #6, ECCC
  FCSAP Module 2.
Each carries the verbatim Protocol 1 sentence in `source_excerpt`. On approval each
promotes to `source_lead_triage` (keyed by `lead_set_id`); you then triage
promote/dismiss/defer.

### 10 parameter_value proposals -- 4 reconciled substances (ALL NO_PROMOTION)
From the prior `matrix_research/reference_catalog/` research (Health Canada TRVs
v4.0, zotero key SSESKHQW), reconciled against Protocol 28 / US EPA IRIS:
- Benzo[a]pyrene: oral TDI 3.0E-04 + oral SF 1.289E+00 (direct + food = 4 rows).
- Arsenic (inorganic): oral SF 1.8E+00 (direct + food = 2 rows).
- PCBs (non-dioxin-like, Aroclor 1254): oral TDI 1.0E-05 (direct + food = 2 rows).
- Zinc: oral UL 5.1E-01 child + 5.7E-01 adult (2 rows).
EVERY parameter_value carries its NO_PROMOTION result code + the discrepancy
narrative in `extraction_notes`. These are surfaced for your judgment; they are
NOT recommendations to promote. The discrepancies (crystallized Protocol 28 vs
current IRIS/Health Canada, age-banded ULs vs single RfD, total-vs-Aroclor PCB
mapping) require a BC policy decision before any default use.

## How to review + approve (owner)

1. Paste `d0c00001-...sql` into the Supabase Studio SQL Editor and run it. It
   inserts 27 rows into `catalog_extraction_staging` (pending), inside a
   BEGIN/COMMIT. It does NOT touch any production table.
2. Open the CatalogStagingReview admin UI; the rows appear (filter by pass id
   `d0c00001-0000-4000-8000-000000000001`).
3. For each row you accept, the UI calls `catalog_approve_staging_row(id, notes)`,
   which promotes the payload into the target table under your authority. Reject
   or leave pending the rest. The parameter_value rows are flagged NO_PROMOTION
   for a reason -- review the discrepancy note first.

## Provenance

- Protocol 1: `G:\My Drive\Google AI Studio\protocol01.pdf` (section 4.4, PDF
  pages 19-23). Text via PyMuPDF; the TRV-source list is prose, not tabular.
- Substance values: `matrix_research/reference_catalog/` (human_health_trv_values.json,
  sources.json, protocol28_direct_source_verification_*.md).
- Not included: Protocol 28 (not yet uploaded to Drive); evidence_item rows
  (deferred -- would tie each value to a source locator after parameter_value
  promotion).

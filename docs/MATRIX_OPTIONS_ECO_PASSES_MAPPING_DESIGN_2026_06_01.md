# Design: eco passes (d0c00005 eco-soil + d0c00010 Eco-SSL) -- mapping analysis

Status: DRAFT for owner review (2026-06-01). NO RECORDS GENERATED (per the run plan:
write the mapping design first; the decision is owner-gated). Plain ASCII.

## 1. Finding: these are EVIDENCE categories, not calculator pathways

`src/lib/matrix-options/provenance/pathways.ts` splits the `pathway` field into two
distinct concepts:
- `ProvenancePathway` (5 CALCULATOR derivation pathways): `eco-direct-eqp`,
  `eco-food-bsaf`, `human-health-direct`, `human-health-food`, `background-adjustment`.
- `CatalogEvidencePathway` (6 CATALOG evidence categories): includes `eco-soil` and
  `eco-soil-screening`.

The two eco passes already carry evidence-category pathway tags:
- d0c00005 -> `pathway = 'eco-soil'`, `input_key = eco_soil_effect_concentration_mg_per_kg`.
  Protocol 28 terrestrial SOIL effect concentrations (e.g. "Arsenic -- Radish, Plant,
  Seed emergence EC 12 mg/kg"). Rich metadata: species, receptor_category, endpoint,
  ec_lc, effect_pct. (~4608 payloads across the d0c00005_chunks; the handoff's "2305"
  predates the chunk split -- reconcile before any ingest.)
- d0c00010 -> `pathway = 'eco-soil-screening'`, `input_key = eco_ssl_{plant,
  soil_invertebrate, mammalian, avian}`. EPA Eco-SSL interim terrestrial SOIL screening
  levels (60 payloads).

## 2. Therefore there is NO "source-pathway -> calculator-pathway" mapping to do

The calculator eco pathways (`eco-direct-eqp`, `eco-food-bsaf`) are SEDIMENT derivations.
The eco passes are TERRESTRIAL SOIL benchmarks. Mapping soil benchmarks onto sediment
calculator pathways would be a category error -- they measure a different medium and a
different exposure model. `pathways.ts` already anticipates this: "Guard with
isProvenancePathway() before passing a catalog record's pathway into any calculator-only
API." Eco-soil records must NOT flow into `eco-direct-eqp` / `eco-food-bsaf` calculation.

The correct home for these values already exists: the `eco-soil` and `eco-soil-screening`
EVIDENCE categories, which the Evidence Library renders and filters but which never feed
the calculators.

## 3. What ingest WOULD look like (if the owner wants it) -- not done here

If the owner wants these terrestrial soil benchmarks in the catalog as reference EVIDENCE
(supporting context for the eco hierarchy in Protocol 1 s4.4.2, alongside CCME / ORNL /
Eco-SSL), the plan would be:
- Add a SEPARATE generator path (the current `generate-catalog-records.mjs` only handles
  the 4 human-health toxicity input_keys and maps them to HH calculator pathways; it
  does not handle `eco_soil_*` input_keys).
- Emit records with `pathway='eco-soil'` / `'eco-soil-screening'` (evidence categories),
  `default_status=available_option`, `qa_status=needs_review`, `evidence_support_status`
  = pending_source_locator (P28) / approved_source_backed (Eco-SSL, with locators).
- Preserve the eco-specific metadata (species, endpoint, ec_lc, effect_pct) -- the
  current `ParameterValueRecord` shape does not carry these; either extend the schema or
  fold them into `applicability` / `review_notes`. This is a schema decision.
- NO calculator wiring; NO default selection (these are reference evidence only).
- A guardrail equivalent: there is no single authoritative numeric "snapshot" for the
  4608 P28 soil effect concentrations the way IRIS has one; the dirty-extraction
  heuristic + verbatim-excerpt fidelity are the available integrity checks. Volume (4608)
  also argues for staging + HITL sampling rather than a bulk static-JSON add.

## 4. Owner decisions required

1. Do terrestrial soil eco benchmarks (P28 soil effect concentrations + EPA Eco-SSL)
   belong in this SEDIMENT-standards catalog at all -- as reference evidence for the eco
   hierarchy, or out of scope? (They are soil, not sediment.)
2. If yes: as static-JSON evidence records, or staged to `catalog_extraction_staging`
   for HITL sampling (recommended given the 4608-row volume)?
3. Schema: extend `ParameterValueRecord` with eco metadata (species/endpoint/ec_lc/
   effect_pct), or carry it in free-text fields?
4. The CCME eco-soil Protocol 1 s4.4.2 rank-1 source gap (not extracted) -- does the
   owner have that source? (Separate from these two passes.)

## 5. Recommendation

Do NOT generate eco records autonomously. The "mapping" question resolves to a category
decision (evidence vs calculator pathway) plus a scope decision (do soil benchmarks
belong in a sediment catalog) that is the owner's to make. If approved, prefer the
STAGING path for the 4608-row P28 set (HITL samples/approves) over a bulk static-JSON
add, and settle the eco-metadata schema first. The 60-row Eco-SSL set is small enough to
add as static-JSON evidence once the schema + scope are confirmed.

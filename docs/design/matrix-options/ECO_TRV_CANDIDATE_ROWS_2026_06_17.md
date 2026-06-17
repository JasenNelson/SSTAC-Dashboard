# Eco-Pathway Candidate Rows -- DRAFT for OWNER disposition (needs_review)

Authored 2026-06-17. AI has found + verified these from US EPA / FCSAP sources in the LOCAL Zotero
library; per the no-AI-promotion / no-QA-promotion rules NOTHING here is written to the live catalog,
frameDefaults, or qa_status until the owner approves. This sheet is the input for the (owner-run)
`generate-catalog-records.mjs` pipeline + the eco frame-default wiring. Companion:
`ECO_DEFAULTS_CANDIDATE_PACKET_2026_06_17.md`.

Pathway: `eco-food-bsaf` (dietary food-web). input_key for the TRV: `TRV_eco_mg_per_kg_bw_day`.
All candidate rows are `qa_status: needs_review`, `default_status: available_option`.

## A. Universal eco frame-default seed candidates (single scalar)

| input_key | value | unit | pathway | source | source_tier | note |
|---|---|---|---|---|---|---|
| `fLipid` | 0.03 | fraction (3% lipid, wet wt) | eco-food-bsaf | ITRC CS-1 (2011) Bioavailability, Text Box 8-1 (Zotero ND29BMRR) | tier_3_industry_or_other (ITRC, EPA-co-hosted, NOT EPA-promulgated) | Generic screening default; site-measured override expected |
| `foc` | 0.002 | mass fraction (0.2% TOC, dry wt) | eco-direct-eqp / eco-food-bsaf | EPA/600/R-02/016 ESB Compendium, Sec 3.1 (Zotero I2YMU9MP) | tier_1_government_or_regulatory | LABELED CONSERVATIVE SCREENING FLOOR = EqP applicability bound, NOT a typical-site default; site-measured fOC overrides. Owner may instead choose central 0.01 (NOT EPA-endorsed) or keep fully site-measured. |

## B. Per-substance / per-receptor eco-TRV candidate rows (FCSAP Module 7 Table 1)

Source: FCSAP ERA Guidance Module 7 v1.0 (ECCC, Apr 2021; Cat. En14-92/7-2021E), Table 1 (PDF pp.25-26),
compiling USEPA Eco-SSL + others. Zotero 7JQ2YJ9T. Grades: A=high / B=moderate / C=low confidence;
N/S=None Suitable (no TRV recommended); N/A=None Available. **Only value-bearing cells become rows**;
N/S/N/A are documented (no row). receptor maps to an eco receptor scenario (mammal vs bird).
**substance_key shown is PROPOSED (lowercase_underscore); reconcile against existing catalog keys at generation.**

| substance | proposed substance_key | receptor | TRV value | unit | grade | original source (per FCSAP) |
|---|---|---|---|---|---|---|
| Arsenic (inorganic) | arsenic | mammal | 1.04 | mg/kg-bw/day | A | USEPA 2005a |
| Arsenic (inorganic) | arsenic | bird | 4.4 | mg/kg-bw/day | A | CEAEQ 2012 |
| Barium | barium | mammal | 51.8 | mg/kg-bw/day | C | USEPA 2005b |
| Barium | barium | bird | 51.3 | mg/kg-bw/day | B | CEAEQ 2012 |
| Cadmium | cadmium | mammal | 0.77 | mg/kg-bw/day | A | USEPA 2005c |
| Cadmium | cadmium | bird | 2.1 | mg/kg-bw/day | B | CEAEQ 2012 |
| Chromium (hexavalent) | chromium_vi | mammal | 9.24 | mg/kg-bw/day | B | USEPA 2008 |
| Chromium (hexavalent) | chromium_vi | bird | 16 | mg/kg-bw/day | C | Condor et al. 2009 |
| Chromium (total) | chromium_total | mammal | 2.4 | mg/kg-bw/day | C | USEPA 2008 |
| Chromium (total) | chromium_total | bird | 2.66 | mg/kg-bw/day | C | USEPA 2008 |
| Copper | copper | mammal | 5.6 | mg/kg-bw/day | A | USEPA 2007a |
| Copper | copper | bird | 4.5 | mg/kg-bw/day | A | CEAEQ 2012 |
| Free Cyanide (HCN+CN-) | free_cyanide | -- | N/S (both receptors) | -- | N/S | -- (no row) |
| Lead | lead | mammal | 4.7 | mg/kg-bw/day | B | USEPA 2005d |
| Lead | lead | bird | 1.63 | mg/kg-bw/day | B | USEPA 2005d |
| Mercury (inorganic) | mercury | mammal | 5.8 | mg/kg-bw/day | B | CEAEQ 2012 |
| Mercury (inorganic) | mercury | bird | 0.8 | mg/kg-bw/day | B | CEAEQ 2012 |
| Nickel | nickel | mammal | 1.7 | mg/kg-bw/day | B | USEPA 2007b |
| Nickel | nickel | bird | 6.71 | mg/kg-bw/day | B | USEPA 2007b |
| Selenium | selenium | mammal | 0.143 | mg/kg-bw/day | B | USEPA 2007c |
| Selenium | selenium | bird | 0.29 | mg/kg-bw/day | B | USEPA 2007c |
| Thallium | thallium | mammal | 0.015 | mg/kg-bw/day | B | Williams et al. 2015 |
| Thallium | thallium | bird | N/S | -- | N/S | -- (no row) |
| Uranium | uranium | mammal | 6.13 | mg/kg-bw/day | B | Sample et al. 1996 |
| Uranium | uranium | bird | N/S | -- | N/S | -- (no row) |
| Vanadium | vanadium | mammal | 4.16 | mg/kg-bw/day | B | USEPA 2005e |
| Vanadium | vanadium | bird | 0.344 | mg/kg-bw/day | B | USEPA 2005e |
| Zinc | zinc | mammal | 75.4 | mg/kg-bw/day | B | USEPA 2007e |
| Zinc | zinc | bird | 66.1 | mg/kg-bw/day | B | USEPA 2007e |
| Anthracene | anthracene | -- | N/S (mammal) / N/A (bird) | -- | N/S,N/A | -- (no row) |
| Fluorene | fluorene | -- | N/S (mammal) / N/A (bird) | -- | N/S,N/A | -- (no row) |
| Naphthalene | naphthalene | mammal | 14.3 | mg/kg-bw/day | B | LANL 2014 |
| Naphthalene | naphthalene | bird | 7.7 | mg/kg-bw/day | C | Klasing 2007 |
| Phenanthrene | phenanthrene | -- | N/S (mammal) / N/A (bird) | -- | N/S,N/A | -- (no row) |
| LMW PAHs (group) | lmw_pahs | mammal | 65.6 | mg/kg-bw/day | B | USEPA 2007d |
| LMW PAHs (group) | lmw_pahs | bird | 7.7 | mg/kg-bw/day | C | Parametrix et al. 2010 |
| Benz(a)anthracene | benz_a_anthracene | bird | 0.107 | mg/kg-bw/day | C | LANL 2014 (mammal N/S) |
| Benzo(a)pyrene | benzo_a_pyrene | mammal | 3.6 | mg/kg-bw/day | C | CEAEQ 2012 |
| Benzo(a)pyrene | benzo_a_pyrene | bird | 0.001 | mg/kg-bw/day | C | USEPA 1999 |
| Pyrene | pyrene | bird | 20.5 | mg/kg-bw/day | C | LANL 2014 (mammal N/S) |
| HMW PAHs (group) | hmw_pahs | mammal | 0.615 | mg/kg-bw/day | B | USEPA 2007d (bird N/S) |
| Benzene | benzene | mammal | 2.62 | mg/kg-bw/day | B | Sanexen 2002 (bird N/A) |
| Ethylbenzene | ethylbenzene | mammal | 0.7 | mg/kg-bw/day | C | Sanexen 2002 (bird N/A) |
| Toluene | toluene | mammal | 26 | mg/kg-bw/day | C | Sample et al. 1996 (bird N/A) |
| Xylenes | xylenes | bird | 107 | mg/kg-bw/day | C | LANL 2014 (mammal N/S) |
| Total PHCs | total_phcs | mammal | 210 | mg/kg-bw/day | C | CCME 2008 |
| Total PHCs | total_phcs | bird | 125 | mg/kg-bw/day | C | Szaro 1977 |
| CCME CWS Fractions | phc_f1..f4 | mammal | F1 48.72 / F2 44.73 / F3 72.45 / F4 38.22 | mg/kg-bw/day | C | AEP 2016 + CCME 2008 (bird N/A) -- FOUR rows (one per fraction) |
| Total PCB TEQ | total_pcb_teq | mammal | 0.19 | **ng TEQ/kg-bw/day** | C | CCME 2001a |
| Total PCB TEQ | total_pcb_teq | bird | 2.3 | **ng TEQ/kg-bw/day** | C | CCME 2001a |
| Total PCDD/F TEQ | total_pcdd_f_teq | mammal | 0.17 | **ng TEQ/kg-bw/day** | C | CCME 2001b |
| Total PCDD/F TEQ | total_pcdd_f_teq | bird | 4.47 | **ng TEQ/kg-bw/day** | C | CCME 2001b |

Approx value-bearing rows: ~46 (metals/inorganics dominate; PAH/VOC/PHC/PCB-dioxin groups add the rest;
the CCME CWS Fractions cell expands to 4 fraction rows).

## C. CRITICAL accuracy caveats (must carry into the records)

1. **UNIT EXCEPTION:** the two TEQ rows (Total PCB TEQ, Total PCDD/F TEQ) are in **ng TEQ/kg-bw/day**, NOT mg/kg-bw/day. Do NOT normalize them to mg without the TEQ basis -- they need a distinct unit + a TEF/TEQ note.
2. **N/S (None Suitable) vs N/A (None Available)** are distinct and BOTH mean "no TRV recommended" -> NO value row; document the gap so the calculator shows "no eco-TRV" rather than a wrong value.
3. **CCME CWS Fractions** is a compound cell -> 4 separate fraction rows (F1-F4), mammal only.
4. **Receptor split:** mammal vs bird are separate receptor scenarios; eco-food currently has ONE `TRV_eco_mg_per_kg_bw_day` input -> seeding needs eco receptor scenarios (mammal/bird), mirroring how HH has toddler/fisher scenarios.
5. **No uncertainty factors** were applied in the Eco-SSL derivation -> do NOT add safety factors (double-count).
6. **Source tier:** these are FCSAP (Canada_federal) compiling USEPA Eco-SSL; a standalone USEPA Eco-SSL PDF is NOT in local Zotero. Stamp jurisdiction=Canada_federal (compiling US_federal) and decide whether the FCSAP-compilation provenance is acceptable or the primary Eco-SSL PDFs must be fetched first.
7. **substance_key reconciliation:** map each to the EXISTING catalog substance_key (most metals/PAHs/VOCs exist, e.g. arsenic, benzo_a_pyrene, naphthalene present); the GROUP rows (lmw_pahs, hmw_pahs, total_phcs, phc_f1..f4, total_pcb_teq, total_pcdd_f_teq) likely need new keys or mapping to a group convention -- flag at generation.

## D. Source entries to add (sources.json) -- owner-gated

- FCSAP ERA Guidance Module 7 v1.0 (ECCC 2021, En14-92/7-2021E) -- the eco-TRV compilation.
- USEPA Eco-SSL (cited-by, via FCSAP) -- the primary underlying TRV source family.
- EPA/600/R-02/016 ESB Compendium (2008) -- fOC / EqP.
- ITRC CS-1 (2011) Bioavailability -- fLipid + BSAF screening.

## E. Generation + wiring plan (owner-gated; wiring AFTER PR #337 merges)

1. Owner dispositions section A + B (which rows to draft; FCSAP-vs-primary-Eco-SSL provenance call).
2. Add the section-D source entries to `sources.json` (needs_review).
3. Feed the disposed rows through `scripts/matrix-options/generate-catalog-records.mjs` -> needs_review records in the catalog (NOT promoted).
4. Fill the eco `SEEDABLE_KEYS` (`frameDefaults.ts`) for eco-food-bsaf (TRV_eco, fLipid, foc) + eco-direct-eqp (foc) and author `FRAME_DEFAULT_PROFILES` rows (per receptor: mammal/bird) citing the approved values. **This touches the eco calculators -> do it on merged main (after #337), not before.**
5. Owner promotes (apply / promote scripts, reviewer J. Nelson) -- AI never runs promote --apply without explicit inline approval.
6. Result: eco pathways auto-compute -> the cross-pathway comparison view shows all 4 pathways.

## F. Owner disposition checklist
- [ ] fLipid 0.03 seed (accept tier_3 source / needs_review?)
- [ ] fOC: floor 0.002 (labeled) vs central 0.01 vs site-measured-only
- [ ] eco-TRV rows: draft all ~46 / subset? FCSAP-compilation provenance acceptable, or fetch primary USEPA Eco-SSL first?
- [ ] BSAF: per-substance from ERDC DB (separate effort) + ITRC ~2 as a generic trip-point?
- [ ] receptor scenarios (mammal/bird) for eco-food -- confirm the scenario model
- [ ] confirm eco-pathway seeding in-scope for the matrix-options lane before the wiring PR

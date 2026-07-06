> **CANDIDATE LEADS ONLY -- NOT CATALOG CONCLUSIONS.** Every row below is a candidate for human adjudication against the actual PDF page before any catalog edit. This script's own extraction/matching logic can have bugs; do not apply any MISMATCH or AMBIGUOUS finding to the catalog without independently re-reading the cited PDF page.

## Extraction Command
Generated via `scripts/matrix-options/hc_trv_v4_extract.py`.

## Mapping Constants
```js
const INPUT_KEY_TO_PDF_TYPE = {
  "rfd_oral_mg_per_kg_bw_day": [
    "Oral TDI",
    "Oral RfD",
    "Risk-specific dose",
    "UL"
  ],
  "sf_oral_per_mg_per_kg_bw_per_day": [
    "Oral SF"
  ],
  "rfc_inhalation_mg_per_m3": [
    "Inhalation TC"
  ],
  "unit_risk_inhalation_per_ug_m3": [
    "Inhalation UR"
  ]
};
const CATALOG_TO_PDF_UNIT_FACTOR = {
  "rfd_oral_mg_per_kg_bw_day": 1,
  "sf_oral_per_mg_per_kg_bw_per_day": 1,
  "rfc_inhalation_mg_per_m3": 1,
  "unit_risk_inhalation_per_ug_m3": 1000
};
```

## Validation Cases
- Synthetic MISMATCH case (Arsenic Oral SF vs 6.4): **PASS**
- Control MATCH case (Arsenic Oral SF and Inhalation UR): **PASS**
- Ambiguity case (Vinyl chloride Oral SF): **PASS**
- Unit-conversion case (Benzene Inhalation UR): **PASS**

## Summary
- catalog_rows_scanned: 111
- MATCH count: 105
- MISMATCH count: 0
- AMBIGUOUS count: 6
- TYPE-OR-NAME-NOT-FOUND count: 0

## MISMATCH Rows
| Substance Key | Input Key | Catalog Value | PDF Value | PDF Page | Parameter Value ID |
|---|---|---|---|---|---|

## AMBIGUOUS Rows
| Substance Key | Input Key | Catalog Value | PDF Candidate Values | Parameter Value ID |
|---|---|---|---|---|
| zinc | rfd_oral_mg_per_kg_bw_day | 0.51 | 0.49 (pg 52), 0.48 (pg 52), 0.51 (pg 52), 0.54 (pg 52), 0.57 (pg 52) | pv-hc-zinc-hh-direct-ul-child |
| zinc | rfd_oral_mg_per_kg_bw_day | 0.57 | 0.49 (pg 52), 0.48 (pg 52), 0.51 (pg 52), 0.54 (pg 52), 0.57 (pg 52) | pv-hc-zinc-hh-food-ul-adult |
| manganese | rfc_inhalation_mg_per_m3 | 0.00005 | 0.00005 (pg 35), 3.5 (pg 35) | pv-hc-manganese-hh-direct-rfc |
| methylmercury | rfd_oral_mg_per_kg_bw_day | 0.00047 | 0.0002 (pg 37), 0.00047 (pg 37) | pv-hc-methylmercury-hh-direct-rfd |
| vinyl_chloride | sf_oral_per_mg_per_kg_bw_per_day | 0.24 | 0.24 (pg 50), 0.48 (pg 50) | pv-hc-vinyl_chloride-hh-direct-sf |
| vinyl_chloride | unit_risk_inhalation_per_ug_m3 | 0.0000044 | 0.0044 (pg 50), 0.0088 (pg 50) | pv-hc-vinyl_chloride-hh-direct-iur |

## Adjudication Notes (hand-verified against the real PDF, 2026-07-06)

All 6 AMBIGUOUS rows were checked directly against the source PDF (via PyMuPDF) and are LEGITIMATE
ambiguities, not tool bugs -- no catalog edit is warranted for any of them:

- **zinc (2 rows):** the real PDF has a genuinely age-stratified UL (0 to <6mo / 6mo-5yrs / 5-12yrs /
  12-20yrs / >=20yrs, 5 distinct values 0.49/0.48/0.51/0.54/0.57 mg/kgBW-day, page 52). The catalog's
  child (0.51) and adult (0.57) rows both correspond to real age-bracket values within this
  stratification -- exactly as the original May 2026 pass's review note documented as a deliberate
  "skip full stratification" decision. Confirmed correct; no fix needed.
- **manganese (1 row):** the "second candidate value" (3.5) is a FALSE POSITIVE in the extraction,
  confirmed by direct PDF read (page 35) -- it's the "3.5" in the unit annotation "mg/m3 (in PM3.5)"
  (particulate size fraction), not a second TRV value. The real (and only) Inhalation TC is 5.0E-05
  mg/m3, matching the catalog's 0.00005 exactly. This is a benign extractor quirk (fails toward
  AMBIGUOUS, never toward a false MATCH/MISMATCH) -- noted here for the record; not worth a parser
  fix given the AMBIGUOUS classification is itself safe.
- **methylmercury (1 row, `pv-hc-methylmercury-hh-direct-rfd`):** correctly AMBIGUOUS -- its
  `applicability` text is generic ("Health Canada TRV v4.0 RFD for methylmercury") with no
  sensitive/adult qualifier keyword, so there is genuinely no catalog-side basis to pick between the
  PDF's two population-variant Oral TDI rows (0.0002 sensitive / 0.00047 adult). The OTHER 3
  methylmercury rows correctly resolved to MATCH once the qualifier-matching keyword bug was fixed --
  this one's own applicability text is just less specific than its siblings.
- **vinyl_chloride (2 rows, Oral SF + Inhalation UR):** correctly AMBIGUOUS -- the PDF has adult vs.
  from-birth variants for both (Oral SF 0.24/0.48; Inhalation UR 0.0044/0.0088 per mg/m3, page 50),
  and the catalog's `applicability` text is generic with no adult/from-birth qualifier. The
  catalog's stored values (0.24, 0.0000044 per ug/m3 = 0.0044 per mg/m3) happen to match the "adult"
  PDF row, but per this cross-check's design, a numeric coincidence does not substitute for
  catalog-side disambiguating metadata -- this is correctly flagged for human review, not silently
  accepted as a match.

**Net result: zero confirmed catalog errors found in this scan** (beyond chlorobenzene, already
corrected in this session -- see the companion PR). All AMBIGUOUS rows are genuine source-document
population/exposure-scenario variants (or one benign extractor quirk) that the catalog's own
metadata doesn't yet disambiguate -- these are candidates for a FUTURE session to add explicit
qualifier/population metadata to the catalog rows (so they resolve cleanly), not evidence of wrong
values. No further catalog edits are made in this PR beyond the chlorobenzene correction.

## TYPE-OR-NAME-NOT-FOUND Rows
| Substance Key | Input Key | Parameter Value ID |
|---|---|---|

## MATCH Rows (Summary)
Total MATCH rows: 105
benzo_a_pyrene, benzo_a_pyrene, benzo_a_pyrene, benzo_a_pyrene, arsenic_inorganic, arsenic_inorganic, total_pcbs_aroclor_1254, total_pcbs_aroclor_1254, methylmercury, methylmercury, methylmercury, lead, lead, cadmium, cadmium, copper, copper, arsenic_inorganic, barium, barium, benzene, benzene, benzene, benzo_a_pyrene, benzo_a_pyrene, beryllium, beryllium, beryllium, beryllium, cadmium, carbon_tetrachloride, carbon_tetrachloride, carbon_tetrachloride, chlorobenzene, chlorobenzene, chlorobenzene, chromium_trivalent, chromium_trivalent, chromium_hexavalent, chromium_hexavalent, chromium_hexavalent, chromium_hexavalent, dichlorobenzene_1_2, dichlorobenzene_1_2, dichlorobenzene_1_4, dichlorobenzene_1_4, dichlorobenzene_1_4, dichloroethane_1_2, dichloroethane_1_2, dichloroethylene_1_1, dichloroethylene_1_1, dichloroethylene_1_1, dichloromethane, dichloromethane, dichloromethane, dichloromethane, dichloromethane, dichloromethane, ethylbenzene, ethylbenzene, ethylbenzene, n_hexane, n_hexane, n_hexane, manganese, manganese, mercury_inorganic, mercury_inorganic, methylnaphthalene_2, methylnaphthalene_2, naphthalene, naphthalene, naphthalene, nickel_chloride, nickel_chloride, nickel_oxide, nickel_subsulfide, nickel_sulfate, nickel_sulfate, nickel_sulfate, nickel_mixture, nickel_metallic, pcbs_non_coplanar, pcbs_non_coplanar, pyrene, pyrene, tetrachloroethylene, tetrachloroethylene, tetrachloroethylene, tetrachloroethylene, toluene, toluene, toluene, trichloroethylene, trichloroethylene, trichloroethylene, trichloroethylene, trichloroethylene, trichloroethylene, uranium, uranium, vinyl_chloride, xylenes, xylenes, xylenes
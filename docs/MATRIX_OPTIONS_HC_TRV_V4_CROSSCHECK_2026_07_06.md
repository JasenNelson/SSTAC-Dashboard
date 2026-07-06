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
- Ambiguity case (synthetic no-qualifier fixture): **PASS**
- Unit-conversion case (Benzene Inhalation UR): **PASS**

## Summary
- catalog_rows_scanned: 111
- MATCH count: 107
- MISMATCH count: 0
- AMBIGUOUS count: 4
- TYPE-OR-NAME-NOT-FOUND count: 0

## MISMATCH Rows
| Substance Key | Input Key | Catalog Value | PDF Value | PDF Page | Parameter Value ID |
|---|---|---|---|---|---|

## AMBIGUOUS Rows
| Substance Key | Input Key | Catalog Value | PDF Candidate Values | Parameter Value ID |
|---|---|---|---|---|
| manganese | rfc_inhalation_mg_per_m3 | 0.00005 | 0.00005 (pg 35), 3.5 (pg 35) | pv-hc-manganese-hh-direct-rfc |
| methylmercury | rfd_oral_mg_per_kg_bw_day | 0.00047 | 0.0002 (pg 37), 0.00047 (pg 37) | pv-hc-methylmercury-hh-direct-rfd |
| vinyl_chloride | sf_oral_per_mg_per_kg_bw_per_day | 0.24 | 0.24 (pg 50), 0.48 (pg 50) | pv-hc-vinyl_chloride-hh-direct-sf |
| vinyl_chloride | unit_risk_inhalation_per_ug_m3 | 0.0000044 | 0.0044 (pg 50), 0.0088 (pg 50) | pv-hc-vinyl_chloride-hh-direct-iur |

## Adjudication Notes (hand-verified against the real PDF, 2026-07-06)

All 4 remaining AMBIGUOUS rows were checked directly against the source PDF (via PyMuPDF) and
each has a specific, understood reason -- no further catalog VALUE edit is warranted by this
scan (three rows have a real population/value tension flagged for separate owner decision):

- **manganese (1 row):** the "second candidate value" (3.5) is a FALSE POSITIVE in the extraction,
  confirmed by direct PDF read (page 35) -- it's the "3.5" in the unit annotation "mg/m3 (in PM3.5)"
  (particulate size fraction), not a second TRV value. The real (and only) Inhalation TC is 5.0E-05
  mg/m3, matching the catalog's 0.00005 exactly. Benign extractor quirk; not worth a parser fix
  given the AMBIGUOUS classification is itself safe.
- **methylmercury (1 row, `pv-hc-methylmercury-hh-direct-rfd`):** correctly AMBIGUOUS, and
  intentionally left that way. Tagged `population_groups: ["screening child"]` -- the SAME tag as
  the sensitive-population row (`pv-hc-mehg-hh-direct-rfd-sensitive`, value 0.0002) -- but holds
  the less-protective adult value (0.00047). **OWNER REVIEW NEEDED** (see `review_notes`): should
  this row be reassigned to the sensitive value, retagged, or is the current tagging intentional?
- **vinyl_chloride (2 rows, direct-contact Oral SF + Inhalation UR):** correctly AMBIGUOUS, and
  intentionally left that way. Both rows are tagged `population_groups: ["screening child"]` but
  hold HC's adult-scenario values (0.24 SF / 0.0044 per mg/m3 IUR), not the more-conservative
  from-birth values (0.48 SF / 0.0088 IUR) that may better fit a child-inclusive screening
  pathway. **OWNER REVIEW NEEDED** (see each row's `review_notes`): should these rows be
  reassigned to the from-birth value, or is the adult value intentional for this pathway? (The
  food-web Oral SF row, by contrast, is tagged `population_groups: ["screening adult"]` --
  consistent with its adult-scenario value -- and resolves cleanly to MATCH.)

For all three flagged rows above: the underlying VALUES were NOT changed in this correction pass
(they predate this session) -- only the descriptive text was corrected to surface each tension
explicitly instead of leaving it implicit. None are current_default (available_option only), so
there is no live calculator impact pending owner decision.

**Previously AMBIGUOUS, now correctly resolved to MATCH (2026-07-06):**
- **zinc (2 rows):** the real PDF has a genuinely age-stratified UL (0 to <6mo / 6mo-5yrs / 5-12yrs /
  12-20yrs / >=20yrs, 5 distinct values 0.49/0.48/0.51/0.54/0.57 mg/kgBW-day, page 52). Added an
  age-bracket exact-substring disambiguation capability to this script, plus explicit age-band
  wording to the catalog's adult row's applicability (the child row already had it) -- both rows
  now resolve to their correct age-bracket value. No population/value tension here: the "child"
  and "adult" rows genuinely correspond to different real HC age brackets, not a same-tag
  value clash like methylmercury/vinyl_chloride above.

**Net result: zero confirmed catalog VALUE errors found in this scan** (beyond chlorobenzene,
corrected in the companion PR). Three genuine population/value tensions (methylmercury,
vinyl_chloride x2) are flagged for owner decision, not silently resolved.

## TYPE-OR-NAME-NOT-FOUND Rows
| Substance Key | Input Key | Parameter Value ID |
|---|---|---|

## MATCH Rows (Summary)
Total MATCH rows: 107
benzo_a_pyrene, benzo_a_pyrene, benzo_a_pyrene, benzo_a_pyrene, arsenic_inorganic, arsenic_inorganic, total_pcbs_aroclor_1254, total_pcbs_aroclor_1254, methylmercury, methylmercury, methylmercury, lead, lead, cadmium, cadmium, copper, copper, zinc, zinc, arsenic_inorganic, barium, barium, benzene, benzene, benzene, benzo_a_pyrene, benzo_a_pyrene, beryllium, beryllium, beryllium, beryllium, cadmium, carbon_tetrachloride, carbon_tetrachloride, carbon_tetrachloride, chlorobenzene, chlorobenzene, chlorobenzene, chromium_trivalent, chromium_trivalent, chromium_hexavalent, chromium_hexavalent, chromium_hexavalent, chromium_hexavalent, dichlorobenzene_1_2, dichlorobenzene_1_2, dichlorobenzene_1_4, dichlorobenzene_1_4, dichlorobenzene_1_4, dichloroethane_1_2, dichloroethane_1_2, dichloroethylene_1_1, dichloroethylene_1_1, dichloroethylene_1_1, dichloromethane, dichloromethane, dichloromethane, dichloromethane, dichloromethane, dichloromethane, ethylbenzene, ethylbenzene, ethylbenzene, n_hexane, n_hexane, n_hexane, manganese, manganese, mercury_inorganic, mercury_inorganic, methylnaphthalene_2, methylnaphthalene_2, naphthalene, naphthalene, naphthalene, nickel_chloride, nickel_chloride, nickel_oxide, nickel_subsulfide, nickel_sulfate, nickel_sulfate, nickel_sulfate, nickel_mixture, nickel_metallic, pcbs_non_coplanar, pcbs_non_coplanar, pyrene, pyrene, tetrachloroethylene, tetrachloroethylene, tetrachloroethylene, tetrachloroethylene, toluene, toluene, toluene, trichloroethylene, trichloroethylene, trichloroethylene, trichloroethylene, trichloroethylene, trichloroethylene, uranium, uranium, vinyl_chloride, xylenes, xylenes, xylenes
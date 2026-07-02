<!-- Generated 2026-07-01 by the mo-eco-values-audit workflow (round 2, 77 agents, adversarial verify). REPORT-ONLY. eco_values.json cross-reference the primary audit skipped. HITL required for value changes; documentation-truth fixes may proceed gated. -->

# Eco-Pathway QA Audit Report - Round 2
## SUBSTANCE_LIBRARY vs eco_values.json (matrix-options)

**Scope:** `src/lib/matrix-options/substanceLibrary.ts` cross-referenced against the eco catalog (`eco_values.json`, 71 substances with at least one approved eco-relevant row: `fcv_ug_per_L` eco-direct-eqp, or `trv_eco_mg_per_kg_bw_day` eco-food-bsaf).
**Method:** Adversarial cross-reference of every static eco field in the library (value, null-ness, and the accompanying `sources`/`notes` prose) against the catalog's approved rows for the same substance_key and input_key.
**Report-only.** No code changes made or proposed as part of this report.

---

## 1. Summary

- **Findings (rows):** 47 distinct key+field findings, covering **51 of the 71** catalog substances (one finding row - the PHC family - bundles 5 substances that are entirely absent from the library).
- **By severity:** 12 HIGH, 35 MEDIUM, 0 LOW.
- **By issue type:**
  | Issue type | Rows | Substances covered | Severity |
  |---|---|---|---|
  | TEXT-DATA CONTRADICTION | 7 | 7 | all HIGH |
  | WIRED-VALUE MISMATCH | 6 | 6 | 5 HIGH, 1 MEDIUM |
  | UNWIRED-APPROVED-GAP | 33 | 34 (lmw_pahs is a whole-substance gap, folded in here) | all MEDIUM |
  | OTHER (whole-substance missing, PHC family) | 1 | 5 (phc_f1, phc_f2, phc_f3, phc_f4, total_phcs) | MEDIUM |

- **Re-verification note:** five findings (lead, copper, cadmium, arsenic_inorganic, barium) were independently flagged in two separate adversarial passes within this round. Where the two passes disagreed on severity (arsenic_inorganic, lead), both ratings are preserved below with the discrepancy called out - treat these as CONFIRMED defects with an unresolved severity call, not as noise.
- **Highest-priority class:** the 7 TEXT-DATA CONTRADICTIONS are shipped provenance lies - the `sources`/`notes` text asserts a specific catalog-backed number was wired in, and it was not. These should be triaged first regardless of numeric magnitude, because they misrepresent what data backs a currently-null field.

---

## 2. Findings by issue type

### 2.1 TEXT-DATA CONTRADICTIONS (notes/sources claim a value that is actually null)

| Key | Field | Severity | Detail |
|---|---|---|---|
| chloroform | fcv_ug_per_L | HIGH | Lines 1450-1471. `fcv_ug_per_L` is null, but `sources` states "Eco-direct FCV 1.8 ug/L from CCME (interim CWQG freshwater aquatic-life guideline, 1992) seeded from the eco catalog" and `notes` repeats "FCV 1.8 ug/L = CCME interim CWQG ... Attribute to CCME only." Catalog has an approved `fcv_ug_per_L` row: 1.8 ug/L, source src-ccme-cwqg-aquatic-life - matches the text exactly. The claimed value was never written into the field. |
| chromium | trv_eco_mg_per_kg_bw_day | HIGH | Lines 1402-1416. `trv_eco_mg_per_kg_bw_day` is null, but `sources` states "Eco-food TRV seeded from the eco catalog (FCSAP ERA Module 7)." Catalog has two approved rows (wildlife, src-fcsap-era-module7-wildlife-trv-2021): 2.4 and 2.66 mg/kg-bw/day. Neither wired in despite the explicit claim. |
| benz_a_anthracene | trv_eco_mg_per_kg_bw_day | HIGH | Lines 562-579. `trv_eco_mg_per_kg_bw_day` is null, but `sources` states "Eco-food TRV seeded from the eco catalog." Catalog has an approved row (wildlife, src-fcsap-era-module7-wildlife-trv-2021): 0.107 mg/kg-bw/day. Never wired in. |
| chlordane_technical | fcv_ug_per_L | HIGH | Lines 769-793. `fcv_ug_per_L` is null, but `sources` ends with "Eco FCV from catalog." Catalog has an approved row (aquatic life, src-us-epa-nrwqc-aquatic-life-live): 0.0043 ug/L. Never wired in. |
| polychlorinated_biphenyls_total_pcbs | fcv_ug_per_L | HIGH | `sources` literally states "Eco-direct FCV 0.014 ug/L from EPA NRWQC" - the exact approved catalog value (0.014 ug/L, src-us-epa-nrwqc-aquatic-life-live, approved) - yet the library's `fcv_ug_per_L` field is null. `notes` even elaborates a detailed EqP-consistency caveat about this FCV as if it were wired. Most explicit contradiction in the set: the text cites the exact number, not just "seeded from catalog." |
| pyrene | trv_eco_mg_per_kg_bw_day | HIGH | `sources` states "Eco-food TRV seeded from the eco catalog" but `trv_eco_mg_per_kg_bw_day` is null. Catalog has an approved row: 20.5 mg/kg-bw/day, generic bird receptor, src-fcsap-era-module7-wildlife-trv-2021. (No approved `fcv_ug_per_L` row exists for pyrene, so the null FCV field is correctly unwired, not a gap.) |
| p_p_dichlorodiphenyltrichloroethane_ddt | fcv_ug_per_L | HIGH | `sources` states "Eco FCV from catalog" but `fcv_ug_per_L` is null. Catalog has an approved row: 0.001 ug/L, aquatic community (chronic), src-us-epa-nrwqc-aquatic-life-live. |

### 2.2 WIRED-VALUE MISMATCHES (a value is wired, but does not match any approved catalog row)

| Key | Field | Severity | Detail |
|---|---|---|---|
| copper | trv_eco_mg_per_kg_bw_day | HIGH (confirmed twice, lines 104-118) | Wired = 7.0 mg/kg-bw/day, cited to "US EPA Eco-SSL avian TRV (Cu)" - a source not present in the eco catalog. Catalog's two approved rows (wildlife, src-fcsap-era-module7-wildlife-trv-2021) are 5.6 and 4.5 mg/kg-bw/day; the wired value matches neither. Legacy pre-catalog value never reconciled. |
| cadmium | trv_eco_mg_per_kg_bw_day | HIGH (confirmed twice, lines 120-138) | Wired = 0.0014 mg/kg-bw/day, cited to "US EPA Eco-SSL avian TRV (Cd)" - not in the catalog. Catalog's two approved rows are 0.77 and 2.1 mg/kg-bw/day - roughly 550x-1500x higher than the wired legacy value. Large-magnitude discrepancy for a priority metal. |
| zinc | trv_eco_mg_per_kg_bw_day | HIGH (lines 140-154) | Wired = 14.0 mg/kg-bw/day, cited to "US EPA Eco-SSL avian TRV (Zn)." Catalog's approved rows are 75.4 (mammal) and 66.1 (bird) mg/kg-bw/day; the wired value matches neither and the Eco-SSL source is absent from the catalog. |
| arsenic_inorganic | trv_eco_mg_per_kg_bw_day | HIGH / MEDIUM (severity split across two verification passes; lines 156-174) | Wired = 0.043 mg/kg-bw/day, cited to "US EPA Eco-SSL avian TRV (iAs)" - not in the catalog. Catalog's approved rows are 1.04 (mammal) and 4.4 (bird) mg/kg-bw/day, roughly 24x-100x higher than the wired value. First pass rated HIGH; independent re-check rated MEDIUM. Given the magnitude, treat as HIGH pending owner call. |
| lead | trv_eco_mg_per_kg_bw_day | HIGH / MEDIUM (severity split across two verification passes; lines 83-102) | Wired = 0.0080 mg/kg-bw/day, cited to "US EPA Eco-SSL avian TRV (Pb)" - not in the catalog. Catalog's approved eco-food-bsaf rows are 4.7 mg/kg-bw/day (mammal) and 1.63 mg/kg-bw/day (bird), both src-fcsap-era-module7-wildlife-trv-2021; the wired value matches neither and is off by ~200x-590x. One pass noted a mitigating factor: `bsaf_loc_freshwater` is null for lead and `EcoFoodBSAFCalculator.tsx`'s relaxed-BSAF gate only unblocks when the dynamic `resolveEcoSeed` resolver supplies a non-null parameterValueId - so the stale value may be dead code today (the calculator likely uses the catalog's 4.7/1.63 via the dynamic path instead). However the wrong value remains the on-disk static fallback and will surface silently if the dynamic resolver ever fails to find an eligible row for lead under a given frame/jurisdiction. Rated HIGH on magnitude / fallback-risk grounds; MEDIUM in the pass that weighted the likely-dead-code mitigation. |
| benzo_a_pyrene | trv_eco_mg_per_kg_bw_day | MEDIUM (lines 12-35) | Wired = 0.0025 mg/kg-bw/day, cited to "US EPA Eco-SSL for PAH (TRV)" - not in the catalog. Catalog's approved rows are 3.6 and 0.001 mg/kg-bw/day (both src-fcsap-era-module7-wildlife-trv-2021); wired value matches neither. (`fcv_ug_per_L` = 0.014 is also uncited-in-catalog but there is no approved catalog FCV row for benzo_a_pyrene at all, so that field is not counted as a mismatch.) |

### 2.3 UNWIRED-APPROVED-GAPS (catalog has an approved row; library field is null and text makes no false claim about it - build-first opportunities)

| Key | Field | Severity | Detail |
|---|---|---|---|
| benzene | both (fcv_ug_per_L, trv_eco_mg_per_kg_bw_day) | MEDIUM | Lines 299-312. Both fields null; `sources` cites only HH toxicity references (no eco-catalog claim, not a contradiction). Catalog has approved rows for both: fcv_ug_per_L = 130 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008) and trv_eco_mg_per_kg_bw_day = 2.62 mg/kg-bw/day (src-fcsap-era-module7-wildlife-trv-2021). One of the more consequential organics in the library. |
| barium | trv_eco_mg_per_kg_bw_day | MEDIUM (confirmed twice, lines 282-297) | `trv_eco_mg_per_kg_bw_day` is null; `sources`/`notes` correctly state defaults are unset (no false claim). Catalog has two approved rows (wildlife, src-fcsap-era-module7-wildlife-trv-2021): 51.8 and 51.3 mg/kg-bw/day (two independent estimates, not receptor duplicates). |
| chromium_hexavalent | trv_eco_mg_per_kg_bw_day | MEDIUM | Lines 350-364. Null; HH-only text. Catalog has two approved rows: 9.24 and 16.0 mg/kg-bw/day (src-fcsap-era-module7-wildlife-trv-2021). |
| azinphos_methyl | fcv_ug_per_L | MEDIUM | Lines 813-827. Null. Catalog approved row: 0.01 ug/L (src-us-epa-nrwqc-aquatic-life-live). |
| biphenyl | fcv_ug_per_L | MEDIUM | Lines 828-842. Null. Catalog approved row: 14 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| bromoform | fcv_ug_per_L | MEDIUM | Lines 843-857. Null. Catalog approved row: 320 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| bromophenyl_phenyl_ether_4 | fcv_ug_per_L | MEDIUM | Lines 858-872. Null. Catalog approved row: 1.5 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| butyl_benzyl_phthalate_bbp | fcv_ug_per_L | MEDIUM | Lines 873-887. Null. Catalog approved row: 19 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| carbaryl | fcv_ug_per_L | MEDIUM | Lines 888-902. Null. Catalog approved row: 2.1 ug/L (src-us-epa-nrwqc-aquatic-life-live). |
| carbon_tetrachloride | fcv_ug_per_L | MEDIUM | Lines 903-917. Null. Catalog approved row: 240 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| chlorpyrifos | fcv_ug_per_L | MEDIUM | Lines 918-932. Null. Catalog approved row: 0.041 ug/L (src-us-epa-nrwqc-aquatic-life-live). |
| demeton | fcv_ug_per_L | MEDIUM | Null; notes only mention logKow 3.21 (EqP input), no catalog-seeding claim. Catalog approved row: 0.1 ug/L (src-us-epa-nrwqc-aquatic-life-live). May be mitigated at runtime by ecoSeed.ts for frames where eco-direct-eqp is not "reference_only." |
| diazinon | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 3.81. Catalog has TWO approved rows, essentially concordant: 0.1699 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008) and 0.17 ug/L (src-us-epa-nrwqc-aquatic-life-live). |
| dibutyl_phthalate_dbp | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 4.5. Catalog approved row: 35 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| dichlorobenzene_1_2 | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 3.43. Catalog approved row: 14 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| dichlorobenzene_1_3 | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 3.53. Catalog approved row: 71 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| dichlorobenzene_1_4 | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 3.44. Catalog approved row: 15 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| diethyl_phthalate_dep | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 2.47. Catalog approved row: 270 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| endosulfan | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 3.83 (flagged disputed). Catalog approved row: 0.056 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| endosulfan_alpha | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 4.74. Catalog has TWO approved rows, both 0.056 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008 and src-us-epa-nrwqc-aquatic-life-live). |
| endosulfan_beta | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 3.62. Catalog has TWO approved rows, both 0.056 ug/L (same two sources as endosulfan_alpha). |
| ethylbenzene | both (fcv_ug_per_L, trv_eco_mg_per_kg_bw_day) | MEDIUM | Catalog has an approved eco-direct-eqp row (7.3 ug/L, src-us-epa-esb-tier2-nonionic-organics-2008) AND an approved eco-food-bsaf row (0.7 mg/kg-bw/day, src-fcsap-era-module7-wildlife-trv-2021, mammal). Both library fields null. `sources` text says "Eco FCV/TRV seeded from the eco catalog" - verified accurate against both catalog rows, so NOT filed as a contradiction, but neither value is statically wired. |
| heptachlor | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 5.44. Catalog approved row: 0.0038 ug/L (src-us-epa-nrwqc-aquatic-life-live). |
| heptachlor_epoxide | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 5.4. Catalog approved row: 0.0038 ug/L (src-us-epa-nrwqc-aquatic-life-live). |
| hexachlorocyclohexane_gamma (Lindane) | fcv_ug_per_L | MEDIUM | Null; notes cite only logKow 3.5. Catalog approved row: 0.08 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| naphthalene | trv_eco_mg_per_kg_bw_day | MEDIUM | ~Lines 377-381. `trv_eco_mg_per_kg_bw_day` is null; `notes` states "EqP/BSAF defaults are pending source-backed ecological values" and `sources` cites only HH IRIS/HC v4.0 references (no eco catalog citation - stale documentation, since other organic-PAH entries in the same file carry eco-catalog citations). Catalog actually has two APPROVED rows: 14.3 mg/kg-bw/day (mammal) and 7.7 mg/kg-bw/day (bird), src-fcsap-era-module7-wildlife-trv-2021. Real-world calculator output is likely unaffected if `resolveEcoSeed()` resolves dynamically at runtime; the defect is the stale/misleading static documentation plus the unwired fallback field. |
| lmw_pahs | both (whole-substance gap) | MEDIUM | No entry exists for `lmw_pahs` (or any low-molecular-weight-PAH synonym) anywhere in `src/lib/matrix-options` or `src/data` - confirmed by grep. Catalog has two APPROVED trv_eco_mg_per_kg_bw_day rows (65.6 mg/kg-bw/day mammal, 7.7 mg/kg-bw/day bird, src-fcsap-era-module7-wildlife-trv-2021). Cannot be selected in the calculator UI at all, so its approved data is completely unreachable regardless of the dynamic-resolver fallback used elsewhere. |
| tetrachloroethylene | fcv_ug_per_L | MEDIUM | Null; text is HH-only (RfD/RfC/SF/inhalation-unit-risk), no eco-catalog claim. Catalog approved row: 98 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| trichloroethylene | fcv_ug_per_L | MEDIUM | Null; HH-only text. Catalog approved row: 47 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| tetrachloroethane_1_1_2_2 | fcv_ug_per_L | MEDIUM | logKow (2.39) present, null field, no catalog-seeding claim. Catalog approved row: 610 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| trichloroethane_1_1_1 | fcv_ug_per_L | MEDIUM | logKow (2.49) present, null field, no catalog-seeding claim. Catalog approved row: 11 ug/L (src-us-epa-esb-tier2-nonionic-organics-2008). |
| thallium | trv_eco_mg_per_kg_bw_day | MEDIUM | Lines 1248-1261. Null. Catalog approved row: 0.015 mg/kg-bw/day, mammal, src-fcsap-era-module7-wildlife-trv-2021. |
| uranium | trv_eco_mg_per_kg_bw_day | MEDIUM | Lines 1308-1321. Null. Catalog approved row: 6.13 mg/kg-bw/day, mammal, src-fcsap-era-module7-wildlife-trv-2021. |

### 2.4 OTHER - whole-substance-missing (PHC family)

| Key | Field | Severity | Detail |
|---|---|---|---|
| phc_f1 / phc_f2 / phc_f3 / phc_f4 / total_phcs | trv_eco_mg_per_kg_bw_day | MEDIUM | These 5 substance_keys have approved eco-food TRV rows in the catalog (phc_f1 = 48.72, phc_f2 = 44.73, phc_f3 = 72.45, phc_f4 = 38.22 mg/kg-bw/day, all generic mammal / src-fcsap-era-module7-wildlife-trv-2021; total_phcs has two approved rows: 210 mg/kg-bw/day mammal and 125 mg/kg-bw/day bird) but have NO corresponding entry at all in `substanceLibrary.ts` (grep for each key returns zero matches anywhere in `src/`). One tier up from unwired-approved-gap: the substances themselves were never added to the library, so field-by-field wiring cannot even be assessed. |

---

## 3. Disposition

### 3.1 SAFE TO AUTO-FIX (documentation-truth only - correct prose that falsely claims a null value was wired; does NOT wire any new value)

These 7 rows can be closed by editing `notes`/`sources` text to stop asserting a value is wired when it is not (or by simply wiring the exact number the text already cites, which is a mechanical 1:1 copy from catalog to field with no judgment call - see note below). No receptor choice, no magnitude reconciliation, no HITL judgment required:

- chloroform - fcv_ug_per_L (text cites exact value 1.8 ug/L, single catalog source)
- chromium - trv_eco_mg_per_kg_bw_day (text cites catalog seeding; catalog gives 2 approved rows - wiring needs a receptor pick, see 3.2 note)
- benz_a_anthracene - trv_eco_mg_per_kg_bw_day (single catalog row, single receptor)
- chlordane_technical - fcv_ug_per_L (single catalog row)
- polychlorinated_biphenyls_total_pcbs - fcv_ug_per_L (text cites exact value 0.014 ug/L, single catalog source)
- pyrene - trv_eco_mg_per_kg_bw_day (single catalog row, single receptor)
- p_p_dichlorodiphenyltrichloroethane_ddt - fcv_ug_per_L (single catalog row)

Note: 5 of the 7 (chloroform, benz_a_anthracene, chlordane_technical, polychlorinated_biphenyls_total_pcbs, p_p_dichlorodiphenyltrichloroethane_ddt, pyrene) have exactly ONE approved catalog row for the field in question, so "wire the value the text already claims" is a pure mechanical fill with no receptor ambiguity - lowest-risk auto-fix candidates. Chromium has 2 approved rows (2.4 and 2.66 mg/kg-bw/day) so it needs a receptor/value pick before wiring - downgrade that one row to NEEDS HITL for the value choice, though the text-truth defect itself (claiming seeding while shipping null) is still auto-fixable as a documentation correction independent of which number gets wired.

### 3.2 NEEDS HITL (wire a value / pick a receptor or dual-row / resolve a magnitude mismatch)

Everything else in this report requires a judgment call and should not be auto-applied:

- **All 6 WIRED-VALUE MISMATCH rows** (copper, cadmium, zinc, arsenic_inorganic, lead, benzo_a_pyrene): the currently-wired numbers are large-magnitude departures from the only approved catalog values and are cited to a source (Eco-SSL) that is not in the catalog at all. Resolving these requires an owner decision on whether to retire the legacy Eco-SSL avian values in favor of the FCSAP wildlife TRVs, and if so, which receptor (mammal vs bird) or whether to carry both as selectable options.
- **All 33 UNWIRED-APPROVED-GAP rows with 2 approved catalog rows for the same field** (chromium [dup], diazinon, endosulfan_alpha, endosulfan_beta, and ethylbenzene's TRV side, plus any multi-row case) need a receptor/estimate pick before wiring, same as chromium above.
- **lmw_pahs and the phc_f1/phc_f2/phc_f3/phc_f4/total_phcs bundle**: these are whole-substance additions to the library, not field edits - needs a decision on whether/how to add these substance_keys (aggregate PAH/PHC fraction handling may have downstream implications for how the calculator groups or double-counts against individual PAH/PHC congeners already in the library).
- **naphthalene**: stale documentation plus an unwired gap; even though the dynamic resolver likely masks the practical impact, the static notes should be corrected and the receptor choice (mammal 14.3 vs bird 7.7 mg/kg-bw/day) made explicitly by HITL rather than left ambiguous.
- **All single-approved-row UNWIRED-APPROVED-GAP rows** (azinphos_methyl, biphenyl, bromoform, bromophenyl_phenyl_ether_4, butyl_benzyl_phthalate_bbp, carbaryl, carbon_tetrachloride, chlorpyrifos, demeton, dibutyl_phthalate_dbp, dichlorobenzene_1_2/1_3/1_4, diethyl_phthalate_dep, endosulfan, heptachlor, heptachlor_epoxide, hexachlorocyclohexane_gamma, tetrachloroethylene, trichloroethylene, tetrachloroethane_1_1_2_2, trichloroethane_1_1_1, barium, chromium_hexavalent, thallium, uranium, benzene [2 fields, 1 row each]) are mechanically simple to wire (one catalog row, no ambiguity) but are still routed to HITL rather than auto-fix in this report because wiring a *new* number (as opposed to correcting a false claim about an already-cited number) is a build decision, not a documentation correction - flagged here as the "build-first opportunity" batch for a follow-up wiring PR, not as something this audit resolves itself.

---

## 4. Coverage note

- The eco catalog (`eco_values.json`) contains **71 substances** with at least one approved eco-relevant row (`fcv_ug_per_L` and/or `trv_eco_mg_per_kg_bw_day`).
- This audit's findings set touches **51 of those 71 substances (72%)**.
- Of the 51: 46 have at least one entry in `substanceLibrary.ts` with a field-level defect (contradiction, mismatch, or gap); 5 (phc_f1, phc_f2, phc_f3, phc_f4, total_phcs) have no library entry at all and are reported as a single bundled "whole-substance missing" finding.
- The remaining **20 of 71 substances (28%)** are NOT represented in this findings set. This does **not** certify those 20 as clean - it means this adversarial pass did not surface a defect for them; a dedicated pass explicitly targeting the unlisted 20 would be needed to close out full-catalog coverage.
- Five findings (lead, copper, cadmium, arsenic_inorganic, barium) were independently reproduced by two separate verification passes within this round, which is treated as corroborating evidence of a real (not spurious) defect; two of those five (lead, arsenic_inorganic) carry a severity disagreement between the passes and are flagged rather than silently resolved.

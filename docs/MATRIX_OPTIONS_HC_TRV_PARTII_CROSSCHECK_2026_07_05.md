# MATRIX OPTIONS HC TRV PART II CROSSCHECK

> **CAVEAT (PRELIMINARY)**: this compares our catalog's Health Canada TRV **v4.0 (2025)** values against the **HC 2010 Part II** TRV table (the only HC TRV compilation available locally; the actual v4.0 tables are order-a-copy / not web-published). Because 2010 != v4.0, MOST differences below are LEGITIMATE HC v4.0 updates (e.g. carbon_tetrachloride 0.00071 vs 2010 0.02; cadmium 0.0008 vs 2010 0.126), NOT errors. The automated name-match + mangled-PDF extraction ALSO have known gaps (some substances show NAME-NOT-FOUND or empty values though they are in the table). Treat every row as a LEAD requiring adjudication against the actual v4.0 document -- NOT an audit conclusion.

## CONFIRMED FINDINGS (manually verified)

- **chlorobenzene** -- our catalog HC oral RfD 0.43 was the inhalation TC (mg/m3); HC oral TDI = 0.063. Fixed to US EPA IRIS 0.02 interim (PR #513).
- **dichlorobenzene_1_2** -- our catalog HC oral RfD 0.43 is an outdated PSL1-1993 value; HC Part II oral TDI = 0.03. The HC 0.43 rows are quarantined (superseded); default remains US EPA IRIS 0.09 interim.

## NEXT STEP

A definitive full HC audit requires the HC TRV **v4.0 (2025)** document (order-a-copy / not web-published). Re-point this script at a v4.0 extraction when available for a clean cross-check.

## PRIORITY REVIEW (NO_HC_MATCH)

| Substance Key | Our v4.0 oral RfD | Part II Numbers Found | Classification | Ratio to Smallest | Note |
|---|---|---|---|---|---|
| benzo_a_pyrene | 0.0003 |  | NAME-NOT-FOUND | N/A |  |
| total_pcbs_aroclor_1254 | 0.00001 | 2 | NO_HC_MATCH | 0.00 |  |
| methylmercury | 0.0002 | 0.00047 | NO_HC_MATCH | 0.43 |  |
| lead | 0.0005 | 0.5, 0.136 | NO_HC_MATCH | 0.00 |  |
| cadmium | 0.0008 | 0.126, 0.141, 0.02 | NO_HC_MATCH | 0.04 |  |
| copper | 0.426 | 0.5, 0.1, 0.6, 0.105 | OUR_VALUE_PRESENT | 4.26 |  |
| zinc | 0.51 |  | NAME-NOT-FOUND | N/A |  |
| barium | 0.19 | 0.0834, 0.13, 0.044, 0.0093, 2.3, 0.095 | OUR_VALUE_PRESENT | 20.43 |  |
| beryllium | 0.002 |  | NAME-NOT-FOUND | N/A |  |
| carbon_tetrachloride | 0.00071 | 0.02, 0.009, 0.063 | NO_HC_MATCH | 0.08 |  |
| chlorobenzene | 0.43 | 0.063, 0.43, 0.11 | OUR_VALUE_PRESENT | 6.83 |  (HC 2010 TDI = 0.063, TC = 0.43; our catalog had 0.43, confirmed script classifies this) |
| chromium_trivalent | 0.3 |  | NAME-NOT-FOUND | N/A |  |
| chromium_hexavalent | 0.0022 |  | NAME-NOT-FOUND | N/A |  |
| dichlorobenzene_1_2 | 0.43 |  | NAME-NOT-FOUND | N/A |  |
| dichlorobenzene_1_4 | 0.11 |  | NAME-NOT-FOUND | N/A |  |
| dichloroethylene_1_1 | 0.003 | 0.000097 | NO_HC_MATCH | 30.93 |  |
| dichloromethane | 0.014 | 0.000097 | NO_HC_MATCH | 144.33 |  |
| ethylbenzene | 0.022 |  | NAME-NOT-FOUND | N/A |  |
| n_hexane | 0.1 |  | NAME-NOT-FOUND | N/A |  |
| manganese | 0.025 |  | NAME-NOT-FOUND | N/A |  |
| naphthalene | 0.02 | 0.02, 0.0011 | OUR_VALUE_PRESENT | 18.18 |  |
| nickel_chloride | 0.0013 | 0.0011, 0.00002 | OUR_VALUE_PRESENT | 65.00 |  |
| nickel_sulfate | 0.012 | 0.011, 0.0000035, 0.000018 | OUR_VALUE_PRESENT | 3428.57 |  |
| pcbs_non_coplanar | 0.00001 | 0.00013, 0.36, 2.3e-9, 3.75 | NO_HC_MATCH | 4347.83 |  |
| tetrachloroethylene | 0.0047 | 0.014, 0.01 | NO_HC_MATCH | 0.47 |  |
| toluene | 0.0097 | 0.22, 0.00025 | NO_HC_MATCH | 38.80 |  |
| xylenes | 0.013 | 1.5, 0.49 | NO_HC_MATCH | 0.03 |  |

## ALL OTHER ROWS

| Substance Key | Our v4.0 oral RfD | Part II Numbers Found | Classification | Ratio to Smallest | Note |
|---|---|---|---|---|---|
| mercury_inorganic | 0.0003 | 0.0003, 0.00047 | OUR_VALUE_PRESENT | 1.00 |  |
| methylmercury | 0.00047 | 0.00047 | OUR_VALUE_PRESENT | 1.00 |  |
| methylnaphthalene_2 | 0.004 | 0.004, 0.01, 0.037 | OUR_VALUE_PRESENT | 1.00 |  |
| pyrene | 0.03 | 0.03, 0.18, 0.5 | OUR_VALUE_PRESENT | 1.00 |  |
| trichloroethylene | 0.00146 | 0.00146, 0.000811, 0.0026, 0.02 | OUR_VALUE_PRESENT | 1.80 |  |
| uranium | 0.0006 | 0.0006, 0.26 | OUR_VALUE_PRESENT | 1.00 |  |

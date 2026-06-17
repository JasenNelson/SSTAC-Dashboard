# PR-MAP-8 LOAD DECISION REPORT (DB2 -> matrix_map)

Decision packet for the matrix-map growth load. Generated read-only from DB2 + the
geocoding CSV. **All chem counts are ETL-LOADABLE measurements** (the ETL acceptance
predicate is applied: non-empty parameter + id + (value, or a censored '<' detection
limit)), NOT raw rows. **The load is gated on the owner choosing a path below.** PR B
merges this report + the geocoder WITHOUT loading.

## 1. The binding constraint is DATES + VISIBILITY, not coordinates

- Geocoding: 343 of 345 sites resolved a registry centroid; geometry covers
  14244 of 14244 loadable measurements. Coordinates are essentially SOLVED.
- Of 14583 raw sediment_chemistry rows, 14244 are ETL-loadable measurements
  (339 are dropped for null value / missing parameter / no id).
- Only ~0.5% of stations are surveyed -- the map is a registry-centroid SITE-INDEX; medium-tier
  centroids must be excluded from station-level stats + the calculator bridge (analytical guard).

## 2. Event-date reality (the real blocker)

- Events: parseable 302, blank 8050, unparseable 2.
- LOADABLE measurements by event-date: parseable 7472, blank 6742, unparseable 30.
- `sample_events.event_date` is NOT NULL in matrix_map, so blank/unparseable-date measurements
  are SKIPPED unless the owner relaxes/imputes the date.

## 3. DRA attribution + visibility

- ra_documents (DRAs): 574; sites WITH a DRA: 344; loadable measurements
  on chem-sites WITHOUT a DRA: 63 (API-hidden -- no source_dra_id).
- Mis-attributed provenance: 117 events reference a non-default-doc
  source_table_ref ('d<NNN>' != the site's default first-by-doc_id DRA). LOAD impact, BY SCENARIO:
  - Scenario A (dated-only): 0 measurements (0 events)
    -- the conflicting refs are on undated events, so dated-only mis-attributes essentially none.
  - Scenario B (relaxed/imputed dates): 28 measurements (22 events)
    would be mis-attributed to the site default unless event-level source_dra_id is added -- a small effect.
- ALL newly loaded DRAs/samples insert `public=false`: visible to ADMINS only until an audited
  `flip_dra_public` / grant. So without a publication decision, the NON-ADMIN end-user delta is ZERO.

## 4. Per-scenario deltas (LOADABLE measurements vs the live seed)

Live seed baseline: ~290 samples; ~7472 measurements currently loaded.

| Scenario | Date handling | Loadable meass (geometry) | + admin-visible (has DRA) | + END-USER-visible |
|---|---|---|---|---|
| A | dated-only | 7472 | 7409 | 0 (public=false) / publish to enable |
| B | nullable or imputed dates | 14244 | 14181 | 0 (public=false) / publish to enable |

Reading: Scenario A (dated-only) is 7472 measurements ~= the live seed (7472) -- **the map does not meaningfully grow.** Scenario B (relax/impute dates)
unlocks ~14244 (about 1.9x the seed), but (a) it is a
schema + consumer-contract change (event_date NOT NULL; UI/filter/export assume exact dates), and
(b) END-USER visibility still needs the publish/grant decision -- otherwise the growth is admin-only.

## 5. Owner decisions required before the load

1. **Dates:** dated-only (no growth) / relax event_date to nullable (migration) / impute (e.g. campaign
   year) -- if relax/impute, the consumer-contract PR (UI/filter/export + date-precision provenance) lands first.
2. **Visibility:** admin-only-until-reviewed / publish (audited flip) / per-user grants -- see the per-DRA
   inventory below; this cannot be decided from aggregate counts.
3. **Provenance:** accept site-default-DRA attribution with disclosure / exclude the source_table_ref
   conflicts / add event-level source_dra_id (migration). Scope: 0 measurements under
   Scenario A (dated-only), 28 under Scenario B (relaxed dates) -- so this only matters if dates are relaxed.
4. **Centroid analytical guard** (non-optional): centroid rows excluded from station-level stats + the bridge.
5. **Substance normalization** (CAS-first EXACT, reviewed alias map) BEFORE the load -- the load bakes
   substances.key into measurement FKs.

## 6. Per-DRA inventory (DEFAULT docs only -- they alone control rows under the ETL attribution)

Top 40 default docs by attributable LOADABLE measurements. Non-default docs at a site control 0
rows under the current site-default model (relevant only if event-level provenance is adopted).

| default doc_id | site_id | doc_type | loadable_meass | filepath |
|---|---|---|---|---|
| 1 | 1 | HHERA | 6894 | ...ts/Item 1h 11644 141110 FINAL HHERA Sediment.pdf |
| 313 | 133 | ERA | 1474 | ...docs\2_202.01580.00000 Old Slope Place-HHERA.pdf |
| 514 | 294 | ERA | 867 | ..._23.3_LTR_Response to ENV comments of DHHERA.pdf |
| 67 | 20 | ERA | 669 | ... Drisk App 16009\Supporting Docs\HHERA_FINAL.pdf |
| 103 | 29 | ERA | 514 | ...evised PortMoody HHERA_FINAL_November24_2014.pdf |
| 92 | 24 | ERA | 491 | ...Teck Trail Operations Final Remediation Plan.pdf |
| 408 | 211 | ERA | 285 | ...ting docs\2017-10-27 Site 13851 HHERA by SLR.pdf |
| 420 | 223 | ERA | 285 | ... to PA_final Feb2018 - HHERA addendum report.pdf |
| 532 | 309 | ERA | 285 | ...0017 FINAL Chevron Langford HHERA 2017-10-27.pdf |
| 312 | 132 | ERA | 209 | ...ting Documents\3_Site 1638 HHERA 25-Aug-2017.pdf |
| 498 | 278 | ERA | 209 | ...ting Documents\3_Site 1638 HHERA 25-Aug-2017.pdf |
| 207 | 89 | ERA | 168 | ...nro Preliminary Aquatic ERA_FINAL_August2019.pdf |
| 231 | 99 | ERA | 160 | ...mentary Studies in Mark Creek and Lois Creek.pdf |
| 147 | 49 | ERA | 151 | ...mulation\ERA Problem Formulation v6 FINAL vf.pdf |
| 8 | 6 | ERA | 140 | ...ssment/2015 03 31 Toquaht ERA COMPLETE FINAL.pdf |
| 433 | 230 | ERA | 139 | ...ssessment Wilder Field - Background document.pdf |
| 5 | 4 | HHERA | 110 | .../Reports/11543 130702 Final Blue Water HHERA.pdf |
| 4 | 3 | HHERA | 105 | ...re DSI HHRA/11318 151231 FINAL BHP ICM HHERA.pdf |
| 327 | 143 | ERA | 86 | ...- Reports\20230406_130371_RPT_CC HHERA_Final.pdf |
| 571 | 343 | ERA | 84 | ...-01-29 FINAL Burnaby Merit HHERA_slabongrade.pdf |
| 496 | 276 | ERA | 70 | ... Prince George_HHERA_FINAL_with_cover_letter.pdf |
| 507 | 287 | ERA | 70 | ... Prince George_HHERA_FINAL_with_cover_letter.pdf |
| 508 | 288 | ERA | 70 | ... Prince George_HHERA_FINAL_with_cover_letter.pdf |
| 509 | 289 | ERA | 70 | ... Prince George_HHERA_FINAL_with_cover_letter.pdf |
| 3 | 2 | HHERA | 56 | ...App ID 10421/2020-04-27 Site 311_HHERA_Final.pdf |
| 6 | 5 | ERA | 48 | ...Assessment/1_Shoreline Risk Assessment_Draft.pdf |
| 16 | 8 | HHERA | 48 | ...R-Rev0-Risk Assessment Rpt 12DEC_16_unlocked.pdf |
| 9 | 7 | Risk Assessment Summary | 44 | ...Studies on SPL Plume & Yacht Basin by Golder.pdf |
| 315 | 134 | ERA | 42 | ...ting docs\2019-06-13 Site 21801 HHERA by SLR.pdf |
| 368 | 176 | ERA | 41 | ...Docs\20240923_131160_RPT_HHERA_Final_reduced.pdf |
| 214 | 91 | ERA | 34 | ...963\Supporting Docs\12022 250131 FINAL HHERA.pdf |
| 429 | 228 | ERA | 28 | ...Rev0-Translink OMC4 Risk Assessment 12SEP_23.pdf |
| 36 | 16 | ERA | 19 | ...02-08 MON030138 signed Phase3 HHERA v8 final.pdf |
| 448 | 242 | ERA | 19 | ...cs\2015-02-02 Detailed HHERA & CoR by Golder.pdf |
| 220 | 94 | ERA | 17 | ...orts\2. HHERA_Blakes_FINAL dated 2016-07-27R.pdf |
| 132 | 40 | ERA | 16 | ...ocs\2020-04-20 Site 21560 HHERA by Steer Env.pdf |
| 334 | 149 | ERA | 14 | ...g docs\Reports\11_FNA Site 24_HHERA_Mar 2015.pdf |
| 500 | 280 | ERA | 14 | ...P6 App 16081\20250606_670196_RPT_HHERA_Final.pdf |
| 21 | 11 | ERA | 13 | ...n04 Response to PA Comments for HHERA by GCL.pdf |
| 253 | 101 | ERA | 13 | ...ting Docs\1- 20241220_674948_RPT_HHERA_Final.pdf |
| ... | | | | (+29 more default docs) |

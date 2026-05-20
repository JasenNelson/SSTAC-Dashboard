# Interactive Map -- Inventory + Revised Recommendations v2

**Status:** v2 incorporates (a) Q3 hard-gate inventory pass results AND (b) all
codex CLI xhigh adversarial findings on recommendations v1. Authored
2026-05-19 after the PR-A2 merge (`87935db`). Supersedes
`.tmp_interactive_map_recommendations_v1.md`.

---

## Part 1: Q3 inventory pass findings (the hard gate)

### Bucket A: BC public WMS / WFS (live, free, authoritative)

14 layers already wired in `SiteMap.tsx:90-194`. Three are load-bearing for matrix-map:

| Layer | Layer name | Confirmed medium / scope | Matrix-map role |
| --- | --- | --- | --- |
| `csrSites` | Contaminated Sites Registry | site polygons + IDs | "Remediation map layer" per owner direction; identify-area target |
| **`bkgdGroundwater`** | **Background Groundwater Concentration Regions** | **GROUNDWATER ONLY** per layer-name + BC ENV guidance (codex finding C) | Reference-region primary for groundwater substances ONLY; NOT applicable to sediment default |
| `emsMonitoring` | Environmental Monitoring Locations | multi-media; long-form measurements via WFS | Supplementary sample source; coverage + ETL feasibility TBD per dev work |

**Availability caveat (codex):** WMS proxy routes (`src/app/api/bn-rrm/wms-identify/route.ts:20-31`) use `cache: 'no-store'`. DataBC WFS has pagination + feature-count limits. WMS is suitable for live rendering + identify-area; it is NOT a durable evidence substrate. Any value entering a UTL calculation MUST come from a cached/pinned source.

### Bucket B: BN-RRM curated extraction (`bnrrm_training.db`, 16.2 MB SQLite)

Located at `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db`. **This is the matrix-map's primary data source.**

**Populated tables (data exists):**

| Table | Rows | Schema highlights | Matrix-map fit |
| --- | --- | --- | --- |
| sites | 50 | site_id, registry_id, lat/lon, region, waterbody, waterbody_type | Province-wide BC contaminated sites |
| stations | 1554 | site_id, **station_type** (reference / exposure / near_field / far_field / sampling), lat/lon, depth_m, habitat_type | **station_type = Q12 classification primary** (see below) |
| sampling_events | 1570 | station_id, date_sampled, media_type, pre_remediation, depth_top_cm, depth_bottom_cm | Long-form sample events |
| **sediment_chemistry** | **9594** | event_id, parameter, parameter_group, value, unit, detection_limit, qualifier, basis, analytical_method | **Primary measurement table.** Long-form, schema-aligned with my v1 proposal. |
| toxicity_tests | 334 | event_id, test_type, species, endpoint, result, unit | Toxicity medium ready |
| env_modifiers | 930 | event_id, parameter (TOC, AVS/SEM, grain size), value, unit | Supports EqP + AVS/SEM downstream |
| sediment_guidelines | 42 | parameter, guideline_name, value, source, year | Built-in CSR/CCME reference benchmarks |
| ra_documents | 148 | doc_id, site_id, filepath, filename, title, author, doc_date, doc_type, total_pages | DRA provenance for audit trail |
| extraction_provenance | 7778 | target_table, target_id, doc_id, page_number, table_number, extraction_method | Per-row audit trail |
| risk_narratives | 844 | doc_id, section_type, section_number, page_start/end, extracted_text, key_findings | DRA narrative context |
| loe_assessments + woe_integration | 144 | LOE/WOE scoring per receptor scenario | Multi-line-of-evidence integration |
| benthic_community | 60 | community metrics (abundance, taxa_richness, Shannon, Simpson, Pielou) | Community medium ready |

**Empty tables (schema ready, no data yet):** porewater_chemistry, surface_water_chemistry, tissue_residues, benthic_taxa, csm_elements, sqt_scores. v1 matrix-map launches **sediment + toxicity + community + env_modifiers**; water and tissue are deferred until extraction populates them.

**Substance coverage** (top 15 by row count): Lead, Copper, Arsenic, Mercury, Zinc, Chromium, Cadmium, Nickel, Total PAHs, Pyrene, Naphthalene, Acenaphthylene, Fluoranthene, Phenanthrene, Anthracene. Matches the BC contaminated-sites priority list. Aligns with the Calculator's existing SUBSTANCE_LIBRARY for metals + PAHs.

**Censoring**: ~33% of sediment_chemistry rows have `<` qualifier (3230 of 9594). Q6 substitution-policy choice is operationally critical, not theoretical.

### Bucket B-CRITICAL: GEOCODING GAP

**Only 40 of 1554 stations (2.6%) and 0 of 50 sites have lat/lon populated.** This is the load-bearing PR-MAP-0 blocker:

- Without coordinates, the map cannot render samples.
- Likely root cause: the Docling extraction prioritized chemistry table extraction over coordinate normalization; lat/lon often appears in narrative text or appendix tables not yet extracted.
- Options:
  - **B-1: Geocoding ETL pass** -- extract lat/lon from DRA narrative sections (already extracted as `risk_narratives`) + DRA front-matter via a targeted re-parse. Possibly use BC Public Site Registry as a join source for `site_id` -> lat/lon.
  - **B-2: Cross-reference BC EMS** -- if a BN-RRM station has a matching EMS station name, use EMS lat/lon. Coverage TBD.
  - **B-3: Manual data-steward geocoding** -- 1554 stations is a lot; impractical for the full set but feasible for a curated initial seed of ~50-100 high-priority stations for matrix-map v1.
  - **B-4 (codex v2-confirmation): Public registry + GIS coordinate sources** -- BC Contaminated Sites Registry centroids/polygons (matches `sites.registry_id`); DRA appendix coordinates that escaped initial extraction; environmental permit/authorization records; waterbody/station crosswalks from BC Freshwater Atlas. All entries carry a `coordinate_source` provenance flag + `coordinate_quality_tier` (high = surveyed; medium = registry centroid; low = waterbody centroid or address geocode).
- **Recommendation: combined approach for v1 seed -- start from the 40 already geocoded; use B-4 (CSR registry centroid + waterbody crosswalk) to enrich the next ~50-60 high-priority sites/stations; B-3 (steward override) for residual gaps; B-1 + B-2 deferred to v1.x for province-wide scale-up.** Every coordinate carries a quality tier so the map can visually distinguish surveyed lat/lon from registry centroid.

This means **PR-MAP-1 ships with ~50-100 mappable stations of varying coordinate quality, not 1554.** Owner residual D-4 (coordinate-quality tiers + centroid policy) gates whether centroids are mappable at all.

### Bucket C: Gap analysis

| Matrix-map needs | A (BC WMS) | B (BN-RRM SQLite) | Gap to fill |
| --- | --- | --- | --- |
| BC site polygons | csrSites (live WMS) | sites (50 with metadata, 0 with lat/lon) | Join on registry_id |
| Sample stations + coords | emsMonitoring (TBD coverage) | stations (1554; 40 geocoded) | **Geocoding ETL (B-1 + B-2 + B-3)** |
| Sediment measurements | -- | sediment_chemistry (9594) | **Migrate to Supabase** for matrix_map.measurements |
| Reference/impacted flag | -- | stations.station_type | **Lift station_type into matrix_map** (Q12 PRIMARY) |
| DRA provenance | -- | ra_documents + extraction_provenance | Migrate to matrix_map.dras + per-row provenance |
| Substance vocabulary | -- | sediment_chemistry.parameter | **Normalize against Calculator SUBSTANCE_LIBRARY** + CAS aliases (codex Q22) |
| Censoring policy | -- | qualifier='<' (33% of rows) | Implement ROS + screening-only label (codex Q6) |
| Selection-stat cache | -- | -- | matrix_map.selection_stat_cache table (5-min TTL) |
| Per-selection audit token | -- | -- | matrix_map.bridge_audit table with full payload (codex Q15) |

---

## Part 2: Q12 RESOLUTION (was the BLOCKER) -- codex-corrected counts + softened authority claim

**Codex was right to reject `bkgdGroundwater` as the classification primary for sediment.** Inventory found a better answer.

**Authority claim (codex v2-confirmation round, softened):** `stations.station_type` is **DRA-derived classification, citation-backed, suitable for screening and prioritization** -- NOT agency-adjudicated regulatory authority. The values come from the original DRAs via Docling extraction. Plan v3 + Calculator-bridge audit trail must label any UTL computed from these classifications as "screening-only, not regulator-adjudicated" until owner/steward confirms regulatory use per site.

**Source-of-truth precedence (most defensible first):**
1. **`station_type = 'reference'`** -> reference. **15 stations confirmed.**
2. **`station_type IN ('exposure', 'near_field', 'far_field')`** -> impacted. **99 stations confirmed** (exposure=6 + near_field=90 + far_field=3). These are explicitly classified-as-impacted per DRA nomenclature.
3. **`station_type = 'sampling'`** -> **UNKNOWN, not impacted**. 176 stations. Codex v2-confirmation finding: "sampling" is a generic-station label without explicit ref/exposure designation; lumping it into "impacted" would be a misclassification. Treat as UNKNOWN until station_type fill via re-extraction or per-station steward override.
4. **`station_type IS NULL` OR empty string** -> unknown (1264 stations -- the bulk; data-steward override path).
5. **Data-steward manual override** -> overrides any above; carries `override_source` + `override_rationale` + `override_confidence` audit columns.
6. **For groundwater substances only:** `bkgdGroundwater` polygon containment -> reference (codex's original suggestion, scoped to its correct medium).

**Corrected counts (1554 total stations):**

| Bucket | Count | % of total | v1 fate |
| --- | --- | --- | --- |
| Reference (defensibly classified) | 15 | 1.0% | Enter reference UTL stats with screening-only label |
| Impacted (defensibly classified) | 99 | 6.4% | Enter impacted/site-specific stats |
| Unknown (sampling label + null/blank) | 1440 | 92.6% | **Rendered grey; EXCLUDED from UTL stats** until steward override |

This corrects the v1 numbers (which said 288 classified / 1266 unknown -- arithmetic error caught by codex). The defensibly-classified subset for matrix-map v1 is **114 stations** (15 ref + 99 impacted), not 288. That is enough to validate the full UX + Calculator bridge with real data; it is NOT enough to support province-wide defensible background statistics -- see Owner residual D-1 below for the v1 statistical-claim scope.

Audit trail per classification row:
- `classification_source`: 'station_type' / 'steward' / 'bkgd_groundwater_polygon' / 'data_unknown'
- `classification_rationale`: free text (e.g., 'station_type=reference from DRA HHERA-2018-08-15')
- `classification_confidence`: high (DRA source with full citation) / medium (polygon containment) / low (steward override without DRA citation)

---

## Part 3: Recommendation revisions (v1 -> v2) -- all codex findings folded in

### Critical Framing Finding (revised)

**REVISED:** BC WMS/WFS = authoritative live context + discovery + identify-area target.
Supabase `matrix_map` schema = curated stats + Calculator bridge + audit substrate
(measurements migrated from bnrrm_training.db; future ETL backfill from BC EMS where
appropriate). The two systems serve DIFFERENT roles, not "primary vs augmentation".

### Per-question revisions

| Q | v1 recommendation | v2 revision | Codex finding driving change |
| --- | --- | --- | --- |
| Q1 | All active layers + suppress filter | (unchanged) | CLEARED |
| Q2 | Blue stroke + cluster badge | (unchanged) | CLEARED |
| **Q3** | Discovery pass produces inventory | **DONE -- this document IS the inventory. Gate has been satisfied.** | B + E |
| Q4 | Long-form | (unchanged) | CLEARED |
| Q5 | geography(POINT, 4326) | (unchanged) | (not flagged) |
| **Q6** | ROS when n>=20 + 1/2 DL fallback | **PIN to ProUCL 5.2 methodology + version. ALWAYS label substitution-fallback stats as "screening-only" in the panel + audit trail. v1 ships substitution + ROS-via-Postgres extension (`pg_stat_robust` or custom plpgsql); ProUCL validation in v1.x.** | B-Q6 (overconfident) |
| Q7 | JSONB + TS interface | (unchanged) | CLEARED |
| Q8 | Sample-only geometry | (unchanged) | CLEARED |
| Q9 | YES; env-var allowlist | (unchanged; owner provides initial list) | CLEARED |
| **Q10** | $5 soft / $20 hard, Supabase queries only | **5-dimensional budget**: (a) Supabase reads, (b) BC WMS proxy calls, (c) ETL job runs, (d) egress GB, (e) CSV exports. Each dimension has its own cap. Owner picks per-dimension caps after a 2-week dev usage baseline; v1 ships permissive placeholders + telemetry. | B-Q10 (numbers placeholder + scope wrong) |
| **Q11** | All 12 GeoJSON artifacts dropped; 14 BC WMS + 4 base tiles carry over | (unchanged) | CLEARED |
| **Q12** | Hybrid: bkgdGroundwater primary + steward override | **RESOLVED VIA INVENTORY: stations.station_type from BN-RRM is the sediment primary; bkgdGroundwater is the groundwater-substance-only primary; steward override is the v1.x fallback for unknowns. See Part 2.** | B-Q12 BLOCKER + inventory finding |
| **Q13** | 9 statistics including UTL 95/95 | **Add methodology appendix to plan v2:** which K table (from existing `utlTable.ts` -- and label as screening-only per file warnings), ROS implementation, validation plan against ProUCL. Every stat carries a "screening-only" badge until validation lands. | B-Q13 (utlTable warns not submission-grade) |
| Q14 | Scripts-only v1 | (unchanged) | CLEARED |
| **Q15** | Selection token = hash | **Expand token payload:** sample IDs + event dates + result IDs + units + censoring policy applied + method version + data-snapshot version + computed-at timestamp + station_type classification per sample. Token is the durable evidence row. | B-Q15 (audit payload incomplete) |
| Q16 | NO public access | (unchanged) | CLEARED |
| **Q17** | Mobile fallback = CSV download | **Mobile fallback = read-only summary view (no CSV).** CSV export remains admin-only per Q19. Removes Q17 vs Q19 conflict. | C (Q17/Q19 conflict) |
| **Q18** | Most-recent default | **Most-recent default + "computed-from rows with event dates Y-Z" audit detail** in the bridge token (codex temporal consistency finding). | C (Q15/Q18/Q13 temporal) |
| Q19 | Admin only + audit log | (unchanged after Q17 fix) | CLEARED post-fix |
| **Q20** | Schema + RLS first | **Reorder:** PR-MAP-0 = inventory packet + geocoding ETL for v1 seed (THIS DOC + geocoding work) -> PR-MAP-1 = schema + RLS + budget breaker + migration from bnrrm_training.db -> PR-MAP-2..6 as before. | B-Q20 (Q3 vs Q20 ordering) |
| **NEW Q21** | n/a | **Methodology + version governance:** UTL/ROS/KM/substitution method version pinning; ProUCL version recorded per stat; code hash captured in bridge token; K-factor source documented per derivation. | D (codex addition) |
| **NEW Q22** | n/a | **Units + substance identity normalization:** schema adds `substances.cas_number` + `substances.aliases jsonb` for synonym handling; `measurements.unit` becomes ENUM with canonical units; raw upload preserves source unit + value in `raw_unit`/`raw_value` columns for audit. | D (codex addition) |
| **NEW Q23** | n/a | **Accessibility:** colorblind-safe encodings (add shape redundancy: circle = reference, triangle = impacted, hollow = unknown -- in addition to color); keyboard nav through identified-features list (Tab + Enter); ARIA live region for selection-count changes. | D (codex addition) |

---

## Part 4: Revised PR sequencing

| PR | Scope | Gating |
| --- | --- | --- |
| **PR-MAP-0** | This inventory doc as the gate artifact + Geocoding ETL pass to bring 50-100 stations to mappable (lat/lon populated in bnrrm_training.db) + owner sign-off on the seed station list | DONE (this doc) + geocoding work + owner sign-off |
| PR-MAP-1 | matrix_map Supabase schema (revised per Part 3) + RLS + dev allowlist + 5-dimensional budget breaker + ETL migration script from bnrrm_training.db -> matrix_map | PR-MAP-0 done |
| PR-MAP-2 | Empty Interactive Map tab + 14 BC WMS overlays wired (no sample data yet) + 4 base tile layers + layer-toggle UI + Jermilova exclusion guard | PR-MAP-1 done |
| PR-MAP-3 | Sample point rendering from matrix_map.samples + station_type color split (with shape redundancy per Q23) + cluster + identify single (hoisted wms-identify) | PR-MAP-2 done |
| PR-MAP-4 | Selection tools (pan / select / select area) + SelectionStore + left-panel SelectionStats with screening-only-labeled stats + methodology badge | PR-MAP-3 done |
| PR-MAP-5 | Right-panel MeasurementWorkbench + raw-measurements API + admin-only CSV export + export audit log | PR-MAP-4 done |
| PR-MAP-6 | Calculator bridge with full-payload audit token + "Sourced from N samples (token #abc, computed YYYY-MM-DD from events Y-Z)" badge on BackgroundAdjustment panel + click-through restore | PR-MAP-5 done |

---

## Part 5: Items still needing owner input (14 total -- 7 original + 7 codex v2-confirmation additions)

After this inventory + two codex rounds, the residual owner decisions:

### Owner sign-off log (live; updated as decisions land)

**Cluster 1 (scope + defensibility) -- LOCKED 2026-05-19:**
- R-1 ACCEPT: `station_type` is sediment classification primary; "sampling" + null = unknown; bkgdGroundwater scoped to groundwater only; data-steward override is v1.x fill path. DRA-derived = screening-only authority label.
- R-4 ACCEPT: "screening-only -- not regulator-submission-grade" label propagates through Selection Stats panel, workbench, AND Calculator bridge audit token. Lifted only when ProUCL validation lands in v1.x.
- R-8 ACCEPT option (b): v1 statistical claim = "screening background statistics, defensible for prioritization, NOT regulatory submission". v1.x graduates to (c) after ProUCL.
- R-13 ACCEPT: methodology appendix signed off BEFORE PR-MAP-4 ships; gate sits between PR-MAP-3 and PR-MAP-4.

**Cluster 2 (data + access) -- LOCKED 2026-05-19:**
- R-9 ACCEPT option (a): ship v1 as-is with seed-limited caveat banner explaining regional coverage gaps.
- R-10 ACCEPT: default `public=false` for every migrated sample; matrix_admin flips per DRA on explicit confirmation; sample inherits DRA public flag with cascade.
- R-12 ACCEPT: matrix_admin role only in v1, no second-approver required; propose/approve workflow deferred to v1.x.
- R-14 ACCEPT: workbench shows all selected stations including unknowns (observation-only); Selection Stats panel computes UTL from classified stations only + surfaces "N excluded, override here" line linking to the override UI.
- R-5 ACCEPT: dev allowlist starts at jasen.nelson@gmail.com only; expand via Vercel redeploy as TWG members opt in.

**Cluster 3 (UX + ops) -- LOCKED 2026-05-19:**
- R-2 ACCEPT: combined geocoding -- 40 already geocoded + B-4 site-registry centroids + B-3 manual fill for high-priority gaps; B-1 + B-2 deferred to v1.x.
- R-3 ACCEPT: AI-proposed default candidate list written to `.tmp_seed_station_list_v1.md` for owner review before PR-MAP-0 geocoding work begins.
- R-11 ACCEPT: centroids render with dashed outline + popup tooltip; surveyed coords render solid; `coordinate_quality_tier` (high/medium/low) column visible + filterable in stats panel.
- R-7 ACCEPT: shape redundancy -- green circle (reference) / yellow triangle (impacted) / grey hollow circle (unknown); marker legend pairs color+shape.
- R-6 ACCEPT: permissive placeholders + 2-week telemetry baseline; starter caps (Supabase 50k/day; WMS proxy 10k/day; ETL 10/day; egress 5GB/day; CSV 20/day); banner at 80%, breaker at 100%; tighten to ~3x measured baseline at 2-week mark.

**ALL 14 RESIDUALS LOCKED. Plan v3 + PR-MAP-0 work cleared to begin.**

### Original 7

1. **R-1: Approve the Q12 resolution** (station_type as DRA-derived/screening-only primary; data-steward override for unknowns; "sampling" type treated as unknown not impacted; bkgdGroundwater as groundwater-only secondary). Includes acceptance of the softened authority language: DRA-derived classification is screening-only, not agency-adjudicated.
2. **R-2: Approve the geocoding strategy** (combined B-1 through B-4; start with 40 already geocoded + B-4 registry centroids + B-3 steward fill; B-1 + B-2 v1.x). If owner has lat/lon in another source (Excel? GIS export? old DRA appendix?), share path.
3. **R-3: Pick the v1 seed station list** (~50-100 mappable stations). AI can propose a default (all 40 currently-geocoded stations + the highest-priority sites per recent extraction work) for owner to edit.
4. **R-4: Confirm "screening-only" labeling philosophy** -- v1 stats are screening-only; ProUCL validation is v1.x. Calculator bridge token carries the screening-only flag. Acceptable?
5. **R-5: Dev allowlist initial email list (Q9)**.
6. **R-6: Per-dimension budget caps (Q10)** OR authorize permissive placeholders + 2-week telemetry baseline.
7. **R-7: Q23 shape redundancy** (circle/triangle/hollow) -- approve or pick alternative encoding.

### Codex v2-confirmation additions (7 more)

8. **R-8: v1 acceptable statistical claim scope** -- pick one: (a) "UX + bridge validation only -- numbers in the panel are illustrative, not a basis for any decision", (b) "screening background statistics -- defensible for prioritization but NOT regulatory submission", (c) "regulatory support after ProUCL validation lands". Recommendation: (b) for v1, (c) for v1.x.
9. **R-9: Seed representativeness criteria** -- the 114 classified stations skew toward certain regions/waterbodies. Pick how to handle representativeness in v1: (a) ship as-is with a "seed-limited" caveat banner, (b) pad with at least N stations per BC region, (c) wait until extraction lifts coverage. Recommendation: (a) with banner.
10. **R-10: Confidentiality/public-flag policy for DRA-derived samples** -- the BN-RRM extraction pulled from DRAs that may have varying public/private status. Recommendation: default `public=false` for every migrated sample; require explicit data-steward sign-off per DRA to flip to public=true; document the policy in the DRA-row metadata.
11. **R-11: Coordinate-quality tiers + centroid policy** -- can registry centroid coordinates appear on the map at all? If yes, with what visual indicator (e.g., dashed marker outline vs solid for surveyed)? Recommendation: yes, with a dashed outline and a popup tooltip "coordinate from registry centroid, not surveyed."
12. **R-12: Steward override approval authority** -- who can approve a classification override? Recommendation: matrix_admin role only in v1; in v1.x, a "TWG-reviewer can propose; matrix_admin approves" workflow.
13. **R-13: Methodology appendix acceptance gate** -- the plan v3 will include a methodology appendix (Q13 + Q21). Must owner sign off on the appendix BEFORE PR-MAP-4 (which surfaces stats) ships, or after? Recommendation: before, so the v1 stats panel ships with already-blessed methodology language.
14. **R-14: Unknown-station workbench visibility** -- when a reviewer selects unknown stations, the workbench shows their raw measurements but the stats panel EXCLUDES them from UTL calculation. Acceptable? Recommendation: yes; the workbench is observation-only; stats panel is the load-bearing analytical surface and only classified stations enter it.

Everything else from Q1-Q23 is AI-recommended-and-codex-cleared; owner can accept en bloc unless they want to override.

---

End of v2 (codex-confirmation-round corrections applied). Ready for
owner walk-through of R-1 through R-14 -> plan v3 captures decisions ->
PR-MAP-0 work (geocoding + owner sign-off on seed list) begins.

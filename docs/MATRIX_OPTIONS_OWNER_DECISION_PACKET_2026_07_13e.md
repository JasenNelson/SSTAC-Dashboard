# SSTAC Matrix Options -- Consolidated Owner-Decision Packet (2026-07-13e)

State: prepared read-only after the 2026-07-13d merge batch; origin/main = f5e8cca9a145a70d1cababf657b151c653e898cd; no writes/merges performed by this packet.
Legend: Reversibility EASY (revert flag/PR) / MEDIUM (revert PR + re-verify) / HIGH-sensitivity (protectiveness/policy).

## Section 0 -- executive recommendation table

| Decision | Recommended | Blast radius | Reversibility | Approval line ref |
| --- | --- | --- | --- | --- |
| IOCO | A | one DRA's 6 samples become member-visible; audited | EASY (unpublish) | See Item 1 |
| sodium_ion | A or B (if one governs) | sodium_ion oral RfD default | MEDIUM | See Item 2 |
| BaP-ADAF | Option 2 (minimal single-bin + warnings) | cancer-risk calculator (HIGH protectiveness sensitivity) | MEDIUM (PR) but affects outputs | See Item 3 |
| PCB-migration | check FIRST, then A or B | PCB eco/HH resolution + EqP sediment benchmark (HIGH protectiveness sensitivity) | MEDIUM (PR) but protectiveness-sensitive | See Item 4 |
| DRA-extraction | Monitored dry-run | none in dry-run (no writes) | n/a (dry-run) | See Item 5 |
| T40-admin-tier | A when you can create the admin user | none in dry-run (no writes) | EASY (PR) | See Item 6 |

## 1. IOCO Shoreline publish

### Current verified state
dra ea15e94a-b093-4cb4-bd4d-80ab9eae16d4, public=false, 6 samples; baseline 3 public / 571 private; reviewed GREEN + preflight done. (docs/MATRIX_OPTIONS_LIVE_STATUS_2026_07_13.md)

### Options
A) publish now via the app publish page (admin JWT / flip_dra_public); B) hold; C) publish + expand DRA-publication policy (bigger).

### Recommendation
A.

### Rationale
The DRA has been reviewed GREEN and preflight is done, making it ready for publication via the audited admin path.

### Blast radius
one DRA's 6 samples become member-visible; audited.

### Reversibility
EASY (unpublish).

### Exact stop boundary
AI NEVER flips public via SQL/pooler/MCP/service-role; owner executes in-app only; AI only read-verifies after.

### Paste-ready approval line
"I published IOCO Shoreline (ea15e94a) via the app publish page; verify +6 member-visible samples."

## 2. sodium_ion current_default

### Current verified state
4 P28 v3.0 rows, ALL input_key rfd_oral_mg_per_kg_bw_day, values base 34.3 vs water-adjusted 21.2 (split across direct+food), all available_option. current_default is tuple-scoped (substance,input_key,pathway); both values share the same tuple, so one current_default can pick only ONE. (See docs/MATRIX_OPTIONS_OWNER_FOLLOWUP_2026_07_13d.md and docs/MATRIX_OPTIONS_CATALOG_FOLLOWUP_DECISIONS_2026_07_13d.md)

### Options
A) current_default = 34.3 (base); B) = 21.2 (water-adjusted); C) schema change adding a route/derivation-basis dimension (larger design item) if BOTH must apply route-specifically.

### Recommendation
A or B if one derivation basis governs the calculator's scenarios; escalate to C only if route-specific selection is genuinely required.

### Rationale
unlike copper (source-hierarchy pick), both sodium values are from the SAME source (P28) and differ by derivation basis -- a substantive judgment, not a tiebreak.

### Blast radius
sodium_ion oral RfD default.

### Reversibility
MEDIUM.

### Exact stop boundary
no catalog mutation until owner rules; C is a schema change (separate packet).

### Paste-ready approval line
"sodium_ion current_default = <34.3 | 21.2>; AI dry-runs + shows before/after + codex + gates + PR." OR "Design the route-specific derivation-basis dimension (option C) as a separate packet."

## 3. BaP HC 1.289 / ADAF wiring

### Current verified state
EPA 2.0 (ADAF-baked lifetime) is the active default cancer SF; HC 1.289 is adult-based/non-ADAF (structurally = EPA 1.0), tagged but NOT default. Per the ADAF explainer (docs/MATRIX_OPTIONS_ADAF_BAP_EXPLAINER_2026_07_07.md), using 1.289 REQUIRES applying age-bin ADAFs (10/3/1) for early-life (<16y) exposure; adafTable.ts + computeBaPeq exist and carry the correct double-count guard, but NO caller sets applyAdaf:true yet. Flipping the default to 1.289 without ADAF application would underestimate child-inclusive risk up to 10x.

### Options
1) FULL -- a caller-side age-bin exposure-duration-weighting API (array of {ageBin, exposureFraction}) wired into the cancer calculator + UI to collect the exposure profile; 2) MINIMAL -- a single-bin applyAdaf caller (one ageYears per scenario) with prominent warnings, QP runs per-bin and combines (matches the current computeBaPeq contract); 3) DEFER -- keep EPA 2.0 default indefinitely, HC 1.289 stays an alternative.

### Recommendation
start with Option 2 (minimal single-bin + warnings) as the first safe increment; keep EPA 2.0 as the default until wiring + tests land; re-evaluate Option 1 after.

### Rationale
Migration path: (a) implement ADAF wiring + tests (Option 1 or 2), non-default; (b) THEN flip the BaP sf default to HC 1.289 as a separate catalog current_default change (library seed==default update + tripwire); (c) surface the adaf_stage scenario tags + warnings in the UI. Test strategy: unit tests for the bin-weighting math (known exposure profile -> known risk), double-count-guard tests (EPA 2.0 + applyAdaf -> warn/block), fail-closed on missing age.

### Blast radius
cancer-risk calculator (HIGH protectiveness sensitivity).

### Reversibility
MEDIUM (PR) but affects outputs.

### Exact stop boundary
do NOT flip the default anchor to HC 1.289 without exact owner approval AND merged ADAF wiring + tests.

### Paste-ready approval line
"Implement ADAF wiring Option <1 | 2> behind tests, non-default (do NOT change the default anchor)." Then later: "Now that ADAF wiring is merged + tested, flip the BaP sf_oral default to HC 1.289."

## 4. PCB value-migration (D3)

### Current verified state
Option A ruled (aroclor canonical, plain row deprecated alias, non-additive) -- NOTES landed in #638. The remaining step is migrating/re-keying the alias's OWNED catalog records (its approved eco FCV row + BC Protocol 28 HH direct/food RfD rows) to the canonical key, or leaving them split. (docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md)

### Options
A) migrate/re-key the alias's catalog records to the canonical key (full Option A); B) leave the records split with cross-reference notes (partial); C) defer.

### Recommendation
obtain the site-congener/EqP protectiveness check FIRST; then A if protective, else B. This is a QP protectiveness judgment, not mechanical.

### Rationale
Caveat (load-bearing, from the PCB brief): pairing the shared 0.014 ug/L water FCV with logKow 6.5 in the EqP model yields a LESS-stringent sediment benchmark; any consolidation must be checked against the site congener profile before it is treated as protective (this is why the merge is HITL-gated, not mechanical).

### Blast radius
PCB eco/HH resolution + EqP sediment benchmark (HIGH protectiveness sensitivity).

### Reversibility
MEDIUM (PR) but protectiveness-sensitive.

### Exact stop boundary
NO value migration without exact owner approval AND the EqP/site-congener check.

### Paste-ready approval line
"Proceed with PCB value-migration Option <A | B> after I confirm the EqP/site-congener protectiveness check; AI drafts the catalog re-key + codex + gates + PR (no apply)."

## 5. DRA coordinate extraction next step (dry-run-only)

### Current verified state
the harness (PR #639) has real UTM->WGS84 + BC-bounds validation + station matching, all tested; extract_station_table is a documented docling-gated stub; docling is NOT installed; pyproj IS installed. 4 candidate DRAs with source PDFs on G: (candidate 1 = Howe Sound, 198 stations).

### Options
Dry-run-only plan: Step 1 install docling in the project .venv (heavy ML dependency; per the Docling SOP; monitored). Step 2 run docling on the candidate-1 PDF to dump the table structure; identify the station table (page, headers, coord format lat/lon vs easting/northing+zone). Step 3 implement extract_station_table tuned to that layout. Step 4 dry-run -> generate an id-keyed UPDATE SQL FILE + JSON report (NO apply); review coords vs BC bounds + station-ID join to real matrix_map.samples.station_id.

### Recommendation
Proceed with the docling-based candidate-1 extraction as a monitored DRY-RUN.

### Rationale
Failure modes: table-detection/OCR miss, ambiguous UTM zone, station-ID mismatch, large-doc OCR memory (Docling SOP MAX_PAGES_FOR_OCR guard), 0 stations -> fail-closed exit 1 (never fabricate). Monitoring: heartbeat + RSS guard + process cleanup per L0 1.7/1.9 (heavy-PDF ingest); run under a monitored launcher.

### Blast radius
none in dry-run (no writes).

### Reversibility
n/a (dry-run).

### Exact stop boundary
--apply stays fail-closed owner-gated; NO Supabase/coordinate write; output = reviewed SQL + report only, pending a separate exact-operation approval.

### Paste-ready approval line
"Proceed with the docling-based candidate-1 extraction as a monitored DRY-RUN; produce a reviewed SQL file + report; no apply, no write."

## 6. T40 authenticated E2E -- status + admin-tier gate

### Current verified state
ACTIVATED. CI run 29304296749 on main f5e8cca: E2E_AUTH_ENABLED:true, 235 tests, 142 passed / 93 skipped (+10 authenticated specs vs the prior 225-test / 132-pass baseline, all passing). Member-tier authenticated E2E is live. (No secret values inspected.) Remaining: admin-tier POSITIVE coverage is a SEPARATE gate -- needs a second admin test user (sstac-e2e-admin@fake.bc.ca) + new secrets (E2E_ADMIN_EMAIL/_PASSWORD) + code (admin fixture + chromium-admin-auth project + admin.json storageState). Not built (out of scope until owner creates the user). (docs/MATRIX_OPTIONS_T40_ADMIN_TIER_OWNER_GATE_2026_07_12.md)

### Options
A) build admin-tier coverage now (needs owner to create the admin user + secrets); B) leave member-tier only.

### Recommendation
A when you can create the admin user; the fixture/config is AI-buildable afterward.

### Rationale
Member-tier authenticated E2E is live, but admin-tier POSITIVE coverage is a SEPARATE gate requiring a separate user, secrets and code to execute effectively without compromising the existing test suite structure.

### Blast radius
none (test coverage only).

### Reversibility
EASY (PR).

### Exact stop boundary
AI never sets secrets/variables or prints them; only reads presence/CI status + builds code fixtures.

### Paste-ready approval line
"I created admin user sstac-e2e-admin + set E2E_ADMIN_EMAIL/_PASSWORD; AI, build the admin-tier E2E fixture + chromium-admin-auth project (no live-write publish assertion)."

## Recommended decision order
1 IOCO (fast, high-value, EASY) -> 2 sodium (quick pick) -> 6 T40 admin-tier (when user ready) -> 3 BaP-ADAF Option 2 (safe increment) -> 4 PCB-migration (after EqP check) -> 5 DRA extraction (monitored dry-run).

Note: every catalog current_default change is a DIRECT JSON edit + substanceLibrary + catalog.test tripwire (not a promote script), AI dry-runs before/after + codex + gates + PR, never applies to Supabase.

# Map-2a Dataset Investigation (2026-06-23) -- CORRECTED

Question: the live Supabase `matrix_map` already has a WORKING multimedium dataset (loaded by a prior
session via the project-scoped MCP). Should we load the 2026-06-22 DB2 full-345-site export over it, and
how? Method: AGY investigation -> codex (gpt-5.5 xhigh) adversarial review -> Claude live-DB verification
(project-scoped MCP reads + monolith greps). Plain ASCII.

> NOTE: the first AGY draft claimed live(DB1) and DB2 had DISJOINT IDs so an overlay would DUPLICATE and a
> clean reload was REQUIRED. codex flagged that and live verification REFUTED it. This doc is the corrected
> record. (AGY = good legwork/structure + the operational points; the ID-disjoint rationale was wrong.)

## Executive summary
- The live data is the **9-site PR-MAP seed** (19 DRAs, 290 stations, 302 events, 7472 sediment / 334 tox /
  175 community), ALL `public=false`. The DB2 export is the **full 345-site scope** (574 DRAs, 7562 stations).
- The seed is a **clean SUBSET of DB2's same source-ID lineage** -- NOT a disjoint dataset. [VERIFIED]
- An overlay (`ON CONFLICT DO NOTHING`) therefore **does not duplicate** (overlapping IDs are skipped), and
  the overlapping measurement values are **IDENTICAL** between seed and DB2 (6/6 spot-check) -> **no value
  staleness** either. So an overlay is technically safe. [VERIFIED]
- BUT in the default **dated-only** load, ~6772 of DB2's 14244 sediment statements are **no-ops** (they
  reference undated events not inserted because `event_date` is NOT NULL + `--allow-undated` not used). So a
  dated-only load (overlay OR clean reload) adds **~0 new measured data** -- it only expands the REGISTRY
  (574 DRAs vs 19, 7562 mostly-EMPTY stations vs 290). The real measured-data growth needs the undated path
  (+ migration `20260620000001`). [codex; verified by monolith no-op count]
- Frontend: the v1 RPC `fetch_samples_with_hidden_summary` is province-wide with **no bbox/pagination**
  (`p_bbox` ignored until v1.x) -> it returns ALL visible samples in one payload. With everything
  `public=false`, scaling to 7562 stations mainly inflates `hidden_sample_count` + the admin/grant payload
  (7562 rows in one response = an egress/perf concern for admins). [VERIFIED in src/lib/matrix-map/fetch-samples-server.ts]

## Verified facts
- Live IDs: stations 1..290 (n=290); events 1..306 (n=302); sediment chem 1..7847 (n=7472); toxicity 1..334.
- DB2 monolith: dras 1..574; samples 1..7815 (253 no-geom gaps -> 7562 emitted); sample_events = the SAME 302
  IDs as the seed; sediment chem includes the seed's 1..7847 + more (statements) but only 7472 reference an
  emitted (dated) event; toxicity 1..334 identical.
- Overlapping value spot-check (live vs DB2 monolith), all IDENTICAL: chem 1 = 250.0 ug/g; 100 = 10.0 ug/kg;
  1000 = 50.0 ug/kg; 3000 = 24300.0 ug/g; 5000 = 66.8 ug/g; 7847 = 0.7 mg/kg.
- ETL ON CONFLICT targets (etl_bnrrm_to_supabase.py): samples bnrrm_station_id; sample_events bnrrm_event_id;
  sediment bnrrm_chemistry_id; toxicity bnrrm_toxicity_id; community (bnrrm_community_id, substance_id);
  dras bnrrm_doc_id; substances key. All DO NOTHING (no upsert/update path).

## Options
| Option | What it does | Risk / cost | Reversibility |
|---|---|---|---|
| **(a) Defer (recommended unless the registry is wanted now)** | Keep the 9-site seed. | None. Dated-only DB2 would add ~0 measured data anyway. | n/a |
| **(b) Overlay (safe, low value)** | Paste DB2 chunks; ON CONFLICT skips overlap. Adds 555 DRAs + ~7272 EMPTY stations; ~0 measured rows in dated-only. | No dup, no staleness (values identical). Inflates admin payload; no bbox yet. Hybrid audit story. | Hard-ish (remove DB2-only id ranges). |
| **(c) Full reload + UNDATED** | Apply migration 20260620000001, snapshot, clean reload with `--allow-undated`. The REAL 345-site dataset incl. the ~8052 undated measurements. | Biggest change. 7562 stations with NO bbox/pagination = admin egress/perf hit. TRUNCATE CASCADE touches grants/audit FKs. | DB snapshot restore. |
| **(d) Defer until v1.x bbox/pagination** | Wait for viewport-bounded fetch, THEN do (c). | Sequencing only. | n/a |

## Recommendation (Claude + codex consensus, 2026-06-23)
**Defer the production load; make bbox/pagination the NEXT concrete task; then full clean reload +
`--allow-undated`.** Skip dated-only entirely (it adds ~0 measured data). codex (gpt-5.5 xhigh, independent
consult) concurred and sharpened it:
- **Admins BYPASS `public=false`** (`matrix_map.fetch_samples_with_hidden_summary`, migration
  `20260521000002:153`) -- so the full load is a REAL all-samples admin payload (7562 rows in one
  province-wide response), not just an inflated hidden-counter. This strengthens the bbox-first case.
- The client materializes `visible_samples` into Leaflet markers + recreates marker layers
  (`MatrixMap.tsx:305,664`). 7562 is not catastrophic but is enough to avoid without real user value.
- **Missed option -- bbox-first reorder:** make viewport-bounded fetch + pagination a concrete lane (NOT a
  vague "v1.x"), THEN do the undated load. Lane spec:
  `docs/design/matrix-map/BBOX_PAGINATION_LANE_2026_06_23.md`.
- **Missed option -- bounded `--site-ids` undated pilot:** the ETL already supports explicit site subsets
  (`etl_bnrrm_to_supabase.py:1463`). Validate the undated load on a chosen handful of sites without a
  province-wide empty-station dump.
- "Undated data WITHOUT the empty stations" is plausible but NOT current ETL behavior (samples emitted
  before events, `etl line 911`) -- it would be a new ETL mode.

Bottom line: option (b) dated-only is worthless; (c) full undated is the right data load but ONLY after
bbox/pagination, or as a bounded `--site-ids` pilot. Loading thousands of empty stations is worth it only if
the product explicitly wants a province-wide DRA registry browser -- which this map is not yet. Do NOT use
the "overlay duplicates" rationale; it is false.

## Owner decision needed
1. Do you want the 345-site scale-up at all (and the empty-station registry it implies)?
2. If yes: dated-only (registry only) or the undated path (real data growth, needs the migration)?
3. Either way: confirm a DB snapshot before any destructive write.

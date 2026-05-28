# Stream B Design: Interactive Map Database Growth + ETL Refresh

**Status:** Design proposal (autonomous draft 2026-05-27). Pending owner review on return + Opus adversarial review before any code lands.

**Plan reference:** `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` Phase 5 (Week 10+).

**Owner directive 2026-05-27:** 2027 ordering = D, C, B. Stream B executes LAST among 2027 streams (after Stream D autonomous catalog agent + Stream C frame-aware calculator equations).

**Scope:** continual growth of the Supabase `matrix_map` schema backing the Interactive Map tab. Resolves the v1.1.0 venv blocker, plans Tier C site expansion, and plans contaminant-substance expansion. Out of scope: changes to the Map UI, changes to the data model itself (additional columns / tables), or rewrites of the existing ETL.

---

## 1. Context

The Interactive Map (`src/components/bn-rrm/map/SiteMap.tsx`) reads sediment site / sample / measurement data from the Supabase `matrix_map` schema via the `fetch_samples_with_hidden_summary` and `fetch_measurements` RPCs. Current v1 seed:

- 9 sites, 290 stations, ~7740 chemistry rows (81% of 9594 total source rows).
- Tiers: A (4 fully surveyed sites), B (5 BC Site Registry centroid-based sites).
- Source: `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db` (16.2 MB SQLite).
- ETL: `scripts/matrix-map/etl_bnrrm_to_supabase.py` v1.1.0 + `split_etl_output.py` chunking helper.
- Schema: 13 migrations under `supabase/migrations/20260519*` and `20260520*` and `20260521*` (matrix_map schema + RPCs + RLS + budget caps).

**Blocker (per `.tmp_matrix_map_etl_prep_status_2026_05_21.md`):** no project venv exists for SQL regeneration. The ETL Python script imports `psycopg2` (optional) + stdlib; it can run with just stdlib for dry-run, but `--apply` mode requires `psycopg2` or `psql` on PATH.

**Open question (from the plan):** "do we have new BN-RRM data sources to ingest, or is this about expanding the existing data with additional sites/parameters?"

---

## 2. Design principles

1. **No model changes; data only.** The 13 existing migrations define the schema. Stream B does NOT add columns, tables, or indexes. If a future need surfaces, it's a separate work stream.
2. **Idempotent ETL only.** Per the existing pattern at `etl_bnrrm_to_supabase.py:23-31`: every INSERT uses `ON CONFLICT DO NOTHING` keyed on the relevant UNIQUE constraint. Re-running is safe. New data passes must preserve this property.
3. **Path-scoped staging artifacts.** Each ingest pass emits `etl_bnrrm_to_supabase_output_<pass>.sql` + chunked `etl_output_chunks/<pass>/0X_*.sql`. Each artifact is reviewed BEFORE owner pastes into Supabase Studio SQL Editor.
4. **Per `cross_project_supabase_mcp_dead_skip_to_sql_editor.md`:** Stream B does NOT attempt Supabase MCP `apply_migration` or `execute_sql`. SQL goes through owner-pasted SQL Editor.
5. **Audit trail preserved.** Every ingest pass writes one `service_role_audit` row capturing the pass scope + affected row counts. Per the existing ETL pattern (`etl_bnrrm_to_supabase.py:51-53`).
6. **Per `cross_project_use_venv_python_not_system_python.md`:** Stream B sets up + uses a venv at `scripts/matrix-map/.venv/`. NEVER PATH python.
7. **No DRA classification changes.** Per the existing Q12 classification rules at `etl_bnrrm_to_supabase.py:33-38`: `station_type` -> `classification` mapping is fixed. New data must arrive with valid `station_type` values or be staged with `classification='unknown'`.

---

## 3. Pre-execution: resolve the venv blocker

### 3.1 Setup steps (one-time, before any ingest)

```powershell
# At scripts/matrix-map/ working directory
cd C:\Projects\SSTAC-Dashboard\scripts\matrix-map

# Create venv (Python 3.11+ required per etl_bnrrm_to_supabase.py:55)
python -m venv .venv

# Activate (PowerShell)
.\.venv\Scripts\Activate.ps1

# Install minimum deps. The ETL script is stdlib + optional psycopg2 +
# subprocess shell-out to psql. For --apply mode, psycopg2 is preferred.
python -m pip install --upgrade pip
python -m pip install psycopg2-binary>=2.9.0

# Verify
python -c "import psycopg2; print('psycopg2:', psycopg2.__version__)"
.\.venv\Scripts\python.exe -m pytest --version  # smoke check
```

### 3.2 `requirements.txt` for venv reproducibility

Authored at `scripts/matrix-map/requirements.txt`:

```
psycopg2-binary>=2.9.0
# stdlib only otherwise; Python 3.11+ required
```

### 3.3 Regenerate baseline SQL (verification step)

After venv setup, regenerate the v1 baseline SQL to confirm the venv + ETL script work against the existing source database:

```powershell
.\.venv\Scripts\python.exe etl_bnrrm_to_supabase.py
# Expected output: scripts/matrix-map/etl_bnrrm_to_supabase_output.sql
# Compare against the existing committed output to verify byte-equality (deterministic)
```

If byte-equal: venv works. Proceed to Section 4 (ingest passes).
If diff: investigate; may indicate non-deterministic ordering in the ETL or schema drift since v1 was emitted.

---

## 4. Ingest passes (Phase 5)

Per the plan, two passes anticipated. Both gated on owner input (specific sites / substances).

### Pass 1: Tier C site expansion

**Source:** Additional BC Site Registry centroid-based sites (mirrors Tier B pattern).
**Identification:** Owner provides a list of site registry IDs + the contaminated-site catalog entries for each. Stream B does NOT auto-select sites; the candidate list is HITL-curated.

**ETL approach:**

1. Source-DB augmentation: the BN-RRM training database (`bnrrm_training.db`) is the canonical source. New sites need to be added there FIRST (in the upstream BN-RRM repo at `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\`). This is upstream work outside SSTAC-Dashboard scope.
2. Geocoding: each new Tier C site needs a BC Site Registry centroid lat/lon. Owner provides or the autonomous-session pattern from `MATRIX_MAP_PR_MAP_4_5_*` handoffs is reused.
3. ETL invocation (filtered):
   ```powershell
   .\.venv\Scripts\python.exe etl_bnrrm_to_supabase.py `
     --source-db C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db `
     --out-sql etl_output_v2_tier_c_pass1.sql `
     --site-ids 10,11,12,13,14
   ```
   (`--site-ids` is a hypothetical filter flag; current ETL script accepts site IDs via different mechanism -- needs verification at execute-time.)
4. Chunk the output:
   ```powershell
   .\.venv\Scripts\python.exe split_etl_output.py `
     --input etl_output_v2_tier_c_pass1.sql `
     --output-dir etl_output_chunks/pass1_tier_c
   ```
5. Owner pastes chunks into Supabase Studio SQL Editor (`cross_project_supabase_mcp_dead_skip_to_sql_editor.md`).
6. Verify via map UI: new sites render with `coordinate_quality_tier='medium'`, `coordinate_source='bc_csr_centroid'`; click each new site to confirm identify-tool data renders.
7. Audit: confirm one new row in `matrix_map.service_role_audit` for the Pass 1 run.

**Estimated commits:** 3 (venv setup + requirements.txt + regenerated baseline SQL; Pass 1 chunks committed if owner wants them in repo for traceability; map UI dogfood notes).

### Pass 2: Contaminant-substance expansion

**Source:** Either (a) additional substance records in the existing `bnrrm_training.db` not yet in `matrix_map.substances`, OR (b) owner-provided new substance entries.

**ETL approach:**

1. Owner provides target substance list (e.g., "add the 8 PCB congeners we missed in v1").
2. ETL filter:
   ```powershell
   .\.venv\Scripts\python.exe etl_bnrrm_to_supabase.py `
     --source-db ... `
     --out-sql etl_output_v2_substances_pass2.sql `
     --substance-keys pcb-118,pcb-138,...
   ```
3. Chunk + paste flow same as Pass 1.
4. Verify via map UI: new substances appear in the substance filter dropdown; selecting them surfaces measurements where applicable.
5. Audit row.

**Estimated commits:** 1-2 (Pass 2 chunks + verification notes).

---

## 5. Idempotency + safety checks

Before each ingest pass, run the following SAFETY CHECKS:

### 5.1 Existing-state probe
```sql
-- Run in Supabase Studio SQL Editor BEFORE the ingest pass
SELECT COUNT(*) AS dras_count FROM matrix_map.dras;
SELECT COUNT(*) AS samples_count FROM matrix_map.samples;
SELECT COUNT(*) AS sample_events_count FROM matrix_map.sample_events;
SELECT COUNT(*) AS substances_count FROM matrix_map.substances;
SELECT COUNT(*) AS measurements_count FROM matrix_map.measurements;
SELECT pass_id, affected_rows, created_at FROM matrix_map.service_role_audit ORDER BY created_at DESC LIMIT 5;
```

Capture the counts. After the ingest pass, the counts should INCREASE by the expected delta (per the ETL's pre-flight COUNT(*) probes captured in the SQL artifact header).

### 5.2 ON CONFLICT spot check
After pass, sample 5 newly-inserted rows + run:
```sql
-- Confirm UNIQUE constraint keys are stable (re-running the same ETL is a no-op)
SELECT bnrrm_doc_id, key, bnrrm_station_id, bnrrm_event_id, bnrrm_chemistry_id
FROM matrix_map.dras LEFT JOIN matrix_map.samples USING (...);
```

If any UNIQUE keys collide unexpectedly (e.g., a "new" site's bnrrm_station_id matches an existing one), the ETL's `ON CONFLICT DO NOTHING` would silently drop the row -- but the ingest pass's affected-row count would not match the source count. Investigation needed.

### 5.3 Classification regression check
For Pass 1 (sites): query the new sites' classification distribution:
```sql
SELECT classification, COUNT(*)
FROM matrix_map.samples
WHERE bnrrm_station_id IN (...new station IDs...)
GROUP BY classification;
```
Expected: all new Tier C sites yield `classification='unknown'` initially (no `station_type` source); owner uses `classification_overrides` UI to mark sites as `reference`/`impacted`/`unknown` after ingest.

---

## 6. Risks + mitigations

### Risk: source-DB drift
If the source `bnrrm_training.db` has been modified since v1 was emitted, the baseline regen (Section 3.3) will not be byte-equal. Mitigation: investigate before any new ingest. The upstream BN-RRM repo at `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\` is the canonical source; check its git log for recent changes to `bnrrm_training.db` or the extraction scripts.

### Risk: schema migration since v1
If new migrations have applied to `supabase/migrations/` that affect the `matrix_map` schema (columns added, RLS changed, RPCs updated), the v1.1.0 ETL may produce INSERTs incompatible with the current schema. Mitigation: check `supabase/migrations/20260519*` through current for any `matrix_map`-related changes since the ETL was last tested. Update the ETL only if a column was added that the ETL would need to populate.

### Risk: Tier C centroid quality
BC Site Registry centroids are approximations. The map UI surfaces this via the `coordinate_quality_tier='medium'` flag, but new TWG members may not notice. Mitigation: confirm the map identify-tool clearly indicates `coordinate_source='bc_csr_centroid'` for Tier C sites; if not, surface this as a P3 UI polish in a separate work item.

### Risk: budget caps
The `matrix_map.budget_caps` table imposes daily request budgets per dimension (5 seeded). New site / substance data may shift query patterns. Mitigation: after Pass 1 + Pass 2, monitor `matrix_map.export_audit` + `service_role_audit` for unusual budget consumption. No code change anticipated.

### Risk: large chunks pasting into SQL Editor
`split_etl_output.py` chunks output at ~700KB. Supabase Studio SQL Editor handles this well, but very large ingest passes may need smaller chunks. Mitigation: configurable via `split_etl_output.py` -- already supported.

---

## 7. Deliverables at Phase 5 close

Per the plan:

- `scripts/matrix-map/.venv/` exists (gitignored).
- `scripts/matrix-map/requirements.txt` committed (Section 3.2).
- Baseline regen byte-equal verification documented.
- Pass 1 (Tier C sites) executed: SQL artifact + chunks + Supabase paste + map UI dogfood + audit row.
- Pass 2 (substances) executed: similar artifacts + verification.
- Memory anchor `dashboard_stream_b_map_data_growth_<date>.md` summarizing what landed.

---

## 8. Dependencies + ordering

- **Stream B follows Stream D + Stream C per owner directive 2026-05-27 (2027 order: D, C, B).** Stream D's autonomous catalog agent does NOT touch the matrix_map schema; no Stream D -> Stream B dependency. Stream C also independent. So Stream B can be the simplest of the three to plan; complexity is owner-content-input bound (which sites? which substances?).
- **Upstream BN-RRM repo:** any new sites must be added to `bnrrm_training.db` first by the BN-RRM team. SSTAC-Dashboard Stream B is downstream consumer.
- **Owner content input:** the specific Tier C site list + the specific Pass 2 substance list. Without these, Stream B is design-only.

---

## 9. Stop conditions

- Any schema migration proposed (column add, table add, RLS change) -- triggers a new work stream, NOT Stream B.
- Any ETL change beyond the existing v1.1.0 logic -- triggers a new work stream.
- Any direct write to `matrix_map.*` outside the ETL+SQL-Editor pattern.
- Any pass that does not emit a `service_role_audit` row.
- Any pass that violates `ON CONFLICT DO NOTHING` idempotency.
- Source-DB drift (baseline regen not byte-equal): STOP and investigate.

---

## 10. Open questions for owner (Phase 5 planning)

1. **Pass 1 site list:** which BC Site Registry sites should expand the matrix map to Tier C? Owner curates.
2. **Pass 2 substance list:** which contaminants are missing from v1? Owner curates (likely informed by Stream D catalog content).
3. **Source-DB stability:** is `bnrrm_training.db` stable, or is it actively churning? If churning, Stream B may need to wait for an upstream stable point.
4. **ETL --site-ids / --substance-keys flag verification:** the design assumes filter flags exist on the v1.1.0 ETL. Need to verify the actual CLI surface at execute time (read `etl_bnrrm_to_supabase.py` argparse setup).
5. **Coordinate source for Tier C:** BC Site Registry centroid only, or are some new sites surveyed (Tier A-style)?
6. **UI surface for new data:** any UI changes needed to surface new sites / substances visibly, or does the existing map auto-discover via the RPC payload?

---

*Authored autonomously by Opus 4.7 main session on 2026-05-27. Pending owner review on return + Opus adversarial review before any Phase 5 code lands. Built from read-only research on existing `scripts/matrix-map/etl_bnrrm_to_supabase.py` + `.tmp_matrix_map_etl_prep_status_2026_05_21.md` + plan file at `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md`.*

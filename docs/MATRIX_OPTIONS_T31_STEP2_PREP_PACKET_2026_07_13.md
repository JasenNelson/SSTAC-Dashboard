# T31 Undated Measurement-Load -- STEP-2 PREP PACKET (2026-07-13)

## 1. What STEP-2 Loads
This load applies undated records to the live Supabase `matrix_map` schema. The net-new rows are:
- +4178 undated `sample_events`
- +5752 `measurements` (5751 chemistry, 1 community, 0 toxicity)
- `samples` delta: 0

This requires a **two-gate approval**:
1. Authorize STEP-2 execution.
2. Approve the EXACT freshly regenerated artifacts (via codex review).

## 2. Command Sequence
The following is the exact command sequence to run STEP-2.

**(a) Regenerate (PowerShell)**
Set the SQL output path:
```powershell
$sql = ".tmp/mo-nextrun-2026-07-12/etl_undated_output.sql"
```

Run ETL generation:
```powershell
.\.venv\Scripts\python.exe scripts/matrix-map/etl_bnrrm_to_supabase.py --source-db "G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_960a8b31.db" --allow-undated --out-sql $sql
```

Split output into 25 chunks:
```powershell
.\.venv\Scripts\python.exe scripts/matrix-map/split_etl_output.py --source $sql
```

Build the manifest:
```powershell
.\.venv\Scripts\python.exe scripts/matrix-map/build_undated_manifest.py
```

Extract the rollback file (dry-run/verification):
```powershell
.\.venv\Scripts\python.exe scripts/matrix-map/extract_undated_rollback.py --input $sql
```

**(b) Dry-run**
The dry-run is satisfied by generating the artifacts above and validating counts via `extract_undated_rollback.py` which hard-stops if counts drift from +4178 undated / +5751 chem / +1 community.

**(c) Codex Review**
MANDATORY codex gate (L0 1.3 + repo Supabase protocol):
Run `/codex-review` on the EXACT freshly-regenerated 25-batch SQL + `mm_undated_load_manifest.json` (targeted: junk-filter completeness, idempotency/ON CONFLICT, FK order, no schema/RLS/RPC change) to mutual-agreement GREEN. The STEP-1 code review did NOT cover these regenerated (uncommitted) batches, so they must be reviewed at STEP-2. Do NOT apply until GREEN.

**(d) Apply (Live Load)**
Run via pooler using the exact flags, which also executes the PRE/POST count verification:
```powershell
.\.venv\Scripts\python.exe scripts/matrix-map/apply_live_load.py --manifest scripts/matrix-map/mm_undated_load_manifest.json --scripts-dir scripts/matrix-map/etl_output_chunks --report .tmp/mo-nextrun-2026-07-12/liveload_apply_closeout.md
```

## 3. PRE/POST Verification Queries
The PRE and POST count verification is handled automatically by the loader (`apply_live_load.py`). It executes the following exact queries to confirm the load:

```sql
SELECT 'substances' as tbl, count(*) as cnt FROM matrix_map.substances
UNION ALL
SELECT 'dras' as tbl, count(*) as cnt FROM matrix_map.dras
UNION ALL
SELECT 'samples' as tbl, count(*) as cnt FROM matrix_map.samples
UNION ALL
SELECT 'sample_events' as tbl, count(*) as cnt FROM matrix_map.sample_events
UNION ALL
SELECT 'measurements' as tbl, count(*) as cnt FROM matrix_map.measurements;
```

```sql
SELECT medium, count(*) FROM matrix_map.measurements GROUP BY medium;
```

Expected row-count deltas:
- `sample_events`: +4178
- `measurements`: +5752
- `samples`: 0
- `substances`: 0
- `dras`: 0

## 4. Owner Approval (OWNER-GATED)
This is a production data write. There is **no execution without exact approval**.
To authorize STEP-2, paste the following approval:

"I have reviewed the STEP-1 report (net-new: +4178 undated sample_events, +5752 measurements; data-safe attachment-scoped rollback; --manifest/--scripts-dir wiring; UCL path includes undated rows). I approve STEP-2: regenerate the undated batches, then apply them via apply_live_load.py --manifest scripts/matrix-map/mm_undated_load_manifest.json --scripts-dir scripts/matrix-map/etl_output_chunks to the live matrix_map schema, with PRE/POST count verification (confirm +4178 undated events / +5752 measurements / samples delta 0) and a report back before any further action."

## 5. Artifact Status
The STEP-1 generated artifacts are **NOT committed**. They will be regenerated fresh by this runbook.

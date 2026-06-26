# Historical Load Method Findings -- matrix_map Data Load

This document details the actual mechanisms, commands, credentials, and data scope used by prior sessions to load `matrix_map` data to the live Supabase instance.

---

## CONFIRMED + EXECUTED 2026-06-26 (read this first)

The BN-RRM sediment enrichment was loaded to live `matrix_map` and verified. The confirmed method:

- **Command:** `.venv/Scripts/python.exe scripts/matrix-map/apply_live_load.py`
- **Mechanism:** reads `DATABASE_URL` from `.env.local`, connects via the IPv4 **session pooler**
  (`postgres.qyrhsieynzfgyuqzznap@aws-1-ca-central-1.pooler.supabase.com:5432`, postgres role bypasses
  RLS), records PRE counts, applies the 27 FK-ordered idempotent batches server-side via `psycopg2`,
  prints POST counts + deltas, writes a closeout report. SQL executes server-side -> never enters
  Claude's context = cheap. `psycopg2` is ALREADY in `.venv` (no install).
- **Credential:** `DATABASE_URL` lives in gitignored `.env.local` (the earlier "ANON-only / no
  DATABASE_URL" claim was WRONG). The **DIRECT** host `db.<ref>.supabase.co` is IPv6-only -> unusable
  on an IPv4-only host; always use the pooler.
- **Result (deltas):** substances +94 (->276), dras +555 (->574), samples +4140 (->4430),
  sample_events +193 (->495), measurements +2167 all sediment (->10148; sediment 9639). Toxicity (334)
  + community (175) unchanged -- already seeded; `ON CONFLICT DO NOTHING` kept the re-load idempotent.
- **The month-long blocker (root cause):** the pooler kept returning "password authentication failed"
  because the Supabase password reset was **SET but never APPLIED** -- you must click the dashboard
  **Reset** button, not just type a new password into the field. Decisive project check (rules out a
  project mix-up): `SELECT count(*) FROM matrix_map.measurements;` in the dashboard SQL Editor must
  match the live count. A pooler "password authentication failed" (vs "Tenant or user not found")
  proves project/region/username are correct and only the password value is wrong.

The pathway notes below remain accurate background. Pathway B (local Python client) is the confirmed
path, implemented by `apply_live_load.py`.

---

## 1. Actual Load Mechanism & Commands

Two main pathways have been designed and documented for applying SQL to the live Supabase instance:

### Pathway A: Manual Studio SQL Editor Paste (Historical Seed Load)
For the initial seed data load (~6 MB SQL), the SQL was split into smaller chunks to bypass the Supabase Studio SQL Editor's paste size limit (~1 MB).
*   **Splitter Script**: [scripts/matrix-map/split_etl_output.py](file:///C:/Projects/sstac-dashboard/scripts/matrix-map/split_etl_output.py#L1-L20)
    *   *Operation*: Splits the SQL monolith into transaction-bracketed, FK-ordered chunks under 700 KB: `scripts/matrix-map/etl_output_chunks/NN_<purpose>.sql`.
*   **Execution Command**: Manually pasted in numeric order (01, 02, ... 26) into the Supabase Studio SQL Editor.
*   **Citations**:
    *   [sql_runbook/MAP_2A_DATA_LOAD_RUNBOOK_2026_06_22.md](file:///C:/Projects/sstac-dashboard/sql_runbook/MAP_2A_DATA_LOAD_RUNBOOK_2026_06_22.md#L3-L9) (Lines 3-9, 73-77)
    *   [docs/design/matrix-map/README.md](file:///C:/Projects/sstac-dashboard/docs/design/matrix-map/README.md#L93-L100) (Lines 93-100)

### Pathway B: Local Python Client (Automated Bulk Load / Live Load)
Runs the load Postgres-side directly from the workspace via a connection to the database.
*   **ETL Script**: [scripts/matrix-map/etl_bnrrm_to_supabase.py](file:///C:/Projects/sstac-dashboard/scripts/matrix-map/etl_bnrrm_to_supabase.py#L86-L88)
*   **Runnable Command**:
    ```powershell
    DATABASE_URL=postgresql://... python scripts/matrix-map/etl_bnrrm_to_supabase.py --apply
    ```
    *   *Operation*: Connects to the database and applies the SQL transaction block via `psycopg2` or shells out to `psql` if `psycopg2` is absent.
*   **Citations**:
    *   [scripts/matrix-map/etl_bnrrm_to_supabase.py](file:///C:/Projects/sstac-dashboard/scripts/matrix-map/etl_bnrrm_to_supabase.py#L1419-L1480) (Lines 1419-1480, 1677-1688)
    *   [docs/design/matrix-map/LIVE_LOAD_APPLY_AGY_BRIEF_2026_06_26.md](file:///C:/Projects/sstac-dashboard/docs/design/matrix-map/LIVE_LOAD_APPLY_AGY_BRIEF_2026_06_26.md#L3-L6) (Lines 3-6)

---

## 2. Write Credential Sourcing

The credentials required to execute the write depend on the method used:
1.  **`DATABASE_URL` (Environment Variable)**: The Postgres connection string (pointing to either the Direct connection or Session pooler URI, bypassing RLS using the `postgres` role). Read at runtime from the shell environment or parsed from a gitignored local env file.
    *   *Citation*: [docs/design/matrix-map/LIVE_LOAD_APPLY_AGY_BRIEF_2026_06_26.md](file:///C:/Projects/sstac-dashboard/docs/design/matrix-map/LIVE_LOAD_APPLY_AGY_BRIEF_2026_06_26.md#L8-L14) (Lines 8-14)
2.  **`SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE`**: Used by server-side routes (such as CSV exports) to bypass RLS.
    *   *Citation*: [docs/ENVIRONMENT_REFERENCE.md](file:///C:/Projects/sstac-dashboard/docs/ENVIRONMENT_REFERENCE.md#L134-L139) (Lines 134-139)

---

## 3. Data Format: Raw SQL vs Row Data

*   **Raw SQL**: The database is loaded by executing **raw SQL statements** (transaction-bracketed, FK-ordered `INSERT` statements with `ON CONFLICT DO NOTHING` clauses). 
*   The Python script `etl_bnrrm_to_supabase.py` converts row data from the source SQLite database into these raw SQL statements, which are then either executed via a Python database connector (`psycopg2`) or pasted manually as SQL scripts in Supabase Studio.
*   *Citation*: [scripts/matrix-map/etl_bnrrm_to_supabase.py](file:///C:/Projects/sstac-dashboard/scripts/matrix-map/etl_bnrrm_to_supabase.py#L17-L21) (Lines 17-21, 1419-1480)

---

## 4. Historical Load Data Scope (Seed vs Full Bulk)

The assumption that prior sessions loaded "tens of thousands" of rows of `matrix_map` data is incorrect:
1.  **Loaded Seed Scope**: Prior sessions only loaded the **9-site seed data subset** (19 DRAs, 282 samples, 302 sample_events, 7,472 sediment measurements, 334 toxicity measurements, 157 substances), all set to `public=false`.
    *   *Citation*: [docs/archive/root-scratch-2026/MATRIX_MAP_PR_MAP_4_5_HANDOFF_2026_05_21_EVENING.md](file:///C:/Projects/sstac-dashboard/docs/archive/root-scratch-2026/MATRIX_MAP_PR_MAP_4_5_HANDOFF_2026_05_21_EVENING.md#L61-L70) (Lines 61-70)
2.  **Full Load Deferred**: The bulk load of the full 345-site DB2 dataset (~7,562 stations) was **deliberately deferred** by consensus in the session of 2026-06-23. The dated-only bulk load would add ~0 actual measured data (most data is undated), and loading 7,562 empty/dated stations before viewport bounding (bbox/pagination) is implemented would cause severe Leaflet rendering and admin page performance issues.
    *   *Citation*: [docs/design/matrix-map/MAP_2A_DATASET_INVESTIGATION_2026_06_23.md](file:///C:/Projects/sstac-dashboard/docs/design/matrix-map/MAP_2A_DATASET_INVESTIGATION_2026_06_23.md#L48-L69) (Lines 48-69)

# T31 Undated Measurement-Load -- STEP-1 Report (2026-07-12)

STEP-1 (owner-approved: generate + dry-run + rollback + wiring + codex; NO live apply) is complete.
This report is the input to the owner's STEP-2 apply decision. **No batch was applied to live Supabase;
`apply_live_load.py` was NOT run; no catalog/data was mutated.**

## 1. Source probe (read-only)
Enriched source DB `bnrrm_enhanced_2026-06-25_960a8b31.db` (65 MB, G:\...\matrix-map-data) present +
readable. `sampling_events` = 8559 rows; **8060 raw undated** (null/blank date_sampled; all sediment).
Nonzero undated confirmed -> generation authorized to proceed.

## 2. Generation (ETL dry-run, --allow-undated)
Command (non-DB2 source auto-skips the SHA integrity check):
```
.venv/Scripts/python.exe scripts/matrix-map/etl_bnrrm_to_supabase.py \
  --source-db "G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_960a8b31.db" \
  --allow-undated --out-sql <fresh .sql>
```
ETL emitted counts (dry-run): **undated_events_emitted 4178**, sample_events 4671, measurements 15375,
toxicity 334, community 172, substances 274, dras 574, samples 4428, junk_filtered_stations 3478,
skipped_no_event_date 0. Output 17 MB -> `split_etl_output.py` -> **25 chunks** (`etl_output_chunks/01..25`,
~686 KB each), **25829** `INSERT INTO` statements. The 25828 data INSERTs are all `ON CONFLICT DO
NOTHING` (idempotent -- a re-run inserts 0 data rows). The ONE exception is a single
`matrix_map.service_role_audit` provenance INSERT (`VALUES (...)`, no ON CONFLICT) at the tail: a
resumed/re-applied run APPENDS one new audit-log row each time (benign audit noise, not data
duplication). The STEP-2 codex review + owner should note this: idempotency holds for all data tables;
the audit table gains one row per apply attempt.

## 3. Exact net-new deltas (predicted; confirmed by loader PRE/POST at STEP-2)
Live matrix_map currently has **0 undated sample_events**, so the net-new rows this load adds are
exactly the undated events + the measurements attached to them:
| stream | net-new |
|---|---|
| undated sample_events | 4178 |
| measurements (chemistry) | 5751 |
| measurements (toxicity) | 0 |
| measurements (community) | 1 |
| **total net-new measurements** | **5752** |
Predicted post-load: sample_events 559 -> ~4737 (all new are undated); measurements 13631 -> ~19383.
(These are predictions from parsing the generated SQL; the loader records authoritative PRE/POST at
apply time. NOTE for owner: the live measurement total need not equal ETL-emitted totals because prior
loads and this run may differ in source coverage; the net-new figure above is what THIS load inserts.)

## 4. Exact rollback (data-safe)
`extract_undated_rollback.py` -> `rollback_undated.sql` + `rollback_ids.json` (the 4178 undated
`bnrrm_event_id` + the net-new measurement id lists, for verification). The rollback is scoped by
**undated-event ATTACHMENT**, not by measurement idempotency-key IN-lists (codex P1 fix): it deletes
only measurements whose `sample_event_id` resolves to an undated event in our set U, then the undated
events in U. Because live had 0 undated events pre-load, this provably cannot delete a pre-existing or
dated production row, and is robust to idempotent re-application:
```sql
BEGIN;
DELETE FROM matrix_map.measurements
 WHERE sample_event_id IN (SELECT id FROM matrix_map.sample_events
   WHERE date_precision='undated' AND bnrrm_event_id = ANY(ARRAY[<4178 ids>]::bigint[]));
DELETE FROM matrix_map.sample_events
 WHERE date_precision='undated' AND bnrrm_event_id = ANY(ARRAY[<4178 ids>]::bigint[]);
SELECT count(*) AS undated_rows_remaining FROM matrix_map.sample_events
 WHERE date_precision='undated' AND bnrrm_event_id = ANY(ARRAY[<4178 ids>]::bigint[]);
-- REVIEW the SELECT (expect 0), THEN run COMMIT; (or ROLLBACK; to abort). The generated
-- rollback_undated.sql deliberately omits COMMIT so the open transaction gives a real pre-commit
-- pause; if the session ends without COMMIT, Postgres rolls back. Fallback: matrix_map backup snapshot.
```

## 5. Apply-input wiring (the packet's flagged caveat -- resolved, option b)
`apply_live_load.py` hardcoded its manifest + scripts-dir to the primary checkout. Fixed with
**backward-compatible** `--manifest` / `--scripts-dir` args (defaults byte-identical to the old
literals; `--help` verified to short-circuit before any DB connect). The prior dated manifest/batches
are untouched. `build_undated_manifest.py` produces a fresh `mm_undated_load_manifest.json` (25-chunk
`apply_order`) that the loader reads via `--scripts-dir scripts/matrix-map/etl_output_chunks`.

## 6. UCL / Selection Stats undated-handling (packet R3 -- RESOLVED, no blocker)
The stats/UCL path (`computeSelectionStats` -> `computeBucket`, `src/lib/matrix-map/stats.ts:254`)
does its ONLY date filtering through the shared `filterMeasurementRows`; there is no independent date
logic in the stats math. By default (no date filter) undated rows are INCLUDED in UCL/background
buckets -- no crash, no silent exclusion. They are excluded only under an active user date-filter
(the documented intentional null-guard, consistent with map/workbench/export). Optional hardening:
add a `stats.test.ts` regression asserting undated inclusion with no date filter (cheap; not a fix).

## 7. codex verdict
codex targeted review of the STEP-1 code -> 2 findings, both AGREED + resolved: [P1] rollback
data-safety -> rewrote to attachment-scoped DELETEs (section 4); [P2] manifest referenced uncommitted
chunk files -> resolved by NOT committing the 17 MB generated chunks and instead documenting the
STEP-2 regeneration workflow (below). Re-review confirms GREEN (see run COMMAND_LOG).

## 8. What gets committed vs generated
COMMITTED (this PR): the `apply_live_load.py --manifest/--scripts-dir` change, `build_undated_manifest.py`,
`extract_undated_rollback.py`, this report, and the T32 packet. NOT committed (large generated artifacts,
regenerated fresh at STEP-2): `etl_undated_output.sql` (17 MB), the 25 `etl_output_chunks/*.sql`, the
`mm_undated_load_manifest.json`, and `rollback_undated.sql`. This satisfies codex P2 (chunks are
"generated by the workflow", not dangling committed references).

## 9. STEP-2 procedure (owner-gated -- run ONLY on owner STEP-2 approval)
1. Regenerate (PowerShell; carry the EXACT approved `--source-db` through -- do NOT rely on the ETL
   default `_enrichment_working/bnrrm_enhanced.db`, which is absent here and would be the wrong source
   elsewhere). Set `$sql = ".tmp/mo-nextrun-2026-07-12/etl_undated_output.sql"` then:
   - `.\.venv\Scripts\python.exe scripts/matrix-map/etl_bnrrm_to_supabase.py --source-db "G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_960a8b31.db" --allow-undated --out-sql $sql`
   - `.\.venv\Scripts\python.exe scripts/matrix-map/split_etl_output.py --source $sql`
   - `.\.venv\Scripts\python.exe scripts/matrix-map/build_undated_manifest.py`
   - `.\.venv\Scripts\python.exe scripts/matrix-map/extract_undated_rollback.py --input $sql`  (hard-stops if the regenerated counts drift from the approved 4178 undated / 5751 chem / 0 tox / 1 community).
2. **MANDATORY codex gate (L0 1.3 + repo Supabase protocol -- every data write is reviewed before
   apply):** run `/codex-review` on the EXACT freshly-regenerated 25-batch SQL + `mm_undated_load_manifest.json`
   (targeted: junk-filter completeness, idempotency/ON CONFLICT, FK order, no schema/RLS/RPC change) to
   mutual-agreement GREEN. The STEP-1 code review did NOT cover these regenerated (uncommitted) batches,
   so they must be reviewed at STEP-2. Do NOT apply until GREEN.
3. PRE-load counts (loader records them).
4. Apply (PowerShell; use the relative-executable form so the interpreter actually runs): `.\.venv\Scripts\python.exe
   scripts/matrix-map/apply_live_load.py --manifest scripts/matrix-map/mm_undated_load_manifest.json
   --scripts-dir scripts/matrix-map/etl_output_chunks --report .tmp/mo-nextrun-2026-07-12/liveload_apply_closeout.md`
   (session pooler, per-batch transactions, idempotent, resumable; `--report` keeps the closeout in this checkout).
5. POST counts; verify deltas == section 3 (+4178 undated events, +5752 measurements; samples delta 0);
   report back. Rollback available per section 4.

## PASTE-READY STEP-2 APPROVAL SENTENCE (owner)
"I have reviewed the STEP-1 report (net-new: +4178 undated sample_events, +5752 measurements;
data-safe attachment-scoped rollback; --manifest/--scripts-dir wiring; UCL path includes undated
rows). I approve STEP-2: regenerate the undated batches, then apply them via
`apply_live_load.py --manifest scripts/matrix-map/mm_undated_load_manifest.json --scripts-dir
scripts/matrix-map/etl_output_chunks` to the live matrix_map schema, with PRE/POST count verification
(confirm +4178 undated events / +5752 measurements / samples delta 0) and a report back before any
further action."

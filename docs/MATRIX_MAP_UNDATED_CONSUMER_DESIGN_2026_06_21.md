# Matrix-Map "Undated Rows" Consumer-Contract Design + ETL Chunk Regen Plan (2026-06-21)

Status: DESIGN / PREP ONLY. No app code or live data is changed by this document. The actual Supabase
data load stays owner-gated (owner pastes SQL into Studio; MCP write path is dead). Authored to scope
the deferred Map-LOAD consumer lane (foundation merged in PR #373 migration + PR #374 ETL --allow-undated).

---

## 1. What the merged foundation provides

- PR #373 migration: `matrix_map.sample_events.event_date` is now NULLABLE; new column
  `date_precision text NOT NULL DEFAULT 'exact'` with CHECK `date_precision IN ('exact','undated')`;
  cross-column CHECK `(event_date IS NULL) = (date_precision = 'undated')`. (The 'year'/'month'
  precision values discussed earlier are NOT in the current CHECK; this design is forward-compatible
  but only 'exact'|'undated' can be stored today.)
- PR #374 ETL: `--allow-undated` emits undated sample-event rows.

No app code yet consumes `date_precision` or handles NULL `event_date`. That is the gap below.

## 2. Consumer-contract design (the changes a future PR would make)

All app-layer changes are autonomous (normal PR + 4 gates). The RPC change is a NEW migration file
(author + codex; the owner pastes it -- per the Supabase SQL-Editor-only protocol).

| Layer | File | Change |
|---|---|---|
| RPC (new migration) | `supabase/migrations/<ts>_matrix_map_measurements_rpc_add_date_precision.sql` | In `fetch_measurements_for_samples`, add `se.date_precision` to the SELECT; add `NULLS LAST` to the `se.event_date` ORDER BY term so undated rows do not sort to the top. (Additive to the jsonb return -> backward compatible.) |
| Store type | `src/stores/matrix-map/measurementStore.ts` | `event_date: string` -> `string | null`; add `date_precision: 'exact' | 'undated' | string`. |
| Filter util | `src/lib/matrix-map/filter-measurements.ts` | Null-guard the date comparison (lines ~32-33): when `event_date === null`, exclude under any active date filter. Keep the existing lexical-string comparison (do NOT switch to Date math -- see the file header). |
| Export route | `src/app/api/matrix-map/export/route.ts` | `MeasurementRow.event_date` -> `string | null`; `normalizeMeasurements` emits null (not `''`) for undated; add a `date_precision` CSV column; apply the same undated null-guard to the date filter (lines ~373-374); record the active date filter in the export_audit filter_summary. |
| UI | `src/components/matrix-options/MatrixMapRightPanel.tsx` | Render an "undated" badge in the event_date cell (line ~810) when `date_precision === 'undated'`; add a small note under the From/To date inputs: "Undated observations are excluded when a date filter is set." |
| Tests | `src/lib/matrix-map/__tests__/filter-measurements.test.ts` + `.../export/__tests__/route.test.ts` | undated row excluded by date_from / date_to; included when no date filter. |

### Filter policy (the load-bearing decision)
Recommended: **exclude undated rows whenever a date filter is active** (a date filter is a precision
filter; undated observations have no date to satisfy it). This matches the current accidental
null-comparison behavior; the change makes it explicit + tested + visible (the UI note). Alternatives
(always-include, or a separate "include undated" toggle) are rejected for v1 as misleading / extra
complexity. Marker symbology is unaffected (markers are station-level, not per-event).

## 3. Stale ETL chunk regen + the env_modifier correction

### 3a. codex env_modifier flag -- RESOLVED (no enum change needed)
The runbook `sql_runbook/50_multimedia_schema_delta.sql:76` (and the PATHB README WARNING) claim Path B
emits `medium='env_modifier'`. That is INCORRECT. The PATH_B monolith (line ~8859+) inserts
env-modifier measurements with `medium='sediment'` and `notes='env_modifier'` as the discriminator.
The live `measurements.medium` CHECK (`sediment|water|tissue|toxicity|community`) is NOT violated, so the
enum-extension block (50_multimedia_schema_delta.sql:91-98) is NOT required before pasting Path B. The
runbook's "RESOLVE THE env_modifier ENUM QUESTION" step is answered: paste Path B without the enum change.
ACTION: correct the note in 50_multimedia_schema_delta.sql + the PATHB README (these are untracked scratch).

### 3b. Stale chunks
`scripts/matrix-map/etl_output_chunks/` are v1.0.0 (sediment-only; no
`bnrrm_toxicity_id`/`bnrrm_community_id`/`bnrrm_env_modifier_id` inserts). They MUST NOT be pasted.
`split_etl_output.py` hard-codes `SOURCE = etl_bnrrm_to_supabase_output.sql` (v1.0.0).
Regen plan: add a `--source` arg to `split_etl_output.py` (5-line argparse change; codex-reviewed) OR
temporarily repoint SOURCE, run it against the v1.1.0 PATH_B monolith, DELETE the stale v1.0.0 chunks
before committing the new set, and header-stamp the new chunks ("generated from PATH_B v1.1.0 2026-06-21").
Note: the PATH_B monolith itself is untracked scratch -- track it (it is the authoritative v1.1.0 output)
once the owner confirms the content post-load.

### 3c. The undated rows need a fresh ETL run
PATH_B was generated BEFORE `--allow-undated`, so it loads 0 undated rows. Loading the undated
measurements requires a fresh `etl_bnrrm_to_supabase.py --allow-undated` run (after migration #373 is
applied), split + pasted separately. Order: (a) apply migration #373; (b) deploy the app-layer +
RPC changes from section 2; (c) paste PATH_B multimedium chunks; (d) run + paste the --allow-undated output.

## 4. Owner-gated boundary

- Autonomous (normal PR + gates): all of section 2's TypeScript + tests; the `--source` flag on
  split_etl_output.py; the env_modifier note correction; authoring (NOT pasting) the RPC migration.
- Owner action (Supabase Studio paste): apply migration #373 (verify state first via its preflight
  SELECT); verify the `bnrrm_env_modifier_id` UNIQUE constraint exists; apply the new RPC migration;
  paste PATH_B chunks; run + paste the --allow-undated ETL output.

## 5. Key risks
- R1 lexical null comparison: a 2-line null-guard; must be unit-tested (LOW).
- R2 RPC backward-compat: additive jsonb field; ship the TS type in the same PR (LOW).
- R3 `bnrrm_env_modifier_id` UNIQUE may be absent in prod -> PATH_B paste aborts on first ON CONFLICT;
  owner verifies before pasting (MEDIUM, easy fix).
- R4 medium='env_modifier' enum: RESOLVED -- not needed (Path B uses medium='sediment').
- R6 splitter SOURCE hard-code: regenerating without repointing produces stale chunks; delete the
  v1.0.0 chunks before committing the new set.

---
Authored 2026-06-21 (design subagent + orchestrator synthesis). Supersedes the codex env_modifier flag
with the medium='sediment' resolution. No files modified by this design.

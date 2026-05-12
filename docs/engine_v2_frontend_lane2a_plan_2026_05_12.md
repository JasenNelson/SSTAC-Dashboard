# engine_v2 frontend Lane 2a (demo MVP) plan v0.2 -- 2026-05-12

## v0.2 amendments (incorporating codex findings)

**BLOCKER fixes:**
- **L2a-3 import ordering reversed.** Insert/UPSERT per_policy_results rows FIRST, then stamp v2_evaluations terminal status LAST. Use `ON CONFLICT (evaluation_id, policy_id, stage, packet_id) DO UPDATE` (not `DO NOTHING`) so retry repairs partial imports. Wrap in transaction via Supabase RPC OR sequential awaits with rollback-on-error semantics. Status classification deferred until rows committed.
- **Eval-run-dir cleanup invariant.** Explicitly: NO cleanup of `<v2_dashboard_eval_runs>/<eval_id>/` on terminal transition for Lane 2a -- run dirs are RETAINED for audit (matches Lane 1's extracts-dir retention). State this. Lane 2b janitor can reap old eval dirs by age.

**IMPORTANT fixes:**
- **Per-policy unique index expanded** to `(evaluation_id, policy_id, COALESCE(stage,''), COALESCE(packet_id,''))` to preserve multi-stage / multi-packet rows. Lane 2a may not exercise multi-stage but the engine emits these fields.
- **telemetry.errors persisted.** Import flow now copies `eval_result.telemetry.errors` (and any other error surfaces) into v2_evaluations.errors. Status classification:
  - `coverage_statement.error == 0 AND telemetry.errors == []` -> `completed`
  - `coverage_statement.error > 0 OR telemetry.errors non-empty` -> `completed_with_errors`
  - Subprocess never emitted eval_result.json within stale timeout -> `error`
- **Extraction JSON selection tied to extraction_run_id.** Lane 2a contract: scan `<v2_dashboard_extracts>/<project_id>/` for `*.json`. Assert EXACTLY ONE found. 0 -> 500 `{error:'no_extracted_json'}`; >=2 -> 500 `{error:'multiple_extraction_artifacts_for_project'}`. Document Lane 2b resolution: per-extraction-run subdirectory.
- **Polling single-flight is NON-DROPPABLE.** EvaluationStatusPanel mirrors Lane 1's ExtractionStatusPanel pattern exactly: `useRef` interval handle, `inFlightRef` boolean, effect deps only `run.id` + terminal-ness, cleanup on unmount.
- **Hydration safety NON-DROPPABLE.** All Lane 2a date formatters use `toLocaleString("en-US", {...})` -- shared helper recommended. Same fix Lane 1 needed at commit af2f76a.
- **EXIT GATE expanded** -- see "EXIT GATE" section below for full checklist including ENOENT, duplicate-poll idempotency, cross-owner 403, CSRF reject, terminal-rendering smoke.
- **ENGINE_V2_EVAL_BACKEND_DEFAULT validated.** Only accepts `stub` or `live`; any other value rejected at startup. Default unset -> 'stub'. Live mode never enabled by Lane 2a smoke.

---


Authored 2026-05-12 after Lane 1 demo gap surfaced. Lane 2a is the **minimum**
viable vertical slice that takes a Lane-1 extraction result and produces a
visible per-policy compliance verdict. Defers HITL judgments, memo export,
telemetry sidebar, multi-VERBATIM merge, and bench fixtures to Lane 2b.

Parent plan: `docs/engine_v2_frontend_lane1_plan_v7.19.md`.

## Backend contract (read-only, confirmed)

- Entry point: `C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/scripts/run_owner_scenario.py`
- CLI: `python run_owner_scenario.py --scenario-config <yaml> --output-dir <dir>`
- Scenario YAML fields (full list in script docstring lines 28-77):
  - `scenario_id` (required) -- anonymous handle.
  - `extract_path` (required) -- path to verbatim JSON.
  - `bench_fixture` (required) -- e.g. `bench_43_full`.
  - `applicability_mode` -- off | pre | soft (default off).
  - `evaluation_backend` -- stub | live (default stub).
  - `embedder_backend` -- stub | real (default stub).
  - `reranker_backend` -- disabled | stub | real (default disabled).
  - `model` -- Ollama tag (default qwen2.5:14b-instruct-q4_K_M).
  - `variant` -- evaluator variant (default graph_v2_default).
- Output file: `<output-dir>/<run_id>/eval_result.json`. Schema:
  - `run_id` (UUID -- engine-generated)
  - `schema_version` (e.g. 0.0.1)
  - `variant_config_hash`
  - `provenance` (corpus_version, graph_corpus_version, embedder_backend, reranker_backend, stages_run[], git_sha_at_run)
  - `per_policy_results[]` -- each row: schema_version, run_id, stage, packet_id, policy_id, tier, site_context, submission_id, submission_version, model_used, started_at, completed_at, ai_suggestion, verdict_suggestion, confidence, confidence_method, summary, evidence_packet, minority_findings, evidence_gaps, pathway_notes, tier_render_policy, stage_models, rubric_self_score, run_metadata, coverage_statement.
  - `coverage_statement` -- total_policies, evaluated, deferred, error, deferred_reasons.
  - `telemetry` -- graph_traversal_log_summary, errors, schema_class, variant, pathway_notes_mode, started_at, completed_at, committed_cohort, etc.

## Lane 2a scope (in)

- Trigger evaluation on a project's latest completed extraction.
- Poll evaluation status (pending -> running -> completed | error).
- Import eval_result.json into Supabase tables.
- Show per-policy verdicts in UI (policy_id, tier, verdict, confidence, summary).
- Show coverage statement.

## Lane 2a scope (out -- deferred to Lane 2b)

- Multi-VERBATIM merge for multi-file projects (Lane 2a uses the first VERBATIM JSON only; documented).
- Full evidence_items / telemetry tables.
- HITL judgment UI + history.
- Memo export (Word MSO).
- Bench fixture management UI.
- Reranker / stage_models / pathway-notes deep configuration UI.
- Stub-vs-live selector UI (Lane 2a always uses stub mode for safety; live mode is set via env var only).

## Engineering Decisions

### ED-2a-1: Default evaluation backend is stub
Lane 2a always invokes the script with `evaluation_backend=stub` in the scenario
YAML. Live Ollama can be opted in via env var `ENGINE_V2_EVAL_BACKEND_DEFAULT=live`
(default unset). Owner-driven decision; do not expose a UI toggle in Lane 2a.

### ED-2a-2: Single-extract submission only
Each project has 1..N submission files. Lane 2a passes the first
extracted-JSON file from `<v2_dashboard_extracts>/<project_id>/` as the
`extract_path`. Multi-file merge is Lane 2b.

### ED-2a-3: Idempotency via engine run_id
`v2_evaluations.run_id_engine UNIQUE` ensures the same eval_result.json
import is a no-op. Repeated trigger calls return 409 with the existing
evaluation_id while a non-terminal row exists (mirrors v2_extraction_runs
idempotency, Finding 5 carried forward).

### ED-2a-4: Per-policy results are flat
Lane 2a stores each `per_policy_results[]` row as a row in
`v2_per_policy_results` with the full raw JSON as a JSONB column AND
selected normalized scalar columns for query/display. Lane 2b will split
out v2_evidence_items + v2_telemetry tables.

### ED-2a-5: Access model
Per-admin-owner inherited from Lane 1. RLS on v2_evaluations and
v2_per_policy_results filters by ownership of the parent v2_projects row.

### ED-2a-6: Reuse Lane 1 helpers
- `requireAdminForApi`, `checkCsrf`, `spawn_extraction.ts` (will rename
  use case but pattern reusable), `storage_materialize.ts` (not needed --
  extracts already on local disk from Lane 1), `path_containment.ts`.
- Same env var conventions: `REG_REVIEW_ENGINE_V2_BASE_PATH`,
  `REG_REVIEW_PYTHON_PATH`, `LOCAL_ENGINE_ENABLED`.
- New env vars:
  - `REG_REVIEW_ENGINE_V2_SCRIPT_PATH` -- path to run_owner_scenario.py
    (default `C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/scripts/run_owner_scenario.py`).
  - `REG_REVIEW_ENGINE_V2_BENCH_FIXTURE` -- default `bench_43_full`.
  - `ENGINE_V2_EVAL_BACKEND_DEFAULT` -- `stub` (default) or `live`.

### ED-2a-7: Soft-delete inherits semantics
v2_evaluations rows are NEVER hard-deleted by users (audit trail).
v2_per_policy_results cascade-deletes on v2_evaluations DELETE (admin SQL only).

## Module breakdown

### L2a-1: schema patch + types + Zod

File allowlist:
- NEW `supabase/engine_v2/database_schema_engine_v2_lane2a_patch.sql`
- NEW `src/lib/engine-v2/types_lane2.ts` (or append to existing types.ts)
- NEW `src/lib/engine-v2/zod_lane2.ts` (or append to existing zod.ts)

Schema (idempotent):
```sql
CREATE TABLE IF NOT EXISTS v2_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  extraction_run_id UUID NOT NULL REFERENCES v2_extraction_runs(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT v2_evaluations_status_check
    CHECK (status IN ('pending','running','completed','completed_with_errors','error')),
  run_id_engine UUID NULL,
  variant_config_hash TEXT NULL,
  evaluation_backend TEXT NOT NULL DEFAULT 'stub',
  embedder_backend TEXT NOT NULL DEFAULT 'stub',
  reranker_backend TEXT NOT NULL DEFAULT 'disabled',
  model TEXT NULL,
  bench_fixture TEXT NOT NULL DEFAULT 'bench_43_full',
  applicability_mode TEXT NOT NULL DEFAULT 'off',
  coverage_statement JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_eval_result_json JSONB NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_evaluations__one_active
  ON v2_evaluations (project_id)
  WHERE status NOT IN ('completed','completed_with_errors','error');
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_evaluations__run_id_engine
  ON v2_evaluations (run_id_engine) WHERE run_id_engine IS NOT NULL;

CREATE TABLE IF NOT EXISTS v2_per_policy_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  policy_id TEXT NOT NULL,
  tier TEXT NULL,
  verdict_suggestion TEXT NULL,
  ai_suggestion TEXT NULL,
  confidence NUMERIC NULL,
  confidence_method TEXT NULL,
  summary TEXT NULL,
  evidence_packet JSONB NOT NULL DEFAULT '{}'::jsonb,
  pathway_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  rubric_self_score JSONB NULL,
  raw_result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_per_policy_results__eval_policy_stage_packet
  ON v2_per_policy_results (
    evaluation_id,
    policy_id,
    COALESCE(stage, ''),
    COALESCE(packet_id, '')
  );

-- Lane 2a per_policy adds stage + packet_id columns to support multi-stage
-- engine output (per codex v0.2 amendment).
ALTER TABLE v2_per_policy_results ADD COLUMN IF NOT EXISTS stage TEXT NULL;
ALTER TABLE v2_per_policy_results ADD COLUMN IF NOT EXISTS packet_id TEXT NULL;

ALTER TABLE v2_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_evaluations_owner_admin_all ON v2_evaluations;
CREATE POLICY v2_evaluations_owner_admin_all ON v2_evaluations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_evaluations.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_evaluations.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_per_policy_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_per_policy_results_owner_admin_all ON v2_per_policy_results;
CREATE POLICY v2_per_policy_results_owner_admin_all ON v2_per_policy_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_per_policy_results.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_per_policy_results.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON v2_evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_per_policy_results TO authenticated;
```

TypeScript types (in types_lane2.ts):
- EvaluationStatus union: 'pending' | 'running' | 'completed' | 'completed_with_errors' | 'error'.
- TERMINAL_EVALUATION_STATUSES.
- V2Evaluation row shape.
- V2PerPolicyResult row shape.
- EvalCoverageStatement, EvalProvenance interfaces.

Zod (in zod_lane2.ts):
- `EvalTriggerPayloadSchema` -- `{ extraction_run_id?: string }` optional (defaults to latest).
- `EvalStatusSyncPayloadSchema` -- `{ evaluation_id: string }`.

### L2a-2: evaluation trigger route

File allowlist:
- NEW `src/app/api/engine-v2/projects/[id]/evaluate/route.ts` (runtime=nodejs)
- NEW `src/lib/engine-v2/scenario_yaml.ts` (writes a scenario YAML string from project + extraction)
- NEW `src/lib/engine-v2/__tests__/scenario_yaml.test.ts`

Flow:
1. requireAdminForApi -> 401/403.
2. checkCsrf -> 415/403.
3. LOCAL_ENGINE_ENABLED -> 503.
4. Ownership probe v2_projects -> 403.
5. Find latest completed extraction: SELECT v2_extraction_runs WHERE project_id = $id AND status IN ('completed','completed_with_errors') ORDER BY started_at DESC LIMIT 1. If 0 rows: 400 `{error:'no_completed_extraction'}`.
6. Find verbatim JSON path: ls `<v2_dashboard_extracts>/<project_id>/` for the first `*.json` file. If none: 500 `{error:'no_extracted_json'}`.
7. Compose scenario YAML via `scenario_yaml.ts`. scenario_id = project.id (or evaluation.id). bench_fixture from env or 'bench_43_full'. evaluation_backend from env (default 'stub'). embedder_backend default 'stub'. extract_path = the verbatim JSON path.
8. INSERT v2_evaluations with status='pending', extraction_run_id=$row.id, evaluation_backend, embedder_backend, reranker_backend='disabled', bench_fixture. On 23505 against idx_v2_evaluations__one_active: re-SELECT existing non-terminal row, return 409 with `{evaluation_id, status}`.
9. Write scenario YAML to a temp file under `<v2_dashboard_eval_runs>/<eval_id>/scenario.yaml`. mkdir -recursive.
10. Spawn detached: `spawnExtractor`-style helper but for `run_owner_scenario.py`. Args: `--scenario-config <path> --output-dir <v2_dashboard_eval_runs>/<eval_id>/`. On spawn throw (ENOENT/EACCES via async error event): UPDATE row to status='error' + completed_at; 500. On success: UPDATE row to status='running'; return `{evaluation_id, status:'running'}` 200.

### L2a-3: evaluation status sync route

File allowlist:
- NEW `src/app/api/engine-v2/projects/[id]/evaluation-status/route.ts` (runtime=nodejs)
- NEW `src/lib/engine-v2/eval_result_import.ts` (imports eval_result.json into v2_evaluations + v2_per_policy_results)
- NEW `src/lib/engine-v2/__tests__/eval_result_import.test.ts`

Flow (POST per Finding 37 -- safe-GET-with-CSRF):
1. requireAdminForApi.
2. checkCsrf.
3. Zod parse EvalStatusSyncPayload.
4. Ownership probe.
5. SELECT v2_evaluations row by (project_id, evaluation_id). 404 if not found.
6. If status in TERMINAL: return as-is (no file read).
7. Look for `<v2_dashboard_eval_runs>/<eval_id>/<engine_run_id>/eval_result.json` -- walk the eval_id dir for any subdir containing eval_result.json (engine generates its own run_id).
8. If found AND status non-terminal:
   a. Read + parse eval_result.json.
   b. Import via `importEvalResult(client, evaluation_id, eval_result_json)`:
      - UPDATE v2_evaluations SET run_id_engine, variant_config_hash, coverage_statement, raw_eval_result_json, status, completed_at.
      - For each per_policy_results[]: INSERT INTO v2_per_policy_results ... ON CONFLICT (evaluation_id, policy_id) DO NOTHING (idempotent).
   c. Determine terminal status: 'completed' if errors empty, else 'completed_with_errors' or 'error'.
   d. Return latest row.
9. If not found AND now() - started_at > stale-timeout: UPDATE to status='error' + completed_at='Subprocess silent beyond timeout'. Return row.
10. Otherwise: return row as-is (UI continues polling).

### L2a-4: trigger button + status panel

File allowlist:
- NEW `src/components/engine-v2/EvaluateTriggerButton.tsx`
- NEW `src/components/engine-v2/EvaluationStatusPanel.tsx`
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/ProjectDetailClient.tsx`

EvaluateTriggerButton:
- Props: `{projectId, currentEval, latestExtractionStatus, onTriggerStart}`.
- Disabled if no completed extraction; disabled if non-terminal eval exists.
- Click -> POST /api/.../evaluate with {} body, Content-Type: application/json.
- Handles 200, 409 (existing run), 400 (no_completed_extraction), 503.

EvaluationStatusPanel:
- Props: `{projectId, evaluation, onPoll}`.
- Polls /evaluation-status at 3s interval; stop on terminal.
- Renders status badge, coverage statement, errors, completed_at, link to results page.

ProjectDetailClient additions:
- State: `currentEvaluation: V2Evaluation | null`.
- Server fetches latest evaluation alongside latest extraction in page.tsx.
- Renders new "Evaluation" + "Evaluation status" sections after the Extraction block.

### L2a-5: results viewer page

File allowlist:
- NEW `src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`
- NEW `src/components/engine-v2/PerPolicyResultsTable.tsx`

Page (Server Component):
- requireAdminForServerComponent.
- params.projectId, params.evalId (both Promises in Next 15).
- SELECT v2_evaluations + v2_per_policy_results joined.
- 404 if eval not found or not owned.
- Render header (project name + eval status badge + coverage statement).
- Render PerPolicyResultsTable.

PerPolicyResultsTable:
- Columns: Policy ID, Tier, Verdict, Confidence, Summary (truncated).
- Tier color-coded: TIER_1_BINARY green, TIER_2_PROFESSIONAL amber, TIER_3_STATUTORY red.
- Verdict badges: PASS / FAIL / NOT_FOUND / ESCALATE.
- Truncated summary with expand-on-click.

### L2a-6: dashboard landing link to evaluation

File allowlist:
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/ProjectDetailClient.tsx` (already in L2a-4)
- EDIT `src/components/engine-v2/EvaluationStatusPanel.tsx` (already in L2a-4)

Trigger panel shows "View results" link to `/dashboard/engine-v2/[projectId]/evaluation/[evalId]` once eval reaches terminal status.

### L2a-7: smoke + docs

File allowlist:
- NEW `docs/engine_v2_frontend_lane2a_smoke_2026_05_12.md`
- NEW `docs/engine_v2_frontend_lane2a_handoff_2026_05_12.md`

Smoke (happy path):
1. Sign in. Navigate to a project that has a completed extraction.
2. Click "Run evaluation". Expect 200 with status='running'.
3. Watch EvaluationStatusPanel transition running -> completed.
4. Click "View results". Verify per-policy table populates with verdict_suggestion + confidence + summary.
5. Verify coverage_statement matches eval_result.json values.

Handoff captures: Lane 2b open items (HITL, memo, multi-VERBATIM, telemetry sidebar, bench fixtures, evidence_items separation). Commit list. QA verdicts.

## Subagent file allowlists

| Module | Files |
|---|---|
| L2a-1 | schema SQL, types, Zod |
| L2a-2 | evaluate route, scenario_yaml.ts + test |
| L2a-3 | evaluation-status route, eval_result_import.ts + test |
| L2a-4 | EvaluateTriggerButton, EvaluationStatusPanel, ProjectDetailClient edit |
| L2a-5 | results page, PerPolicyResultsTable |
| L2a-7 | docs |

Sequencing:
- L2a-1 schema applied first (owner gate via Supabase SQL editor, mirrors Lane 1 EXIT GATE).
- L2a-2 + L2a-3 + L2a-5 can run in parallel after L2a-1 (disjoint allowlists; L2a-3 imports into tables L2a-1 created, L2a-5 reads from same tables).
- L2a-4 depends on L2a-2 (needs the routes) and L2a-3 (needs the routes).
- L2a-7 docs last.

## Verification (after each commit)
- `npx vitest run src/lib/engine-v2/__tests__/ src/app/api/engine-v2/`
- `npx tsc --noEmit`
- `npx eslint src/lib/engine-v2/ src/components/engine-v2/ src/app/api/engine-v2/`

## EXIT GATE (mirrors Lane 1)

Owner-action:
1. Confirm clean-slate via `SELECT to_regclass('public.v2_evaluations'), to_regclass('public.v2_per_policy_results');` -- both NULL.
2. Apply `supabase/engine_v2/database_schema_engine_v2_lane2a_patch.sql`.
3. Verify `REG_REVIEW_ENGINE_V2_SCRIPT_PATH` exists on disk.
4. Verify python at REG_REVIEW_PYTHON_PATH can import the engine_v2 module (pre-flight script run -- documented in smoke step 0).
5. Optional: set `REG_REVIEW_ENGINE_V2_BENCH_FIXTURE` env var.

## Budget

Lane 1 took roughly 90 minutes of focused work via parallel subagents. Lane 2a
is smaller in surface area (2 tables vs 3; 1 spawn route vs 1; 1 results page).
Realistic budget: **45-90 minutes** parallel implementation + ~15 min owner gate.

## Out of scope (Lane 2b, post-demo)

- Multi-VERBATIM merge across multiple submission files in a project.
- v2_evidence_items table separated from per-policy raw JSONB.
- v2_telemetry table with retrieval_index_mode, graph_drift, etc.
- v2_stage_models per-stage model tracking.
- HITL judgment UI (TIER_2 + TIER_3 reviewer paths).
- v2_judgments + v2_judgment_history tables.
- v2_memo_exports + Word MSO export.
- Bench fixtures UI.
- Reranker mode + pathway_notes_mode advanced configuration.
- Live Ollama backend toggle in UI (env-only in 2a).

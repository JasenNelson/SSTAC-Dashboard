# engine_v2 frontend Lane 2b (demo enrichment) plan v0.1 -- 2026-05-12

Authored 2026-05-12 after Lane 2a shipped (commits f18044c + d90b936). Lane 2b
takes the visible-but-skeletal per-policy results from Lane 2a and turns them
into a defensible HITL review surface: tier-aware judgments with append-only
audit, rich evidence/telemetry rendering, filter/sort, a Word memo export, and
an authorized live-backend opt-in toggle. Demo at ~1500 local on 2026-05-12.

Parent plans:
- `docs/engine_v2_frontend_lane1_plan_v7.19.md` (Lane 1, end-to-end ingest).
- `docs/engine_v2_frontend_lane2a_plan_2026_05_12.md` (Lane 2a, evaluate -> per-policy table).

This document is authored to pre-empt the obvious codex blocker classes from
Lane 1 and Lane 2a review:
- Tier-discretion enforced AT THE DB LEVEL via CHECK constraint (defense in
  depth: client UI disable -> server route guard -> DB constraint -> RLS).
- Judgment history is append-only by schema design (no UPDATE pathway exposed).
- Memo export idempotency via `content_sha256` + per-evaluation latest-only.
- All Lane 2b date formatting uses `toLocaleString("en-US", {...})` (Finding
  carried forward from Lane 1 commit af2f76a and Lane 2a regression guard).
- Polling single-flight pattern is not re-introduced (judgments are write-only
  RPCs; memo export is request-response; live toggle is per-trigger).
- RLS predicates mirror Lane 1 / Lane 2a exactly (project-ownership join +
  admin role probe).
- ASCII only across all artifacts.

---

## Backend contract carried forward from Lane 2a

Lane 2a `eval_result.json` fields surfaced into `v2_per_policy_results.raw_result_json`
and `v2_evaluations.raw_eval_result_json`:

- per_policy_results[]: policy_id, stage, packet_id, tier, ai_suggestion,
  verdict_suggestion, confidence, confidence_method, summary, evidence_packet,
  minority_findings, evidence_gaps, pathway_notes, tier_render_policy,
  stage_models, rubric_self_score, run_metadata.
- telemetry: graph_traversal_log_summary, errors, schema_class, variant,
  pathway_notes_mode, started_at, completed_at, committed_cohort,
  sandbox_db_path, graph_drift_warnings, strict_corpus_version,
  corpus_version_source, evidence_index_writes, retrieval_index_mode,
  corpus_indices_dir, bm25_manifest_corpus_version,
  chunk_policy_mapping_count, vector_indices_dir,
  vector_manifest_corpus_version, vector_index_mapping_count.
- provenance: corpus_version, graph_corpus_version, embedder_backend,
  reranker_backend, stages_run, git_sha_at_run.

Lane 2b reads these from the existing JSONB columns. No new engine ingest
plumbing is required; Lane 2b is a frontend + DB enrichment lane.

---

## Lane 2b scope (in -- demo today)

- L2b-1: schema patch -- `v2_judgments` + `v2_judgment_history` + `v2_memo_exports`.
- L2b-2: HITL judgment UI + API. Tier-aware enforcement.
- L2b-3: rich `evidence_packet` + `pathway_notes` rendering inside
  `PerPolicyResultsTable`. JSONB walker + collapsible sections.
  Surface `stage_models` + `minority_findings` + `evidence_gaps`.
- L2b-4: `TelemetrySidebar` component -- provenance + selected telemetry.
- L2b-5: filter + sort UX on results table (tier, verdict, confidence threshold).
- L2b-6: memo export -- Word `.docx` via API route.
- L2b-7: live/stub backend selector in `EvaluateTriggerButton`.

## Lane 2b scope (out -- deferred to Lane 2c, post-demo)

- Multi-file projects + `v2_evidence_items` separation + multi-VERBATIM merge.
- Policy KB linking (link `policy_id` to a KB viewer page; requires cross-project
  policy registry access -- deferred).
- Bench fixtures management UI.
- Reranker mode + pathway_notes_mode deep config UI.
- `v2_telemetry` table (Lane 2b reads from `raw_eval_result_json.telemetry`).
- `v2_stage_models` per-stage model tracking table.
- Judgment workflows for non-admin reviewers / multi-reviewer concurrency.
- Memo export storage-bucket promotion for projects > demo scale.

---

## Engineering Decisions

### ED-2b-1: Tier-discretion enforcement is server-side AND DB-level

Per `CLAUDE.md`:
- TIER_1_BINARY -> AI may return adequacy; HITL may judge ADEQUATE/INADEQUATE/
  DEFICIENT/REQUIRES_REVIEW.
- TIER_2_PROFESSIONAL -> AI flags deficiencies only; HITL may judge DEFICIENT /
  REQUIRES_REVIEW -- **NEVER ADEQUATE**. DB trigger ABORTS if violated.
- TIER_3_STATUTORY -> Observation only; HITL judgment fixed at OBSERVATION_ONLY.

`v2_judgments` has a CHECK constraint mirroring these rules (see L2b-1 schema).
Server-side `/judgments` POST route validates payload against the same enum
table before INSERT. Client UI disables disallowed verdict buttons. Triple
defense in depth.

### ED-2b-2: Judgment history is append-only

Schema design: `v2_judgments` is the LIVE state (one row per per_policy_result).
Every edit BEFORE overwrite copies the prior values into `v2_judgment_history`
via a BEFORE-UPDATE trigger. The route only accepts INSERT-or-UPDATE; DELETE is
not exposed. Audit trail preserved.

### ED-2b-3: Memo export is server-side generation

API route `POST /api/engine-v2/projects/[id]/evaluation/[evalId]/memo` generates
a `.docx` via the `docx` npm library. Storage at Lane 2b is **inline blob** in
`v2_memo_exports.content_blob` bytea (demo scale, single-digit MB). Promotion to
storage bucket `v2-memos` is Lane 2c. Idempotency via `content_sha256` + a
`judgment_snapshot_hash` so re-generation after a judgment change produces a
new row rather than overwriting. The latest row per evaluation is served.

### ED-2b-4: Live backend toggle is per-evaluation, not persistent

`EvaluateTriggerButton` lets the reviewer pick `evaluation_backend = 'stub' |
'live'` for the next trigger only. Default `stub`. Live requires a preflight:
`/api/engine-v2/projects/[id]/evaluate` checks `OLLAMA_URL` (default
`http://localhost:11434`) is reachable; if not, the route rejects with 503
`{error:'live_backend_unavailable'}`. The choice is recorded in
`v2_evaluations.evaluation_backend` (already present, set by Lane 2a default).

### ED-2b-5: Locale-locked everywhere (regression guard)

All Lane 2b date / number / boolean formatters use:
- `toLocaleString("en-US", {...})` for dates.
- `Intl.NumberFormat("en-US", ...)` for numbers.

Shared helpers in `src/lib/engine-v2/format.ts` (already established by Lane 1
hotfix at commit af2f76a; reused, not duplicated). NON-DROPPABLE.

### ED-2b-6: Re-uses Lane 1 + Lane 2a foundation

No new utilities unless explicitly listed in a module's file allowlist.
Specifically reused:
- `requireAdminForApi` + `requireAdminForServerComponent` -- auth wrappers.
- `checkCsrf` -- 415/403 on non-JSON POSTs.
- `path_containment.ts` -- not needed (no filesystem writes in Lane 2b except
  memo export bytea blob).
- `format.ts` -- date / number formatters.
- Lane 2a `types_lane2.ts` and `zod_lane2.ts` -- appended to, not duplicated.
- `EvaluationStatusPanel` polling pattern (`useRef` handle, `inFlightRef`
  boolean, cleanup on unmount) -- reused if memo-export status surfaces; for
  Lane 2b, memo generation is synchronous (< 5s for 43-policy bench).

### ED-2b-7: Judgments and memos are admin-only

RLS predicates on all three Lane 2b tables join through parent
`v2_per_policy_results` -> `v2_evaluations` -> `v2_projects` and check
`p.user_id = auth.uid()` AND admin role. Identical to Lane 2a pattern.

### ED-2b-8: Filter / sort is client-side

`PerPolicyResultsTable` receives the full 43-row dataset (small enough for
client-side filtering). Filter state lives in component state; URL query params
optional in Lane 2c. No server round-trip per filter change.

---

## Module breakdown

### L2b-1: schema patch + types + Zod

File allowlist:
- NEW `supabase/engine_v2/database_schema_engine_v2_lane2b_patch.sql`
- EDIT `src/lib/engine-v2/types_lane2.ts` (append judgment + memo types)
- EDIT `src/lib/engine-v2/zod_lane2.ts` (append judgment + memo schemas)

Schema (idempotent):

```sql
CREATE TABLE IF NOT EXISTS v2_judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  per_policy_result_id UUID NOT NULL REFERENCES v2_per_policy_results(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tier TEXT NOT NULL,
  verdict TEXT NOT NULL,
  rationale TEXT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT v2_judgments_tier_verdict_check CHECK (
    (tier = 'TIER_1_BINARY'
      AND verdict IN ('ADEQUATE','INADEQUATE','DEFICIENT','REQUIRES_REVIEW')) OR
    (tier = 'TIER_2_PROFESSIONAL'
      AND verdict IN ('DEFICIENT','REQUIRES_REVIEW')) OR
    (tier = 'TIER_3_STATUTORY'
      AND verdict = 'OBSERVATION_ONLY')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_judgments__one_per_result
  ON v2_judgments (per_policy_result_id);
CREATE INDEX IF NOT EXISTS idx_v2_judgments__per_policy_created
  ON v2_judgments (per_policy_result_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v2_judgment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judgment_id UUID NOT NULL REFERENCES v2_judgments(id) ON DELETE CASCADE,
  prior_verdict TEXT NULL,
  prior_rationale TEXT NULL,
  prior_evidence_refs JSONB NULL,
  changed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_judgment_history__judgment_changed
  ON v2_judgment_history (judgment_id, changed_at DESC);

-- BEFORE UPDATE trigger: copy prior to history, refresh updated_at
CREATE OR REPLACE FUNCTION v2_judgments_history_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.verdict IS DISTINCT FROM NEW.verdict
      OR OLD.rationale IS DISTINCT FROM NEW.rationale
      OR OLD.evidence_refs IS DISTINCT FROM NEW.evidence_refs) THEN
    INSERT INTO v2_judgment_history
      (judgment_id, prior_verdict, prior_rationale, prior_evidence_refs, changed_by_user_id)
    VALUES
      (OLD.id, OLD.verdict, OLD.rationale, OLD.evidence_refs, auth.uid());
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS v2_judgments_history_before_update ON v2_judgments;
CREATE TRIGGER v2_judgments_history_before_update
  BEFORE UPDATE ON v2_judgments
  FOR EACH ROW EXECUTE FUNCTION v2_judgments_history_trigger();

CREATE TABLE IF NOT EXISTS v2_memo_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  generator_version TEXT NOT NULL,
  judgment_snapshot_hash TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  storage_path TEXT NULL,
  content_blob BYTEA NULL,
  byte_size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT v2_memo_exports_content_present CHECK (
    (storage_path IS NOT NULL) OR (content_blob IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_v2_memo_exports__eval_created
  ON v2_memo_exports (evaluation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_memo_exports__eval_snapshot
  ON v2_memo_exports (evaluation_id, judgment_snapshot_hash);

-- RLS (mirrors Lane 2a per-admin-owner pattern)
ALTER TABLE v2_judgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_judgments_owner_admin_all ON v2_judgments;
CREATE POLICY v2_judgments_owner_admin_all ON v2_judgments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_per_policy_results r
      JOIN v2_evaluations e ON e.id = r.evaluation_id
      JOIN v2_projects p ON p.id = e.project_id
      WHERE r.id = v2_judgments.per_policy_result_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_per_policy_results r
      JOIN v2_evaluations e ON e.id = r.evaluation_id
      JOIN v2_projects p ON p.id = e.project_id
      WHERE r.id = v2_judgments.per_policy_result_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_judgment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_judgment_history_owner_admin_select ON v2_judgment_history;
CREATE POLICY v2_judgment_history_owner_admin_select ON v2_judgment_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_judgments j
      JOIN v2_per_policy_results r ON r.id = j.per_policy_result_id
      JOIN v2_evaluations e ON e.id = r.evaluation_id
      JOIN v2_projects p ON p.id = e.project_id
      WHERE j.id = v2_judgment_history.judgment_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
-- history INSERT is trigger-only; no INSERT/UPDATE/DELETE policies exposed to users

ALTER TABLE v2_memo_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_memo_exports_owner_admin_all ON v2_memo_exports;
CREATE POLICY v2_memo_exports_owner_admin_all ON v2_memo_exports FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_memo_exports.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_memo_exports.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE ON v2_judgments TO authenticated;
GRANT SELECT ON v2_judgment_history TO authenticated;
GRANT SELECT, INSERT, DELETE ON v2_memo_exports TO authenticated;
```

TypeScript types (append to `types_lane2.ts`):
- `JudgmentVerdict` union per tier (`TierVerdictMap` helper).
- `V2Judgment`, `V2JudgmentHistoryRow`, `V2MemoExport` row shapes.
- `ALLOWED_VERDICTS_BY_TIER: Record<Tier, readonly Verdict[]>` -- mirrors CHECK.

Zod (append to `zod_lane2.ts`):
- `JudgmentUpsertPayloadSchema` = `{ per_policy_result_id, verdict, rationale?,
  evidence_refs? }`. Refined: verdict must be in `ALLOWED_VERDICTS_BY_TIER[tier]`
  (tier resolved server-side from the per_policy_result row before refine -- so
  refine is just enum-membership; tier check happens in the route).
- `MemoExportPayloadSchema` = `{}` (request is empty; route resolves evaluation
  and snapshot itself).

Test requirements:
- NEW `src/lib/engine-v2/__tests__/judgment_validation.test.ts` -- verifies
  `ALLOWED_VERDICTS_BY_TIER` matches CLAUDE.md spec; verifies the constant is
  in sync with the SQL CHECK string (regex-extract from the patch file).

Constraints:
- Single migration file. Idempotent. No DROP TABLE.
- ASCII only.

### L2b-2: HITL judgment UI + API

File allowlist:
- NEW `src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/judgments/route.ts` (runtime=nodejs)
- NEW `src/components/engine-v2/JudgmentEditor.tsx`
- NEW `src/components/engine-v2/JudgmentHistoryDrawer.tsx`
- NEW `src/lib/engine-v2/tier_discretion.ts` (export `ALLOWED_VERDICTS_BY_TIER`,
  `assertVerdictAllowed(tier, verdict)`)
- NEW `src/lib/engine-v2/__tests__/tier_discretion.test.ts`
- EDIT `src/components/engine-v2/PerPolicyResultsTable.tsx` (add Judgment
  column + expand-row to show JudgmentEditor)

API flow (POST):
1. `requireAdminForApi` -> 401/403.
2. `checkCsrf` -> 415/403.
3. Zod parse `JudgmentUpsertPayloadSchema`.
4. SELECT `v2_per_policy_results` by id (also probe ownership via join). 404 if
   not found or not owned.
5. Resolve `tier` from the per_policy_results row.
6. `assertVerdictAllowed(tier, payload.verdict)` -- throws 422
   `{error:'verdict_not_allowed_for_tier', tier, verdict}` on mismatch.
7. UPSERT into `v2_judgments` ON CONFLICT (per_policy_result_id) DO UPDATE
   (BEFORE UPDATE trigger writes prior to history).
8. Return the latest `v2_judgments` row.

API flow (GET):
- Query string `?per_policy_result_id=<uuid>` -- returns the live judgment +
  history rows (sorted desc).

JudgmentEditor:
- Props: `{perPolicyResultId, tier, currentJudgment, onSave}`.
- Shows tier-allowed verdict buttons only -- disables disallowed ones with
  tooltip "Not permitted for {tier}".
- TIER_3_STATUTORY: shows OBSERVATION_ONLY only; rationale required (>= 10
  chars) before save.
- Rationale textarea.
- On submit -> POST /judgments; on 422 surface a banner with the rejected
  verdict + tier.
- Indigenous content reminder banner if `tier === 'TIER_3_STATUTORY'`:
  "Per CLAUDE.md: TIER_3 reflects Section 35 constitutional rights and DRIPA
  commitments. AI cannot evaluate adequacy."

JudgmentHistoryDrawer:
- Lazy-fetches GET on open.
- Shows changed_at + prior_verdict + prior_rationale per row.
- Locale-locked dates.

PerPolicyResultsTable edit:
- New column "Judgment" -- shows current verdict pill OR "Not yet judged".
- Expand-row reveals JudgmentEditor inline; second click closes.
- Sort by judgment status (judged vs unjudged) included in L2b-5.

Test requirements:
- `tier_discretion.test.ts` -- exhaustive enum coverage.
- API integration test in `src/app/api/engine-v2/__tests__/judgments.test.ts`
  -- 422 path for TIER_2 + ADEQUATE; 200 happy path; 403 cross-owner; 415 CSRF
  reject.

Constraints:
- Indigenous tier banner is hardcoded text from CLAUDE.md (no i18n).
- ASCII only.

### L2b-3: rich evidence_packet + pathway_notes rendering

File allowlist:
- NEW `src/components/engine-v2/EvidencePacketView.tsx`
- NEW `src/components/engine-v2/PathwayNotesView.tsx`
- NEW `src/components/engine-v2/StageModelsView.tsx`
- NEW `src/components/engine-v2/MinorityFindingsView.tsx`
- NEW `src/lib/engine-v2/jsonb_walker.ts` (recursive collapsible JSON renderer)
- NEW `src/lib/engine-v2/__tests__/jsonb_walker.test.ts`
- EDIT `src/components/engine-v2/PerPolicyResultsTable.tsx` (use components in
  the expand-row alongside JudgmentEditor)

Flow / behavior:
- Expand-row shows a tabbed panel:
  1. Summary + AI suggestion (already in Lane 2a).
  2. Evidence packet (EvidencePacketView).
  3. Pathway notes (PathwayNotesView).
  4. Stage models (StageModelsView).
  5. Minority findings + evidence gaps (MinorityFindingsView).
  6. Judgment (JudgmentEditor from L2b-2).

EvidencePacketView:
- Input: `evidence_packet: JSONB` (may be `{}` in stub mode).
- If empty: shows "No evidence packet emitted by this stage (stub backend or
  schema gap)." -- regression-safe text.
- Otherwise: uses `jsonb_walker.ts` for collapsible recursive rendering.
- Detects known shapes (chunk arrays with `text` + `source_ref`) and renders
  them as cards with text excerpt + source link if a viewer URL is known
  (Lane 2c expands this).

PathwayNotesView:
- Renders `pathway_notes` JSONB. Same walker.
- If `tier_render_policy === 'TIER_3_STATUTORY'` -- prepend an Indigenous tier
  banner identical to JudgmentEditor.

StageModelsView:
- Renders `stage_models` (per-stage model identifiers). Table form.

MinorityFindingsView:
- Renders `minority_findings[]` and `evidence_gaps[]` as bulleted lists.
- Empty arrays -> "No minority findings recorded." / "No evidence gaps recorded.".

jsonb_walker:
- Pure component. Props: `{value, depth=0, maxDepth=8}`.
- Renders objects as `<details>` accordions; arrays as ordered lists with
  index labels; primitives inline.
- Truncates strings > 500 chars with click-to-expand.
- No external deps.
- 100% covered by unit tests (objects, arrays, primitives, nulls, deep
  nesting, mixed types).

Test requirements:
- `jsonb_walker.test.ts` -- snapshot tests for each shape.

Constraints:
- No `react-json-view` or similar libs (bundle size + ASCII concerns).
- All formatting locale-locked.

### L2b-4: TelemetrySidebar component

File allowlist:
- NEW `src/components/engine-v2/TelemetrySidebar.tsx`
- NEW `src/lib/engine-v2/telemetry_select.ts` (pure function that picks the
  Lane 2b-relevant fields from `raw_eval_result_json`)
- NEW `src/lib/engine-v2/__tests__/telemetry_select.test.ts`
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`
  (render TelemetrySidebar alongside PerPolicyResultsTable)

Flow / behavior:
- TelemetrySidebar receives `{provenance, telemetrySelected}` props.
- Renders two sections:
  1. Provenance: `corpus_version`, `git_sha_at_run`, `embedder_backend`,
     `reranker_backend`, `stages_run` (comma-joined).
  2. Telemetry: `graph_drift_warnings` (count + first 3 messages),
     `retrieval_index_mode`, `chunk_policy_mapping_count`,
     `vector_index_mapping_count`, `pathway_notes_mode`, `schema_class`,
     `variant`, `started_at`, `completed_at`.
- Drift warnings rendered with a warning pill if count > 0.
- Locale-locked timestamp formatting.
- Collapsible on small screens.

telemetry_select:
- Pure function. Input `raw_eval_result_json: unknown`. Output the typed
  selection. Defensive: missing fields render as "n/a".
- Zod-parses defensively (so a malformed eval_result.json does not crash the
  page).

Test requirements:
- `telemetry_select.test.ts` -- happy path, empty telemetry, partial fields.

Constraints:
- Locale-locked dates.
- No filesystem reads (page already has the JSONB in memory).

### L2b-5: filter + sort UX on results table

File allowlist:
- NEW `src/components/engine-v2/ResultsToolbar.tsx`
- NEW `src/lib/engine-v2/results_filter.ts` (pure filter+sort fn)
- NEW `src/lib/engine-v2/__tests__/results_filter.test.ts`
- EDIT `src/components/engine-v2/PerPolicyResultsTable.tsx` (consume toolbar
  state)

Flow / behavior:
- ResultsToolbar exposes:
  - Tier filter -- multi-select: TIER_1_BINARY / TIER_2_PROFESSIONAL /
    TIER_3_STATUTORY / null (uncategorized).
  - Verdict filter -- multi-select: PASS, FAIL, NOT_FOUND, ESCALATE,
    OBSERVATION_ONLY, null.
  - Confidence threshold -- range slider 0.0-1.0 (filters to rows with
    confidence >= threshold; null confidence always passes).
  - Judgment status -- all / judged / unjudged.
  - Sort by -- policy_id (asc/desc) | confidence (asc/desc) | tier | verdict.
- Toolbar state is component state (lifted to PerPolicyResultsTable).
- `results_filter.ts` is the pure function (results, toolbarState) -> filtered
  + sorted results.

Test requirements:
- `results_filter.test.ts` -- coverage of each filter axis + composite filter.

Constraints:
- No URL query-param sync (Lane 2c).
- No server round-trip per filter change.
- ASCII only.

### L2b-6: memo export -- Word .docx download

File allowlist:
- NEW `src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/memo/route.ts` (runtime=nodejs)
- NEW `src/lib/engine-v2/memo_builder.ts` (pure: judgments + per-policy + eval
  -> docx Buffer)
- NEW `src/lib/engine-v2/__tests__/memo_builder.test.ts`
- NEW `src/components/engine-v2/ExportMemoButton.tsx`
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`
  (render ExportMemoButton)
- EDIT `package.json` (add `docx` dependency, current stable version)

API flow (POST):
1. `requireAdminForApi`.
2. `checkCsrf`.
3. Ownership probe v2_evaluations -> 403.
4. SELECT eval + all per_policy + all judgments (join).
5. Compute `judgment_snapshot_hash` = sha256(sorted list of judgment ids +
   verdicts + updated_at).
6. SELECT v2_memo_exports WHERE evaluation_id = $id AND judgment_snapshot_hash
   = $hash. If found and `content_blob` non-null, return the existing blob.
7. Otherwise: `memo_builder.build({eval, perPolicy, judgments})` ->
   `Buffer<docx>`. Compute `content_sha256`.
8. INSERT v2_memo_exports with `generator_version='lane2b-v1'`,
   `judgment_snapshot_hash`, `content_sha256`, `content_blob`, `byte_size`.
   On 23505 (unique snapshot+eval) -- re-SELECT the existing row.
9. Return `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   stream with `Content-Disposition: attachment; filename="memo-<eval_id_short>.docx"`.

memo_builder.build:
- Pure function (returns Buffer; no DB access).
- Layout:
  - Title: "Regulatory Review -- Evaluation Memo".
  - Project name + evaluation id + completed_at (locale-locked).
  - Coverage statement table (total / evaluated / deferred / error).
  - For each tier section in order TIER_1_BINARY -> TIER_2_PROFESSIONAL ->
    TIER_3_STATUTORY:
    - Table: Policy ID | AI suggestion | Confidence | HITL Verdict | Rationale.
  - Per CLAUDE.md tier discretion: TIER_2 rows never show "ADEQUATE";
    TIER_3 rows show only "OBSERVATION_ONLY" -- enforced by the
    `assertVerdictAllowed` invariant upstream (DB CHECK + route guard +
    UI disable).
  - Provenance footer: corpus_version + git_sha_at_run +
    "Generated by lane2b-v1, locale en-US".

ExportMemoButton:
- POSTs to memo route; on 200 streams the blob to a download.
- Disabled while in-flight; shows "Generating..." text.
- Errors surface inline with status code.

Test requirements:
- `memo_builder.test.ts` -- mocked eval + judgments fixture; asserts:
  - Docx Buffer is non-empty.
  - TIER_2 section never contains an "ADEQUATE" cell (regression guard for
    ED-2b-1).
  - TIER_3 section verdict cells contain only "OBSERVATION_ONLY".
  - Coverage statement values match input.

Constraints:
- No external API calls.
- Buffer < 2 MB for 43-policy bench (Lane 2b demo scope).
- ASCII only in generated text (memo title, headers).

### L2b-7: live/stub backend selector in EvaluateTriggerButton

File allowlist:
- EDIT `src/components/engine-v2/EvaluateTriggerButton.tsx` (add backend toggle)
- EDIT `src/app/api/engine-v2/projects/[id]/evaluate/route.ts` (accept body
  `{evaluation_backend?: 'stub' | 'live'}` + live preflight)
- EDIT `src/lib/engine-v2/zod_lane2.ts` (extend `EvalTriggerPayloadSchema`)
- NEW `src/lib/engine-v2/ollama_preflight.ts` (probe `OLLAMA_URL/api/tags` with
  2s timeout)
- NEW `src/lib/engine-v2/__tests__/ollama_preflight.test.ts` (mocked fetch)

Flow / behavior:
- Toggle in EvaluateTriggerButton: "Backend" radio = stub | live; defaults to
  `ENGINE_V2_EVAL_BACKEND_DEFAULT` env value as surfaced via page props.
- Live mode shows a small warning: "Live mode runs Ollama locally and takes
  longer."
- Client POSTs `{evaluation_backend: 'live'}` if live selected.
- Server validates payload, runs `ollamaPreflight()` if live, rejects with
  503 `{error:'live_backend_unavailable'}` if probe fails.
- On success, writes `evaluation_backend: 'live'` into the scenario YAML and
  `v2_evaluations.evaluation_backend` row.

ollama_preflight:
- `fetch(`${OLLAMA_URL}/api/tags`, {signal: AbortSignal.timeout(2000)})`.
- Returns boolean; logs `console.warn` on failure (no throw).
- `OLLAMA_URL` defaults to `http://localhost:11434`.

Test requirements:
- `ollama_preflight.test.ts` -- mocked fetch (200 -> true, network error ->
  false, timeout -> false).

Constraints:
- Live mode is reviewer-authorized per evaluation; no persistent flag.
- Locale-locked timestamps in any new UI.
- ASCII only.

---

## Subagent file allowlists

| Module | Files |
|---|---|
| L2b-1 | schema SQL, types append, zod append |
| L2b-2 | judgments route, JudgmentEditor, JudgmentHistoryDrawer, tier_discretion, PerPolicyResultsTable edit |
| L2b-3 | EvidencePacketView, PathwayNotesView, StageModelsView, MinorityFindingsView, jsonb_walker, PerPolicyResultsTable edit |
| L2b-4 | TelemetrySidebar, telemetry_select, evaluation page edit |
| L2b-5 | ResultsToolbar, results_filter, PerPolicyResultsTable edit |
| L2b-6 | memo route, memo_builder, ExportMemoButton, evaluation page edit, package.json |
| L2b-7 | EvaluateTriggerButton edit, evaluate route edit, zod edit, ollama_preflight |

Sequencing:
- L2b-1 schema applied first (owner gate via Supabase SQL editor).
- L2b-2, L2b-3, L2b-4, L2b-5 can run in parallel after L2b-1 (different files;
  PerPolicyResultsTable.tsx is edited by L2b-2, L2b-3, L2b-5 -- subagents must
  serialize via the orchestrator merging PerPolicyResultsTable changes last,
  OR each subagent emits a patch fragment and the orchestrator merges).
- L2b-6 depends on L2b-2 (memo reads judgments).
- L2b-7 is independent; can run any time after L2b-1.

Merge strategy for `PerPolicyResultsTable.tsx` (edited by 3 modules):
- L2b-2 adds Judgment column + JudgmentEditor expand-row.
- L2b-3 adds the tabbed expand-row layout.
- L2b-5 consumes ResultsToolbar state for filter+sort.
- Orchestrator implements PerPolicyResultsTable LAST as a single coherent
  component after the supporting components from L2b-2/L2b-3/L2b-5 land.

---

## Verification (after each commit)

- `npx vitest run src/lib/engine-v2/__tests__/ src/app/api/engine-v2/`
- `npx tsc --noEmit`
- `npx eslint src/lib/engine-v2/ src/components/engine-v2/ src/app/api/engine-v2/`
- Spot-check: open the evaluation page, click expand on a row, verify tabs
  render; click Judgment, verify tier-disallowed verdicts are disabled;
  click "Export memo", verify a .docx downloads.

---

## EXIT GATE for Lane 2b

Owner action (before subagents start):
1. Confirm clean-slate: `SELECT to_regclass('public.v2_judgments'),
   to_regclass('public.v2_judgment_history'), to_regclass('public.v2_memo_exports');`
   -- all three NULL.
2. Apply `supabase/engine_v2/database_schema_engine_v2_lane2b_patch.sql`.
3. Verify trigger present: `SELECT tgname FROM pg_trigger WHERE tgname =
   'v2_judgments_history_before_update';`.
4. Verify CHECK constraint: insert TIER_2 + ADEQUATE via SQL editor; expect
   row-level CHECK ABORT.
5. Optional: set `OLLAMA_URL` env var if testing live preflight.

After implementation:
1. Vitest, tsc, eslint all green.
2. Smoke: judge a TIER_1 row ADEQUATE; judge a TIER_2 row attempt ADEQUATE ->
   422; judge a TIER_3 row -> OBSERVATION_ONLY only. Export memo; open in
   Word; verify tier ordering and absence of ADEQUATE in TIER_2 section.
3. Confirm telemetry sidebar renders provenance + drift warnings.
4. Confirm filter+sort works on confidence threshold and tier multi-select.
5. Live preflight smoke (optional): stop Ollama, click Live, expect 503
   banner.

---

## Codex pre-emption checklist

| Risk class | Lane 2b control |
|---|---|
| Tier-discretion drift | CHECK constraint + route guard + UI disable + memo regression test |
| Append-only audit not enforced | BEFORE-UPDATE trigger + no DELETE policy + history is SELECT-only |
| Memo idempotency missing | unique (evaluation_id, judgment_snapshot_hash) + content_sha256 + per-eval latest |
| Hydration mismatch | All dates via `toLocaleString("en-US", ...)` shared helper |
| Polling single-flight regression | No new polling loops in Lane 2b; memo is sync; judgments are write-only |
| RLS drift | Predicates copied from Lane 2a; explicit project-ownership join + admin role probe |
| Live backend unavailable failure mode | ollama_preflight 2s timeout + 503 with clear error code |
| ASCII discipline | ASCII-only across SQL, TSX, MD; tests assert no smart quotes in memo output |
| Subagent file collisions | PerPolicyResultsTable.tsx merge handled by orchestrator last |
| Zod payload tightening | EvalTriggerPayloadSchema extended; JudgmentUpsertPayloadSchema strict |

---

## Budget

Lane 1 ~ 90 min parallel subagents. Lane 2a ~ 45-60 min. Lane 2b is wider
surface than 2a (7 modules vs 7, but two of them -- memo + judgments -- are
non-trivial) and shares the parallelism profile. Realistic budget:
**90-150 minutes** parallel implementation + ~10 min owner gate. Demo at
1500 local provides ~5 hour runway from authoring.

---

## Out of scope (Lane 2c, post-demo)

- Multi-file projects + v2_evidence_items separation + multi-VERBATIM merge.
- Policy KB linking (link policy_id to a KB viewer page).
- Bench fixtures management UI.
- Reranker mode + pathway_notes_mode deep config UI.
- v2_telemetry table (Lane 2b reads from raw_eval_result_json.telemetry).
- v2_stage_models per-stage model tracking table.
- Memo export storage-bucket promotion.
- URL query-param sync for results filter state.
- Non-admin reviewer workflows + multi-reviewer concurrency.
- Eval-run-dir janitor (reap old eval dirs by age).

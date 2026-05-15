# Engine_v2 Frontend Build - Narrow Vertical Slice (Lane 1 today) + Queued Lane 2 - v6

## Context

Engine_v2 backend complete (master `6f125686`). Build fresh v2 frontend within existing SSTAC-Dashboard Next.js app at `/dashboard/engine-v2/`. Owner: "fresh webpage informed by but NOT using v1's infrastructure directly; high attention to detail; zero assumptions."

Revision history: 3 codex MCP rounds + 4 Opus rounds (7 total). Codex Round 5 found 10 blockers; codex Round 6 found 8 more after v5 revision. Plan v6 addresses all 8 v6 blockers + retains all v5 closures.

### v6 findings incorporated (all confirmed against actual v1 source)

- **Status enum incomplete**: `dashboard_extract.py:543` emits `completed_with_errors` as a terminal status; v1 extract-status route at `src/app/api/regulatory-review/projects/[id]/extract-status/route.ts:68` declares `TERMINAL_STATUSES = ['completed', 'completed_with_errors', 'error']`. v5 enum was missing `completed_with_errors`. Also `currentFile` field at `dashboard_extract.py:59` was absent from schema.
- **run_id not in schema but referenced**: v5's L1-6 said poll `?run_id=<run_id>` and update by `(project_id, run_id)` but `v2_extraction_runs` only has `id`. Resolution: `v2_extraction_runs.id` IS the canonical run_id; poll path uses `?run_id=<v2_extraction_runs.id>`; update by `(project_id, id)`.
- **Stale-timeout detection missing**: detached pythonw.exe subprocess can crash silently. v1 handles this at `extract-status/route.ts:32` with `DEFAULT_EXTRACT_STALE_TIMEOUT_MS = 30*60*1000` + env override + stale-to-error transition; terminal statuses don't trigger stale. v5 omitted; v6 replicates.
- **Orphan cleanup RLS gap**: v5 had INSERT + SELECT for `storage.objects` but no DELETE policy; client-supplied storage path was trusted. v6 adds DELETE RLS with split_part ownership check; orphan endpoint takes `(project_id, file_id)` and SERVER re-derives expected path.
- **Memory-buffering risk**: `supabase.storage.download()` buffers entire file as Blob. v6 explicitly bans it; mandates Web Streams `fetch(signedUrl).body.getReader()` for SHA256 + Node `fs.createWriteStream` for local materialization.
- **gitignore for v2 outputs**: engine_v2 `.gitignore` (verified) doesn't currently include v2 dashboard paths. v6 Module L1-6 allowlist includes `.gitignore` edit.
- **Schema patch missing GRANTs**: `database_schema.sql:903-907` grants ALL TABLES; a standalone v2 patch may not pick up the broad grant unless it re-runs. v6 Module L1-1 patch SQL re-issues the all-tables grant at end.
- **Admin vs owner model**: v6 picks Model A: admin-gated entry (every v2 route requires admin) + per-admin owner of their own projects (no cross-admin sharing in Lane 1). RLS uses owner-only pattern; admin override SELECT removed for Lane 1 (admins are owners of their own data).

### Other v6 corrections

- TUS `x-upsert`: omit by default (overwriting NOT desired); Supabase docs state default is no overwrite when header absent. v5 set `x-upsert: false` explicitly which is harmless but unnecessary; v6 omits.
- Output dir contradiction: extractor spawned with `--output-dir <v2_dashboard_extracts/<project_id>/>` directly; NO post-completion move step. Cleanup deletes upload-side staging only; extracts dir retained.
- Triage protects Zod filename/path validators (security-critical; cannot drop).
- `/files/complete` duplicate SHA semantic: return existing v2_submission_files row + DELETE the newly uploaded duplicate Storage object (avoid orphaned bytes).
- Rename "stub-mode smoke" to "local extraction smoke" (Lane 1 has no evaluation).
- `currentFile` field added to UI + schema + parser + tests.

### Verified v1 ground truth

- `schedule3.ts` exports: `SERVICES`, `LIFECYCLE_STAGES`, `Schedule3Service`, `LifecycleStage`, `LifecycleStageInfo`, `getServicesByStage()`, `getServiceById()`. NO `SCHEDULE_3` export.
- `dashboard_extract.py` status JSON: `status`, `totalFiles`, `completedFiles`, `currentFile`, `progress`, `errors`, `updatedAt`, optional `chunkProgress`. Status values: `pending`, `extracting`, `completed`, `completed_with_errors`, `error`. Terminal: completed, completed_with_errors, error.
- v1 extract-status route stale detection: `EXTRACT_STALE_TIMEOUT_MS` env (default 30 min); compares `updatedAt` against `Date.now()`; transitions stale -> error if exceeded; terminal statuses skip stale check.
- `database_schema.sql:903-907`: broad `GRANT ... ON ALL TABLES IN SCHEMA public TO authenticated` + INSERT/UPDATE/DELETE + sequences.
- Route shell: `src/app/(dashboard)/dashboard/<segment>/page.tsx`.
- Auth helper: `src/lib/supabase-auth.ts:34` `createAuthenticatedClient()`.
- Admin guard: `src/lib/api-guards.ts` `requireAdmin()` + `LOCAL_ENGINE_ENABLED` pattern.
- v1 extractor: `C:/Projects/Regulatory-Review/engine/scripts/dashboard_extract.py`.
- Engine_v2 canonical: `C:/Projects/Regulatory-Review-worktrees/engine-v2/engine_v2/` (master `6f125686`).

## Owner Decisions (locked)

1. Database: Supabase Postgres.
2. URL: `/dashboard/engine-v2/` (files at `src/app/(dashboard)/dashboard/engine-v2/`).
3. Two-lane delivery: Lane 1 today; Lane 2 queued.
4. Vocabulary: `SERVICES` + `LIFECYCLE_STAGES` from v1 `schedule3.ts`.
5. Access model: Lane 1 admin-gated entry; each admin owns own projects (no cross-admin sharing).

## Engineering Decisions (v6)

- Schema delivery: `database_schema_engine_v2_patch.sql` standalone, including table DDL + RLS on app tables + RLS on `storage.objects` (INSERT/SELECT/DELETE) + all-tables grant re-run at end.
- Status ingestion: poll-route upsert only. v1-style stale detection.
- Staging dirs (under engine_v2 worktree):
  - `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/<project_id>/` (transient input materialization; delete on extraction terminal-success; quarantine on error).
  - `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_extracts/<project_id>/` (extractor `--output-dir`; persistent; retained for Lane 2).
- Word HTML (Lane 2): verbatim import of MSO scaffolding from v1's `memo-generator.ts`.
- Lane 1 smoke posture: LOCAL EXTRACTION SMOKE (upload + extract; no evaluation).
- Env vars: `REG_REVIEW_ENGINE_V2_BASE_PATH`, `REG_REVIEW_LEGACY_EXTRACTOR_PATH`, `LOCAL_ENGINE_ENABLED`, `REG_REVIEW_PYTHON_PATH`, `EXTRACT_STALE_TIMEOUT_MS` (optional override).
- TS types hand-written; Zod at API boundaries is the real guard.
- TUS: chunkSize 6 MB; bearer token; endpoint `https://<project-id>.storage.supabase.co/storage/v1/upload/resumable`; omit `x-upsert` header (default no overwrite).
- Filename safety: validate at API; original_filename + storage_path (safe scheme); local materialization uses `<file_id>.<ext>`.
- JSONB for all variant fields.
- Lane 1 access policy: `requireAdmin` on all v2 API routes + storage RLS owner-based.
- Streaming downloads MANDATORY: `fetch(signedUrl)` + `response.body.getReader()` for SHA256 (using `crypto.subtle.digest` chunk by chunk via incremental hash, OR streaming hash via Node `crypto.createHash('sha256').update(chunk)`); `fs.createWriteStream` for local materialization. `supabase.storage.download()` BANNED (buffers as Blob).
- /files/complete duplicate SHA: return existing v2_submission_files row + DELETE newly uploaded Storage object via service-role client.
- Orphan cleanup: `POST /api/engine-v2/files/orphan` JSON body `{project_id, file_id}`; SERVER re-derives expected storage path from project ownership + file_id (NOT trusted from client).

## Lane 1 - Narrow Vertical Slice (today; 7 modules; budget 4-5h; smoke NON-DROPPABLE)

Goal: signed-in admin can create v2 project, upload submission files via TUS, files materialize to local staging dir, Docling extraction triggers and produces VERBATIM JSON per file (persisted to `v2_dashboard_extracts/`), status visible in dashboard with stale detection, smoke documented.

### Module L1-1: Schema patch + bucket + types + Zod + tests

File allowlist (Module L1-1 owns these; L1-2/L1-3/L1-4 depend on them):
- NEW `C:\Projects\SSTAC-Dashboard\supabase\engine_v2\database_schema_engine_v2_patch.sql`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\types.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\zod.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\schema_notes.md`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\admin_guards.ts` (MOVED from L1-2/L1-3 per codex Round 11: shared prerequisite across parallel L1-2/L1-3/L1-4)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\zod.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\admin_guards.test.ts` (unit tests covering unauthenticated -> redirect, authenticated-non-admin -> redirect, authenticated-admin -> {client, user})

Tables (Lane 1 ONLY). Patch SQL begins with extension declaration:

```sql
-- Required for gen_random_uuid() (codex Round 11 finding)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE v2_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  application_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_context_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  applicability_mode TEXT NOT NULL DEFAULT 'off',
  evaluation_backend TEXT NOT NULL DEFAULT 'stub',
  embedder_backend TEXT NOT NULL DEFAULT 'stub',
  reranker_backend TEXT NOT NULL DEFAULT 'disabled',
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE v2_submission_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE UNIQUE INDEX idx_v2_submission_files__active_sha
  ON v2_submission_files (project_id, sha256) WHERE deleted_at IS NULL;

CREATE TABLE v2_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'extracting', 'completed', 'completed_with_errors', 'error')),
  total_files INTEGER NOT NULL DEFAULT 0,
  completed_files INTEGER NOT NULL DEFAULT 0,
  current_file TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,  -- JSON array of strings (matches v1 extractor's string-error convention; stale transition writes a single string entry)
  chunk_progress TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_v2_extraction_runs__project_started
  ON v2_extraction_runs (project_id, started_at DESC);
```

Lane 2 schema deferred (sketched at end).

RLS policies in patch SQL:

**Admin requirement enforced at RLS layer**: codex Round 10 caught that route-level `requireAdmin` is insufficient because authenticated non-admins could bypass Next.js and INSERT v2_projects directly via Supabase REST. ALL policies below require BOTH ownership AND admin role.

```sql
-- v2_projects: owner-only AND admin-only
ALTER TABLE v2_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY v2_projects_owner_admin_all ON v2_projects FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- v2_submission_files: parent ownership AND admin role
ALTER TABLE v2_submission_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY v2_submission_files_owner_admin_all ON v2_submission_files FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_submission_files.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_submission_files.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- v2_extraction_runs: parent ownership AND admin role
ALTER TABLE v2_extraction_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY v2_extraction_runs_owner_admin_all ON v2_extraction_runs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_extraction_runs.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_extraction_runs.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- storage.objects for v2-submissions bucket: INSERT, SELECT, DELETE all require BOTH ownership AND admin role
CREATE POLICY v2_submissions_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'v2-submissions'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM v2_projects p
      WHERE p.id::text = split_part(name, '/', 2) AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY v2_submissions_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'v2-submissions'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM v2_projects p
      WHERE p.id::text = split_part(name, '/', 2) AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
CREATE POLICY v2_submissions_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'v2-submissions'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM v2_projects p
      WHERE p.id::text = split_part(name, '/', 2) AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- GRANTs: re-run the all-tables grant pattern after CREATE TABLE statements
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_submission_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_extraction_runs TO authenticated;
```

Bucket config:
- Name: `v2-submissions`
- `file_size_limit`: confirmed at EXIT GATE (Supabase Free 50MB; Pro/Team 500GB global with per-bucket caps).
- Allowed MIME types (Lane 1): `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`. `application/json` REMOVED from allowlist because `dashboard_extract.py` does not process JSON (extractor is for source documents only). MIME-to-extension map (used for safe storage path `<file_id>.<ext>`): pdf->`.pdf`, docx-MIME->`.docx`, doc-MIME->`.doc`. Extension is derived server-side from MIME allowlist, NOT from client filename.

Zod schemas (Lane 1):
- `ProjectCreatePayload`
- `FileCompletePayload` (project_id, file_id, original_filename, size_bytes, content_type). NO client-claimed SHA256; server computes via streaming hash and is the sole authority.
- `ExtractionStatusUpsert` (matches v1 dashboard_extract.py JSON shape: status enum incl. `completed_with_errors`, totalFiles, completedFiles, currentFile, progress, errors, updatedAt, optional chunkProgress)
- `OrphanCleanupPayload` (project_id, file_id; NO storage_path; server derives)

Unit tests (`zod.test.ts`):
- Accept/reject scenarios per schema.
- Filename validation: reject `../`, `..\\`, `/`, `\\`, control chars, null bytes, length > 255.
- ExtractionStatusUpsert parses ALL FIVE status values + completed_with_errors path.

**Module L1-1 EXIT GATE**: orchestrator pauses; asks owner: "Module L1-1 ready. Please (a) apply `database_schema_engine_v2_patch.sql`, (b) create `v2-submissions` bucket with documented file_size_limit (reply with discovered limit), (c) confirm Lane 1 access model = admin-gated entry + per-admin owner. Reply 'schema-and-bucket-applied' with file_size_limit and access confirmation."

### Module L1-2: Route shell + landing page

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\layout.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\page.tsx`

Route: `/dashboard/engine-v2/`. Server Component. `requireAdmin` enforced.

Landing lists owner's v2 projects from `v2_projects` filtered by `auth.uid()` (admin-gated entry + per-admin ownership).

### Module L1-3: TUS upload + file finalize + orphan cleanup + safe filename + tests

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\UploadStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\files\complete\route.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\files\orphan\route.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\filename_safety.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\streaming_sha256.ts` (Web Streams + crypto API; ban supabase.storage.download)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\filename_safety.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\streaming_sha256.test.ts` (uses fixture blob to verify hash)
- EDIT `C:\Projects\SSTAC-Dashboard\package.json` (add `tus-js-client`)
- EDIT `C:\Projects\SSTAC-Dashboard\package-lock.json` (npm install regenerates)

**Node runtime required**: each new API route under `src/app/api/engine-v2/` that uses `fs`, `child_process`, Node streams, Node `crypto`, or any Node-only API MUST declare at top of file:
```typescript
export const runtime = 'nodejs';
```
This applies to: `files/complete/route.ts` (Node crypto + streaming fetch via Node), `files/orphan/route.ts` (auth client; OK either runtime; declare nodejs for consistency), and ALL Module L1-6 routes (`extract/route.ts`, `extract-status/route.ts`) which use `child_process` + `fs`. Without this, Next.js may pick Edge runtime which lacks these APIs.

**Admin-gating helpers** (owned by Module L1-1 file allowlist; L1-2/L1-3/L1-4/L1-5/L1-6 depend on them):
- `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\admin_guards.ts` (created in Module L1-1):
  - `requireAdminForServerComponent()`: returns `{client, user}` on success. On failure: unauthenticated -> redirect to `/login?next=/dashboard/engine-v2`; authenticated-non-admin -> redirect to `/dashboard?error=admin_required` (client-side renders a toast from this query param; NO server-side toast call, which doesn't work in Server Components per codex Round 11). Used by Server Components in `(dashboard)/dashboard/engine-v2/`.
  - `requireAdminForApi(req)`: returns `{client, user}` on success; returns 403 JSON `NextResponse` on failure. Used by all API routes.
- Both helpers query `user_roles` table for `role = 'admin'` matching v1's pattern in `src/lib/api-guards.ts`. v1's `requireAdmin` returns `NextResponse-or-null` which is awkward for the user/client-return pattern; v2 adds the new helpers explicitly with `{client, user}` return shape.

TUS config (CORRECTED v6):
- endpoint: `https://<supabase-project-id>.storage.supabase.co/storage/v1/upload/resumable`
- chunkSize: 6 * 1024 * 1024
- headers: `Authorization: Bearer <session-access-token>` (omit `x-upsert`; default is no overwrite)
- metadata: `bucketName`, `objectName`, `contentType`
- objectName: safe scheme `<user_id>/<project_id>/<file_id>/<file_id>.<ext>`

`POST /api/engine-v2/files/complete`:
1. `requireAdmin` + project ownership check.
2. Validate Zod `FileCompletePayload`.
3. Storage HEAD object exists at expected derived path.
4. Object size + content-type match POST claim.
5. Filename validation via `filename_safety.ts`.
6. Compute SHA256 server-side via Node `crypto.createHash('sha256')` only (NOT `crypto.subtle.digest`, which is Web Crypto; codex Round 10 clarification). Stream chunks from `fetch(signedUrl).body` via Node async iteration, `update(chunk)` per chunk, then `.digest('hex')`. NO `supabase.storage.download()` (buffers entire blob). Server SHA is authoritative; no client-claimed SHA accepted.
7. Check duplicate SHA: if existing non-deleted `v2_submission_files` row exists for `(project_id, sha256)`, DELETE the newly uploaded Storage object via the authenticated server client (DELETE RLS policy permits via storage.objects v2_submissions_delete; server re-validates path matches the just-uploaded object) and return the existing row. NO service-role usage; service-key code paths bypass RLS and are out-of-scope for Lane 1.
8. Insert `v2_submission_files` row.

`POST /api/engine-v2/files/orphan`:
- JSON body `{project_id, file_id}`.
- `requireAdmin` + project ownership.
- Server lists `storage.objects` under prefix `<user_id>/<project_id>/<file_id>/` (auth client, RLS-enforced).
- Validates EXACTLY ONE object under that prefix (else 409 conflict + log; do not delete on ambiguity).
- DELETE that single object via authenticated server client (DELETE RLS policy permits).
- NO service-role usage; the authenticated client with DELETE RLS is sufficient and stays within the per-user owner scope.

Filename safety:
- Reject path separators (`/`, `\`).
- Reject control chars (0x00-0x1f, 0x7f).
- Reject null bytes.
- Reject length > 255.
- Reject `..` substrings.
- Reject reserved Windows names (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
- Original filename stored verbatim in `original_filename`; sanitized variant only used for display fallback.

### Module L1-4: Project create wizard + tests

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\new\page.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ProjectMetadataStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ApplicationTypeStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ServiceTypeStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\SubmissionContextStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ReviewStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\projects\route.ts` (POST; `requireAdmin`; Zod-validated)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\service_to_media.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\service_to_media.test.ts`

Wizard imports (CORRECTED v6):
```typescript
import { SERVICES, LIFECYCLE_STAGES, getServicesByStage, getServiceById, type Schedule3Service } from "@/lib/regulatory-review/schedule3";
```

NOT `SCHEDULE_3` (does not exist).

`service_to_media.ts`: literal TypeScript const copying v1's `SERVICE_TO_MEDIA` at `src/lib/regulatory-review/launch-evaluation.ts:19-42`.

### Module L1-5: Project detail page (upload + file list + extract control + status)

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\[projectId]\page.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\[projectId]\ProjectDetailClient.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\FileList.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\ExtractionStatusPanel.tsx` (renders status, totalFiles, completedFiles, currentFile, progress, errors, updatedAt, chunkProgress)
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\ExtractTriggerButton.tsx`

Route: `/dashboard/engine-v2/<projectId>`. Renders all the controls the smoke test exercises.

### Module L1-6: Extraction trigger + status polling + stale detection + tests

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\projects\[id]\extract\route.ts` (POST; `requireAdmin`)
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\projects\[id]\extract-status\route.ts` (GET; `requireAdmin`)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\spawn_extraction.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\storage_materialize.ts` (streaming download to local; quarantine on failure)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\status_parsing.ts` (parses v1-extractor JSON; defensive)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\status_parsing.test.ts` (covers all 5 status values including completed_with_errors + stale transition)
- EDIT `C:\Projects\Regulatory-Review-worktrees\engine-v2\engine_v2\.gitignore` (add `data/v2_dashboard_uploads/` and `data/v2_dashboard_extracts/` patterns). **Cross-repo edit**: this is in the engine-v2 worktree, NOT the SSTAC-Dashboard repo. Module L1-6 commit therefore spans two repos; orchestrator MUST commit each repo separately with matching messages.

Extraction flow:
1. `POST /api/engine-v2/projects/<id>/extract`: `requireAdmin` + project ownership + `LOCAL_ENGINE_ENABLED` gate; fetch all non-deleted `v2_submission_files` for project; download each via streaming fetch + Node `fs.createWriteStream` to local `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/<project_id>/<file_id>.<ext>` (NO `supabase.storage.download()`).
2. Pre-create `v2_extraction_runs` row with `status='pending'`; capture `id` as the canonical run_id.
3. Spawn detached `pythonw.exe` running `${REG_REVIEW_LEGACY_EXTRACTOR_PATH}` with args `--source-dir <uploads_dir>` `--output-dir <extracts_dir>` `--progress-file <status_json_path>`. Wrap spawn in try/catch: if spawn throws (ENOENT on pythonw, bad path, permission denied, etc.) BEFORE any status JSON is written, route handler catches, updates `v2_extraction_runs` row to `status='error', errors=["Subprocess spawn failed: <error.message>"]` and moves uploads dir to quarantine (codex Round 11 finding).
4. Return immediately `{run_id: <v2_extraction_runs.id>, status: 'extracting'}` on success, or HTTP 500 + the error row on spawn failure.

Output dir (extractor's `--output-dir`): `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_extracts/<project_id>/`. PERSISTENT; retained for Lane 2.

Status JSON path: `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/<project_id>/.extraction_status.json`.

`POST /api/engine-v2/projects/<id>/extract-status` (body: `{run_id}`):
1. `requireAdmin` + project ownership.
2. Fetch `v2_extraction_runs` row by `(project_id, id)`; if not found -> 404.
3. If row's `status` is in TERMINAL_STATUSES (`completed`, `completed_with_errors`, `error`) -> return row (no stale check, no file read).
4. Read status JSON file (defensive parse via `status_parsing.ts`); if file missing -> check pre-create vs stale.
5. Stale detection: if `progress.updatedAt` is older than `EXTRACT_STALE_TIMEOUT_MS` (env override; default 60 min -- `DEFAULT_STALE_MS = 3600000`), transition row to `status='error'` with `errors=["Extraction subprocess silent beyond timeout (stale)"]`. **String errors only** to match v1 extractor's string-error convention; do NOT emit object errors.
6. Upsert row by `(project_id, id)`; return latest.

Cleanup policy (in extract route AND extract-status route on transition):
- On status='completed' OR 'completed_with_errors': delete `v2_dashboard_uploads/<project_id>/` recursively (validate resolved path inside `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/` before delete).
- On status='error' (incl. stale): MOVE `v2_dashboard_uploads/<project_id>/` to `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/_quarantine/<project_id>_<UTC_timestamp>/`.
- Extracts dir RETAINED in all terminal states (for forensics + Lane 2).

Engine_v2 `.gitignore` edits (must be in Module L1-6 commit):
```
# v2 dashboard staging dirs (engine_v2/data/)
data/v2_dashboard_uploads/
data/v2_dashboard_extracts/
```

Tests:
- `status_parsing.test.ts`: parses all 5 status values (pending, extracting, completed, completed_with_errors, error) + with/without chunkProgress + with/without currentFile.
- Stale transition: mock `updatedAt` older than timeout; verify row transitions to error.

### Module L1-7: Smoke + docs + handoff (NON-DROPPABLE)

Smoke (in-module verification):
- Sign in as admin.
- Navigate to `/dashboard/engine-v2/`.
- Create project via wizard.
- Upload single small synthetic PDF via TUS.
- Synthetic PDF source (in priority order):
  - (a) Reuse existing minimal test fixture if one exists.
  - (b) Generate via Python `-c` dep-free one-liner writing minimal valid PDF (no `reportlab`); committed as `C:\Projects\SSTAC-Dashboard\tests\fixtures\lane1_smoke.pdf` (file in allowlist).
  - (c) Owner provides anonymized small PDF locally (not committed).
- Trigger extraction; observe status polling (`status`, `currentFile`, `progress`, `chunkProgress`).
- Confirm VERBATIM JSON appears at `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_extracts/<project_id>/`.
- Document rough edges in `LANE1_SMOKE_2026_05_11.md`.

Test fixture allowlist (if committed): `C:\Projects\SSTAC-Dashboard\tests\fixtures\lane1_smoke.pdf`.

Docs:
- `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\README.md`.
- `C:\Projects\SSTAC-Dashboard\docs\engine_v2_frontend_lane1_handoff_2026_05_11.md`.

Staged-only hygiene scan (PowerShell-safe; excludes binary fixtures):
```powershell
git diff --cached --name-only --diff-filter=ACM | Where-Object {
  $_ -notmatch '\.(pdf|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|zip|gz|tar|sqlite|db)$'
} | ForEach-Object {
  Select-String -Path $_ -Pattern '\b\d{4,5}\b' -SimpleMatch:$false -ErrorAction SilentlyContinue
}
```
Allow `2026` year. Binary fixtures excluded by extension.

## Lane 2 - Evaluation + Review + Memo (QUEUED)

(Same as v5; sketched only.)

- **L2-1**: Lane 2 schema. Tables: v2_evaluations (with raw_eval_result_json JSONB; run_id_engine UNIQUE; etc.), v2_per_policy_results (verdict_suggestion, confidence, confidence_method, tier_render_policy, pathway_notes, rubric_self_score, etc.; unique (evaluation_id, policy_id)), v2_evidence_items (rich evidence_item_ref/traceability_anchor/provenance preserved; unique (per_policy_result_id, evidence_item_id)), v2_telemetry, v2_stage_models, v2_judgments (enum decided by owner: 4 vs 5), v2_judgment_history (audit), v2_memo_exports (format, eval_id, generator_version, judgment_snapshot_hash, content_sha256, storage_path NULL), v2_bench_fixtures (seeded from engine_v2 worktree).
- **L2-2**: multi-VERBATIM merge adapter (preserves per-file provenance).
- **L2-3**: evaluation status wrapper script (writes JSON status the harness doesn't natively produce).
- **L2-4**: evaluation trigger (stub default; live owner-authorized per-run).
- **L2-5**: idempotent eval_result.json import (raw blob + selected normalized fields; transaction-wrapped; unique-key collision = update).
- **L2-6**: results viewer + provenance/telemetry sidebar.
- **L2-7**: HITL judgments + memo export (Word imports MSO scaffolding verbatim).
- **L2-8**: Lane 2 smoke.

## Codex Review Strategy

- Each module: codex MCP first; on disconnect, Opus fallback per `feedback_codex_unavailable_fallback.md`.
- High-risk: L1-1 (schema/RLS/storage), L1-3 (upload + streaming + filename), L1-6 (subprocess + stale detection).
- Track retro codex obligations per Opus-only commit.
- Review NOT timeboxed.

## Subagent File Allowlists

Each Lane 1 module has explicit file allowlist (no wildcards). Sequencing: L1-1 (EXIT GATE) -> L1-2 + L1-3 + L1-4 (parallel; disjoint allowlists) -> L1-5 (needs L1-2 + L1-3 + L1-4) -> L1-6 -> L1-7.

## Failure-Mode Triage (Lane 1) - smoke NON-DROPPABLE

Droppable polish (only if elapsed exceeds budget):
- ProvenancePanel-equivalent extra telemetry surfacing (none in Lane 1 anyway).
- Extra defensive tests beyond the required unit-test coverage in module allowlists.
- ASCII docstring linting strictness (relax to "ASCII-clean at commit time" without auto-fixers).

NON-DROPPABLE (must ship in Lane 1):
- Module L1-7 smoke (the entire point of vertical-slice verification).
- filename_safety + streaming_sha256 (security/perf critical).
- Zod boundary validators (security critical).
- currentFile field across schema + Zod + parser + UI (codex Round 6 closure; required for v1 status JSON parity).
- Duplicate-SHA cleanup at /files/complete (return existing + delete newly uploaded object; codex Round 6 closure; without it Storage accumulates orphans).
- Stale-detection in extract-status route (codex Round 6 closure; without it crashed subprocesses stick projects forever).

If 4h with L1-6 unfinished: ship L1-6 minus chunk_progress display only (keep chunk_progress in schema for forward compat). currentFile stays in UI.

If 5h with smoke unfinished: extend session OR ship L1-7 docs marking smoke as unverified-this-session AND flag explicitly that Lane 1 is not yet verified.

## Critical Files (Reused, read-only)

- `C:/Projects/SSTAC-Dashboard/src/middleware.ts:130` (matcher)
- `C:/Projects/SSTAC-Dashboard/src/lib/supabase-auth.ts:34` (REUSE `createAuthenticatedClient`)
- `C:/Projects/SSTAC-Dashboard/src/lib/api-guards.ts` (REUSE `requireAdmin`, `LOCAL_ENGINE_ENABLED`)
- `C:/Projects/SSTAC-Dashboard/src/lib/regulatory-review/schedule3.ts` (REUSE `SERVICES`, `LIFECYCLE_STAGES`, `getServicesByStage`, `getServiceById`)
- `C:/Projects/SSTAC-Dashboard/src/lib/regulatory-review/launch-evaluation.ts:19-42` (REUSE `SERVICE_TO_MEDIA`)
- `C:/Projects/SSTAC-Dashboard/src/app/api/regulatory-review/projects/[id]/extract-status/route.ts:32,68` (REUSE stale-detection + TERMINAL_STATUSES patterns)
- `C:/Projects/Regulatory-Review/engine/scripts/dashboard_extract.py` (REUSE; called by Module L1-6 via subprocess)

## Verification (Lane 1)

After each module commit:
```
cd C:/Projects/SSTAC-Dashboard
npm run lint
npm run test:unit
```

Lane 1 end-to-end smoke (Module L1-7):
1. Sign in as admin.
2. Navigate to `/dashboard/engine-v2/`.
3. Create project via wizard.
4. Upload synthetic PDF via TUS.
5. Trigger extraction; observe status polling (incl. currentFile + chunkProgress + completed_with_errors handling if any file errors).
6. Confirm VERBATIM JSON at extracts dir.
7. Document in `LANE1_SMOKE_2026_05_11.md`.

## Open Questions for Owner (Before Lane 1 Execution)

1. Supabase project tier + bucket file_size_limit confirmation.
2. Lane 1 access model confirmation: admin-gated entry + per-admin owner of own projects (default v6); owner confirms or specifies alternative.
3. Lane 1 smoke PDF source: dep-free generated commit fixture, reuse existing fixture, or local-only owner-supplied.

(HITL enum question deferred to Lane 2.)

## ASCII / Real-Owner-Content Guardrails

- All new MD docs / commit messages / code comments plain ASCII per CLAUDE.md.
- No protected literals (HHRA/HHERA/site numbers/contractor/personnel/project names) in committed source.
- Staged-only hygiene scan: PowerShell-safe (see Module L1-7 for the exact script); excludes binary fixtures by extension; allow `2026` year.
- This plan file is ASCII-clean.

## Rollback Plan

Each commit per-module. `git revert <sha>` per regression. v1 untouched. v2 Lane 1 is admin-gated, opt-in via URL.

## Cross-References

- Plan history: 7 review rounds (3 codex MCP + 4 Opus).
- Engine_v2 master: `6f125686`.
- v1 extractor: `C:/Projects/Regulatory-Review/engine/scripts/dashboard_extract.py`.
- Supabase docs: TUS resumable uploads, storage access control, file limits.

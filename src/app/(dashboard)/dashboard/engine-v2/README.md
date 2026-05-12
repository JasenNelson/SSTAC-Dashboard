# engine-v2 Dashboard (Lane 1)

This dashboard is the v2 submission extraction frontend for the Regulatory Review
AI Agent. It is admin-gated and per-admin-owner: each admin user sees only the
v2 projects, files, and extraction runs they own. Upload-and-extract flows post
to local Next.js API routes that, on extraction trigger, spawn the v1
`dashboard_extract.py` Python script against a materialized copy of the
submission file.

Lane 1 is upload + extract only. Evaluation, review, and memo authoring belong
to Lane 2 (separate session).

## Route map

| Route | Page |
|-------|------|
| `/dashboard/engine-v2/` | Landing (project list, "+ New Project" button) |
| `/dashboard/engine-v2/new` | Project create wizard |
| `/dashboard/engine-v2/[projectId]` | Project detail (file list, upload, extract trigger, status panel) |

## API routes

All under `src/app/api/engine-v2/`. All require an authenticated admin session;
all mutating routes require a matching CSRF token.

| Route | Purpose |
|-------|---------|
| `POST /api/engine-v2/projects` | Create v2 project (per-admin-owner) |
| `POST /api/engine-v2/files/complete` | Finalize a TUS-uploaded object: streaming SHA-256, MIME sniff, size cap, dedupe |
| `POST /api/engine-v2/files/orphan` | Best-effort orphan-storage cleanup on client-side upload failure |
| `GET  /api/engine-v2/files/exists` | Check whether a finalized file already exists by sha256 (for cap-aware UX) |
| `POST /api/engine-v2/projects/[id]/extract` | Spawn `dashboard_extract.py` against a materialized file copy |
| `GET  /api/engine-v2/projects/[id]/extract-status` | Poll the latest extraction run (status, page count, ms elapsed, stale flag) |

## Source layout

### Utilities -- `src/lib/engine-v2/`

- `admin_guards.ts` -- single-shot admin session + per-owner enforcement
- `csrf.ts` -- double-submit cookie validation
- `zod.ts` -- request body schemas (project create, file complete, extract trigger)
- `types.ts` -- shared response shapes (Project, SubmissionFile, ExtractionRun)
- `filename_safety.ts` -- ASCII-safe display + storage filename normalization
- `mime_to_extension.ts` -- enforce `.pdf|.docx|.doc` from sniffed MIME
- `path_containment.ts` -- prevent `..` / absolute-path escape in materialized paths
- `storage_safe_delete.ts` -- delete-by-exact-path with prefix guard
- `streaming_sha256.ts` -- chunked sha256 of a Supabase Storage object (no full buffer in memory)
- `spawn_extraction.ts` -- subprocess launcher for `dashboard_extract.py` with timeout + termination
- `storage_materialize.ts` -- copy storage object to local tmp path before spawn
- `status_parsing.ts` -- parse dashboard_extract stdout/exit code into a v2_extraction_runs row
- `service_to_media.ts` -- map service category to media type for downstream evaluator

### UI components -- `src/components/engine-v2/`

- `UploadStep.tsx` -- TUS-protocol multipart upload to Supabase Storage
- `FileList.tsx` -- finalized files for the project
- `ExtractTriggerButton.tsx` -- per-file "Extract" button (admin-only)
- `ExtractionStatusPanel.tsx` -- polling panel with stale-run banner
- `wizard/*` -- project create wizard steps

## Database

Per-admin-owner RLS on three tables (see `supabase/migrations/`):

- `v2_projects` -- id, owner_id, name, service_category, media_type, created_at
- `v2_submission_files` -- id, project_id, owner_id, sha256, byte_size, mime, storage_path, uploaded_at
- `v2_extraction_runs` -- id, project_id, file_id, owner_id, status, page_count, ms_elapsed, error, created_at

## Storage

Bucket: `v2-submissions`

- 50MB file_size_limit (52428800 bytes)
- Allowed MIME: PDF (`application/pdf`), DOCX, DOC
- Path convention: `{owner_id}/{project_id}/{sha256_prefix}/{safe_filename}`
- RLS: per-owner read/write; no public read

## Environment variables

| Var | Purpose |
|-----|---------|
| `REG_REVIEW_ENGINE_V2_BASE_PATH` | Repo root used to resolve relative paths in spawn |
| `REG_REVIEW_PYTHON_PATH` | Path to pythonw.exe / python executable for spawn |
| `LOCAL_ENGINE_ENABLED` | Gate for spawning the local Python extractor at all |
| `EXTRACT_STALE_TIMEOUT_MS` | When status polling should surface a stale-run banner |
| `EXTRACT_SCRIPT_PATH` | Path to `dashboard_extract.py` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (client) |
| `VERCEL_PROJECT_PRODUCTION_URL` | Production canonical URL (used for absolute-URL building when needed) |

## Local dev quick start

1. `npm install`
2. Apply the v2 migration in `supabase/migrations/` (Lane 1 schema + RLS + bucket).
3. Set the env vars above in `.env.local`. Defaults work for most cases when the
   local engine repo is at the expected sibling path.
4. `npm run dev`
5. Sign in as an admin user.
6. Navigate to `/dashboard/engine-v2/`.

## Lane 2 (out of scope here)

Lane 2 will add evaluation, review surfaces, and memo authoring against the
extracted JSON produced by Lane 1. See
`docs/engine_v2_frontend_lane1_plan_v7.19.md` -- "Lane 2" section.

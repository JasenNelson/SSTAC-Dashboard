# engine_v2 Frontend - Lane 1 Handoff (2026-05-11)

Status: Lane 1 functionally complete. Module L1-7 (smoke fixture + docs)
authored. Smoke run not yet executed -- that is the owner's task during the
upcoming demo. This handoff captures everything the next session needs to
either (a) run the Lane 1 smoke, (b) close out Lane 1, or (c) start Lane 2.

## Scope reminder

Lane 1 = v2 submission upload + extraction trigger only. Evaluation, review,
and memo authoring belong to Lane 2 (separate session). Per-admin-owner access
model: each admin sees only their own v2 projects/files/runs. Admin-pool
relaxation is deferred to a later lane; functionally equivalent while we have a
single active admin.

## Entry points

### Lane 1 (this lane)

Routes (admin-gated):

- `/dashboard/engine-v2/` -- landing (project list + "+ New Project")
- `/dashboard/engine-v2/new` -- project create wizard
- `/dashboard/engine-v2/[projectId]` -- project detail (file list + upload + extract + status)

API endpoints (all `runtime = 'nodejs'`, admin-gated, CSRF-validated on mutations):

- `POST /api/engine-v2/projects`
- `POST /api/engine-v2/files/complete`
- `POST /api/engine-v2/files/orphan`
- `GET  /api/engine-v2/files/exists`
- `POST /api/engine-v2/projects/[id]/extract`
- `POST /api/engine-v2/projects/[id]/extract-status` (POST not GET; body: {run_id: uuid}; per Finding 37 CSRF)

Reference: `src/app/(dashboard)/dashboard/engine-v2/README.md` for the
full source-tree map.

### Lane 2 (queued)

See plan section "Lane 2 - Evaluation + Review + Memo (QUEUED)" near
line 1133 of `docs/engine_v2_frontend_lane1_plan_v7.19.md`. Modules L2-1
through L2-8:

- L2-1: schema (v2_evaluations, v2_per_policy_results, v2_evidence_items,
  v2_telemetry, v2_stage_models, v2_judgments, v2_judgment_history,
  v2_memo_exports, v2_bench_fixtures)
- L2-2: multi-VERBATIM merge adapter (per-file provenance)
- L2-3: evaluation status wrapper script
- L2-4: evaluation trigger (stub default; live owner-authorized per run)
- L2-5: idempotent eval_result.json import
- L2-6: results viewer + provenance/telemetry sidebar
- L2-7: HITL judgments + memo export
- L2-8: Lane 2 smoke

## Commit list (in landing order)

| SHA | Module | Summary |
|-----|--------|---------|
| 0891765 | L1-1 | Foundation: v2 schema + RLS + bucket + cap trigger + utility libs |
| 0c7f339 | L1-1 fix | Codex fix: CSRF tighten + ASCII-only tests |
| 4007a6c | L1-2 | Route shell + landing page |
| b2a3656 | L1-4 | Project create wizard + POST /api/engine-v2/projects |
| e0f54f4 | L1-3 | TUS upload + /files/complete + /files/orphan + magic-number sniff + safe-delete |
| 4ca32f9 | L1-5 | Project detail page + FileList + ExtractionStatusPanel skeleton |
| fa47450 | L1-6 | ExtractTriggerButton + status polling + materialization + subprocess spawn |
| (next)  | L1-7 | Smoke fixture + dev README + handoff + smoke template |

All commits already on `main`. L1-7 is the only outstanding commit.

## Pre-commit QA status (Opus adversarial subagent reviews)

| Commit | Opus verdict | Outstanding |
|--------|--------------|-------------|
| 0891765 | GREEN | None |
| 0c7f339 | GREEN | None (CSRF tighten + tests closed) |
| 4007a6c | GREEN | None |
| b2a3656 | GREEN | None |
| e0f54f4 | YELLOW->GREEN | Findings closed inline: idempotent-retry safety check (Finding 98), drain-and-error on materialize is L1-6 concern not L1-3, orphan-on-failure wired in UploadStep, safe-delete prefix guard verified |
| 4ca32f9 | GREEN | None |
| fa47450 | YELLOW->GREEN | Findings closed inline: mkdir-before-createWriteStream (Finding 35), persistent error listener (Finding 30), drain-and-error on writes (Finding 34), partial-file cleanup on failure (Finding 28), safe releaseLock in finally (Finding 36), zero-file guard before spawn |

Codex desktop review of the committed diffs is owner-triggered and pending;
not a blocking gate.

## QA findings closed inline (highlights)

L1-3:
- F64/F98: idempotent retry handled at top of /files/complete before cap preflight.
- Filename safety: NFC normalization + ASCII-safe display + byte-length cap.
- Magic-number sniff before persisting metadata (PDF/DOCX/DOC).
- Streaming sha256 with chunked read (no full-buffer in memory).
- CSRF double-submit cookie on every mutation.
- Orphan storage object cleanup wired in UploadStep on client-side failure.
- safe_delete prefix guard (`v2-submissions/`) before any storage delete.

L1-6:
- Path containment guard prevents `..` and absolute paths in materialized paths.
- Materialize: mkdir(recursive) before createWriteStream; persistent error listener; drain-and-error on writes; finish-and-error on close; partial-file cleanup on any failure; safe releaseLock in `finally`.
- Stale-run detection: uses `EXTRACT_STALE_TIMEOUT_MS` (default 10 min); status endpoint surfaces stale flag.
- Zero-file guard: refuse to spawn extraction against a zero-byte materialized file.
- Quarantine helper: on subprocess error, move materialized file to a quarantine subpath for post-mortem.

## Known minors carried forward (DO NOT regress in Lane 2)

These were accepted as Lane 1 known minors per plan:

- **Finding 32 (narrowed by Finding 98) -- cap-trigger UX edge.** A NEW file_id
  with the SAME sha256 at a project already at cap will still return HTTP 413.
  True retries (same file_id + same sha256) return 200 via the idempotent
  safety check. Lane 2 polish: trigger could SELECT for dup-SHA before count
  check, returning 200 idempotently in that narrow case.
- **Finding 42 -- cap fires only on finalized rows.** Storage objects uploaded
  but never finalized do not count toward cap. Mitigations in Lane 1:
  UploadStep orphan-cleanup wiring + admin-gating + bucket file_size_limit.
  Full closure requires a janitor (see below).
- **Findings 53/61 -- ambiguous-network-failure orphans.** When the
  /files/complete POST fails ambiguously (timeout, network blip), the storage
  object may or may not be finalized. UploadStep makes a best-effort
  /files/orphan call; if that also fails, the object is leaked. Closure
  requires the janitor below.
- **Finding 7 -- PID-based liveness for stale detection.** Lane 1 stamps stale
  via wall-clock only. Lane 2 should store subprocess_pid on v2_extraction_runs
  and probe liveness via `process.kill(pid, 0)` before terminal stamp.
- **Finding 11 -- rate-limiting.** Lane 1 relies on admin-gating only. Lane 2
  should add per-uid token-bucket middleware with route-specific caps.
- **Finding 13 -- Content-Disposition on signed URLs.** Lane 1 does not expose
  a "download original" button; Lane 2 will, and must pass `?download=` to
  `createSignedUrl` so the browser uses a safe filename.
- **Finding 26 -- materialization-as-background-job.** If Lane 2 deploys to
  Vercel serverless, materialization must move out of the POST handler to a
  separate worker queue. Lane 1 runs on a long-lived local Next.js dev server,
  so this is acceptable for now.
- **Findings 42, 53, 61 -- storage-objects janitor.** Periodic worker that
  scans `storage.objects` under the `v2-submissions/` prefix, joins against
  `v2_submission_files`, and deletes objects with no matching row that are
  older than 24h. Deferred to Lane 2.

## Lane 1 manual cleanup procedure (weekly admin maintenance)

Until the storage-objects janitor lands in Lane 2, an admin should:

1. List storage objects under `v2-submissions/{owner_id}/`:
   - Supabase Studio -> Storage -> v2-submissions -> filter by owner UID.
2. Cross-reference against `v2_submission_files.storage_path` (filter by
   `owner_id`).
3. Any storage object older than 24h with no matching row is an orphan; delete
   via Supabase Studio.
4. Any zero-byte object is also an orphan -- safe to delete.

Capture deletions in an audit log; Lane 2 janitor will replicate this logic
automatically.

## Open follow-ups for Lane 2 design kickoff

- PID-based stale-detection (Finding 7).
- Rate-limiting middleware (Finding 11).
- Content-Disposition on signed download URLs (Finding 13).
- Materialization-as-background-job (Finding 26 -- only if going serverless).
- Storage-objects janitor (Findings 42, 53, 61).
- Cap-trigger reordering (Finding 32 narrowing).

## Smoke run pointer

The Lane 1 smoke run record lives at
`docs/LANE1_SMOKE_2026_05_11.md`. Owner-driven; steps 1-13 are NON-DROPPABLE,
steps 14-15 are time-pressed droppable per the plan. The smoke fixture is at
`tests/fixtures/lane1_smoke.pdf` (text-bearing single-page PDF with literal
"Engine v2 lane 1 smoke text"; ~1.4 KB; opens in any PDF viewer; text
extractable via pypdf).

## L1-1 EXIT GATE record

Captured at the start of Module L1-2 work:

- Schema applied: v2_projects + v2_submission_files + v2_extraction_runs with
  per-admin-owner RLS policies (SELECT/INSERT/UPDATE/DELETE on owner_id =
  auth.uid()).
- Cap trigger applied: per-project finalized-row count check at INSERT/UPDATE
  on v2_submission_files; returns custom error code consumed by /files/complete.
- Bucket created: `v2-submissions` in Supabase Storage.
- `file_size_limit = 52428800` bytes (50 MB).
- Allowed MIME types restricted to PDF/DOCX/DOC at bucket level.
- Per-owner RLS on `storage.objects` for the v2-submissions bucket.

## Plan-level access model

- All Lane 1 surfaces are admin-gated (admin role checked via the same single-
  shot admin guard used elsewhere in SSTAC-Dashboard).
- Per-admin-owner: each row carries `owner_id = auth.uid()` and RLS enforces
  isolation between admins.
- Admin-pool relaxation (any admin can see any admin's projects) is deferred.
  While there is one active admin, the two models are behaviorally identical.

## Plan reference

`docs/engine_v2_frontend_lane1_plan_v7.19.md`. Module sections L1-1 through
L1-7 use `<!-- BEGIN SECTION -->` / `<!-- END SECTION -->` markers for codex
per-module review scoping.

---

Last verified: 2026-05-14 (L1-7 retro pass -- extract-status verb corrected from GET
to POST per Finding 37; env var defaults in LANE1_SMOKE_2026_05_11.md corrected).

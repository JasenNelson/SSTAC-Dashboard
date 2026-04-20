# API Reference

**Lifecycle:** REFERENCE
**Last reframed:** 2026-04-20
**Source of truth:** every entry below was derived from current `src/app/api/**/route.ts` and its imported helpers/schemas. If code and this doc disagree, the code is authoritative and this doc needs a follow-up.

---

## About this document

This is a route-by-route description of every HTTP endpoint exposed by the dashboard. For narrative current-state summary see `docs/INDEX.md`; for volatile metrics see `docs/_meta/docs-manifest.json` `facts`; for internal behavior see the code itself.

Each entry describes:

- **Method** — the HTTP verb the route handler accepts (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- **Auth/session requirement** — what the route checks before doing work.
- **Request shape** — query params or JSON body the route reads.
- **Response shape** — on the 2xx path.
- **Backing store / source** — Supabase table/view/RPC, engine SQLite DB, submission SQLite DB, filesystem path, or Ollama.
- **Side effects** — anything the route mutates outside its own response (DB writes, disk writes, subprocess spawns, external HTTP calls).

Error responses are uniform: JSON `{ error: string, details?: unknown }` with an appropriate 4xx/5xx status. Zod-validated routes return `{ error, details }` with the Zod issue list on 400.

---

## Authentication

Three authentication flavors coexist on the dashboard:

### 1. Supabase SSR session (default)
Routes call `createClient()` from `@/lib/supabase/server` (cookie-based). Unauthenticated calls either return 401, or — for read endpoints that have a CEW variant — fall back to the anonymous client via `createClientForPagePath()`.

### 2. CEW anonymous session (poll routes only)
Poll submit/results routes accept unauthenticated calls when the user came from a CEW page (`pagePath` starts with `/cew-polls/`). The route switches to the anonymous Supabase client so RLS still applies.

### 3. Admin-guarded routes
The destructive content routes (`announcements`/`tags`/`milestones` mutations) and the regulatory-review project/extract/evaluate/assistant routes enforce a role check via `requireAdmin()`. A subset of regulatory-review routes also require the local engine to be enabled — see the per-section guard tables below for the precise mapping; do not assume `LOCAL_ENGINE_ENABLED` blocks every `/api/regulatory-review/**` route.

**Helpers:**
- `requireAdmin()` in `src/lib/api-guards.ts` — returns a `NextResponse` on failure (401/403), `null` on success. Verifies an authenticated user exists and has `role='admin'` in `user_roles`.
- `requireLocalEngine()` in `src/lib/api-guards.ts` — returns a 503 `NextResponse` when `LOCAL_ENGINE_ENABLED` is not `'true'`.
- `getAuthAndRateLimit(req, limiterKey)` in `src/lib/rate-limit.ts` — returns `{ user, headers, error }`. Combines session lookup with an in-memory or Upstash-backed rate limiter. See `docs/ENVIRONMENT_REFERENCE.md` for `REDIS_URL`/`REDIS_TOKEN`.

**CEW access codes** are validated inside the poll submit/results flow; they do not grant global dashboard access.

---

## Request/response format

- Request bodies are JSON unless the route explicitly accepts `multipart/form-data` (file uploads).
- Response bodies are JSON (`Content-Type: application/json`), except:
  - HITL packet download routes (`csv`/`md`) return the raw file with `Content-Disposition: attachment`.
  - Assistant chat streams Server-Sent Events (`text/event-stream`).
- Rate-limit headers (`X-RateLimit-*`, `Retry-After`) are attached by routes that run through `getAuthAndRateLimit`.

---

## Rate limiting

Implemented in `src/lib/rate-limit.ts`. Default store is an in-process LRU; if `REDIS_URL` and `REDIS_TOKEN` are set, the Upstash REST client is used instead. Limiter keys are chosen per route (e.g. `'discussion'`, `'admin'`). Limits live in the same file; adjust there, not in route handlers.

---

## Error handling

Routes follow a consistent error pattern:

| Status | Meaning | Typical source |
|---|---|---|
| 400 | Malformed request / Zod validation failure | route-level schema |
| 401 | No authenticated session | `createClient().auth.getUser()` |
| 403 | Authenticated but not authorized | `requireAdmin()` / owner checks |
| 404 | Resource not found | DB lookup returned null |
| 422 | Tier-constraint violation | regulatory-review judgment guard |
| 429 | Rate-limited | `getAuthAndRateLimit` |
| 500 | Unhandled server error | caught in outer `try/catch` |
| 501 | Deprecated | `/api/regulatory-review/run-engine` only |
| 503 | Local engine disabled | `requireLocalEngine()` |

---

## Endpoints by category

- [Auth](#auth)
- [Polls](#polls)
- [Content (discussions, announcements, tags, milestones, documents)](#content)
- [Analysis (prioritization matrix)](#analysis)
- [Review submission (legacy)](#review-submission-legacy)
- [Regulatory Review — projects](#regulatory-review--projects)
- [Regulatory Review — extraction & evaluation](#regulatory-review--extraction--evaluation)
- [Regulatory Review — assessments & judgments](#regulatory-review--assessments--judgments)
- [Regulatory Review — assistant](#regulatory-review--assistant)
- [Regulatory Review — search](#regulatory-review--search)
- [Regulatory Review — validation & progress](#regulatory-review--validation--progress)
- [HITL packets](#hitl-packets)
- [Deprecated](#deprecated)

---

## Auth

### `GET /api/auth/callback`
Supabase OAuth redirect target.
- **Auth:** none (this is the entry point into a session).
- **Query:** `code` (OAuth authorization code), optional `next` (post-login redirect path).
- **Behavior:** exchanges `code` for a session via `supabase.auth.exchangeCodeForSession`. On success, redirects to `next || '/'`. On failure, redirects to `/auth/auth-code-error`.
- **Backing store:** Supabase Auth.
- **Side effects:** sets Supabase session cookies.

No client-facing `/api/auth/login`, `/api/auth/logout`, `/api/auth/user`, or `/api/auth/refresh` routes exist — session mutations go through Supabase's own endpoints and cookies, and session reads happen inside route handlers via `createClient()`.

---

## Polls

Three independent poll systems share this surface: single-choice (`polls`), ranking (`ranking-polls`), and wordcloud (`wordcloud-polls`). Each uses a dedicated `get_or_create_*` RPC to resolve a poll by `(pagePath, pollIndex, question, options)` and then reads/writes the matching vote table. See `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md` for the three-systems contract.

### `POST /api/polls/submit`
Record a single-choice vote.
- **Auth:** authenticated Supabase session OR CEW anonymous (when `pagePath` starts with `/cew-polls/`); chosen by `createClientForPagePath()`. CEW pages derive an anonymous user id from `authCode` + `x-session-id` header via `generateCEWUserId()`.
- **Body:** `{ pagePath, pollIndex, question, options, optionIndex, otherText?, authCode? }`.
- **Response:** `{ success: true, pollId }`.
- **Backing store:** `rpc('get_or_create_poll')`; CEW path inserts into `poll_votes`; authenticated path upserts into `poll_votes`.
- **Side effects:** may create a `polls` row (via RPC) on first submit; writes `poll_votes`.

### `GET /api/polls/results`
Read aggregated single-choice results.
- **Auth:** uses `createAuthenticatedClient()` directly. Anonymous callers are allowed (results still returned), but `userVote`/`userOtherText` are populated only for authenticated, non-CEW callers; CEW callers (presence of `authCode`) explicitly do not get their per-user vote returned, for privacy.
- **Query:** `pagePath`, `pollIndex`, `authCode?`.
- **Response:** `{ results, userVote, userOtherText }` where `results` is the matching `poll_results` view row (or `null` if the poll doesn't exist yet), and `userVote`/`userOtherText` are `null` unless the lookup conditions above are met.
- **Backing store:** `polls`, `poll_results` view, `poll_votes`.
- **Side effects:** none.

### `POST /api/ranking-polls/submit`
Record a ranking vote.
- **Auth:** CEW split via `createClientForPagePath()`.
- **Body:** `{ pagePath, pollIndex, question, options, rankings, authCode? }`.
- **Response:** `{ success: true, pollId }`.
- **Backing store:** `rpc('get_or_create_ranking_poll')`; inserts into `ranking_votes`.

### `GET /api/ranking-polls/results`
Aggregated ranking results.
- **Auth:** CEW split via `createClientForPagePath()`.
- **Query:** `pagePath`, `pollIndex`, `authCode?`.
- **Response:** `{ results, userRankings }` where `results` is the matching `ranking_results` view payload and `userRankings` reflects the caller's previously submitted rankings (where applicable).
- **Backing store:** `ranking_polls`, `ranking_results` view, `ranking_votes`.

### `POST /api/wordcloud-polls/submit`
Record a wordcloud vote.
- **Auth:** CEW split via `createClientForPagePath()`.
- **Body:** `{ pagePath, pollIndex, question, words: string[], maxWords, wordLimit, authCode? }`.
- **Validation:** word count ≤ `maxWords`, per-word length ≤ `wordLimit`, no duplicates after normalization.
- **Response:** `{ success: true, message: 'Words submitted successfully', pollId }`.
- **Backing store:** `rpc('get_or_create_wordcloud_poll_fixed')`; inserts into `wordcloud_votes`.

### `GET /api/wordcloud-polls/results`
Aggregated wordcloud results across survey and CEW paths.
- **Auth:** CEW split via `createClientForPagePath()`.
- **Query:** `pagePath`, `pollIndex`, `authCode?`.
- **Response:** `{ results: { total_votes, words: { text, value }[], user_words: string[] | null } }`.
- **Backing store:** `wordcloud_votes` aggregated across matching polls.

---

## Content

### `GET /api/discussions`, `POST /api/discussions`
List or create forum discussions.
- **Auth:** authenticated via `getAuthAndRateLimit(req, 'discussion')`.
- **GET response:** `{ discussions: Discussion[] }`.
- **POST body:** `{ title, content, category? }`.
- **POST response:** `{ discussion }`.
- **Backing store:** `discussions` table.
- **Rate limiting:** `'discussion'` key.

### `GET|PUT|DELETE /api/discussions/[id]`
Read, update, or delete a single discussion.
- **Auth:** authenticated; `PUT` and `DELETE` additionally require owner match (or admin).
- **Backing store:** `discussions`; `DELETE` cascades to `discussion_replies`.

### `GET|POST /api/discussions/[id]/replies`
List or add replies to a discussion.
- **Auth:** authenticated.
- **Backing store:** `discussion_replies`.

### `GET|POST|PUT|DELETE /api/announcements`
Admin-managed announcements feed.
- **GET:** authenticated (any role).
- **Mutations:** admin only; rate-limited via `getAuthAndRateLimit(req, 'admin')`.
- **Backing store:** `announcements` (via server actions in `src/app/actions/`).

### `POST|PUT|DELETE /api/tags`
Manage content tags.
- **Auth:** admin; rate-limited `'admin'`.
- **Backing store:** `tags`.

### `GET|POST|PUT|DELETE /api/milestones`
Project milestones timeline.
- **GET:** authenticated.
- **Mutations:** admin; rate-limited `'admin'`.
- **Backing store:** `milestones`.

### `GET|PUT|DELETE /api/documents/[id]`
Document metadata operations.
- **GET:** unauthenticated diagnostic stub. Returns `{ message: 'API route working', id, timestamp }` — does NOT query the `documents` table. Used to confirm the dynamic route is registered; do not rely on it for document reads.
- **PUT / DELETE:** authenticated; explicit `user_roles.role='admin'` check inside the handler. PUT body: `{ title, file_url, description, tags? }`. Both verify the document exists before mutating.
- **Backing store (PUT/DELETE only):** `documents`; PUT also rewrites `document_tags` when `tags` is provided; `DELETE` cascades to `document_tags` via FK.
- **Side effects:** none on the Supabase Storage object itself — that is managed separately by upload routes.

No `/api/admin/export` or `/api/admin/analytics` routes exist in the current codebase.

---

## Analysis

### `GET /api/graphs/prioritization-matrix`
Aggregated importance-vs-feasibility matrix for the SSTAC matrix graphs.
- **Auth:** anonymous Supabase client (no user required; reads public aggregates).
- **Query:** `filter=all|twg|cew` (default `all`).
- **Response:** `EnhancedMatrixData[]` — per-question rows each with an `individualVotes[]` array of `{importance, feasibility}` pairs so the frontend can render jittered dots.
- **Backing store:** ranking vote tables via `ranking_results`-style joins.
- **Side effects:** caches the response in-process for 10 minutes.

No `/api/prioritization-matrix` route (without the `/graphs/` prefix) exists.

---

## Review submission (legacy)

A pre-regulatory-review submission flow that writes to `review_submissions` and Supabase Storage. Still in use for the non-regulatory reviewer workflow.

### `POST /api/review/save`
Upsert an in-progress review.
- **Auth:** authenticated.
- **Body:** `{ formData: ReviewFormData }`.
- **Response:** `{ submissionId }`.
- **Backing store:** `review_submissions` with `status='IN_PROGRESS'`.

### `POST /api/review/submit`
Finalize a review.
- **Auth:** authenticated.
- **Body:** `{ formData }`.
- **Response:** `{ submissionId }`.
- **Backing store:** `review_submissions.status='SUBMITTED'`.

### `POST /api/review/upload`
Upload a supporting file for a review.
- **Auth:** authenticated.
- **Body:** `multipart/form-data` with a `file` part **and** a `submissionId` part. Both are required (omit `submissionId` and the route returns 400 `Submission ID is required`).
- **Validation:** MIME whitelist (`pdf`, `docx`, `doc`, `txt`, `xlsx`); 10 MB cap (over-limit returns 413). Extension must match the whitelist. The submission must belong to the calling user.
- **Response:** `{ success: true, file: ReviewFileRow, message: 'File uploaded successfully' }`.
- **Backing store:** Supabase Storage bucket `documents` at `review-files/{userId}/{ts}-{rand}.{ext}`; inserts a `review_files` row.

---

## Regulatory Review — guard model (applies to all `/api/regulatory-review/**` and `/api/hitl-packets/**` sections below)

The regulatory-review surface uses three different guard combinations. Read this table before using any individual entry; per-route entries below assume this model and call out only deviations.

| Guard combination | Routes |
|---|---|
| `requireAdmin()` + `requireLocalEngine()` | `projects` (list/create), `projects/[id]` (read/patch/delete), `projects/[id]/files` (list/upload), `projects/[id]/files/[fileId]` (delete), `projects/[id]/extract`, `projects/[id]/extract-status`, `projects/[id]/evaluate`, `projects/[id]/evaluate-status`, `assistant/chat`, `assistant/models` |
| `requireAdmin()` only (no local-engine gate) | `assessments`, `assessments/[csapId]`, `submissions`, `judgments`, `matching-detail`, `progress`, `validation-stats`, `search`, `submission-search` |
| Authenticated Supabase session via `createAuthenticatedClient()` + `getAuthenticatedUser()` (returns 401 if no user; no admin check) | `hitl-packets` (list), `hitl-packets/[sessionId]`, `hitl-packets/[sessionId]/csv`, `hitl-packets/[sessionId]/md` |
| No guards | `regulatory-review/run-engine` (deprecated 501 stub) |

These routes read/write the submission SQLite DB (`src/data/regulatory-review.db`) via helpers in `src/lib/sqlite/queries/**`. The local-engine-gated subset additionally touches the Regulatory-Review sibling repo filesystem at `C:/Projects/Regulatory-Review/1_Active_Reviews/`. Routes that read the policy KB use the engine DB at `{cwd}/../Regulatory-Review/engine/data/rraa_v3_2.db`.

The HITL packet routes serve pre-generated packet artifacts. They require an authenticated Supabase session (the route returns 401 without one) but do not require admin role or local-engine gate. Path-traversal is prevented inside each handler via `isValidSessionId()`.

---

## Regulatory Review — projects

### `GET /api/regulatory-review/projects`
List review projects.
- **Response:** `{ projects: ReviewProject[] }`.
- **Backing store:** `review_projects` (submission DB).

### `POST /api/regulatory-review/projects`
Create a project and its on-disk folder tree.
- **Body:** `{ siteId, applicationTypes: string[], siteName?, applicantName?, applicantCompany?, selectedServices?, submissionDate?, siteAddress?, siteRegion?, notes? }`. `siteId` and a non-empty `applicationTypes` array are both required (otherwise 400 `siteId and at least one applicationTypes entry are required`).
- **Response:** `{ project }` with HTTP 201.
- **Side effects:** creates `C:/Projects/Regulatory-Review/1_Active_Reviews/{sanitize(siteId + "_" + applicationTypes[0])}/{0_Source_Documents,1_Extractions,2_Evaluation_Output}/`. Inserts a `review_projects` row (status `'created'`, `application_type` stored as JSON-encoded array). **Note:** the base path is hardcoded — see `docs/NEXT_STEPS.md` for the deferred env-var migration.

### `GET /api/regulatory-review/projects/[id]`
Fetch a single project together with its uploaded source-document file list.
- **Response:** `{ project, files }` where `files` is `getProjectFiles(id)`. There is no `counts` field — derive any per-file counts client-side or with a follow-up query.

### `PATCH /api/regulatory-review/projects/[id]`
Partial-update a project (status, display metadata).
- **Body:** a subset of `ReviewProject` fields.
- **Response:** `{ project }`.

### `DELETE /api/regulatory-review/projects/[id]?deleteFiles=true`
Delete a project row and optionally its on-disk folders.
- **Query:** `deleteFiles=true|false` (default `false`).
- **Side effects:** always deletes the `review_projects` and `review_files` rows. When `deleteFiles=true`, recursively removes the on-disk project folder.

### `GET|POST /api/regulatory-review/projects/[id]/files`
List or upload source documents for a project.
- **GET response:** `{ files: ReviewFile[] }`.
- **POST body:** `multipart/form-data` with repeated `files` parts.
- **POST side effects:** writes each file into `{ACTIVE_REVIEWS_BASE}/{folder_path}/0_Source_Documents/`; inserts `review_files` rows.

### `DELETE /api/regulatory-review/projects/[id]/files/[fileId]`
Remove a source document.
- **Side effects:** deletes the `review_files` row and the on-disk file.

---

## Regulatory Review — extraction & evaluation

### `POST /api/regulatory-review/projects/[id]/extract`
Spawn the Docling extraction subprocess.
- **Body:** `{ mode: 'new' | 'full', files?: string[] }`.
- **Response:** `{ status: 'started', progressFile }`.
- **Side effects:**
  - Spawns detached `pythonw.exe` running `C:/Projects/Regulatory-Review/engine/scripts/dashboard_extract.py` with `--source-dir`, `--output-dir`, `--progress-file` args. Fail-closed if `pythonw.exe` is not found at the `REG_REVIEW_PYTHON_PATH` location (returns 500).
  - Writes `.extraction_status.json` (via the child process) and `.extraction_spawn.log` (via the route) inside the project folder.
  - Sets `review_projects.status='extracting'`.

### `GET /api/regulatory-review/projects/[id]/extract-status`
Poll extraction progress.
- **Response:** the contents of `.extraction_status.json`, or `{ status: 'not_started' }` when the file doesn't exist yet, or `{ status: 'error', error: '... timed out ...' }` on stale timeout.
- **Stale detection:** uses `updatedAt` heartbeat in the JSON (falling back to file mtime). Timeout is `EXTRACT_STALE_TIMEOUT_MS` (default 30 minutes).
- **Side effects:**
  - On clean `completed`: marks unprocessed files as processed and sets `review_projects.status='extracted'`, then atomically attempts `UPDATE review_projects SET status='evaluating' WHERE id=? AND status='extracted'` and, if it wins the race, calls `spawnEvaluation()` (see below). On spawn failure, sets `status='eval_failed'`.
  - On `completed_with_errors`: only sets `status='extracted'` (no auto-chain; requires user review).
  - On `error` or stale timeout: sets `status='extract_failed'`.

### `POST /api/regulatory-review/projects/[id]/evaluate`
Manually spawn the evaluation subprocess.
- **Body:** empty or `{}`.
- **Response:** `{ status: 'started' }`.
- **Side effects:** calls `spawnEvaluation(project)` from `@/lib/regulatory-review/launch-evaluation` — spawns the detached Python evaluation subprocess.

### `GET /api/regulatory-review/projects/[id]/evaluate-status`
Poll evaluation progress.
- **Response:** parsed `.evaluation_status.json` plus, on clean completion, an `importResult` payload.
- **Stale detection:** `EVAL_STALE_TIMEOUT_MS` (default 30 minutes).
- **Side effects:** on completion, calls `importResultsToDatabase()` (overriding `submission_id` to `project.id`) to pull the engine's JSON output into the submission DB. `importResult` reports `{ submissionCreated, assessmentsImported }`.

---

## Regulatory Review — assessments & judgments

### `GET /api/regulatory-review/assessments`
List evaluation assessments with filtering.
- **Query:** `submissionId` (required), `tier?`, `status?`, `result?`, `section?`, `sheet?`, `offset?`, `limit?` (default 50, max 500).
- **Response:** `{ assessments: Assessment[], pagination: { total, offset, limit, hasMore }, filtersApplied: { submissionId, tier?, status?, result?, section?, sheet? } }`. Camel-cased; evidence fidelity/rank metadata passed through; location strings cleaned.
- **Backing store:** submission DB `assessments` table.

### `GET|PATCH /api/regulatory-review/assessments/[csapId]`
Read or update a single assessment.
- **Path param:** numeric assessment id or CSAP string (e.g. `"DSI-1.2.3"`).
- **PATCH body:** partial judgment update.
- **Tier constraints** (enforced in PATCH):
  - TIER_1_BINARY: full authority (any status / judgment).
  - TIER_2_PROFESSIONAL: may NOT set `status='ACCEPT'` or `judgment='OVERRIDE_PASS'`.
  - TIER_3_STATUTORY: only `judgment='DEFER'` allowed.
  - Violations return 422.
- **Backing store:** submission DB `assessments` table.

### `GET /api/regulatory-review/submissions`
Full submission list with summary stats.
- **Response:** `{ submissions: SubmissionSummary[] }`.

### `POST /api/regulatory-review/judgments`
Bulk judgment update (1 ≤ N ≤ 100 per request).
- **Body:** `{ submissionId: string, judgments: BulkJudgmentItem[] }`. Each `BulkJudgmentItem` is `{ assessmentId: number, humanResult?, humanConfidence?, evidenceSufficiency?, includeInFinal?, finalMemoSummary?, followUpNeeded?, judgmentNotes?, overrideReason? }` (camelCase; see route source for enum values and length caps).
- **Validation:** Zod schema with refinement — `overrideReason` must be ≥ 10 chars when `humanResult` is `OVERRIDE_PASS` or `OVERRIDE_FAIL`. The submission must exist; each assessment must exist and belong to that submission. Tier constraints apply per-item (see `assessments/[csapId]` PATCH section).
- **Response:** `{ processed: number, succeeded: number, failed: number, results: Array<{ assessmentId, success, error?, judgmentId? }> }`. Status `200` when all succeed, `207` when partially successful, `422` when all fail.

### `GET|POST /api/regulatory-review/matching-detail`
Matching rationale and baseline validation.
- **GET query:** `csapId`, `submissionId`.
- **GET response:** rebuilt matching rationale from the underlying assessment row.
- **POST body:** `{ csapId, submissionId, classification: 'TP'|'FP'|'TN'|'FN', notes? }`.
- **POST side effects:** upserts `baseline_validations`.

---

## Regulatory Review — assistant

Conversational assistant over the policy KB and current submission, backed by Ollama.

### `POST /api/regulatory-review/assistant/chat`
Streamed assistant response (Server-Sent Events).
- **Body:** `{ submissionId, query, scope: 'policy' | 'submission' | 'hybrid', mode: 'fast' | 'deep', model?, history?: ChatTurn[] }`.
- **Response:** `text/event-stream` emitting `citation`, `delta`, `meta`, `done`, and `error` events.
- **Backing stores:**
  - `RRAA_DB_PATH = {cwd}/../Regulatory-Review/engine/data/rraa_v3_2.db` — policy KB.
  - `SUBMISSION_DB_PATH = src/data/regulatory-review.db` — current submission evidence.
- **Ollama:** POSTs to `{OLLAMA_BASE_URL}/api/chat`; the exact model is chosen per `mode` from `MODEL_REGISTRY.{fast,deep}.allowed`. Indigenous-content queries trigger a hard-stop response.
- **History:** trimmed to the last 10 turns before being sent to the model.

### `GET /api/regulatory-review/assistant/models`
Lists every Ollama model from the local instance with its fast/deep capability flags derived from `MODEL_REGISTRY.fast.allowed` / `.deep.allowed`.
- **Response:** `{ models: Array<{ name: string, size: string, capabilities: ('fast' | 'deep')[] }> }`. `size` is the parameter-size string (e.g. `"7B"`) or a formatted byte string when Ollama omits parameter size. Models that are not in either allow-list are still returned, with an empty `capabilities` array — UI must filter.
- **Errors:** `{ models: [], error: string }` (HTTP 200) when Ollama is unreachable or returns a non-OK status.
- **Backing source:** proxies `{OLLAMA_BASE_URL}/api/tags`.

---

## Regulatory Review — search

### `GET /api/regulatory-review/search`
Policy knowledge-base search.
- **Query:** `q` (≥ 2 chars, required), `tier?`, `topic?`, `limit?` (≤ 100).
- **Response:** `{ query, count, results: PolicyRow[], filters: { topics: string[], tiers: string[] } }`.
- **Backing store:** policy DB FTS5 virtual table; falls back internally to `LIKE` queries when FTS5 is unavailable (the response shape does not change between paths).

### `GET /api/regulatory-review/submission-search`
Full-text scan over submission evidence.
- **Query:** `q`, `submissionId`, `location?`, `limit?`.
- **Response:** `{ query, count, results: EvidenceHit[], filters: { locations: string[] } }`.
- **Backing store:** in-memory JSON scan over `assessments.evidence_found`. Performance limitation flagged in `docs/NEXT_STEPS.md` (denormalized search table / FTS index is a deferred enhancement).

---

## Regulatory Review — validation & progress

### `GET /api/regulatory-review/progress`
Review progress summary for a submission.
- **Query:** `submissionId`.
- **Response:** `{ progress: ReviewProgress, details, submission }`.
  - `progress` — `ReviewProgress` from `src/lib/regulatory-review/types.ts`: `{ totalItems, tierBreakdown: { tier1, tier2, tier3 }, statusBreakdown: { autoPassed, pendingReview, reviewed, deferred }, progressPercent, itemsNeedingAttention }`.
  - `details` — raw progress counters from the `getProgress()` query (camelCased).
  - `submission` — selected fields from the submission row (counts, tier breakdown, recommendation, completion timestamp).

### `GET /api/regulatory-review/validation-stats`
Baseline validation statistics.
- **Query:** `submissionId`.
- **Response:** `{ submissionId, totalItems, stats: { totalValidated, progressPercent, breakdown: { truePositive, falsePositive, trueNegative, falseNegative }, rates: { precision, recall, f1Score, falsePositiveRate, falseNegativeRate }, byTier }, benchmarks: { tier1: { targetFpRate, targetFnRate }, tier2: { ... } }, meetingTargets: { tier1Fp, tier1Fn, tier2Fp, tier2Fn } }`.
- **Source:** baseline classifications (TP/FP/TN/FN) compared against `ENGINE_BASELINE_COMPARISON` benchmarks.

---

## HITL packets

Pre-generated human-in-the-loop review packets discovered on disk under `HITL_PACKET_DIR` (default `{ACTIVE_REVIEWS_BASE}/_hitl_packets/`). All four routes require an authenticated Supabase session (return 401 without one) but do not enforce admin role or local-engine gate.

### `GET /api/hitl-packets`
List discovered packet sessions.
- **Auth:** authenticated session (`createAuthenticatedClient()` + `getAuthenticatedUser()`); 401 if absent.
- **Response:** `{ sessions: { sessionId, hasCSV, hasMD, metadata, modifiedAt }[], count }`.
- **Source:** `discoverPacketSessions()` from `@/lib/hitl-packets`.

### `GET /api/hitl-packets/[sessionId]`
Packet metadata plus validation result.
- **Auth:** authenticated session; 401 if absent.
- **Response:** `{ packet, validation }`.
- **Security:** `isValidSessionId(sessionId)` path-traversal guard — rejects ids containing `..`, path separators, or null bytes.

### `GET /api/hitl-packets/[sessionId]/csv`
Download the pre-generated CSV.
- **Auth:** authenticated session; 401 if absent.
- **Response:** `text/csv` with `Content-Disposition: attachment; filename="HITL_PACKET_{sessionId}.csv"`.

### `GET /api/hitl-packets/[sessionId]/md`
Download the pre-generated markdown packet.
- **Auth:** authenticated session; 401 if absent.
- **Response:** `text/markdown` with `Content-Disposition: attachment; filename="HITL_PACKET_{sessionId}.md"`.

---

## Deprecated

### `POST /api/regulatory-review/run-engine` — DEPRECATED
Returns HTTP 501 with a deprecation message redirecting callers to `POST /api/regulatory-review/projects/[id]/evaluate`. Removal is tracked in `docs/NEXT_STEPS.md`.

---

## What is NOT here

The following routes are referenced in older documentation but do not exist in the current codebase. If you need them, check `git log` and `docs/_meta/DOCUMENTATION_AUDIT_2026-04.md` §1.3 for context:

- `/api/auth/login`, `/api/auth/logout`, `/api/auth/user`, `/api/auth/refresh` — session mutations go through Supabase directly.
- `/api/admin/export`, `/api/admin/analytics` — never implemented under those paths.
- `/api/polls`, `/api/polls/:id`, `/api/polls/:id/vote`, `/api/polls/:id/results` — the actual poll surface is the `submit`/`results` pair per poll system described above.
- `/api/prioritization-matrix` (no `/graphs/` prefix) — the real route is `/api/graphs/prioritization-matrix`.
- `/api/wordcloud/results` — the real route is `/api/wordcloud-polls/results`.
- `/api/regulatory-review/submission` — no singular `submission` route exists; see `submissions` (plural) and `assessments`.

---

## How to update this file

1. **Identify the route.** Open `src/app/api/**/route.ts`.
2. **Read the code, not the old doc.** The authoritative signature is the exported `GET`/`POST`/etc. handler. Imported helpers (`requireAdmin`, `requireLocalEngine`, `getAuthAndRateLimit`, Zod schemas) tell you the auth/validation story.
3. **Update the matching section here** — smallest possible diff.
4. **Run the checkpoint convention** (`npm run docs:gate -- --base origin/main --head HEAD`, plus manifest JSON parse and path-existence checks) before commit.
5. Do not add routes to this file speculatively. If a route is planned but not implemented, that is a `docs/NEXT_STEPS.md` entry, not an API_REFERENCE entry.

# Engine_v2 Frontend Build - Narrow Vertical Slice (Lane 1) + Queued Lane 2 - v7.19 (codex-GREEN with audit corrections)

## v7.19 Changelog (Rounds 14-17 Opus + Rounds 18-33 codex desktop + R25 restructure, 2026-05-11; in-session)

**v7.19 CONVERGENCE STATE: codex desktop R32 emitted GREEN-LIGHT on v7.17 with 0 BLOCKER + 0 IMPORTANT + 1 NIT. R33 audit pass on v7.18 caught 1 IMPORTANT + 1 NIT in cross-cutting wording / stale labels that the prior cleanup missed. v7.19 closes both. Plan is codex-GREEN with all known cross-cutting wording reconciled; ready for ExitPlanMode + Module L1-1 implementation.**

R33 closures (v7.19):
- IMPORTANT 115: Engineering Decisions "Known limitation (Finding 42)" bullet still said "TUS-success + /files/complete failure -> client calls /files/orphan", which reopened F111. CLOSED: rewritten to the strict 4-way classification ("TUS-success + parsed non-2xx with literal `orphan_cleanup_required === true` -> orphan; AMBIGUOUS and CLEANUP-UNKNOWN paths never orphan").
- NIT 116: Two stale current-version labels remained (Context "v7.17 (current)" and L1-1 EXIT GATE "v7.4 patch"). CLOSED: updated to v7.19 (Context) and "current `database_schema_engine_v2_patch.sql`" (EXIT GATE).

R32 closure (v7.18):
- NIT 114 (final): stale current-facing version labels (v7.6, v7.12, v7.15, v7.16) lingered in a handful of lines after F108/F113 cleanup passes. CLOSED: replaced with v7.18 OR version-neutral wording ("current plan", "current patch"). No execution semantics changed.

Prior round closures (v7.17):

R31 closures (v7.17):
- IMPORTANT 110: F105/F107 route-level tests claimed in changelog but only UploadStep.test.tsx (client) was added to L1-3 allowlist; no server-route test file. CLOSED: added `src/app/api/engine-v2/files/complete/__tests__/route.test.ts` to L1-3 allowlist with test cases covering: 401/403/415 auth+CSRF + boolean flag; 400 Zod + flag; 403 ownership + flag; 400 HEAD mismatch + flag; 400 filename + flag; 500 SHA streaming + flag; 400 magic mismatch + flag through helper outcomes; 409 file_id_reused + `false` flag; 413 cap_preflight + true flag through helper outcomes; 200 idempotent retry (no flag); 23505/23514 step 11 outcomes per their explicit response bodies.
- IMPORTANT 111: Cross-cutting wording still says "/files/complete failure -> client calls /files/orphan" without distinguishing DECISIVE true vs DECISIVE false vs CLEANUP-UNKNOWN vs AMBIGUOUS. Subagent could implement the broad summary. CLOSED: reworded the cross-cutting summaries to: "client calls `/files/orphan` only after a parsed non-2xx `/files/complete` response with literal `orphan_cleanup_required === true`; ambiguous and cleanup-unknown paths never call orphan."
- NIT 112: Step 11 summary in universal-schema block conflicted with the explicit 23505 storage-error branch (summary said all 23505 cleanup paths set true; actually storage-error returns 200 with no flag). CLOSED: summary reworded to match branch text.
- NIT 113: Stale v7.x version references remain after F108. CLOSED: another cleanup pass; lingering refs labeled explicitly as historical where appropriate.

R30 closures (v7.16):
- IMPORTANT 105: requireAdminForApi + csrf.ts return generic responses without orphan_cleanup_required; /files/complete early auth/CSRF/Zod/ownership/HEAD/filename/SHA failures emit those generic responses without the required flag. CLOSED: added `/files/complete`-local error wrapper `fileCompleteError(status, body, orphanCleanupRequired)` that constructs the response with the required field; ALL pre-step-8 failure paths in /files/complete use this wrapper (NOT the shared helpers' direct responses). Test added: 403/415/400 from /files/complete include the boolean flag.
- IMPORTANT 106: Step 11 23505/23514 branch outcomes still say "return HTTP 500 fail-closed" / "return HTTP 413" without showing response body including the flag. Subagent could miss. CLOSED: each branch now shows explicit response body: 23505 helper success path -> 200 with existing row (no flag); 23505 helper guard_query_error -> 500 with `{error, orphan_cleanup_required: true}`; 23505 helper storage_error -> 200 with existing row + log warning (cleanup deferred); 23514 helper success -> 413 with `{error, cap_kind, current_value, limit, orphan_cleanup_required: true}`; 23514 helper guard_query_error -> 500 with `{error, orphan_cleanup_required: true}`; 23514 helper storage_error -> 413 with `{error, ..., orphan_cleanup_required: true}` (cap dominant; cleanup deferred).
- IMPORTANT 107: F99/F100 test claims not in operative `UploadStep.test.tsx` list. CLOSED: explicit test bullets added: (a) parsed 409 file_id_reused_with_different_content + `orphan_cleanup_required: false` -> UploadStep does NOT call /files/orphan, surfaces conflict error; (b) parsed non-2xx with missing/null/string/non-boolean flag -> UploadStep does NOT call /files/orphan, treats as cleanup-unknown, surfaces original error; (c) parsed 413 with `orphan_cleanup_required: true` -> UploadStep calls /files/orphan; (d) parsed 500 with `orphan_cleanup_required: true` -> UploadStep calls /files/orphan. Route-level test added (server side): every /files/complete non-2xx response body includes a literal boolean `orphan_cleanup_required` field.
- NIT 108: Stale v7.12/v7.6 audit refs remain. CLOSED: cleanup pass.
- NIT 109: Cross-references review-count stale (says 25 rounds + R14-26). CLOSED: replaced with "see changelog above for round-by-round detail" to avoid drift.

R29 closures (v7.15):
- IMPORTANT 99: F94 `orphan_cleanup_required` flag was added in changelog but not enumerated for every operative /files/complete error branch. Step 11 23505 guard_query_error, 23514 cap branches, earlier validation/HEAD/streaming failures all lacked explicit flag. CLOSED: defined a required `/files/complete` error response schema -- EVERY non-2xx response body MUST include `orphan_cleanup_required: boolean` (true | false; no other values). Each operative branch (steps 1-2 auth/CSRF rejects, step 3 Zod reject, step 4 ownership probe 403, step 5 HEAD mismatch, step 6 filename safety reject, step 7 SHA streaming failure, step 8 magic mismatch + helper outcomes, step 9 idempotent-retry mismatch 409, step 10 cap-preflight + helper outcomes, step 11 INSERT outcomes) explicitly sets the flag. Tests added: 409+false, 413+true, 500+true cleanup-branch coverage.
- IMPORTANT 100: F94 "missing field -> treat as TRUE" fallback recreated the unsafe default. CLOSED: client classification updated -- literal `orphan_cleanup_required === true` IS the only condition that triggers /files/orphan; literal `=== false` suppresses cleanup AND surfaces the original error; ANY OTHER value (undefined, null, non-boolean, missing) is treated as **cleanup-unknown** -- client does NOT call /files/orphan, optionally polls /files/exists for safety, and surfaces the original error to the user. Defense-in-depth against server bugs / version drift.
- NIT 101: F95 changelog still overstated storage_error behavior. CLOSED: changelog line reworded to match operative.
- NIT 102: F96 stale audit refs still at v7.12. CLOSED: updated to v7.15.
- NIT 103: F97 ED still said L1-6 catch is at step 8 (operative now step 9 after renumbering). CLOSED.
- NIT 104: F98 cap-edge wording contradicted itself across ED, handoff, and Lane 2 sections. CLOSED: aligned all three to "remaining edge is new file_id + SAME sha256 at cap"; new file_id + NEW sha256 at cap is normal cap rejection (not an edge).

R28 closures (v7.14):
- IMPORTANT 94: DECISIVE path too broad -- parsed 409 `file_id_reused_with_different_content` is a semantic error, not cleanup-worthy, but UploadStep currently calls /files/orphan on every parsed non-2xx. CLOSED: server adds `orphan_cleanup_required: boolean` to ALL /files/complete error response bodies. Set to TRUE for 400 magic_mismatch, 413 cap_exceeded, 500 unexpected errors (where the just-uploaded storage object IS orphan-eligible OR the server-side cleanup already deleted it making the orphan call a safe no-op via the helper's idempotency). Set to FALSE for 409 file_id_reused_with_different_content (the storage at the existing file_id's path is legitimately referenced by another row; orphan call must NOT delete it). UploadStep DECISIVE path now checks `parsed_body.orphan_cleanup_required` -- only calls /files/orphan when TRUE. New test: parsed 409 file_id_reused_with_different_content with `orphan_cleanup_required: false` -> UploadStep does NOT call /files/orphan, surfaces conflict error to user.
- NIT 95: F84 changelog overstated storage_error handling. CLOSED: changelog reworded to match operative -- storage_error returns HTTP 500 for magic-mismatch cleanup AND 23505 cleanup; returns HTTP 413 for cap-preflight AND 23514 cleanup (cap is the dominant error in those branches; storage cleanup deferred to Lane 2 janitor); guard_query_error returns HTTP 500 universally (fail-closed).
- NIT 96: Stale v7.12/pre-R27 audit refs. CLOSED: one cleanup pass.
- NIT 97: L1-6 step 8 catch description says "materialization throw from step 7" -- should say step 8 (renumbering carry-over). CLOSED.
- NIT 98: Cap-trigger known-minor wording stale after F64 idempotent-retry fix. CLOSED: handoff/Lane 2 wording updated -- F32 known minor now applies only to NEW file/new SHA at cap (not retries of existing finalized file); Lane 2 reordering deferred only for that narrow case.

R27 closures (v7.13):
- IMPORTANT 84: /files/complete cleanup paths invoke deleteUnfinalizedStorageObject but don't specify outcome handling for each helper return. CLOSED: every cleanup site (steps 8, 10, 11's 23505/23514 handlers) now explicitly enumerates handling for `guard_query_error:*` (fail closed, return HTTP 500 + structured error, do NOT proceed), `finalized_row_references_path` (race window with finalization; re-SELECT and return existing row HTTP 200 where the operation's semantics allow, OR return HTTP 200/409 with the existing row), `storage_error:*` (log and surface HTTP 500 with the original operation context).
- IMPORTANT 85: UploadStep.test.tsx omits broadened-AMBIGUOUS scenarios (2xx-with-json-failure; non-2xx-with-parse-failure). CLOSED: test list extended -- "mock 2xx response then `response.json()` throws SyntaxError -> AMBIGUOUS path (poll /files/exists, NO /files/orphan)" + "mock non-2xx response with body that fails to parse as JSON -> AMBIGUOUS path (poll /files/exists, NO /files/orphan)".
- IMPORTANT 86: Universal delete-order rule said "no DELETE before step 9 idempotent check" but step 8 magic-mismatch DELETE happens earlier. CLOSED: invariant reworded -- "no UNGUARDED Storage DELETE in /files/complete; ALL DELETE paths (steps 8, 10, 11) MUST go through `deleteUnfinalizedStorageObject` which fails closed on guard error and refuses if any active row references the path."
- IMPORTANT 87: filename_safety.test.ts ownership ambiguous (file moved to L1-1 but test description stayed under L1-3 Tests block). CLOSED: filename_safety.test.ts bullet now lives under L1-1 Unit tests; L1-3 references it as already-landed foundation prerequisite.
- IMPORTANT 88: F80 zero-file guard had no required test coverage. CLOSED: added to L1-6 spawn_extraction.test.ts -- "POST /extract returns 400 `{error: 'no_active_files'}` when no active v2_submission_files exist for the project; verify NO v2_extraction_runs row was inserted; verify NO subprocess was spawned".
- NIT 89: Helper placement typo -- one ref said L1-1 instead of L1-3. CLOSED.
- NIT 90: Ownership-pattern summary omitted /files/exists. CLOSED: /files/exists added.
- NIT 91: Smoke PowerShell syntax was shell-style. CLOSED: rewritten as proper PowerShell: `$beforeCount = (tasklist | findstr pythonw | Measure-Object).Count`.
- NIT 92: L1-6 step 7 duplicated (zero-file guard insertion didn't renumber). CLOSED: renumbered.
- NIT 93: Codex Review Strategy section has duplicate/stale bullets. CLOSED: collapsed to one current implementation-phase bullet + one current high-risk bullet.

Twelve adversarial rounds + 1 workflow restructure. Four Opus (R14-17) + eight codex desktop (R18-24 whole-plan loop, then R25 restructure, then R26 comprehensive on v7.11) closed cumulative 78 findings. v7.12 closes R26's 11 findings (2 BLOCKER + 6 IMPORTANT + 3 NIT) -- several of which were operative/allowlist gaps where prior rounds' fixes were described in changelog but not fully wired into the operative plan body.

R26 closures (v7.12):
- BLOCKER 73: storage_safe_delete.ts + test missing from L1-3 file allowlist. CLOSED: added.
- BLOCKER 74: safe-delete helper fails OPEN on guard-query error. CLOSED: helper rewritten to capture `{data, error}`; on `error`, returns `{deleted: false, reason: 'guard_query_error'}` BEFORE any storage delete. Tests added.
- IMPORTANT 75: F71 ambiguous-path closure was in changelog but L1-3 operative behavior + tests still said "fetch throw only". CLOSED: L1-3 UploadStep flow + UploadStep.test.tsx updated to define AMBIGUOUS as "any failure before obtaining a confirmed-non-2xx response with successfully parsed error body" (covers AbortError, TypeError 'Failed to fetch', 2xx response with body-read/parse failure, connection reset, etc.).
- IMPORTANT 76: /files/orphan bypasses shared deleteUnfinalizedStorageObject helper. CLOSED: orphan step 8 now invokes the helper; handle skipped/error returns properly.
- IMPORTANT 77: Engineering Decisions Duplicate-SHA + cap section described stale flow (step 9 cap, direct deletes). CLOSED: ED section rewritten to match the renumbered L1-3 flow (step 9 idempotent-retry safety, step 10 cap preflight, step 11 INSERT, all deletes via helper).
- IMPORTANT 78: L1-1 zod.test.ts claimed filename-safety coverage, but filename_safety.ts was in L1-3. Cross-module test dependency. CLOSED: filename_safety.ts + its test moved from L1-3 to L1-1 foundation allowlist; Zod payload validation that depends on filename safety now imports from L1-1.
- IMPORTANT 79: Smoke 13b operative text only delays server; missing client-side AbortSignal.timeout. CLOSED: smoke step 13b updated to include both server `testDelay=3000` AND client `AbortSignal.timeout(1000)` under non-production test flag.
- IMPORTANT 80: Extract can start with zero files (UI disable doesn't check file count; API doesn't reject empty). CLOSED: ExtractTriggerButton UI rule extended to also disable when active file count == 0; POST /extract returns HTTP 400 BEFORE creating run row if active file count == 0.
- NIT 81: Cap-override contract in ProjectCreatePayload contradicts project create flow. CLOSED: ProjectCreatePayload max_files/max_total_bytes override fields removed; defaults always used in Lane 1 (admin can later UPDATE row via SQL). Lane 2 can re-add explicit override path.
- NIT 82: Smoke subprocess check `tasklist | findstr pythonw` is unreliable globally. CLOSED: smoke step 7 updated to count pythonw processes BEFORE and AFTER, verify delta is 0 (idempotency holds; second click should not spawn additional process).
- NIT 83: Stale audit/history wording. CLOSED: one cleanup pass across history/cross-refs.

### Round 14 (Opus, against v6.x): 20 findings (6 BLOCKER + 9 IMPORTANT + 5 NIT)
- BLOCKER 1: Service-role contradiction at v6 line 65 vs L1-3 body. CLOSED in v7: zero service-role usage in Lane 1; authenticated server client + RLS for all storage ops.
- BLOCKER 2: Web Crypto chunked-digest fiction. CLOSED in v7: Node `crypto.createHash('sha256')` mandated; `crypto.subtle.digest` BANNED.
- BLOCKER 3: Node version + iteration pattern unspecified. CLOSED in v7: Node >= 20.x via `engines.node`; explicit `getReader()`/`read()` loop; `for await` rejected.
- BLOCKER 4: Duplicate-SHA TOCTOU race. CLOSED in v7: INSERT-first 23505-catch pattern.
- BLOCKER 5: Extract re-trigger race. CLOSED in v7: partial unique index `idx_v2_extraction_runs__one_active` + 23505-catch returning 409.
- BLOCKER 6: Pre-create row visibility + missing-status-file baseline. CLOSED in v7: pre-create auto-commits before spawn; GET stale-check uses `started_at` baseline when status file missing AND row.status in (pending, extracting).
- IMPORTANT 7: Stale-transition race with live extractor. CLOSED in v7: extended `EXTRACT_STALE_TIMEOUT_MS` default to 60min; PID-based liveness deferred to Lane 2.
- IMPORTANT 8: Ownership-verification pattern unspecified. CLOSED in v7: standardized sentinel `SELECT id FROM v2_projects WHERE id = $project_id` via authenticated client; RLS returns 0 rows on cross-admin attempt -> 403.
- IMPORTANT 9: MIME magic-number validation. CLOSED in v7 (refined in v7.1, see Finding 21): validate first 8 bytes during streaming SHA loop.
- IMPORTANT 10: Max-files-per-project DoS. CLOSED in v7 (refined in v7.1, see Finding 23): `max_files`/`max_total_bytes` columns + cap enforcement.
- IMPORTANT 11: CSRF + rate-limit. CLOSED in v7 (refined in v7.1, see Finding 24): Content-Type + Origin check on POST/DELETE; rate-limit deferred to Lane 2.
- IMPORTANT 12: NFC normalization + byte length. CLOSED in v7: `.normalize('NFC')` + `Buffer.byteLength`.
- IMPORTANT 13: Content-Disposition. CLOSED in v7: Lane 1 doesn't generate signed URLs; Lane 2 enhancement note added.
- IMPORTANT 14: Log redaction. CLOSED in v7: file_id in logs, not original_filename.
- IMPORTANT 15: Path-containment algorithm. CLOSED in v7 (refined in v7.1, see Finding 25): explicit `path.resolve` + case-aware comparison + `realpath` for symlinks/junctions.
- NIT 16: Idempotent schema patch. CLOSED in v7 (refined in v7.2, see Finding 31): `IF NOT EXISTS` / `DROP POLICY IF EXISTS` + ALTER TABLE ADD COLUMN IF NOT EXISTS for v7.x columns.
- NIT 17: chunkProgress wire shape. CLOSED VERIFIED in v7: dashboard_extract.py:48 declares `chunk_progress: str`; scalar string; TEXT column correct.
- NIT 18: Pre-generate smoke PDF. CLOSED in v7: pypdf pre-generation during L1-7 prep; committed fixture.
- NIT 19: engines.node. CLOSED in v7: added to L1-3 package.json edit allowlist.
- NIT 20: Schedule3Service import shape. CLOSED VERIFIED in v7: schedule3.ts:22 declares `export interface`; `type` keyword correct.

### Round 15 (Opus, against v7): 7 findings (0 BLOCKER + 3 IMPORTANT + 4 NIT)
- IMPORTANT 21: Magic-number capture loses bytes when first chunk < 8 bytes (current `if (!firstBytes)` pattern captures only from first chunk). CLOSED in v7.1: accumulator pattern; capture until firstBytesAccum.length >= 8.
- IMPORTANT 22: `writeStream.write()` backpressure not handled (queue blowup on large files). CLOSED in v7.1 (refined in v7.2, see Finding 28): check write() return; await drain when false; await finish event after end(); v7.2 adds error rejection to drain/finish Promises.
- IMPORTANT 23: Project-cap enforcement TOCTOU race (two parallel uploads each pass count check, both INSERT, cap breached). CLOSED in v7.1: Postgres BEFORE INSERT trigger with `pg_advisory_xact_lock(hashtext('v2_proj_cap_' || project_id))` for atomic per-project serialization; raises ERRCODE 23514 on cap violation.
- NIT 24: Vercel preview deploys may fail CSRF Origin check (NEXT_PUBLIC_SITE_URL hardcoded to production). CLOSED in v7.1: production-strict / preview-permissive / dev-localhost rules documented.
- NIT 25: Path-containment vs Windows junctions/symlinks. CLOSED in v7.1: `fs.realpath` (with parent-dir fallback for not-yet-existing targets) before resolve+containment.
- NIT 26: Materialization in POST handler exceeds Vercel function timeout for large submissions. CLOSED IN v7.1 AS MOOT: Lane 1 extract routes are gated by `LOCAL_ENGINE_ENABLED`; not running on Vercel serverless in any realistic deployment. Lane 2 will revisit if evaluation moves to Vercel.
- NIT 27: Wording clarity on which storage path to DELETE in dup-SHA race recovery. CLOSED in v7.1: explicit "DELETE just-uploaded `<user_id>/<project_id>/<this_request.file_id>/<this_request.file_id>.<ext>` NOT the existing winning row's storage_path".

### Round 16 (Opus, against v7.1): 6 findings (0 BLOCKER + 2 IMPORTANT + 4 NIT)
- IMPORTANT 28: Drain Promise hangs indefinitely on writeStream error (no reject handler for 'error' event). CLOSED in v7.2: dual-listener pattern with off()-cleanup on both drain and finish/error Promises; route never hangs on a stream error.
- IMPORTANT 29: Streaming pattern ambiguous for /files/complete (canonical pattern includes fs.createWriteStream; /files/complete needs hash + magic only, not local materialization). CLOSED in v7.2: pattern split into two named functions exported from streaming_sha256.ts: `computeStreamingSha256AndMagic(signedUrl, headers): Promise<{sha, firstBytes}>` for /files/complete (no writeStream, no local side effect); `materializeToLocal(signedUrl, headers, localPath): Promise<void>` for /extract (writeStream + drain + finish + try/finally partial-file cleanup); lives in storage_materialize.ts.
- NIT 30: Partial-file disk leak on mid-stream error during materialization. CLOSED in v7.2: try/catch wraps the materializeToLocal loop; on any throw, writeStream.destroy() + fs.unlink(localPath).catch(() => {}) drops the partial file.
- NIT 31: Idempotent schema patch is no-op on column additions to pre-existing tables (CREATE TABLE IF NOT EXISTS doesn't add new columns). CLOSED in v7.2: explicit `ALTER TABLE v2_projects ADD COLUMN IF NOT EXISTS max_files INTEGER NOT NULL DEFAULT 50` + `ALTER TABLE v2_projects ADD COLUMN IF NOT EXISTS max_total_bytes BIGINT NOT NULL DEFAULT 524288000` defensively appended after CREATE TABLE block.
- NIT 32: Cap trigger fires before dup-SHA index; at-cap re-upload returns 413 instead of 200. CLOSED in v7.2 BY DOCUMENTATION: accepted as Lane 1 minor UX edge; handoff doc + smoke notes capture the workaround (delete existing file before re-upload at cap, or raise cap first). Trigger-reordering deferred as Lane 2 polish.
- NIT 33: Smoke step 12 wording ambiguous on starting state. CLOSED in v7.2: reworded to "create a fresh test project for cap testing" with explicit fresh-project setup.

### Round 17 (Opus, against v7.2): 3 findings (0 BLOCKER + 1 IMPORTANT + 2 NIT)
- IMPORTANT 34: Missing `mkdir` before `fs.createWriteStream` in `materializeToLocal`. Lane 1 smoke blocker: the first /extract on any new project would have `v2_dashboard_uploads/<project_id>/` as a non-existent parent dir; lazy-open emits 'error' before any await listener is attached; route hangs or crashes. CLOSED in v7.3: `await fs.promises.mkdir(path.dirname(localPath), { recursive: true })` added before `createWriteStream`.
- NIT 35: writeStream 'error' between await boundaries has no listener (defense-in-depth gap). Disk-full or permission-denied mid-stream could emit 'error' outside the drain/finish Promise windows, triggering an unhandled error event. CLOSED in v7.3: persistent `'error'` listener registered at writeStream creation captures errors to a closure variable; each await boundary checks the variable and throws if set; persistent listener removed in finally.
- NIT 36: `reader.releaseLock()` in finally may throw and mask original error. CLOSED in v7.3: `releaseLock()` wrapped in `try { ... } catch { /* original error takes precedence */ }` in both `computeStreamingSha256AndMagic` and `materializeToLocal`.

### Round 18 (Codex desktop, against v7.3): 7 findings (0 BLOCKER + 6 IMPORTANT + 1 NIT)
- IMPORTANT 37: Side-effectful GET /extract-status violates safe-GET semantics + bypasses CSRF. CLOSED in v7.4: route converted from GET to POST `/projects/[id]/extract-status` with full CSRF (Content-Type + Origin) + Zod-validated `{run_id}` body; client polling switches to POST. State sync (row updates, stale transition, quarantine, terminal cleanup) now under CSRF protection.
- IMPORTANT 38: `isContained()` realpath fallback fails when `_quarantine/` parent does not exist on first error transition. CLOSED in v7.4: quarantine base directory `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/_quarantine/` is `mkdir -p`-created BEFORE computing the target path in the quarantine helper; `isContained()` then operates on existing dirs.
- IMPORTANT 39: Schema patch is only partially migration-safe (only v2_projects has defensive ALTERs; v2_extraction_runs missing columns and CHECK changes not handled). CLOSED in v7.4: clean-slate requirement made explicit at L1-1 EXIT GATE (owner confirms no prior v2 schema OR pre-drops it); additional defensive ALTERs added for v2_extraction_runs columns; explicit DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT for the status CHECK to allow re-application without conflict.
- IMPORTANT 40: Orphan cleanup endpoint exists but UploadStep client never calls it on `/files/complete` failure. CLOSED in v7.4: UploadStep client behavior specified: on TUS-success followed by `/files/complete` non-2xx response OR network throw, the client MUST call `/files/orphan` with `{project_id, file_id}` and surface the cleanup result. Tests added.
- IMPORTANT 41: Smoke step 10 idempotency test is race-prone (runs AFTER extraction completes; first re-trigger legitimately spawns a new run). CLOSED in v7.4: smoke step 10 reordered to test idempotency IMMEDIATELY after the first extract trigger (while pending/extracting). UI rule: `ExtractTriggerButton` MUST be disabled while there is a non-terminal `v2_extraction_runs` row for the project; re-enabled only after terminal state.
- IMPORTANT 42: Cap trigger protects `v2_submission_files` but does NOT constrain raw Storage uploads under owned prefix. CLOSED in v7.4 BY DOCUMENTATION + Lane 2 follow-up: Engineering Decisions section makes explicit that Lane 1 caps apply to FINALIZED rows only; admin-owned direct Storage uploads that bypass `/files/complete` are limited by bucket `file_size_limit` + admin-gating + RLS prefix scoping. Lane 2 enhancement: storage-objects janitor that periodically reconciles `storage.objects` under the v2-submissions prefix against `v2_submission_files` rows, deleting orphans older than a TTL.
- NIT 43: `v2_extraction_runs.completed_at` declared but never set. CLOSED in v7.4: all terminal-status transitions (`completed`, `completed_with_errors`, `error`) now set `completed_at = now()` in the same UPDATE.

### Round 19 (Codex desktop, against v7.4): 4 findings (1 BLOCKER + 1 IMPORTANT + 2 NIT)
- BLOCKER 44: Defensive ALTERs for v2_extraction_runs run BEFORE the CREATE TABLE for that table. On clean-slate, Postgres fails with "relation does not exist" before reaching CREATE TABLE. F39 was NOT actually closed in v7.4. CLOSED in v7.5: defensive ALTER block for v2_extraction_runs moved to AFTER the CREATE TABLE v2_extraction_runs statement; the DROP CONSTRAINT IF EXISTS / ADD CONSTRAINT pattern remains migration-safe.
- IMPORTANT 45: csrf.ts and csrf.test.ts owned by L1-3 but used by L1-4 (POST /api/engine-v2/projects). L1-3 and L1-4 are scheduled to run in parallel with disjoint allowlists; if L1-4 is implemented before L1-3 lands, it cannot compile. Same class as the admin_guards.ts orchestration issue codex Round 11 already caught. CLOSED in v7.5: csrf.ts + __tests__/csrf.test.ts moved from L1-3 to L1-1 foundation allowlist, same pattern as admin_guards.ts.
- NIT 46: Engineering Decisions still says "GET stale baseline" after F37 migrated extract-status to POST. CLOSED in v7.5: wording changed to "POST extract-status stale baseline".
- NIT 47: Smoke step reference says "cap rejection (step 12)" but the actual cap test is now step 14 after the F41-driven smoke renumbering. CLOSED in v7.5: reference updated to "cap rejection (step 14)".

### Round 20 (Codex desktop, against v7.5): 5 findings (1 BLOCKER + 2 IMPORTANT + 2 NIT)
- BLOCKER 48: Orphan cleanup can delete a successfully finalized upload after ambiguous `/files/complete` network failure. Scenario: TUS-success -> POST /files/complete -> server INSERTs row + prepares 201 -> network failure on response -> client throws -> client calls /files/orphan -> orphan endpoint lists+deletes the Storage object the row references -> DB row now points to a deleted object. F40 was incompletely closed. CLOSED in v7.6: /files/orphan adds a finalized-row check after deriving expected storage_path -- if `v2_submission_files WHERE storage_path = $expectedPath AND deleted_at IS NULL` returns a row, return HTTP 409 with body indicating "already finalized; not deleting" AND do NOT delete the Storage object. Tests added covering the "complete throws but row exists" scenario.
- IMPORTANT 49: Quarantine mkdir closure not applied to /extract spawn/materialization failure path. F38 was closed for the POST extract-status terminal cleanup path but the /extract route's spawn-failure catch block still only says "MOVE uploads dir to quarantine via isContained()" without ensuring `_quarantine/` parent exists first. First-ever spawn failure still hits the original missing-parent problem. CLOSED in v7.6: factored out a shared `quarantineUploadsDir(projectId)` helper in `storage_materialize.ts` (or a new `quarantine_helper.ts`) that ALWAYS mkdir-recursive's the quarantine base + computes target + runs isContained checks + moves. Used by BOTH /extract failure path AND /extract-status terminal cleanup. Test added: spawn-failure when `_quarantine/` does not yet exist -> helper creates it -> move succeeds.
- IMPORTANT 50: Owner-supplied smoke PDF fallback conflicts with no-protected-literals guardrail. Fallback wording "owner-supplied PDF is acceptable but must be committed for reproducibility" creates a path where binary PDFs containing protected site/personnel/project literals could be committed. Staged text-scan does not inspect binary content. CLOSED in v7.6: fallback rewritten -- owner-supplied PDFs may be used ONLY IF explicitly anonymized AND owner-approved for commit (no PII; no site/personnel/contractor names; no protected literals). Otherwise owner-supplied PDFs are local-only smoke inputs and NOT committed. The pypdf-generated fixture remains the default and committed-by-default path.
- NIT 51: Schema comment overclaims migration of unnamed status CHECK constraints. The `DROP CONSTRAINT IF EXISTS v2_extraction_runs_status_check` only matches the named v7.x constraint; an unnamed/narrower prior CHECK would not be dropped (clean-slate gate avoids this in practice but the comment is inaccurate). CLOSED in v7.6: comment rewritten to "clean-slate is required (see L1-1 EXIT GATE step a); this defensive DROP+ADD only refreshes the named v7.x constraint if a prior named-but-different variant exists. Unnamed prior CHECK constraints are NOT migrated by this pattern; pre-drop the table per the clean-slate gate."
- NIT 52: Cross-reference plan history count is stale (line 66 has 19 rounds via Round 19 changelog header, but cross-references section at line ~970 still says 18 rounds and omits R19). CLOSED in v7.6: cross-references count updated to 20 rounds (5 codex MCP + 12 Opus adversarial + 3 codex desktop); R19, R20 explicitly listed.

### Round 21 (Codex desktop, against v7.6): 5 findings (1 BLOCKER + 2 IMPORTANT + 2 NIT)
- BLOCKER 53: Orphan cleanup STILL races -- F48 only fixed the "complete-then-orphan" direction. The reverse race remains: client throws on fetch (ambiguous network failure) -> calls /files/orphan WHILE /files/complete is still in-flight server-side -> orphan checks v2_submission_files, sees no row yet (commit hasn't happened), proceeds to LIST + DELETE the Storage object -> the still-running /files/complete INSERTs a row pointing to the now-deleted Storage path. Data integrity violation. CLOSED in v7.7 via behavioral change to UploadStep client: DO NOT call /files/orphan on ambiguous fetch throw/abort. Only call /files/orphan on a definitive non-2xx HTTP response from /files/complete (the server returned a verdict, so we know whether finalization happened or not). On fetch throw, treat as "finalization unknown" -> re-fetch the project's file list to detect whether the row exists; if row exists, treat as success; if row doesn't exist after a brief retry window (e.g., 5s with 1s polls), surface a non-fatal toast and rely on the Lane 2 storage-objects janitor (Finding 42 follow-up) to clean up any orphaned Storage object via TTL. F48's finalized-row safety check at /files/orphan is retained as belt-and-suspenders for the definitive-non-2xx path.
- IMPORTANT 54: `quarantineUploadsDir` contract still ambiguous (allows "no throw OR documented throw" on missing source). The route's failure path invokes the helper without a nested try/catch, so a helper throw can mask the original spawn/materialization failure. CLOSED in v7.7: helper contract tightened to return `{moved: false, reason: 'source_missing'}` on missing source (no throw); throw on containment violations or unexpected fs errors. In /extract spawn-failure catch and /extract-status terminal-error cleanup, the helper invocation is wrapped in a best-effort try/catch that logs quarantine failures WITHOUT masking the original error response or the row's terminal status. Test cases updated.
- IMPORTANT 55: Smoke PDF is blank (pypdf.add_blank_page); smoke can pass without validating Docling actually extracted text. CLOSED in v7.7: smoke PDF generation uses a minimal text-bearing PDF containing the literal string "Engine v2 lane 1 smoke text"; smoke step 10 asserts that this string appears in the VERBATIM JSON output at `v2_dashboard_extracts/<project>/`. This verifies the full upload -> materialize -> extract -> VERBATIM-JSON pipeline rather than only plumbing.
- NIT 56: `UploadStep.test.tsx` doesn't cover the 409 `already_finalized` client behavior. CLOSED in v7.7: test case added -- `/files/complete` returns non-2xx (e.g., 500), `/files/orphan` returns 409 `{error: "already_finalized"}`; UploadStep MUST re-fetch the file list and treat the upload as successful (not surface a cleanup-failure toast).
- NIT 57: TUS objectName extension is client-derived but `/files/complete` server-derives the expected path; if client and server MIME-to-extension maps drift, the server looks for a different path and creates an orphan. CLOSED in v7.7: shared helper `src/lib/engine-v2/mime_to_extension.ts` used by BOTH UploadStep client (to set TUS objectName) AND /files/complete server (to derive expected path). Unit test for all 3 allowed MIME types.

### Round 22 (Codex desktop, against v7.7): 6 findings (2 BLOCKER + 2 IMPORTANT + 2 NIT)
- BLOCKER 58: TUS `file_id` not persisted as a first-class column on v2_submission_files; the row's PRIMARY KEY `id` is auto-generated and differs from the TUS upload identifier. Ambiguous-path recovery polling has no column to match the client-side `file_id` against; /extract materialization uses `<file_id>.<ext>` from the storage_path but the row identity is decoupled. CLOSED in v7.8: schema changed -- v2_submission_files.id is now the client-supplied TUS file_id (NOT auto-generated); /files/complete passes the request's file_id as the INSERT id; ambiguous-path polling matches by `v2_submission_files.id = $file_id`. Storage path remains `<user_id>/<project_id>/<file_id>/<file_id>.<ext>` for consistency.
- BLOCKER 59: Smoke step 13 contradicts F53's ambiguous-path closure -- it instructs simulating ambiguous network failure and verifying UploadStep "falls through to POST /files/orphan", which is exactly the behavior F53 removed. A correct v7.7 implementation would fail this smoke step. CLOSED in v7.8: smoke step 13 split into 13a (DECISIVE non-2xx -> UploadStep calls /files/orphan -> verify storage cleanup) and 13b (AMBIGUOUS throw/abort -> UploadStep DOES NOT call /files/orphan -> UploadStep polls /files/exists endpoint -> row appears -> success treated; OR row does not appear -> non-fatal toast shown).
- IMPORTANT 60: Ambiguous-path polling endpoint is hand-wavy ("GET /api/engine-v2/projects/<id> OR similar OR a dedicated GET /files/exists ... to be designed"); no concrete route in any file allowlist; subagent strict allowlists make this unimplementable. CLOSED in v7.8: concrete new route `src/app/api/engine-v2/files/exists/route.ts` added to L1-3 file allowlist. GET-only (safe; pure read); requireAdminForApi; ownership probe via project_id query param; Zod query validation `{project_id, file_id}`; SELECT v2_submission_files WHERE id = $file_id AND project_id = $project_id AND deleted_at IS NULL; returns 200 with row OR 404. UploadStep AMBIGUOUS-path polls this endpoint.
- IMPORTANT 61: AMBIGUOUS-path toast promises Lane 2 janitor that doesn't exist yet; Lane 1 orphaned Storage objects could persist indefinitely. CLOSED in v7.8: toast language softened to "Upload status unclear; if you don't see your file, retry. Orphaned storage will require manual admin cleanup until the Lane 2 maintenance task is added." Handoff doc captures a Lane 1 manual cleanup procedure: admin compares Supabase Storage bucket contents to v2_submission_files rows weekly and deletes Storage objects without a corresponding active row that are older than 7 days.
- NIT 62: Quarantine helper test still says "no throw OR documented throw" on missing source -- reopens the contract ambiguity F54 closed. CLOSED in v7.8: test bullet locked to `assert returns {moved: false, reason: 'source_missing'}` (no throw, no ambiguity).
- NIT 63: Smoke text-extraction assertion is brittle against Docling normalization (whitespace, splitting across fields). CLOSED in v7.8: assertion defined as "load all text-bearing fields from VERBATIM JSON, concatenate, normalize whitespace (collapse \s+ to single space, trim), then assert the smoke phrase 'Engine v2 lane 1 smoke text' is present in the normalized concatenation".

### Round 23 (Codex desktop, against v7.8): 4 findings (1 BLOCKER + 1 IMPORTANT + 2 NIT)
- BLOCKER 64: F58's client-supplied `v2_submission_files.id = file_id` interacts badly with cap logic. Scenario A: finalized upload retried with same file_id when project is at cap -- cap preflight returns 413 + DELETEs the Storage object that the existing finalized row references -> data loss. Scenario B: two same-file_id /files/complete requests race when the first INSERT brings the project to cap -- second path returns 413 + DELETEs the storage the first committed. F58 was improperly closed. CLOSED in v7.9: /files/complete adds an idempotent-retry safety check BEFORE the cap preflight (step 9). New step 8.5: SELECT v2_submission_files WHERE id = $file_id AND project_id = $project_id AND deleted_at IS NULL. If the row exists, validate that storage_path matches the expected derived path AND sha256 matches the just-computed SHA AND size_bytes matches AND mime_type matches. If all match, return HTTP 200 with the existing row (true idempotent retry; no Storage deletion). If any field mismatches, return HTTP 409 with body indicating "file_id reused with different content; reject". The 23514 catch path also re-checks before DELETEing the just-uploaded object: only DELETE if no row with `id = file_id` references the just-uploaded storage_path (defense in depth).
- IMPORTANT 65: Smoke step 13b operationally racy -- client-abort timing doesn't reliably prove server committed before abort; smoke pass/fail becomes timing-dependent. CLOSED in v7.9: 13b moved from a manual smoke test to an AUTOMATED mocked integration test (added to `UploadStep.test.tsx` with a MSW/test-server harness that provides deterministic server-side commit-then-disconnect injection). The manual smoke step 13b is replaced with a simpler verification: exercise the /files/exists polling path explicitly (force /files/complete to delay 3s, observe UploadStep starts polling /files/exists at 1s intervals during the delay, observe row appears, observe success state without /files/orphan call). The deterministic commit-then-disconnect race coverage lives in the automated test.
- NIT 66: UploadStep ambiguous-path test wording says "polls file list" -- stale after F60 introduced concrete /files/exists route. CLOSED in v7.9: test bullet updated to explicitly require polling `GET /api/engine-v2/files/exists?project_id=<id>&file_id=<id>` and asserting NO /files/orphan call occurs on fetch throw.
- NIT 67: Smoke step 10 text-assertion recipe lowercases the smoke phrase but not the concatenated extracted text -- case-sensitive false-fail risk if Docling preserves case differently. CLOSED in v7.9: assertion recipe explicitly: collect string leaves -> join -> collapse whitespace -> trim -> **lowercase both the normalized extracted text AND the expected phrase** -> perform substring assertion.

### Round 24 (Codex desktop, against v7.9): 5 findings (1 BLOCKER + 3 IMPORTANT + 1 NIT)
- BLOCKER 68: F64 step 8.5 was inserted physically AFTER step 9 cap preflight in the document text. Subagents implementing in document order would still hit the at-cap data-loss path. CLOSED in v7.10: renumbered the L1-3 flow -- step 9 is now the idempotent-retry safety check (was step 8.5); step 10 is the cap preflight (was step 9); step 11 is the INSERT-first race-safe pattern (was step 10). Explicit statement: NO Storage DELETE path may execute before the idempotent row check has run.
- IMPORTANT 69: "Before all DELETEs" defense-in-depth not universally applied -- magic-mismatch DELETE (step 8) and cap-preflight DELETE (now step 10) don't explicitly re-check rows before DELETE; only 23505/23514 handlers and /files/orphan do. CLOSED in v7.10: shared helper `deleteUnfinalizedStorageObject(expectedPath)` introduced -- first queries v2_submission_files WHERE storage_path = $expectedPath AND deleted_at IS NULL; if a row is found, refuses to delete (returns boolean false / "skipped due to finalized row"); if no row, DELETEs via authenticated server client. Used by magic-mismatch step 8, cap-preflight step 10, 23505 cleanup, 23514 cleanup, and /files/orphan. Added to L1-3 file allowlist (`src/lib/engine-v2/storage_safe_delete.ts`) with tests.
- IMPORTANT 70: Manual smoke 13b can't trigger polling by merely delaying `/files/complete` -- a slow response leaves fetch pending; UploadStep only enters AMBIGUOUS path on fetch throw/abort. CLOSED in v7.10: manual smoke 13b updated -- the test flag activates BOTH server-side `?testDelay=3000` AND client-side `AbortSignal.timeout(1000)` on the /files/complete fetch. The client-side timeout fires before the server responds, triggering AbortError; UploadStep enters AMBIGUOUS path and starts polling /files/exists. Server's INSERT eventually commits (testDelay=3s elapses); poll sees the row; UploadStep transitions to success. Test flag guarded so AbortSignal.timeout is NOT applied in production.
- IMPORTANT 71: Ambiguous classification too narrow -- defined as "fetch threw, no HTTP response received", but a realistic commit-then-disconnect can yield a 200 status and then fail during response body read. That is still finalization-unknown and must NOT call /files/orphan. CLOSED in v7.10: UploadStep AMBIGUOUS classification explicitly broadened -- ambiguous path triggers on ANY error encountered after sending the request and before obtaining a confirmed-non-2xx HTTP status with a usable response body. Specifically: (a) network-level throws (AbortError, TypeError "Failed to fetch", connection reset, etc.), (b) HTTP response received with 2xx status but `response.json()` / body-read fails, (c) any other case where the client cannot determine from a definitive HTTP status whether the server committed. DECISIVE-FAILURE classification narrowed to: response received AND `response.ok === false` AND error body successfully parsed.
- NIT 72: Codex Review Strategy section stale (stops at R21). CLOSED in v7.10: paragraph rewritten to include R22, R23, R24 closures OR shortened to "see changelog above for round-by-round detail".

Full review history: see round-by-round changelog above (Finding 109 -- count refs replaced to avoid drift). Going forward: per-module codex iteration available (section markers in place); whole-plan comprehensive pass also supported. Either path until codex emits GREEN with zero open BLOCKER/IMPORTANT.

## Context

Engine_v2 backend complete (master `6f125686` on engine-v2 worktree; lane completion at `a5e2d982` Module E plus Module F docs commit `6f125686` = current head). Build fresh v2 frontend inside existing SSTAC-Dashboard Next.js 14 App Router app at `/dashboard/engine-v2/`. Owner directive: "fresh webpage informed by but NOT using v1's infrastructure directly; high attention to detail; zero assumptions."

Revision history: v1 -> ... -> v7.19 (current). See round-by-round changelog above for the per-version finding closures.

## Verified v1 ground truth

- Route pattern: `src/app/(dashboard)/dashboard/<segment>/page.tsx`. Middleware matcher at `src/middleware.ts:130` covers `/dashboard/:path*`.
- Auth helper: `src/lib/supabase-auth.ts:34` `createAuthenticatedClient()`.
- Admin guard: `src/lib/api-guards.ts` `requireAdmin()` + `LOCAL_ENGINE_ENABLED` pattern.
- Schema management: hand-edited `database_schema.sql` (1357 lines, root). No Supabase CLI in use.
- RLS pattern: `auth.uid() = user_id` + `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')`.
- v1 extractor: `C:\Projects\Regulatory-Review\engine\scripts\dashboard_extract.py`. Status JSON fields: `status`, `totalFiles`, `completedFiles`, `currentFile`, `progress`, `errors` (array of strings), `updatedAt`, optional `chunkProgress`. Terminal: completed, completed_with_errors, error.
- chunkProgress wire shape: VERIFIED 2026-05-11 against dashboard_extract.py:48 + line 65. `chunk_progress` is a Python `str` typed parameter; emitted as JSON scalar string. Schema `chunk_progress TEXT` is correct (not JSONB).
- HITL enum (`src/lib/regulatory-review/types.ts:53`): ACCEPT, OVERRIDE_PASS, OVERRIDE_FAIL, DEFER. 4 values, not 5. (Lane 2 concern.)
- HITL tier constraints (`src/app/api/regulatory-review/judgments/route.ts:96-118`): TIER_2 rejects ACCEPT + OVERRIDE_PASS; TIER_3 rejects ACCEPT + OVERRIDE_PASS + OVERRIDE_FAIL. (Lane 2 concern.)
- `schedule3.ts` exports: `SERVICES` (array, line 99), `LIFECYCLE_STAGES` (array, line 44), `Schedule3Service` (interface, line 22 -- VERIFIED 2026-05-11 as `export interface`), `LifecycleStage` (type), `LifecycleStageInfo` (interface), `getServicesByStage()`, `getServiceById()`. NO `SCHEDULE_3` export. Import keyword `type Schedule3Service` is correct because it is an interface (compile-time only).
- `database_schema.sql:903-907`: broad `GRANT ... ON ALL TABLES IN SCHEMA public TO authenticated` + INSERT/UPDATE/DELETE + sequences. Standalone v2 patch re-issues GRANTs at end to ensure new tables are covered.
- v1 extract-status route stale detection: `EXTRACT_STALE_TIMEOUT_MS` env (default 30 min in v1); compares `updatedAt` against `Date.now()`; transitions stale -> error if exceeded; terminal statuses skip stale check. v7+ raises Lane 1 default to 60 min (Finding 7).

## Engine_v2 backend state

- engine-v2 worktree at `C:\Projects\Regulatory-Review-worktrees\engine-v2\` master HEAD `6f125686` (Module F docs commit). Lane completion is `a5e2d982` (Module E) plus `6f125686` (Module F docs). 881 tests pass. AI scope unchanged.
- Productization plan section 9.5.3 ALL conditions SATISFIED for `pre` mode across full corpus (5,860 policies) + contaminants axis of soft mode.
- Lane 1 invokes `dashboard_extract.py` from v1 path (`C:\Projects\Regulatory-Review\engine\scripts\`), NOT engine-v2 worktree. Engine-v2 evaluation comes in Lane 2.

## Owner Decisions (locked)

1. Database: Supabase Postgres.
2. URL: `/dashboard/engine-v2/` (files at `src/app/(dashboard)/dashboard/engine-v2/`).
3. Two-lane delivery: Lane 1 today (codex-GREEN at v7.18 R32 + R33 audit corrections in v7.19; ready for execution); Lane 2 queued.
4. Vocabulary: `SERVICES` + `LIFECYCLE_STAGES` from v1 `schedule3.ts`.
5. Access model: Lane 1 admin-gated entry; each admin owns own projects (no cross-admin sharing).
6. Codex-review cadence (session-level): pre-commit Opus adversarial subagent loop until mutual agreement; user runs manual codex desktop on plan + key commits; commits without codex desktop flagged for later.

<!-- BEGIN SECTION: ENGINEERING_DECISIONS -->
## Engineering Decisions (v7.19 - codex-GREEN + R33 audit corrections)

### Schema delivery
- Standalone `database_schema_engine_v2_patch.sql`, idempotent: `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (defensive for v7.x columns per Finding 31), `DROP POLICY IF EXISTS ... ; CREATE POLICY`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS ... ; CREATE TRIGGER`. Table DDL + RLS on app tables + RLS on `storage.objects` (INSERT/SELECT/DELETE) + cap-enforcement trigger + all-tables grant re-run at end.

### Streaming downloads: two named operations (Findings 2, 3, 21, 22, 28, 29, 30)

The v6.x canonical "streaming pattern" conflated two distinct operations -- SHA + magic computation, and local-disk materialization -- under a single example with an unconditional `fs.createWriteStream`. v7.2 splits them into TWO named functions, each handling its own error model. Both live in `src/lib/engine-v2/streaming_sha256.ts` (operation 1) and `src/lib/engine-v2/storage_materialize.ts` (operation 2). `supabase.storage.download()` is BANNED in both paths (buffers entire file as Blob).

Common preconditions:
- Node version: require >= 20.x via `package.json` `"engines": {"node": ">=20.0.0"}`. Vercel project Node runtime 20.x.
- Web Crypto `crypto.subtle.digest` is BANNED in both paths (one-shot API; cannot stream).
- Do NOT use `for await (const chunk of response.body)`: behavior differs across Node 18 / 20; the explicit `getReader()` + `read()` loop is portable and pinned.

#### Operation 1: `computeStreamingSha256AndMagic` (for /files/complete; Finding 29 split; no local-disk side effect)

```typescript
// src/lib/engine-v2/streaming_sha256.ts
import * as crypto from 'crypto';

export async function computeStreamingSha256AndMagic(
  signedUrl: string,
  headers: HeadersInit,
): Promise<{ sha: string; firstBytes: Buffer }> {
  const response = await fetch(signedUrl, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`fetch failed: status=${response.status}`);
  }
  const reader = response.body.getReader();
  const hash = crypto.createHash('sha256');
  let firstBytesAccum: Buffer = Buffer.alloc(0);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);

      // Accumulate first 8 bytes for magic-number validation; survives small first chunks (Finding 21)
      if (firstBytesAccum.length < 8) {
        const needed = 8 - firstBytesAccum.length;
        firstBytesAccum = Buffer.concat([
          firstBytesAccum,
          Buffer.from(value.subarray(0, Math.min(needed, value.length))),
        ]);
      }
    }
  } finally {
    // Safe releaseLock: swallow errors so original throw (if any) takes precedence (Finding 36)
    try { reader.releaseLock(); } catch { /* original error takes precedence */ }
  }

  return {
    sha: hash.digest('hex'),
    firstBytes: firstBytesAccum, // length <= 8; real PDF/DOCX/DOC always have >= 8 bytes
  };
}
```

Magic-number validation (called by /files/complete after computeStreamingSha256AndMagic returns):
- `application/pdf`: first 5 bytes are `25 50 44 46 2D` (`%PDF-`).
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`: first 4 bytes are `50 4B 03 04` (PKZip).
- `application/msword`: first 8 bytes are `D0 CF 11 E0 A1 B1 1A E1` (OLE compound document).
- If `firstBytes.length < 8`, treat as malformed file (real PDF/DOCX/DOC are all >= 8 bytes); reject HTTP 400.

#### Operation 2: `materializeToLocal` (for /extract; Finding 29 split; writeStream + drain + finish + cleanup)

```typescript
// src/lib/engine-v2/storage_materialize.ts
import * as fs from 'fs';
import * as path from 'path';

export async function materializeToLocal(
  signedUrl: string,
  headers: HeadersInit,
  localPath: string,
): Promise<void> {
  const response = await fetch(signedUrl, { headers });
  if (!response.ok || !response.body) {
    throw new Error(`fetch failed: status=${response.status}`);
  }

  // Ensure parent dir exists before lazy-open by createWriteStream (Finding 34).
  // Without this, first /extract for a new project would emit 'error' on createWriteStream's
  // lazy open before any await listener is attached (parent dir <project_id>/ does not yet exist).
  await fs.promises.mkdir(path.dirname(localPath), { recursive: true });

  const writeStream = fs.createWriteStream(localPath);

  // Persistent 'error' listener so writeStream errors between await boundaries are captured (Finding 35).
  // Without this, 'error' fired outside drain/finish Promise windows is unhandled (Node treats as
  // uncaughtException, which may crash the process under default settings).
  let streamErr: Error | null = null;
  const onPersistentError = (err: Error) => { if (!streamErr) streamErr = err; };
  writeStream.on('error', onPersistentError);

  const reader = response.body.getReader();

  try {
    while (true) {
      if (streamErr) throw streamErr; // check at each await boundary (Finding 35)
      const { done, value } = await reader.read();
      if (done) break;
      if (streamErr) throw streamErr;

      // Backpressure: respect write() return; await drain OR propagate error (Finding 28, 22)
      const canContinue = writeStream.write(value);
      if (!canContinue) {
        await new Promise<void>((resolve, reject) => {
          if (streamErr) { reject(streamErr); return; } // check at await start
          const onDrain = () => { writeStream.off('error', onAwaitError); resolve(); };
          const onAwaitError = (err: Error) => { writeStream.off('drain', onDrain); reject(err); };
          writeStream.once('drain', onDrain);
          writeStream.once('error', onAwaitError);
        });
      }
    }

    if (streamErr) throw streamErr;
    writeStream.end();
    // Wait for full flush to disk OR propagate error (Finding 28)
    await new Promise<void>((resolve, reject) => {
      if (streamErr) { reject(streamErr); return; }
      const onFinish = () => { writeStream.off('error', onAwaitError); resolve(); };
      const onAwaitError = (err: Error) => { writeStream.off('finish', onFinish); reject(err); };
      writeStream.once('finish', onFinish);
      writeStream.once('error', onAwaitError);
    });
  } catch (err) {
    // Cleanup partial file on any mid-stream failure (Finding 30)
    writeStream.destroy();
    await fs.promises.unlink(localPath).catch(() => { /* best-effort; file may not exist */ });
    throw err;
  } finally {
    writeStream.off('error', onPersistentError);
    // Safe releaseLock: swallow errors so original throw (if any) takes precedence (Finding 36)
    try { reader.releaseLock(); } catch { /* original error takes precedence */ }
  }
}
```

This function:
- Ensures the parent directory exists before lazy-open of createWriteStream (Finding 34).
- Registers a persistent 'error' listener at writeStream creation so errors between await boundaries are captured to a closure variable that each await checks (Finding 35).
- Handles backpressure (drain awaited only when write() returns false).
- Awaits the 'finish' event after end() before returning, guaranteeing the file is fully flushed.
- Rejects on writeStream 'error' from either drain-wait or finish-wait or persistent-listener (Finding 28: no indefinite hang).
- On any throw (network failure mid-loop, drain rejection, finish rejection, etc.) destroys the writeStream + unlinks the partial file (Finding 30).
- Releases the reader lock in finally with try-catch-swallow so the original throw (if any) takes precedence (Finding 36).
- Removes the persistent error listener in finally for proper teardown.

### Subprocess lifecycle (BLOCKERS 5, 6; IMPORTANT 7)
- Pre-create INSERT into `v2_extraction_runs` MUST commit before pythonw spawn. Supabase JS auto-commits per call; do not wrap pre-create + spawn in a single open transaction.
- Race-safe idempotency on `POST /extract`: enforced by partial unique index `idx_v2_extraction_runs__one_active ON v2_extraction_runs (project_id) WHERE status NOT IN ('completed','completed_with_errors','error')`. Handler attempts INSERT; on 23505 unique violation, re-SELECT existing non-terminal row, return HTTP 409 with `{run_id, status}` of existing row; do NOT spawn a second subprocess.
- Stale transition is best-effort: extended default `EXTRACT_STALE_TIMEOUT_MS = 3600000` (60 minutes) to reduce race with slow-but-alive extractors. PID-based liveness check (process.kill(pid, 0) probe; SIGTERM with grace before terminal stamp) is deferred to Lane 2.
- POST extract-status stale baseline when status JSON missing: use `v2_extraction_runs.started_at` (not `progress.updatedAt`, which doesn't exist yet) when row.status IN ('pending','extracting'). (Status sync was migrated from GET to POST in v7.4 per Finding 37; baseline logic unchanged.)

### Duplicate-SHA race + cap enforcement (BLOCKER 4; IMPORTANT 23; updated for Findings 64, 68, 69, 74, 77)
- /files/complete flow puts an **idempotent-retry safety check (step 9 in L1-3)** BEFORE the cap preflight (step 10) and BEFORE the INSERT (step 11). The safety check looks up v2_submission_files by `(id = $file_id, project_id, deleted_at IS NULL)`; if found AND all fields (storage_path, sha256, size_bytes, mime_type) match, returns HTTP 200 with the existing row WITHOUT any Storage DELETE -- this prevents the at-cap-retry data-loss path (Finding 64).
- INSERT-first race-safe pattern (step 11) is the duplicate-SHA defense. On 23505 unique violation against `idx_v2_submission_files__active_sha`, re-SELECT the existing winning row by `(project_id, sha256)`. DELETE the just-uploaded Storage object at `<user_id>/<project_id>/<this_request.file_id>/<this_request.file_id>.<ext>` **via the shared `deleteUnfinalizedStorageObject` helper** (Finding 69 -- helper refuses if any active row references the path; fails closed on guard-query error per Finding 74). Return existing row with HTTP 200.
- Atomic cap enforcement via Postgres trigger (Finding 23): `BEFORE INSERT` trigger on v2_submission_files acquires `pg_advisory_xact_lock(hashtext('v2_proj_cap_' || project_id))` to serialize per-project cap checks; SELECTs current count + sum(size_bytes) of active files; raises ERRCODE 23514 if either cap breached. Lock auto-releases on transaction commit/rollback.
- Application-level cap pre-flight at L1-3 step 10 is UX-only (return 413 friendly message early to avoid INSERT+rollback latency); actual enforcement is the trigger. On 23514 from trigger (step 11), route deletes the just-uploaded storage object via `deleteUnfinalizedStorageObject` helper (Finding 69; helper refuses if path is referenced by a race-finalized row) and returns 413. On 23505 cleanup path, same helper. On magic-mismatch DELETE in step 8, same helper. On cap-preflight DELETE in step 10, same helper. NO direct `supabase.storage.remove()` calls bypassing the helper.
- Known minor UX edge (Finding 32, narrowed per Findings 64, 98, 104): when a project is at max_files and the user re-uploads with the SAME file_id AND SAME sha256, the idempotent-retry safety check at step 9 catches it FIRST (returns HTTP 200 with the existing row) -- so the at-cap-true-retry path is resolved. The remaining edge is a NEW file_id with the SAME sha256 at cap (e.g., user uploads identical content but the TUS layer assigned a fresh file_id); the cap trigger fires before the dup-SHA constraint check, returning 413 instead of 200 with the existing winning row. A new file_id + NEW sha256 at cap is normal cap rejection (legitimately 413, not an edge). Lane 2 polish: trigger could SELECT for dup-SHA before count check; documented in handoff.
- Known limitation (Finding 42; mitigation wording corrected per Finding 115): cap enforcement applies to FINALIZED `v2_submission_files` rows only. An admin-owner who uploads to Storage via TUS and then never calls `/files/complete` (e.g., browser tab closed, transient network failure that the orphan-cleanup wiring also failed to handle) can leave un-finalized Storage objects under their owned `<user_id>/<project_id>/<file_id>/` prefix that don't count against the cap. In Lane 1 this is mitigated by: (a) admin-gated entry (only authorized admins can reach upload at all), (b) bucket-level `file_size_limit` (Supabase enforces per-object), (c) RLS prefix scoping (admins can only write to their own prefix), and (d) the UploadStep orphan-cleanup wiring per Findings 40, 53, 94, 100, 111: **TUS-success + parsed non-2xx `/files/complete` response with literal `orphan_cleanup_required === true` -> client calls `/files/orphan`. AMBIGUOUS (fetch throw / 2xx body-parse failure / non-2xx parse failure) and CLEANUP-UNKNOWN (parsed non-2xx with missing or non-boolean flag) paths NEVER call `/files/orphan`; they poll `/files/exists` or surface the original error.** Lane 2 enhancement: a "storage-objects janitor" worker that periodically scans `storage.objects` under the v2-submissions prefix, joins against `v2_submission_files` rows, and deletes objects with no matching row that are older than a TTL (e.g., 24h). This Lane 2 enhancement is noted in the handoff.

### Service-role usage (BLOCKER 1)
- ZERO service-role usage anywhere in Lane 1. All Storage object operations (INSERT, SELECT, DELETE) via the authenticated server client; RLS policies on storage.objects permit owner+admin deletion. Any future code path that needs cross-RLS access must be flagged for owner approval and recorded as a Lane 2 scope expansion.

### Ownership-verification pattern (IMPORTANT 8)
- Every v2 API handler that takes `project_id` (or implicit project_id via file_id) MUST run a sentinel ownership probe via the authenticated server client:
  ```typescript
  const { data: project, error } = await supabase
    .from('v2_projects')
    .select('id, max_files, max_total_bytes')
    .eq('id', projectId)
    .single();
  if (error || !project) return NextResponse.json({ error: 'Project not found or forbidden' }, { status: 403 });
  ```
  RLS returns 0 rows when the requester is not the admin-owner. 403 (not 404) is returned to avoid leaking project existence to non-owners. Apply to: /files/complete, /files/orphan, /files/exists (per Finding 90), /projects/[id]/extract, /projects/[id]/extract-status.

### CSRF + rate-limit (IMPORTANT 11; refined NIT 24)
- CSRF protection on every v2 POST/DELETE API route:
  - Require `Content-Type: application/json` (form-POST CSRF cannot set this without CORS preflight). Reject 415 on mismatch.
  - Verify `Origin` header (or `Referer` fallback) per environment-aware rules below. Reject 403 on mismatch.

  Environment-aware Origin check (Finding 24):
  - Production (`process.env.VERCEL_ENV === 'production'` OR self-hosted prod): strict against `NEXT_PUBLIC_SITE_URL`. Origin must exactly match. Reject 403 otherwise.
  - Vercel preview (`process.env.VERCEL_ENV === 'preview'`): allow Origin if it matches `https://<project-slug>-*.vercel.app` pattern OR matches `request.nextUrl.origin` (same-origin requests pass through).
  - Local dev (`VERCEL_ENV` undefined AND `NODE_ENV === 'development'`): allow `http://localhost:*` and `http://127.0.0.1:*`.
  - Unit test required to cover production-strict, preview-permissive, and dev-localhost paths.

- Rate-limiting: deferred to Lane 2. Lane 1 relies on admin-gating + per-project caps (Finding 10/23) + idempotency guard (Finding 5) for protection.

### Filename safety (IMPORTANT 12)
- Server normalizes `original_filename` via `original_filename.normalize('NFC')` BEFORE all validation.
- Length limit: 255 UTF-8 bytes computed as `Buffer.byteLength(normalized, 'utf8')`. NOT `.length` (which counts UTF-16 code units).
- Reject path separators (`/`, `\\`), control chars (0x00-0x1f and 0x7f), null bytes, length > 255 UTF-8 bytes, `..` substrings, reserved Windows names (CON, PRN, AUX, NUL, COM1-9, LPT1-9 case-insensitive).
- Original verbatim (after NFC) stored in `original_filename`; sanitized variant only used for display fallback. Storage path uses safe scheme `<user_id>/<project_id>/<file_id>/<file_id>.<ext>` where `<ext>` is derived server-side from MIME allowlist.

### Path-containment with realpath (IMPORTANT 15; refined NIT 25)
- Cleanup operations (uploads-dir delete on terminal; quarantine move on error) MUST validate the resolved target path is contained within the resolved base path; `fs.realpath` follows symlinks and Windows junctions before the check:
  ```typescript
  async function isContained(basePath: string, targetPath: string): Promise<boolean> {
    // Resolve symlinks / Windows junctions before containment check (Finding 25)
    const baseReal = await fs.promises.realpath(basePath);
    let targetReal: string;
    try {
      targetReal = await fs.promises.realpath(targetPath);
    } catch {
      // Target may not exist yet (quarantine move pre-flight); resolve via parent dir
      const parentReal = await fs.promises.realpath(path.dirname(targetPath));
      targetReal = path.join(parentReal, path.basename(targetPath));
    }
    const baseResolved = path.resolve(baseReal);
    const targetResolved = path.resolve(targetReal);
    const cmp = process.platform === 'win32'
      ? { base: baseResolved.toLowerCase(), target: targetResolved.toLowerCase() }
      : { base: baseResolved, target: targetResolved };
    return cmp.target === cmp.base || cmp.target.startsWith(cmp.base + path.sep);
  }
  // Cleanup/quarantine handlers MUST `await isContained()` and throw if false; never delete/move uncontained paths.
  ```
- Applies to: `v2_dashboard_uploads/<project_id>/` delete on completion, `v2_dashboard_uploads/<project_id>/` move to quarantine on error.

### Log redaction (IMPORTANT 14)
- Server-side log lines in v2 routes MUST log `file_id` (UUID) and `project_id` (UUID), NOT `original_filename`.
- Error responses to clients MAY include `original_filename` for UX clarity, but the server-side logger never echoes it.
- Filenames may contain PII (personnel names, site identifiers); log redaction protects against PII leakage to Vercel/Supabase log infrastructure.

### Content-Disposition (IMPORTANT 13; Lane 2 note)
- Lane 1 does NOT generate signed URLs for browser-side download (uploads use TUS bearer token directly to Supabase Storage; server-side materialization uses authenticated fetch).
- Lane 2 enhancement note: any `createSignedUrl()` call for v2-submissions bucket MUST include `?download=` query parameter (Supabase Storage sets `Content-Disposition: attachment`). Dashboard never embeds bucket-stored files via `<iframe>`, `<embed>`, or `<object>` in Lane 1 or Lane 2.

### Vercel timeout / materialization (closes NIT 26 as moot)
- Lane 1 extract routes are gated by `LOCAL_ENGINE_ENABLED`; routes return 503 unless this env var is `"true"`. Real subprocess spawn of pythonw.exe requires the Node process to run on a machine that has pythonw.exe AND `dashboard_extract.py` (i.e., the owner's local dev machine).
- On Vercel serverless: pythonw.exe does not exist; setting `LOCAL_ENGINE_ENABLED=true` on Vercel is a misconfiguration. The spawn step would fail with ENOENT, the catch block at L1-6 step 9 (per F92/F103 renumbering) stamps the row as `error`, and the request returns 500.
- Therefore Vercel function timeout (60s on Pro plan; 10s on Hobby) does NOT apply to any realistic Lane 1 deployment. Lane 2 evaluation paths that ARE Vercel-deployable must be designed differently (likely an external worker queue).

### Status JSON shape parity (BLOCKER 2 context)
- All 5 status enum values (pending, extracting, completed, completed_with_errors, error) in CHECK constraint + Zod + parser + UI.
- `currentFile` field present in schema + Zod + parser + UI (codex Round 6 closure carry-over from v6.x).
- `chunkProgress` is a scalar string per v1 extractor (verified Finding 17); stored as `chunk_progress TEXT`.
- `errors` is a JSON array of strings only; stale transition writes a single string entry; never object-shaped errors.

### Cross-repo commit (Module L1-6)
- Module L1-6 commit spans two repos: SSTAC-Dashboard for the dashboard code, and engine-v2 worktree for the .gitignore edit at `C:\Projects\Regulatory-Review-worktrees\engine-v2\engine_v2\.gitignore` (or root .gitignore of worktree if engine_v2 is not its own subtree). Orchestrator MUST commit each repo separately with matching commit messages. Cross-repo references go in the body of each commit message.

### Env vars (consolidated)
- `REG_REVIEW_ENGINE_V2_BASE_PATH`: parent directory for staging dirs (uploads + extracts).
- `REG_REVIEW_LEGACY_EXTRACTOR_PATH`: absolute path to `dashboard_extract.py`.
- `REG_REVIEW_PYTHON_PATH`: absolute path to pythonw.exe.
- `LOCAL_ENGINE_ENABLED`: gate flag; if not "true", extract routes return 503.
- `EXTRACT_STALE_TIMEOUT_MS`: optional override; default 3600000 (60 minutes per Finding 7).
- `NEXT_PUBLIC_SITE_URL`: dashboard origin for CSRF check (production-strict per Finding 24).
- `VERCEL_ENV`: read-only env; `production` / `preview` / `development` switches CSRF Origin rules.
- `NODE_ENV`: read-only env; `development` enables localhost Origin allowance.

### TypeScript + JSONB
- TS types hand-written in `src/lib/engine-v2/types.ts`. Zod at API boundaries is the real guard.
- JSONB for `application_types`, `selected_services`, `media_types`, `submission_context_overrides`, `errors`, future Lane 2 `raw_eval_result_json`, `evidence_item_ref`, `provenance`.

### TUS upload
- chunkSize 6 MB. Bearer token in `Authorization` header. Endpoint `https://<project-id>.storage.supabase.co/storage/v1/upload/resumable`. Omit `x-upsert` header (Supabase default is no-overwrite).
- objectName: `<user_id>/<project_id>/<file_id>/<file_id>.<ext>`. Extension derived server-side from MIME allowlist.

### Staging directories
- `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/<project_id>/`: transient input materialization; delete on extraction terminal-success; move to `_quarantine/<project_id>_<UTC>/` on error.
- `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_extracts/<project_id>/`: extractor `--output-dir`; persistent; retained for Lane 2.

### Word HTML (Lane 2)
- Verbatim import of MSO scaffolding from v1's `memo-generator.ts`. (No Lane 1 impact.)

### Lane 1 smoke posture
- LOCAL EXTRACTION SMOKE (upload + extract; no evaluation). Lane 2 will add live evaluation smoke.

<!-- END SECTION: ENGINEERING_DECISIONS -->

## Lane 1 - Narrow Vertical Slice (7 modules; budget 4-5h; smoke NON-DROPPABLE)

Goal: signed-in admin can create v2 project, upload submission files via TUS, files materialize to local staging dir, Docling extraction triggers and produces VERBATIM JSON per file (persisted to `v2_dashboard_extracts/`), status visible in dashboard with stale detection, smoke documented.

<!-- BEGIN SECTION: L1-1 -->
### Module L1-1: Schema patch + bucket + types + Zod + admin guards + tests

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\supabase\engine_v2\database_schema_engine_v2_patch.sql`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\types.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\zod.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\schema_notes.md`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\admin_guards.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\csrf.ts` (moved from L1-3 per codex Finding 45 -- shared helper used by L1-3 + L1-4 + L1-6; foundation prerequisite)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\filename_safety.ts` (moved from L1-3 per codex Finding 78 -- foundational utility used by Zod payload validators and /files/complete; foundation prerequisite)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\zod.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\admin_guards.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\csrf.test.ts` (moved from L1-3 per codex Finding 45)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\filename_safety.test.ts` (moved from L1-3 per codex Finding 78)

Schema patch SQL (idempotent; ALTER TABLE ADD COLUMN IF NOT EXISTS for v7.x columns per Finding 31):

```sql
-- Idempotent v2 schema patch (Lane 1 tables only; Lane 2 tables deferred)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS v2_projects (
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
  max_files INTEGER NOT NULL DEFAULT 50,
  max_total_bytes BIGINT NOT NULL DEFAULT 524288000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive: ensure v7.x-introduced columns exist even if v2_projects pre-dates them (Finding 31).
-- No-op when the table is freshly CREATEd above; required if prior partial schema (e.g., earlier v6.x) is already deployed.
ALTER TABLE v2_projects ADD COLUMN IF NOT EXISTS max_files INTEGER NOT NULL DEFAULT 50;
ALTER TABLE v2_projects ADD COLUMN IF NOT EXISTS max_total_bytes BIGINT NOT NULL DEFAULT 524288000;

-- (v2_extraction_runs defensive ALTERs moved to AFTER the CREATE TABLE v2_extraction_runs below
-- per codex Finding 44: on clean-slate the table doesn't exist yet when ALTERs run, so Postgres
-- raises "relation does not exist" before reaching CREATE TABLE.)

CREATE TABLE IF NOT EXISTS v2_submission_files (
  -- id is the TUS client-supplied file_id (NOT gen_random_uuid()); same value used in:
  --   - storage_path: <user_id>/<project_id>/<id>/<id>.<ext>
  --   - local materialization: <id>.<ext>
  --   - ambiguous-path polling: SELECT WHERE id = $file_id (Finding 58)
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_submission_files__active_sha
  ON v2_submission_files (project_id, sha256) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS v2_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT v2_extraction_runs_status_check
    CHECK (status IN ('pending', 'extracting', 'completed', 'completed_with_errors', 'error')),
  total_files INTEGER NOT NULL DEFAULT 0,
  completed_files INTEGER NOT NULL DEFAULT 0,
  current_file TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  chunk_progress TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_v2_extraction_runs__project_started
  ON v2_extraction_runs (project_id, started_at DESC);

-- Defensive: ensure v7.x columns on v2_extraction_runs exist even if the table pre-dates them
-- (Findings 39, 44 -- moved AFTER CREATE TABLE per codex R19; on clean-slate these are no-ops).
ALTER TABLE v2_extraction_runs ADD COLUMN IF NOT EXISTS current_file TEXT;
ALTER TABLE v2_extraction_runs ADD COLUMN IF NOT EXISTS chunk_progress TEXT;
ALTER TABLE v2_extraction_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

-- Defensive: ensure the status CHECK constraint allows all 5 v7.x values including 'completed_with_errors'
-- (Findings 39, 44, 51). The named constraint v2_extraction_runs_status_check is created in the CREATE TABLE
-- above by name. Clean-slate is REQUIRED per the L1-1 EXIT GATE step (a); this defensive DROP+ADD only
-- refreshes the named v7.x constraint if a prior named variant exists (e.g., during dev re-application).
-- IMPORTANT (Finding 51): DROP CONSTRAINT IF EXISTS by name will NOT remove an UNNAMED prior CHECK
-- constraint (e.g., one from a v6.x partial schema without the explicit CONSTRAINT v2_extraction_runs_status_check
-- declaration). Such unnamed prior constraints must be dropped manually (or by pre-dropping the table) at
-- the L1-1 EXIT GATE step (a). This pattern is migration-safe ONLY for named-variant migrations.
ALTER TABLE v2_extraction_runs DROP CONSTRAINT IF EXISTS v2_extraction_runs_status_check;
ALTER TABLE v2_extraction_runs ADD CONSTRAINT v2_extraction_runs_status_check
  CHECK (status IN ('pending', 'extracting', 'completed', 'completed_with_errors', 'error'));

-- Race-safe extract idempotency (Finding 5): only one non-terminal run per project at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_extraction_runs__one_active
  ON v2_extraction_runs (project_id)
  WHERE status NOT IN ('completed', 'completed_with_errors', 'error');

-- Cap-enforcement trigger (Finding 23): atomic per-project cap check via advisory lock
CREATE OR REPLACE FUNCTION enforce_project_caps_v2() RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
  v_sum BIGINT;
  v_max_files INTEGER;
  v_max_total_bytes BIGINT;
BEGIN
  -- Serialize cap checks per-project; advisory lock releases on transaction commit/rollback.
  PERFORM pg_advisory_xact_lock(hashtext('v2_proj_cap_' || NEW.project_id::text));
  SELECT max_files, max_total_bytes INTO v_max_files, v_max_total_bytes
    FROM v2_projects WHERE id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent v2_projects row not found' USING ERRCODE = '23503';
  END IF;
  SELECT count(*), COALESCE(sum(size_bytes), 0) INTO v_count, v_sum
    FROM v2_submission_files
    WHERE project_id = NEW.project_id AND deleted_at IS NULL;
  IF v_count + 1 > v_max_files THEN
    RAISE EXCEPTION 'project file count cap exceeded (% files; limit %)', v_count + 1, v_max_files
      USING ERRCODE = '23514';
  END IF;
  IF v_sum + NEW.size_bytes > v_max_total_bytes THEN
    RAISE EXCEPTION 'project total bytes cap exceeded (% bytes; limit %)', v_sum + NEW.size_bytes, v_max_total_bytes
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_project_caps_v2 ON v2_submission_files;
CREATE TRIGGER trg_enforce_project_caps_v2
  BEFORE INSERT ON v2_submission_files
  FOR EACH ROW EXECUTE FUNCTION enforce_project_caps_v2();

-- RLS: every policy requires BOTH ownership AND admin role

ALTER TABLE v2_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_projects_owner_admin_all ON v2_projects;
CREATE POLICY v2_projects_owner_admin_all ON v2_projects FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_submission_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_submission_files_owner_admin_all ON v2_submission_files;
CREATE POLICY v2_submission_files_owner_admin_all ON v2_submission_files FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_submission_files.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_submission_files.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_extraction_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_extraction_runs_owner_admin_all ON v2_extraction_runs;
CREATE POLICY v2_extraction_runs_owner_admin_all ON v2_extraction_runs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_extraction_runs.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_extraction_runs.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- storage.objects policies for v2-submissions bucket: INSERT, SELECT, DELETE all require BOTH ownership AND admin role

DROP POLICY IF EXISTS v2_submissions_insert ON storage.objects;
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

DROP POLICY IF EXISTS v2_submissions_select ON storage.objects;
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

DROP POLICY IF EXISTS v2_submissions_delete ON storage.objects;
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
- Name: `v2-submissions`.
- `file_size_limit`: confirmed at EXIT GATE (Supabase Free 50MB; Pro/Team 500GB global with per-bucket caps). Owner reports discovered value.
- Allowed MIME types (Lane 1): `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`. `application/json` excluded (extractor does not process JSON). MIME-to-extension server-derived map: pdf -> `.pdf`, docx -> `.docx`, doc -> `.doc`.

Zod schemas (Lane 1):
- `ProjectCreatePayload`: name, application_types[], selected_services[], media_types[], submission_context_overrides{}. **NO max_files / max_total_bytes fields (Finding 81 closure -- defaults always used in Lane 1; admin may UPDATE the row via SQL after creation for any non-default cap; Lane 2 can add an explicit override path if needed).**
- `FileCompletePayload`: project_id, file_id, original_filename, size_bytes, content_type. NO client-claimed SHA256.
- `ExtractionStatusUpsert`: status (all 5 values), totalFiles, completedFiles, currentFile, progress, errors (array of strings), updatedAt, optional chunkProgress (string). (Used internally by `status_parsing.ts` to parse the extractor's status JSON file shape.)
- `ExtractStatusSyncPayload`: `{ run_id: string }` (UUID). Used by POST `/projects/[id]/extract-status` (Finding 37).
- `FileExistsQuery`: `{ project_id: string (UUID), file_id: string (UUID) }`. Used by GET `/api/engine-v2/files/exists` (Finding 60).
- `OrphanCleanupPayload`: project_id, file_id only. NO storage_path; server derives.

Unit tests:
- `zod.test.ts`: accept/reject scenarios per schema; ExtractionStatusUpsert parses ALL FIVE status values. (Structural validation only. Filename safety deep checks are in `filename_safety.test.ts` below.)
- `admin_guards.test.ts`: unauthenticated -> redirect, authenticated-non-admin -> redirect, authenticated-admin -> {client, user} pair.
- `filename_safety.test.ts` (Finding 87 -- moved from L1-3 to L1-1 with filename_safety.ts per Finding 78): NFC normalization (NFD input becomes NFC); byte-length check (255 bytes via Buffer.byteLength); control chars (0x00, 0x1f, 0x7f); null byte; `..` substrings; reserved Windows names case-insensitive (con.pdf, CON.pdf, Con.PDF, com1.docx); path separators (`/` and `\\`); legitimate filenames pass.
- `csrf.test.ts`: production-strict (VERCEL_ENV=production) rejects non-matching origin; preview-permissive (VERCEL_ENV=preview) accepts `*.vercel.app` patterns; local dev (NODE_ENV=development) accepts localhost; Referer-fallback works when Origin absent; Content-Type non-application/json rejected 415.

Admin-gating helpers (in admin_guards.ts):
- `requireAdminForServerComponent()`: returns `{client, user}` on success. Failure: unauthenticated -> `redirect('/login?next=/dashboard/engine-v2')`; non-admin -> `redirect('/dashboard?error=admin_required')` (client-side renders toast from query param).
- `requireAdminForApi(req)`: returns `{client, user}` on success; returns 403 JSON `NextResponse` on failure. Used by all API routes.
- Both helpers query `user_roles` table for `role = 'admin'` matching v1's pattern in `src/lib/api-guards.ts`.

Module L1-1 EXIT GATE: orchestrator pauses; asks owner: "Module L1-1 ready. Please (a) confirm CLEAN-SLATE status: no prior partial v2_* schema deployed on the target Supabase project (`SELECT to_regclass('public.v2_projects'), to_regclass('public.v2_submission_files'), to_regclass('public.v2_extraction_runs');` should return three nulls; if any return non-null, drop those tables CASCADE FIRST so the current `database_schema_engine_v2_patch.sql` applies cleanly per Finding 39), (b) apply `database_schema_engine_v2_patch.sql` (idempotent on fresh apply; defensive ALTERs cover partial-schema cases per Finding 39 but are not a full migration tool), (c) create `v2-submissions` bucket with documented file_size_limit and the 3 allowed MIME types listed above (reply with discovered limit), (d) confirm Lane 1 access model = admin-gated entry + per-admin owner of own projects. Reply with `schema-and-bucket-applied`, file_size_limit value, clean-slate confirmation, and access confirmation."

<!-- END SECTION: L1-1 -->

<!-- BEGIN SECTION: L1-2 -->
### Module L1-2: Route shell + landing page

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\layout.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\page.tsx`

Route: `/dashboard/engine-v2/`. Server Component. `requireAdminForServerComponent` enforced. Landing lists owner's v2 projects from `v2_projects` filtered by `auth.uid()` via RLS.

<!-- END SECTION: L1-2 -->

<!-- BEGIN SECTION: L1-3 -->
### Module L1-3: TUS upload + file finalize + orphan cleanup + safe filename + tests

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\UploadStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\files\complete\route.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\files\complete\__tests__\route.test.ts` (Findings 99, 105, 107, 110 -- server-route tests: every non-2xx response body includes literal boolean `orphan_cleanup_required`; coverage for auth/CSRF/Zod/ownership/HEAD/filename/SHA/magic/idempotent-409/cap/23505/23514 branches; verifies fileCompleteError wrapper used at all early-failure sites)
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\files\orphan\route.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\files\exists\route.ts` (Finding 60 -- GET-only finalization probe used by UploadStep AMBIGUOUS-path polling; safe read-only; requireAdminForApi + ownership probe + Zod query validation `{project_id, file_id}` -> 200 with row OR 404; export const runtime = 'nodejs')
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\streaming_sha256.ts` (exports `computeStreamingSha256AndMagic` per Finding 29)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\path_containment.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\mime_to_extension.ts` (Finding 57 -- shared MIME->extension lookup used by BOTH UploadStep client and /files/complete server to avoid client-server drift)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\storage_safe_delete.ts` (Findings 69, 73, 74 -- shared helper `deleteUnfinalizedStorageObject` used by /files/complete magic-mismatch, cap-preflight, 23505 cleanup, 23514 cleanup, AND /files/orphan; fails CLOSED on guard-query error)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\streaming_sha256.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\path_containment.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\mime_to_extension.test.ts` (Finding 57 -- all 3 allowed MIME types map to correct extensions)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\storage_safe_delete.test.ts` (Findings 69, 73, 74 -- helper deletes when no finalized row exists; refuses delete when row exists; fails CLOSED on guard-query error; returns structured `{deleted, reason}` result)
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\__tests__\UploadStep.test.tsx` (Finding 40 orphan-on-failure wiring; Finding 53/75 ambiguous-path polling for any pre-confirmed-response failure; Finding 56 already-finalized handling)
- (filename_safety.ts and __tests__/filename_safety.test.ts MOVED to L1-1 per Finding 78 -- foundational utility consumed by Zod schemas and /files/complete; foundation prerequisite.)
- (csrf.ts and __tests__/csrf.test.ts MOVED to L1-1 per Finding 45 -- shared helper consumed by L1-3 + L1-4 + L1-6 parallel modules; foundation prerequisite.)
- EDIT `C:\Projects\SSTAC-Dashboard\package.json` (add `tus-js-client` AND `"engines": {"node": ">=20.0.0"}` per Finding 19)
- EDIT `C:\Projects\SSTAC-Dashboard\package-lock.json` (regenerated by npm install)

`export const runtime = 'nodejs'` declared at top of EVERY API route under `src/app/api/engine-v2/` that uses fs, child_process, Node streams, Node crypto, or any Node-only API. Specifically: `files/complete/route.ts`, `files/orphan/route.ts`, all Module L1-6 routes.

TUS config:
- endpoint: `https://<supabase-project-id>.storage.supabase.co/storage/v1/upload/resumable`
- chunkSize: `6 * 1024 * 1024`
- headers: `Authorization: Bearer <session-access-token>` (omit `x-upsert`)
- metadata: `bucketName='v2-submissions'`, `objectName='<user_id>/<project_id>/<file_id>/<file_id>.<ext>'`, `contentType=<MIME from allowlist>`

UploadStep client behavior (Findings 40, 48, 53):
- After TUS upload completes successfully, client POSTs `/api/engine-v2/files/complete` with the JSON payload.
- **DECISIVE PATH (server returned non-2xx HTTP status AND the error body parsed successfully -- narrowed per Findings 71, 75, 94, 100):** server's verdict is known. The body's `orphan_cleanup_required` field strictly directs the client (Finding 100 -- strict checking, no unsafe fallback):
    - Literal `orphan_cleanup_required === true` (boolean true; required by server schema per Finding 99 on EVERY non-2xx response): the just-uploaded storage object IS orphan-eligible OR server-side cleanup already deleted it (orphan call is a safe no-op via the helper's idempotency). Client MUST call `POST /api/engine-v2/files/orphan` with `{project_id, file_id}`.
    - Literal `orphan_cleanup_required === false` (boolean false; set by server for 409 file_id_reused_with_different_content): the storage at the existing file_id's path is legitimately referenced by another finalized row; orphan call MUST NOT be made. Client surfaces the conflict error to the user (e.g., "This file ID is already used by a different file; pick a different name or check your project").
    - ANY OTHER value (undefined, null, non-boolean, missing): treated as **cleanup-unknown** (Finding 100 defense-in-depth against server bugs or version drift). Client does NOT call /files/orphan, optionally polls /files/exists for safety to detect a race-finalized row, surfaces the original error to the user with a note that storage cleanup status is unclear. NEVER fail-open to orphan deletion when the flag is malformed.
   The orphan endpoint's finalized-row safety check (Finding 48 via the deleteUnfinalizedStorageObject helper) remains as belt-and-suspenders for the orphan-required case.
- **AMBIGUOUS PATH (any failure before obtaining a confirmed-non-2xx HTTP response with successfully parsed error body -- broadened per Findings 71, 75):** server's verdict is UNKNOWN. This includes: (a) network-level throws (AbortError, TypeError 'Failed to fetch', connection reset, ETIMEDOUT, etc.); (b) HTTP response received with 2xx status but `response.json()` / body-read fails (commit-then-disconnect-during-body-emit race); (c) HTTP response received with non-2xx status but error-body parse fails (cannot determine the server's intended verdict); (d) any other case where the client cannot determine from a definitive HTTP status + parsed body whether the server committed. Finalization may or may not have completed server-side. F53 BLOCKER prohibits calling /files/orphan synchronously in any of these cases because /files/complete may still be in-flight (or committed-but-response-failed) server-side; orphan deletion would race the in-flight INSERT and could delete a Storage object that a successfully-finalized row points to. INSTEAD, the client:
  1. Treats the upload as "finalization unknown".
  2. Polls the new GET `/api/engine-v2/files/exists?project_id=<id>&file_id=<id>` endpoint (Finding 60) every 1s for up to 5s, looking for the row identified by the same `file_id` the client supplied to TUS. The server-side row's PRIMARY KEY `id` == client file_id (Finding 58).
  3. If the endpoint returns 200 (row exists) within the window, treat the upload as successful (the server-side INSERT was just slow to be visible).
  4. If the endpoint returns 404 throughout the window (no row after 5 polls), surface a non-fatal toast (Finding 61 softened wording): "Upload status unclear; if you don't see your file, retry. Orphaned storage may require manual admin cleanup until the Lane 2 maintenance task is added." The Lane 2 storage-objects janitor (Finding 42 follow-up) will be the long-term reaper for un-finalized Storage objects via TTL; Lane 1 documents a manual cleanup procedure in the handoff. Lane 1 accepts this small Storage-leak surface as the safe tradeoff against the race that would otherwise delete finalized uploads.
- Orphan cleanup failures (in the decisive path) are logged (client-side console + non-fatal toast) but do not block the user from retrying the upload.
- This wiring closes both the "TUS succeeds, /files/complete fails decisively, Storage object orphaned" hole (Finding 40) AND the "orphan deletes finalized object" hole (Findings 48 + 53).

CSRF headers on `POST /api/engine-v2/files/complete` and `POST /api/engine-v2/files/orphan` (and all Module L1-4 + L1-6 POST/DELETE routes):
- Require `Content-Type: application/json`; reject 415 on mismatch.
- Verify `Origin` (Referer fallback) per environment-aware rules (Engineering Decisions / CSRF section, Finding 24).

**Universal rule for /files/complete (Findings 68, 69, 86):** NO UNGUARDED Storage DELETE in /files/complete. ALL DELETE paths (steps 8 magic-mismatch, 10 cap-preflight, 11's 23505 dup-SHA cleanup, 11's 23514 cap-violation cleanup) MUST invoke the shared helper `deleteUnfinalizedStorageObject(expectedPath)` which (a) queries v2_submission_files first and refuses the DELETE if any active row references the path, (b) FAILS CLOSED on guard-query error (returns `{deleted:false, reason:'guard_query_error:*'}`), (c) returns `{deleted:false, reason:'storage_error:*'}` on storage API failure. Callers MUST inspect the helper's return value and handle all three failure reasons (see per-step handling specs below). Helper is exported from `src/lib/engine-v2/storage_safe_delete.ts` (in L1-3 file allowlist).

**Universal error-response schema for /files/complete (Findings 99, 105):** EVERY non-2xx response body MUST include the field `orphan_cleanup_required: boolean` (literal true or false; no other values). UploadStep relies on strict equality checking per Finding 100. To guarantee the flag is present even on early failure paths that would otherwise emit generic helper responses (Finding 105), /files/complete uses a local wrapper:
```typescript
// /api/engine-v2/files/complete/route.ts
function fileCompleteError(status: number, body: Record<string, unknown>, orphanCleanupRequired: boolean): NextResponse {
  return NextResponse.json({ ...body, orphan_cleanup_required: orphanCleanupRequired }, { status });
}
```
ALL pre-step-8 failure paths (auth, CSRF, Zod, ownership, HEAD, filename, SHA) MUST construct their response via `fileCompleteError(...)` rather than returning the shared helpers' direct responses. The shared helpers (`requireAdminForApi`, `csrf.ts`) return generic responses that the /files/complete route handler intercepts and re-wraps with the flag.

Per-branch flag assignment:
- Steps 1-2 auth/CSRF rejects (401, 403, 415): `fileCompleteError(status, {error:...}, true)` (upload reached Storage; orphan needed to clean up).
- Step 3 Zod payload reject (400): `fileCompleteError(400, {error:'invalid_payload',...}, true)`.
- Step 4 ownership probe 403: `fileCompleteError(403, {error:'project_not_found_or_forbidden'}, true)`.
- Step 5 HEAD mismatch (400): `fileCompleteError(400, {error:'head_mismatch',...}, true)`.
- Step 6 filename safety reject (400): `fileCompleteError(400, {error:'invalid_filename',...}, true)`.
- Step 7 SHA streaming failure / fetch error (500): `fileCompleteError(500, {error:'sha_streaming_failed',...}, true)`.
- Step 8 magic-mismatch + helper outcomes: see step 8 spec (true on success/storage_error/guard_error; no flag on 200 idempotent path).
- Step 9 idempotent-retry mismatch (409 file_id_reused_with_different_content): `fileCompleteError(409, {error:'file_id_reused_with_different_content', existing_sha256, requested_sha256}, false)` (existing storage is legitimately referenced).
- Step 10 cap-preflight + helper outcomes: see step 10 spec (true universally on 413/500).
- Step 11 INSERT outcomes (Finding 112 -- summary corrected to match branch text): success and 23505+`storage_error` and 23505+`finalized_row_references_path` paths return 200 with the existing row (NO flag); 23505+`guard_query_error` returns 500 via fileCompleteError with `true`; 23505 helper success returns 200 (NO flag); 23514+`helper_success` returns 413 via fileCompleteError with `true`; 23514+`guard_query_error` returns 500 via fileCompleteError with `true`; 23514+`storage_error` returns 413 via fileCompleteError with `true`; 23514+`finalized_row_references_path` returns 200 with existing row (NO flag). See step 11 spec for the explicit response bodies and helper-outcome branches.
2xx responses (200/201) do NOT include the flag (it's only on error responses).

`POST /api/engine-v2/files/complete` flow (renumbered per Finding 68 to put idempotent-retry safety BEFORE cap preflight):

1. `requireAdminForApi(req)` -> `{client, user}` or 403.
2. CSRF check via `csrf.ts` helper (Content-Type + environment-aware Origin).
3. Validate Zod `FileCompletePayload`.
4. Ownership probe: `SELECT id, max_files, max_total_bytes FROM v2_projects WHERE id = $project_id` via authenticated client; 0 rows -> 403.
5. Storage HEAD object at expected derived path; verify size + content-type match POST claim.
6. Filename safety: NFC normalize, then validate (reject path separators, control chars, null bytes, > 255 UTF-8 bytes via `Buffer.byteLength`, `..`, reserved Windows names).
7. Compute SHA256 + capture first 8 bytes via `computeStreamingSha256AndMagic(signedUrl, headers)` from `streaming_sha256.ts` (Finding 29 -- NO local-disk writeStream at this stage; just hash + accumulator).
8. Magic-number validation: validate `firstBytes` (returned by step 7) against declared MIME (PDF: `25 50 44 46 2D`; DOCX: `50 4B 03 04`; DOC: `D0 CF 11 E0 A1 B1 1A E1`). If `firstBytes.length < 8` OR magic mismatch: invoke `const r = await deleteUnfinalizedStorageObject(supabase, expectedPath);` and handle outcomes (Findings 69, 84, 94):
    - `r.deleted === true`: return HTTP 400 `{error: "magic_mismatch", detail, orphan_cleanup_required: true}` (Finding 94 -- field always present so client knows whether to orphan-cleanup).
    - `r.reason.startsWith('guard_query_error:')`: fail closed; return HTTP 500 `{error: "guard_query_error_during_magic_cleanup", detail: r.reason, orphan_cleanup_required: true}` (do NOT delete; client should retry; if client treats this as decisive and calls orphan, the orphan endpoint's own helper guard makes it a safe no-op).
    - `r.reason === 'finalized_row_references_path'`: extremely unlikely at step 8 (no row should exist yet for this file_id), but if reached: this is a duplicate of an in-flight or earlier-finalized upload; re-SELECT by `id = $file_id` and return HTTP 200 with the existing row (NO orphan_cleanup_required field needed on 200 response).
    - `r.reason.startsWith('storage_error:')`: log + return HTTP 500 `{error: "storage_error_during_magic_cleanup", detail: r.reason, orphan_cleanup_required: true}`. Storage may still contain the just-uploaded object; Lane 2 janitor will reap if client's orphan retry also fails.
    Log `file_id` in all outcomes (never `original_filename` per Finding 14).
9. **Idempotent-retry safety check (Findings 64, 68 -- runs BEFORE cap preflight and BEFORE all subsequent DELETE paths):** SELECT v2_submission_files WHERE id = $payload.file_id AND project_id = $payload.project_id AND deleted_at IS NULL. If a row is found:
    - Validate `storage_path` matches the expected derived path (`<user_id>/<project_id>/<file_id>/<file_id>.<ext>`) AND `sha256` matches the just-computed SHA (from step 7) AND `size_bytes` matches the request body's claimed size AND `mime_type` matches the request body's claimed content_type.
    - If ALL fields match: true idempotent retry. Return HTTP 200 with the existing row. **Do NOT delete the just-uploaded Storage object** -- it is identical to the already-referenced object (TUS upload is idempotent on objectName).
    - If ANY field mismatches: client supplied a file_id already in use with different content. Return HTTP 409 `{error: "file_id_reused_with_different_content", existing_sha256, requested_sha256, orphan_cleanup_required: false, ...}` (Finding 94 -- `orphan_cleanup_required: false` because the existing file_id's storage is legitimately referenced by another row and MUST NOT be deleted by client's orphan call). Do NOT delete the Storage object the existing row references.
    - If NO row found: proceed to step 10.
10. Pre-flight cap check (UX-only; trigger is authoritative per Finding 23): SELECT count + sum(size_bytes) of active files for project; if exceeded: invoke `const r = await deleteUnfinalizedStorageObject(supabase, expectedPath);` and handle outcomes (Findings 69, 84, 94):
    - `r.deleted === true`: return HTTP 413 `{error: "project_cap_exceeded", cap_kind: 'files'|'bytes', current_value, limit, orphan_cleanup_required: true}`.
    - `r.reason.startsWith('guard_query_error:')`: fail closed; return HTTP 500 `{error: ..., orphan_cleanup_required: true}` (do NOT proceed; client should retry).
    - `r.reason === 'finalized_row_references_path'`: race window where the same file_id finalized concurrently. Re-SELECT by `id = $file_id` AND `project_id` AND `deleted_at IS NULL`; if found, return HTTP 200 with the existing row (the concurrent request already succeeded; no orphan_cleanup_required field on 200).
    - `r.reason.startsWith('storage_error:')`: log + return HTTP 413 `{..., orphan_cleanup_required: true}` (cap is the dominant error; storage cleanup will be Lane 2 janitor's responsibility if client orphan retry also fails).
11. INSERT-first race-safe pattern with atomic cap-trigger enforcement: attempt INSERT INTO v2_submission_files (id, project_id, original_filename, storage_path, size_bytes, mime_type, sha256) -- where **id = $payload.file_id** (Finding 58). Trigger `trg_enforce_project_caps_v2` runs atomically before the row is inserted, raising ERRCODE 23514 on cap violation. Handle outcomes:
    - Success (HTTP 201): return new row (row.id == client file_id).
    - 23505 unique violation against `idx_v2_submission_files__active_sha`: re-SELECT existing winning row by `(project_id, sha256)`. Invoke `const r = await deleteUnfinalizedStorageObject(supabase, expectedJustUploadedPath);` and handle (Findings 69, 84, 106 -- explicit response bodies):
        - `r.deleted===true`: `return NextResponse.json(existingRow, {status: 200})` (no flag on 200; not an error).
        - `r.reason==='finalized_row_references_path'`: `return NextResponse.json(existingRow, {status: 200})` (rare race; treat as success).
        - `r.reason.startsWith('guard_query_error:')`: `return fileCompleteError(500, {error: 'guard_query_error_during_dup_sha_cleanup', detail: r.reason}, true)`.
        - `r.reason.startsWith('storage_error:')`: log + `return NextResponse.json(existingRow, {status: 200})` (the existing row is the data integrity win; storage cleanup deferred to janitor; no flag on 200).
    - 23505 unique violation against `v2_submission_files_pkey`: should be caught by step 9 above. If reached, indicates a race between step 9 and step 11's INSERT (another request committed first). Re-run step 9's logic to determine idempotent vs mismatch; respond accordingly (200 with row OR `fileCompleteError(409, {error:'file_id_reused_with_different_content', ...}, false)`). Do NOT delete (the row is now finalized by the concurrent request).
    - 23514 cap violation: invoke `const r = await deleteUnfinalizedStorageObject(supabase, expectedJustUploadedPath);` and handle (Findings 69, 84, 106 -- explicit response bodies):
        - `r.deleted===true`: `return fileCompleteError(413, {error: 'project_cap_exceeded', cap_kind, current_value, limit}, true)`.
        - `r.reason==='finalized_row_references_path'`: same file_id finalized concurrently and brought the project to cap; re-SELECT by `id = $file_id` and `return NextResponse.json(existingRow, {status: 200})` (no flag on 200).
        - `r.reason.startsWith('guard_query_error:')`: `return fileCompleteError(500, {error: 'guard_query_error_during_cap_cleanup', detail: r.reason}, true)`.
        - `r.reason.startsWith('storage_error:')`: log + `return fileCompleteError(413, {error: 'project_cap_exceeded', cap_kind, current_value, limit, storage_cleanup_deferred: true}, true)` (cap error is dominant; storage cleanup deferred to janitor; flag still true since the upload IS orphan-eligible).
    - Note: at-cap retry of an existing-SHA file with the SAME file_id is caught by step 9 idempotent retry path; arrives at step 11 only with NEW sha256 or NEW file_id+SAME sha256. The NEW file_id + SAME sha256 case is the remaining UX edge per Finding 32/104.

`deleteUnfinalizedStorageObject(expectedPath)` helper (Findings 69, 73, 74, 89 -- exported from `src/lib/engine-v2/storage_safe_delete.ts`; in L1-3 file allowlist):
```typescript
export async function deleteUnfinalizedStorageObject(
  supabase: SupabaseClient,
  expectedPath: string,
): Promise<{ deleted: boolean; reason?: string }> {
  // Universal guard: refuse to DELETE any Storage object that an active v2_submission_files row references.
  // FAILS CLOSED on guard-query error (Finding 74 BLOCKER closure): if the SELECT errors, do NOT proceed
  // to delete -- return guard_query_error so callers can decide whether to retry or skip.
  // Used by /files/complete (magic-mismatch, cap-preflight, 23505 cleanup, 23514 cleanup) AND /files/orphan.
  const { data: row, error: guardErr } = await supabase
    .from('v2_submission_files')
    .select('id, storage_path')
    .eq('storage_path', expectedPath)
    .is('deleted_at', null)
    .maybeSingle();
  if (guardErr) {
    // Fail closed: do not delete when we cannot verify finalization status.
    return { deleted: false, reason: `guard_query_error:${guardErr.message}` };
  }
  if (row) {
    return { deleted: false, reason: 'finalized_row_references_path' };
  }
  const { error: removeErr } = await supabase.storage.from('v2-submissions').remove([expectedPath]);
  if (removeErr) {
    return { deleted: false, reason: `storage_error:${removeErr.message}` };
  }
  return { deleted: true };
}
```
Helper is exported from L1-3's `src/lib/engine-v2/storage_safe_delete.ts` (codex Finding 73 placement; the only consumers are L1-3 routes /files/complete + /files/orphan). Callers MUST inspect the return value and handle the three failure reasons (`guard_query_error:*`, `finalized_row_references_path`, `storage_error:*`) without proceeding as if the object was deleted.

`POST /api/engine-v2/files/orphan` flow:
1. `requireAdminForApi(req)`.
2. CSRF check via `csrf.ts`.
3. Validate Zod `OrphanCleanupPayload` (project_id, file_id).
4. Ownership probe: SELECT v2_projects via auth client; 0 rows -> 403.
5. LIST `storage.objects` under prefix `<user_id>/<project_id>/<file_id>/` via auth client (RLS-enforced).
6. Validate EXACTLY ONE object found. 0 -> 404; >= 2 -> 409 Conflict + log (do NOT delete on ambiguity).
7. Compute the expected storage path of the single found object: `<user_id>/<project_id>/<file_id>/<file_id>.<ext>`.
8. **DELETE via the shared helper (Findings 48, 73, 74, 76):** `const result = await deleteUnfinalizedStorageObject(supabase, expectedPath);`
   - On `result.deleted === true`: orphan cleanup succeeded. Return HTTP 200 `{ deleted: true }`.
   - On `result.reason === 'finalized_row_references_path'`: the upload finalized despite the client's ambiguous-perception (Finding 48 belt-and-suspenders -- though Finding 53 closure means well-behaved Lane 1 clients should not call /files/orphan on ambiguous failures). Return HTTP 409 `{ error: 'already_finalized', file_id, storage_path: expectedPath }`. The client should treat this as a successful upload.
   - On `result.reason.startsWith('guard_query_error:')`: fail-closed -- the helper could not verify finalization status. Return HTTP 500 `{ error: 'guard_query_error', detail: result.reason }`. The orphan is NOT deleted; client should retry or rely on Lane 2 janitor.
   - On `result.reason.startsWith('storage_error:')`: Return HTTP 500 `{ error: 'storage_delete_error', detail: result.reason }`. Caller logs + may retry.

Filename safety implementation:
- Server normalizes `original_filename.normalize('NFC')` BEFORE validation.
- Length limit 255 UTF-8 bytes computed as `Buffer.byteLength(normalized, 'utf8')`.
- Reject: path separators (`/`, `\\`), control chars (0x00-0x1f, 0x7f), null bytes, length > 255 UTF-8 bytes, `..` substrings, reserved Windows names (CON, PRN, AUX, NUL, COM1-9, LPT1-9 case-insensitive).
- Original (NFC) stored verbatim in `original_filename`; sanitized variant only used for display fallback. Storage path uses safe scheme `<user_id>/<project_id>/<file_id>/<file_id>.<ext>`.

Tests (L1-3-owned; filename_safety + csrf tests live in L1-1 foundation per Findings 78, 45, 87 and are listed in L1-1's Unit tests block):
- `streaming_sha256.test.ts` (covers `computeStreamingSha256AndMagic`): known fixture blob produces known SHA256; first 8 bytes captured correctly INCLUDING small-first-chunk case (forced via custom ReadableStream that delivers 1-byte chunks first); PDF magic detected; DOCX magic detected; DOC magic detected; mismatched magic rejected; `firstBytes.length < 8` rejected (file truncated). NO writeStream involved -- pure hash + accumulator.
- `path_containment.test.ts`: contained inside base (positive); outside base (negative); case differences on Windows (cmp.win32 lowercase); trailing separator confusion (`/base` vs `/base_evil`); existing target uses `realpath`; non-existing target uses parent-dir `realpath`; symlink-to-outside is rejected (Linux); junction-to-outside is rejected (Windows, when test env supports it).
- `mime_to_extension.test.ts` (Finding 57): pdf MIME -> `.pdf`; docx MIME -> `.docx`; doc MIME -> `.doc`; unknown MIME throws or returns null per documented contract.
- `storage_safe_delete.test.ts` (Findings 69, 73, 74): no row exists at expectedPath -> helper DELETEs storage object, returns `{deleted: true}`; row exists at expectedPath -> helper refuses, returns `{deleted: false, reason: 'finalized_row_references_path'}`; guard SELECT errors -> helper fails closed, returns `{deleted: false, reason: 'guard_query_error:*'}`, does NOT call storage.remove; storage.remove errors -> helper returns `{deleted: false, reason: 'storage_error:*'}`.
- `UploadStep.test.tsx` (Findings 40, 53, 56, 65, 66, 75, 85, 94, 100, 107): **DECISIVE path (server returned non-2xx AND error body parsed successfully + has literal boolean `orphan_cleanup_required`)**:
    - Mock /files/complete 400 with `{error:'magic_mismatch', orphan_cleanup_required: true}` -> client calls /files/orphan; verify cleanup.
    - Mock /files/complete 413 with `{error:'project_cap_exceeded', orphan_cleanup_required: true}` -> client calls /files/orphan (Finding 107).
    - Mock /files/complete 500 with `{error:'guard_query_error_*', orphan_cleanup_required: true}` -> client calls /files/orphan (Finding 107).
    - Mock /files/complete 409 with `{error:'file_id_reused_with_different_content', orphan_cleanup_required: false}` -> client does NOT call /files/orphan, surfaces conflict error (Finding 107 critical case).
    - Mock /files/complete 200 -> client does NOT call /files/orphan.
    - Mock /files/complete 500 + /files/orphan 200 -> orphan cleanup succeeds.
    - Mock /files/complete 500 + /files/orphan 404 -> client logs but does not block.
    - Mock /files/complete 500 + /files/orphan 409 already_finalized -> UploadStep treats as success (NOT cleanup-failure toast; Finding 56).
- **CLEANUP-UNKNOWN path (Finding 100)**: any parsed non-2xx response with missing/null/undefined/non-boolean `orphan_cleanup_required` field -> client does NOT call /files/orphan, treats as cleanup-unknown, optionally polls /files/exists for safety, surfaces original error to user with cleanup-status-unclear note. Specifically:
    - Mock /files/complete 500 with body `{error: 'unknown'}` (NO flag) -> NO orphan call.
    - Mock /files/complete 400 with body `{error: 'x', orphan_cleanup_required: null}` -> NO orphan call.
    - Mock /files/complete 400 with body `{error: 'x', orphan_cleanup_required: "true"}` (string not boolean) -> NO orphan call.
    - Mock /files/complete 400 with body `{error: 'x', orphan_cleanup_required: 1}` (number) -> NO orphan call.
- **AMBIGUOUS path (Findings 53, 66, 75, 85 -- broadened)** -- ALL of the following enter the AMBIGUOUS polling path, and in each the client MUST NOT call /files/orphan, MUST poll `GET /api/engine-v2/files/exists?project_id=<id>&file_id=<id>` at 1s intervals for up to 5 polls, MUST treat 200-within-window as success, MUST surface non-fatal toast on 5x404:
    - (a) Mock TUS-success then `/files/complete` network throw (AbortError, TypeError 'Failed to fetch', connection reset, ETIMEDOUT).
    - (b) Mock TUS-success then `/files/complete` returns 200 but `response.json()` throws SyntaxError or rejects mid-body-read (Finding 75: 2xx-with-body-failure is AMBIGUOUS).
    - (c) Mock TUS-success then `/files/complete` returns non-2xx (e.g., 502) but the error body is unparseable as JSON (Finding 85: non-2xx-with-parse-failure is AMBIGUOUS -- the client cannot determine the server's intended verdict). Note: a non-2xx response with a successfully-parsed error body is DECISIVE, NOT AMBIGUOUS.
    - (d) Mock TUS-success then `/files/complete` AbortSignal.timeout fires before any response (under test flag).
- **F56 case** -- mock `/files/complete` 500 + `/files/orphan` 409 `{error: "already_finalized"}` -> UploadStep re-fetches file list and treats as success (NOT a cleanup-failure toast).
- **F65 race coverage (deterministic mocked integration test)** -- use MSW or equivalent: client POSTs /files/complete; server COMMITs the row (mock DB INSERT success); server disconnects the response (mock connection abort AFTER INSERT but BEFORE response body); client sees fetch throw; assert client polls /files/exists; mock /files/exists returns 200; assert client transitions to success without /files/orphan call. This is the deterministic race coverage that manual smoke 13b previously attempted.

<!-- END SECTION: L1-3 -->

<!-- BEGIN SECTION: L1-4 -->
### Module L1-4: Project create wizard + tests

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\new\page.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ProjectMetadataStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ApplicationTypeStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ServiceTypeStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\SubmissionContextStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\wizard\ReviewStep.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\projects\route.ts` (POST; requireAdminForApi; Zod; CSRF check; `export const runtime = 'nodejs'`)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\service_to_media.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\service_to_media.test.ts`

Wizard imports (Schedule3Service is an interface per Finding 20; type-only import correct):
```typescript
import { SERVICES, LIFECYCLE_STAGES, getServicesByStage, getServiceById, type Schedule3Service } from "@/lib/regulatory-review/schedule3";
```

`service_to_media.ts`: literal TypeScript const copying v1's `SERVICE_TO_MEDIA` at `src/lib/regulatory-review/launch-evaluation.ts:19-42`.

`POST /api/engine-v2/projects` flow:
1. `requireAdminForApi(req)`.
2. CSRF check (Content-Type + Origin via csrf.ts).
3. Validate Zod `ProjectCreatePayload`.
4. INSERT INTO v2_projects (user_id, name, application_types, selected_services, media_types, submission_context_overrides, model). max_files / max_total_bytes use DEFAULT (50, 500MB).
5. Return new project row.

<!-- END SECTION: L1-4 -->

<!-- BEGIN SECTION: L1-5 -->
### Module L1-5: Project detail page (upload + file list + extract control + status)

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\[projectId]\page.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\[projectId]\ProjectDetailClient.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\FileList.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\ExtractionStatusPanel.tsx`
- NEW `C:\Projects\SSTAC-Dashboard\src\components\engine-v2\ExtractTriggerButton.tsx`

Route: `/dashboard/engine-v2/<projectId>`. Server Component for initial render via `requireAdminForServerComponent`. Renders all controls the smoke exercises: upload, file list, extract trigger, status panel.

`ExtractionStatusPanel` renders: status, totalFiles, completedFiles, currentFile, progress, errors[], updatedAt, completed_at (terminal-status timestamp per Finding 43), chunkProgress (scalar string per Finding 17 verification). Polls via `POST /projects/[id]/extract-status` with `{run_id}` JSON body (Finding 37; was GET in v7.3). Poll interval 2s while status is non-terminal; stop polling on terminal status.

`ExtractTriggerButton` rules (Findings 41, 80 UI button-disable):
- Renders an enabled "Run extraction" button only when ALL of the following hold:
  1. NO non-terminal `v2_extraction_runs` row exists for the current project (latest run is terminal or no runs exist).
  2. AT LEAST ONE active (deleted_at IS NULL) `v2_submission_files` row exists for the project (Finding 80 -- extract cannot proceed with zero files).
- Renders a DISABLED "Extraction in progress (run_id=<short>)" button when a non-terminal row exists.
- Renders a DISABLED "Upload at least one file first" button when no active files exist (Finding 80).
- Re-enables automatically once polling reports a terminal status transition AND active file count >= 1.
- Click handler POSTs `/projects/[id]/extract` (CSRF-protected). On 409 (idempotency hit), the button does NOT spawn a duplicate run; the existing run_id is displayed and the panel switches to polling that run. On 400 with `{error: "no_active_files"}` (server-side zero-file guard per Finding 80), the button surfaces a non-fatal toast prompting the user to upload a file.
- Closes the "double-click race" + "zero-file extract" surfaces (Findings 41, 80); the SQL idempotency guard + server-side zero-file guard remain authoritative server-side enforcement.

<!-- END SECTION: L1-5 -->

<!-- BEGIN SECTION: L1-6 -->
### Module L1-6: Extraction trigger + status polling + stale detection + tests

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\projects\[id]\extract\route.ts` (POST; requireAdminForApi; CSRF; `export const runtime = 'nodejs'`)
- NEW `C:\Projects\SSTAC-Dashboard\src\app\api\engine-v2\projects\[id]\extract-status\route.ts` (POST per Finding 37 to comply with safe-GET semantics + CSRF; requireAdminForApi + CSRF; `export const runtime = 'nodejs'`)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\spawn_extraction.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\storage_materialize.ts` (exports `materializeToLocal` per Finding 29; partial-file cleanup per Finding 30)
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\status_parsing.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\status_parsing.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\spawn_extraction.test.ts`
- NEW `C:\Projects\SSTAC-Dashboard\src\lib\engine-v2\__tests__\storage_materialize.test.ts`
- EDIT `C:\Projects\Regulatory-Review-worktrees\engine-v2\engine_v2\.gitignore` (cross-repo; SEPARATE commit per Engineering Decisions)

`POST /api/engine-v2/projects/[id]/extract` flow:
1. `requireAdminForApi(req)`.
2. CSRF check (Content-Type + Origin).
3. `LOCAL_ENGINE_ENABLED` gate; if not "true", return 503.
4. Ownership probe: SELECT v2_projects via auth client; 0 rows -> 403.
5. Zero-file guard (Finding 80): SELECT count(*) FROM v2_submission_files WHERE project_id = $id AND deleted_at IS NULL. If count == 0, return HTTP 400 `{error: "no_active_files", message: "Upload at least one file before triggering extraction."}` and do NOT create a v2_extraction_runs row.
6. Race-safe idempotency (Finding 5): attempt `INSERT INTO v2_extraction_runs (project_id, status, total_files)` with status='pending' and `total_files = count_from_step_5`. On 23505 unique violation against `idx_v2_extraction_runs__one_active`, re-SELECT existing non-terminal row, return HTTP 409 with `{run_id, status}` of existing row. Do NOT spawn new subprocess.
7. Fetch all non-deleted v2_submission_files for project (same SELECT as step 5; reuse the in-memory result if possible). Pre-create INSERT auto-commits.
8. Materialize each file via `materializeToLocal(signedUrl, headers, localPath)` from `storage_materialize.ts` (Finding 29 named operation; partial-file cleanup on error per Finding 30) to local `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/<project_id>/<file_id>.<ext>`. Materialization is sequential (one file at a time) to keep disk pressure bounded; if any file fails to materialize, the function call throws -- catch propagates to step 9's spawn-failure path (uploads dir moved to quarantine, row stamped error).
9. Spawn detached `pythonw.exe` via `child_process.spawn` with args `--source-dir <uploads_dir> --output-dir <extracts_dir> --progress-file <status_json_path>`. Wrap in try/catch:
   - On spawn success (process started): return `{run_id: <v2_extraction_runs.id>, status: 'extracting'}` (HTTP 200) and update row to status='extracting'.
   - On spawn throw (ENOENT, EACCES, etc., BEFORE any status JSON exists) OR materialization throw from step 8 (Finding 97 -- corrected from "step 7" after renumbering): catch, update row to `status='error', errors=['Subprocess spawn failed: <error.message>']` (or `'Materialization failed: <error.message>'`) AND `completed_at=now()` (Finding 43), then BEST-EFFORT invoke `quarantineUploadsDir(projectId)` from `storage_materialize.ts` wrapped in its own try/catch (Finding 54: helper throws MUST NOT mask the original error response or the row's terminal status; quarantine failures logged but route still returns HTTP 500 with the original failure reason). The helper contract: `{moved: false, reason: 'source_missing'}` on missing source (no throw); throws on containment violations or unexpected fs errors. Return HTTP 500.

Output dir (extractor `--output-dir`): `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_extracts/<project_id>/`. PERSISTENT; retained for Lane 2.

Status JSON path (extractor `--progress-file`): `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/<project_id>/.extraction_status.json`.

`POST /api/engine-v2/projects/[id]/extract-status` (per Finding 37; was GET in v7.3; route name kept for clarity but verb is now POST) flow:

Request body Zod: `ExtractStatusSyncPayload` = `{ run_id: string-uuid }`.

1. `requireAdminForApi(req)`.
2. CSRF check (Content-Type: application/json + environment-aware Origin per Finding 24).
3. Validate Zod `ExtractStatusSyncPayload`.
4. Ownership probe: SELECT v2_projects via auth client; 0 rows -> 403.
5. Fetch v2_extraction_runs row by `(project_id, run_id)`. 0 rows -> 404.
6. If row.status IN TERMINAL_STATUSES (`completed`, `completed_with_errors`, `error`): return row (no stale check, no file read, no cleanup).
7. Read status JSON file via `status_parsing.ts` (defensive parse).
8. If file missing AND row.status IN ('pending', 'extracting') (Finding 6 baseline): use `started_at` as stale baseline. If `(now() - started_at) > EXTRACT_STALE_TIMEOUT_MS` (default 3600000 / 60min per Finding 7), transition row to `status='error', errors=['Subprocess never wrote status file within stale timeout'], completed_at=now()` (Finding 43). Otherwise return row as-is with `status='pending'`.
9. If file present: parse JSON; merge into row; if `progress.updatedAt` older than `EXTRACT_STALE_TIMEOUT_MS`, transition row to `status='error', errors=['Extraction subprocess silent beyond timeout (stale)'], completed_at=now()` (Finding 43). String errors only.
10. Cleanup-on-transition: on transition to `status='completed'` OR `status='completed_with_errors'`: delete `v2_dashboard_uploads/<project_id>/` recursively (await `isContained()` per Finding 15/25; set `completed_at=now()` per Finding 43). On transition to `status='error'` (including stale): BEST-EFFORT invoke `quarantineUploadsDir(projectId)` from `storage_materialize.ts` wrapped in try/catch (Finding 54 -- helper throws logged but do NOT mask the row's terminal status). Helper (Findings 38, 49) mkdir-recursive's the quarantine base, derives target `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_uploads/_quarantine/<project_id>_<UTC_timestamp>/`, runs isContained checks on both source and target parents, then moves. Helper contract: `{moved: false, reason: 'source_missing'}` on missing source (no throw, returns normally); throws on containment violations or unexpected fs errors. Extracts dir retained always.
11. Upsert row by `(project_id, run_id)` including `completed_at=now()` for terminal transitions (Finding 43); return latest.

Engine-v2 worktree `.gitignore` edits (cross-repo; SEPARATE commit per Engineering Decisions):
```
# v2 dashboard staging dirs (engine_v2/data/)
data/v2_dashboard_uploads/
data/v2_dashboard_extracts/
```

Tests:
- `status_parsing.test.ts`: parses all 5 status values (pending, extracting, completed, completed_with_errors, error); chunkProgress optional; presence/absence parses correctly (scalar string only); currentFile optional; stale transition (mock `progress.updatedAt` older than timeout); missing-file stale (mock missing status JSON + row.started_at older than timeout); missing-file in-window (returns row.status='pending' unchanged).
- `spawn_extraction.test.ts`: spawn-success path returns `{run_id, status: 'extracting'}`; spawn-failure path (mock ENOENT) transitions row to error + moves uploads to quarantine; race-safe idempotency (mock pre-existing non-terminal row, attempt second extract -> 409 returned); **zero-active-files guard (Finding 88)**: mock zero active v2_submission_files for the project; POST /extract returns HTTP 400 `{error: "no_active_files"}` AND verifies NO v2_extraction_runs row was inserted AND verifies NO subprocess was spawned.
- `storage_materialize.test.ts` (covers `materializeToLocal` + `quarantineUploadsDir`): writes streamed bytes to local path; backpressure handled (mock slow disk; verify drain awaited); finish event awaited (verify file fully flushed before return); writeStream error mid-stream -> Promise rejects, partial file unlinked (Finding 28 + 30); fetch 4xx/5xx -> throws "fetch failed"; parent dir missing initially -> mkdir creates the dir recursively, materialize succeeds (Finding 34); persistent error listener captures writeStream 'error' between await boundaries (mock fast disk-full emit between reader.read() and next write call; verify Promise rejects with the captured error, NOT process crash) (Finding 35); releaseLock failure does not mask original throw (Finding 36). **`quarantineUploadsDir(projectId)` (Findings 38, 49, 54, 62):** quarantine base dir does not exist initially -> helper mkdir-recursive's it -> move succeeds, returns `{moved: true, targetPath}`; quarantine base exists -> helper is idempotent on the mkdir; **source uploads dir does not exist -> helper returns `{moved: false, reason: 'source_missing'}` (NO throw -- Finding 62 locks the contract);** isContained check rejects source/target outside REG_REVIEW_ENGINE_V2_BASE_PATH (containment violation -> helper throws without moving); unexpected fs errors (EACCES, EBUSY, etc.) -> helper throws. Route callers MUST wrap helper invocation in try/catch and log quarantine failures without masking the original error response.

<!-- END SECTION: L1-6 -->

<!-- BEGIN SECTION: L1-7 -->
### Module L1-7: Smoke + docs + handoff (NON-DROPPABLE)

File allowlist:
- NEW `C:\Projects\SSTAC-Dashboard\tests\fixtures\lane1_smoke.pdf` (pre-generated; Finding 18)
- NEW `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\dashboard\engine-v2\README.md`
- NEW `C:\Projects\SSTAC-Dashboard\docs\engine_v2_frontend_lane1_handoff_2026_05_11.md`
- NEW `C:\Projects\SSTAC-Dashboard\docs\LANE1_SMOKE_2026_05_11.md`

Pre-generated smoke PDF (Findings 18, 50, 55):
- The committed fixture MUST be a TEXT-BEARING PDF containing the literal string `Engine v2 lane 1 smoke text` so that smoke step 10 can verify Docling actually extracted submission text into the VERBATIM JSON (not just plumbing) (Finding 55).
- Generate ONCE during L1-7 prep, BEFORE smoke run. NOT via inline `python -c` (Finding 18). Commit at `C:\Projects\SSTAC-Dashboard\tests\fixtures\lane1_smoke.pdf`. Approximate size: 2-5 KB.
- Preferred generation method (run once; reportlab installed locally as a one-time tooling dep, no runtime dep):
  ```python
  # Run from C:\Projects\SSTAC-Dashboard\tests\fixtures\
  # pip install reportlab  # one-time install if not already present
  from reportlab.pdfgen import canvas
  c = canvas.Canvas('lane1_smoke.pdf')
  c.drawString(100, 750, 'Engine v2 lane 1 smoke text')
  c.save()
  ```
- Alternative if reportlab unavailable: write minimal text-bearing PDF bytes literal manually (well-formed `%PDF-1.4` skeleton with one page containing a `BT /F1 12 Tf ... (Engine v2 lane 1 smoke text) Tj ET` content stream; xref offsets must be byte-accurate). Confirm the generated file parses in a PDF reader AND that opening it visually shows the text BEFORE committing.
- Owner-supplied PDF (last resort) is acceptable ONLY IF explicitly anonymized AND owner-approved for commit (no PII, no site/personnel/contractor names, no project numbers, no protected literals per CLAUDE.md). Otherwise owner-supplied PDFs are local-only smoke inputs and NOT committed. Default is the reportlab-generated fixture (Finding 50 closure -- staged text-scan does not inspect binary PDF content, so commit decisions must be conservative).

Smoke (Lane 1 end-to-end). Order matters for race-sensitive idempotency test (Finding 41):
1. Sign in as admin.
2. Navigate to `/dashboard/engine-v2/`.
3. Create project via wizard. Call this Project A.
4. Upload `lane1_smoke.pdf` (or owner-supplied) to Project A via TUS UploadStep.
5. Verify magic-number validation passes for the test PDF (no 400 returned).
6. Trigger extraction via ExtractTriggerButton on Project A. Note the run_id returned.
7. **IDEMPOTENCY TEST (must run BEFORE step 8's terminal transition per Finding 41):** Verify the ExtractTriggerButton is now in DISABLED state (UI button-disable rule). Capture pythonw count BEFORE the second attempt (PowerShell syntax per Finding 91): `$beforeCount = (tasklist | findstr pythonw | Measure-Object).Count`. To force the race, bypass the disabled UI and call `POST /api/engine-v2/projects/<Project A id>/extract` directly (via curl, browser devtools, or a second tab that hasn't refreshed UI state) WHILE the first run is non-terminal. Verify the response is HTTP 409 with the same run_id from step 6. Capture pythonw count AFTER: `$afterCount = (tasklist | findstr pythonw | Measure-Object).Count`. **Verify `$afterCount -eq $beforeCount` (Finding 82 -- idempotency means the second click spawned no additional subprocess; global pythonw count from unrelated processes is netted out by the before/after delta).** Also verify exactly ONE v2_extraction_runs row exists in non-terminal status for Project A.
8. Observe ExtractionStatusPanel updating: status transitions pending -> extracting -> (completed | completed_with_errors).
9. Verify currentFile + progress + chunkProgress fields render during step 8.
10. Confirm VERBATIM JSON output appears at `${REG_REVIEW_ENGINE_V2_BASE_PATH}/data/v2_dashboard_extracts/<Project A id>/` after step 8 reaches terminal status. **Text-extraction assertion (Findings 55, 63, 67):** recursively walk the VERBATIM JSON tree, collecting ALL string leaves (every string value at any depth, not just designated text fields, to be robust against Docling field-naming choices). CONCATENATE all collected strings into one buffer. NORMALIZE whitespace (replace `\s+` regex matches with a single space, trim leading/trailing). **LOWERCASE both the normalized extracted concatenation AND the expected phrase before substring assertion (Finding 67 -- handles case differences Docling might introduce).** Assert that the lowercased expected phrase `engine v2 lane 1 smoke text` is present as a substring in the lowercased normalized extracted concatenation. Robust against Docling splitting text across fields, normalizing whitespace differently, or altering case.
11. Verify ExtractTriggerButton is now re-enabled (terminal state). Verify `v2_extraction_runs.completed_at` is non-null (Finding 43).
12. Test duplicate-SHA: upload the same `lane1_smoke.pdf` twice in Project A; verify second upload returns existing file row (HTTP 200, not a duplicate row).
13. Test orphan cleanup wiring -- split into two sub-cases per Finding 59:
    **13a (DECISIVE path -- Finding 40):** upload a third file but FORCE `/files/complete` to return a definitive 400 (use a file with intentionally invalid magic-number content, or transiently break the route via a feature flag); verify the client's UploadStep fires `POST /api/engine-v2/files/orphan`; verify the Storage object is removed from the bucket; verify no orphaned `v2_submission_files` row exists.
    **13b (AMBIGUOUS path -- Findings 53, 58, 60, 65, 70, 75, 79):** manual smoke verification is no longer the deterministic test for the "server commits then client sees throw" race (that case is now covered by an automated mocked integration test in `UploadStep.test.tsx` using a deterministic MSW/test-server harness; see L1-3 test list). Manual smoke step 13b instead exercises the /files/exists polling path deterministically using TWO coordinated mechanisms (Finding 70 + 79 -- server-side delay alone leaves fetch pending, never triggering the AMBIGUOUS path; need a client-side abort to fire AbortError so UploadStep enters AMBIGUOUS):
    - Server-side: force `/files/complete` to DELAY its response by 3 seconds via a guarded `?testDelay=3000` query param accepted only when `process.env.VERCEL_ENV !== 'production'` AND `process.env.NODE_ENV !== 'production'`. The server still COMMITs the INSERT internally before the delay (or alternatively, the delay happens after a synchronous commit; ensure ordering is "INSERT-commit then sleep then response").
    - Client-side: under the same non-production test flag, UploadStep applies `AbortSignal.timeout(1000)` to the /files/complete fetch (or an equivalent manual AbortController triggered at 1s); after 1 second, the abort fires, the fetch throws AbortError, UploadStep enters the AMBIGUOUS path.
    - Observe UploadStep starts polling `GET /api/engine-v2/files/exists?project_id=<id>&file_id=<id>` at 1s intervals. Server's INSERT has already committed (well within the 3s server delay). After at most 5 polls, /files/exists returns 200. UploadStep transitions to success state WITHOUT calling /files/orphan and WITHOUT showing a cleanup-failure toast. Verify the Storage object and DB row remain intact.
    - Test flag MUST be off in production (no AbortSignal.timeout, no testDelay accepted).
14. Test cap rejection (Finding 33 reworded): Create a FRESH project for cap testing (call it Project B; SEPARATE from Project A). Set `max_files = 1` on Project B via SQL: `UPDATE v2_projects SET max_files = 1 WHERE id = '<Project B id>';`. Upload first file to Project B (count goes 0->1; expect HTTP 201 or 200). Upload second file (count=1; trigger raises 23514; expect HTTP 413 from cap trigger). Reset `max_files = 50` via SQL (optional cleanup). Smoke step 14 optional if time-pressed; documented in handoff.
15. Test quarantine on error path (Finding 38): Create a fresh project C with a single file uploaded. Temporarily set `LOCAL_ENGINE_ENABLED=true` but break the pythonw path (e.g., `REG_REVIEW_PYTHON_PATH=C:\does_not_exist\pythonw.exe`) so spawn fails with ENOENT. Trigger extraction; verify HTTP 500 and the row stamps `status='error'`. Verify `${quarantineBase}/<Project C id>_<UTC>/` exists with the uploaded file contents. Verify the quarantine base directory `_quarantine/` was created if it didn't exist. Reset `REG_REVIEW_PYTHON_PATH` to the correct value after the test. Smoke step 15 optional if time-pressed; documented in handoff.
16. Document rough edges in `LANE1_SMOKE_2026_05_11.md` (PASS/FAIL/notes per step).

Docs:
- `src/app/(dashboard)/dashboard/engine-v2/README.md`: developer-facing v2 dashboard navigation.
- `docs/engine_v2_frontend_lane1_handoff_2026_05_11.md`: handoff to next session. MUST capture:
  - Lane 2 entry points.
  - Known minors carried forward (per Findings 32, 42, 53, 61, 98, 104 -- narrowed): (a) cap-trigger UX edge: F64 idempotent-retry safety check at step 9 handles true retries of existing finalized files (SAME file_id + SAME sha256) with HTTP 200 BEFORE cap preflight, resolving the original at-cap-dup-SHA UX issue for true retries. The REMAINING edge is a NEW file_id + SAME sha256 at cap (user uploads identical content but TUS assigned a fresh file_id); cap trigger fires before dup-SHA check, returning 413. New file_id + NEW sha256 at cap is normal cap rejection. Workaround for the narrow remaining edge: delete an existing file first OR raise the cap via SQL. (b) cap-only-on-finalized-rows limitation per Finding 42: un-finalized direct Storage uploads bypass cap until bucket-level file_size_limit; Lane 1 mitigations are UploadStep orphan wiring + admin-gating + bucket limits. (c) ambiguous-network-failure orphans per Findings 53/61: UploadStep does not delete on ambiguous fetch failure, so rare un-finalized Storage objects may persist until manual cleanup or Lane 2 janitor.
  - **Lane 1 manual cleanup procedure (Finding 61):** weekly, admin runs the following maintenance task -- (1) LIST all objects in the v2-submissions bucket under their own `<user_id>/` prefix via Supabase Storage API or dashboard, (2) SELECT all storage_paths from v2_submission_files for projects the admin owns where deleted_at IS NULL, (3) compute the diff (Storage objects with no matching active row), (4) for each orphan that is older than 7 days, DELETE via the authenticated Supabase client. Document the SQL + a sample script in the handoff. Lane 2 janitor (Finding 42 follow-up) will automate this.
  - Open follow-ups: PID-based liveness check (Finding 7 -> Lane 2), rate-limiting (Finding 11 -> Lane 2), Lane 2 download Content-Disposition (Finding 13), materialization-as-background-job (Finding 26) if any Lane 2 path goes to Vercel serverless, storage-objects janitor for un-finalized Storage objects (Findings 42, 53, 61 -> Lane 2 -- automates the manual cleanup procedure above).
  - Commit list with codex-desktop review status (per session memory: pre-commit Opus loop + codex desktop manual review).
- `docs/LANE1_SMOKE_2026_05_11.md`: smoke execution record.

Staged-only hygiene scan (PowerShell-safe; excludes binary fixtures):
```powershell
git diff --cached --name-only --diff-filter=ACM | Where-Object {
  $_ -notmatch '\.(pdf|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|eot|zip|gz|tar|sqlite|db)$'
} | ForEach-Object {
  Select-String -Path $_ -Pattern '\b\d{4,5}\b' -SimpleMatch:$false -ErrorAction SilentlyContinue
}
```
Allow `2026` year. Binary fixtures excluded by extension.

<!-- END SECTION: L1-7 -->

## Lane 2 - Evaluation + Review + Memo (QUEUED)

(Same as v6.x; sketched only.)

- L2-1: Lane 2 schema. Tables: v2_evaluations (raw_eval_result_json JSONB; run_id_engine UNIQUE), v2_per_policy_results (unique (evaluation_id, policy_id); verdict_suggestion, confidence_method, tier_render_policy, pathway_notes, rubric_self_score), v2_evidence_items (evidence_item_ref / traceability_anchor / provenance preserved; unique (per_policy_result_id, evidence_item_id)), v2_telemetry, v2_stage_models, v2_judgments (enum decided by owner: 4 vs 5), v2_judgment_history, v2_memo_exports (generator_version, judgment_snapshot_hash, content_sha256, storage_path NULL), v2_bench_fixtures.
- L2-2: multi-VERBATIM merge adapter (per-file provenance).
- L2-3: evaluation status wrapper script (JSON status not natively produced).
- L2-4: evaluation trigger (stub default; live owner-authorized per-run).
- L2-5: idempotent eval_result.json import (raw blob + selected normalized fields; transaction-wrapped).
- L2-6: results viewer + provenance/telemetry sidebar.
- L2-7: HITL judgments + memo export (Word MSO scaffolding verbatim).
- L2-8: Lane 2 smoke.

Lane 2 enhancements that should be considered for design at L2 kickoff:
- PID-based stale-detection (Finding 7 follow-up): store subprocess_pid on v2_extraction_runs row; stale handler probes liveness via `process.kill(pid, 0)` before terminal stamp.
- Rate-limiting middleware (Finding 11 follow-up): per-uid token bucket; per-route caps (60/min on file routes, 5/min on /extract).
- Content-Disposition on signed URLs (Finding 13 follow-up): if Lane 2 adds a "download original" button, pass `?download=` query parameter to `createSignedUrl` calls.
- Materialization-as-background-job (Finding 26 deferred): if Lane 2 evaluation ever deploys to Vercel serverless, materialization must move out of the POST handler to a separate worker queue.
- Cap-trigger reordering (Finding 32, narrowed per Finding 98): F64 idempotent-retry safety check at L1-3 step 9 now handles true retries of existing finalized files (same file_id + same sha256) with HTTP 200 BEFORE cap preflight. Remaining edge: a NEW file_id with the SAME sha256 (e.g., user uploads the same content but the TUS layer assigned a new file_id) at a project at cap will still return 413; the dup-SHA constraint at idx_v2_submission_files__active_sha would otherwise return 200 with the existing winning row, but the cap trigger fires earlier. Lane 2 polish: trigger could SELECT for dup-SHA before count check, returning 200 idempotently in that narrow case.
- Storage-objects janitor (Finding 42 follow-up): periodic worker that scans `storage.objects` under the v2-submissions prefix, joins against `v2_submission_files` rows, and deletes objects with no matching row that are older than a TTL (e.g., 24h). Closes the un-finalized-Storage-bypass gap that Lane 1 mitigates only via UploadStep orphan-cleanup wiring + admin-gating + bucket file_size_limit.

## Codex Review Strategy (session-level)

- Plan-mode review (R14-R24 whole-plan loop): Opus iterative loop (R1-R5) closed 36 findings; R18-R24 codex desktop loop closed 31 additional findings across whole-plan single-shot reviews. Closure cadence was steady but not strictly convergent (5-7 findings per round across the codex passes). See changelog above for round-by-round detail.
- Plan-mode review (R25+ per-module loop): codex desktop is restarted with PER-MODULE iteration. Each module L1-1 through L1-7 gets its own codex session that iterates until codex emits "GREEN-LIGHT L1-N" for that section. Engineering Decisions cross-cutting block is reviewed FIRST as foundation before any module session. Section markers (`<!-- BEGIN SECTION: L1-N -->` / `<!-- END SECTION: L1-N -->` and `<!-- BEGIN SECTION: ENGINEERING_DECISIONS -->`) scope each codex session to a single block. Within a section's session, the user and orchestrator paste fixes back to codex until that section is green. After all sections green, ExitPlanMode and begin Module L1-1 implementation.
- Implementation phase: pre-commit Opus adversarial subagent per module. After Opus GREEN per module + Claude concurrence: commit. Codex desktop review of committed diff is owner-triggered (not blocking), flagged commits captured for batch review.
- High-risk modules requiring extra-thorough codex iteration before declaring green: L1-1 (schema/RLS/storage/cap-trigger), L1-3 (upload + streaming + filename + magic + CSRF + orphan flows + idempotent retry + safe-delete helper), L1-6 (subprocess + stale detection + path-containment + materialization + quarantine helper + zero-file guard).

## Subagent File Allowlists

Each Lane 1 module has explicit file allowlist (no wildcards). Sequencing: L1-1 (EXIT GATE) -> L1-2 + L1-3 + L1-4 (parallel; disjoint allowlists) -> L1-5 (needs L1-2 + L1-3 + L1-4) -> L1-6 -> L1-7.

Subagents must not modify files outside their allowlist. Subagents must declare `export const runtime = 'nodejs'` on every API route they create.

## Failure-Mode Triage (Lane 1) - smoke NON-DROPPABLE

Droppable polish (only if elapsed exceeds budget):
- Telemetry surfacing beyond what status JSON provides (none in Lane 1 anyway).
- Extra defensive tests beyond the required unit-test coverage in module allowlists.
- ASCII docstring linting strictness (relax to "ASCII-clean at commit time" without auto-fixers).
- Smoke steps 14, 15 (cap rejection on fresh Project B; quarantine on error path): can be deferred to a follow-up smoke if time pressed; documented in handoff.

NON-DROPPABLE (must ship in Lane 1):
- Module L1-7 smoke steps 1-13 (the vertical-slice verification + idempotency race test + orphan-wiring test).
- filename_safety + NFC + byte-length (security critical).
- computeStreamingSha256AndMagic with accumulator + try/finally safe reader release (security + perf critical).
- materializeToLocal with mkdir-before-createWriteStream + persistent error listener + drain-and-error + finish-and-error + partial-file cleanup + safe releaseLock (security + perf critical; Findings 28, 30, 34, 35, 36).
- Magic-number validation (security critical).
- Zod boundary validators including ExtractStatusSyncPayload (security critical).
- CSRF Content-Type + environment-aware Origin check on every POST/DELETE INCLUDING the new POST /extract-status (Finding 37).
- currentFile + chunkProgress + completed_at fields across schema + Zod + parser + UI (Finding 43).
- INSERT-first race-safe duplicate-SHA pattern at /files/complete.
- Cap-enforcement trigger + cap-trigger handling at /files/complete.
- idx_v2_extraction_runs__one_active partial unique index + 23505-catch at /extract.
- Stale-detection in POST extract-status with started_at baseline.
- Ownership probe pattern in every authenticated handler.
- Path-containment with realpath for cleanup/quarantine.
- Quarantine base directory mkdir before quarantine move (Finding 38).
- UploadStep orphan-on-failure wiring (Findings 40, 53, 94, 100, 111): client calls `/files/orphan` ONLY after a parsed non-2xx `/files/complete` response with literal `orphan_cleanup_required === true`; AMBIGUOUS path (fetch throw / 2xx body-parse failure / non-2xx parse failure) polls `/files/exists` instead and never calls orphan; CLEANUP-UNKNOWN path (parsed non-2xx with missing or non-boolean flag) also never calls orphan and surfaces original error.
- ExtractTriggerButton disabled while non-terminal v2_extraction_runs exists for the project (Finding 41).
- Defensive schema ALTERs + clean-slate EXIT GATE confirmation (Finding 39).
- Log redaction (file_id instead of filename).

If 4h with L1-6 unfinished: ship L1-6 minus chunk_progress display only (keep chunk_progress in schema for forward compat). currentFile stays in UI.

If 5h with smoke unfinished: extend session OR ship L1-7 docs marking smoke as unverified-this-session AND flag explicitly that Lane 1 is not yet verified.

## Critical Files (Reused, read-only)

- `C:\Projects\SSTAC-Dashboard\src\middleware.ts:130` (matcher)
- `C:\Projects\SSTAC-Dashboard\src\lib\supabase-auth.ts:34` (REUSE `createAuthenticatedClient`)
- `C:\Projects\SSTAC-Dashboard\src\lib\api-guards.ts` (REUSE `requireAdmin`, `LOCAL_ENGINE_ENABLED`)
- `C:\Projects\SSTAC-Dashboard\src\lib\regulatory-review\schedule3.ts` (REUSE `SERVICES`, `LIFECYCLE_STAGES`, `getServicesByStage`, `getServiceById`, type `Schedule3Service`)
- `C:\Projects\SSTAC-Dashboard\src\lib\regulatory-review\launch-evaluation.ts:19-42` (REUSE `SERVICE_TO_MEDIA`)
- `C:\Projects\SSTAC-Dashboard\src\app\api\regulatory-review\projects\[id]\extract-status\route.ts:32,68` (REUSE stale-detection + TERMINAL_STATUSES patterns)
- `C:\Projects\Regulatory-Review\engine\scripts\dashboard_extract.py` (REUSE; called by Module L1-6 via subprocess)

## Verification (Lane 1)

After each module commit:
```
cd C:\Projects\SSTAC-Dashboard
npm run lint
npm run test:unit
```

Lane 1 end-to-end smoke (Module L1-7) is described above. Smoke MUST exercise idempotency (step 7 immediately after first extract trigger -> 409 from idx_v2_extraction_runs__one_active) and duplicate-SHA (step 12: re-upload same PDF -> existing row) and orphan-cleanup wiring (step 13a: DECISIVE-TRUE path -- forced /files/complete failure with `orphan_cleanup_required: true` -> client calls /files/orphan; step 13b: AMBIGUOUS path -- forced fetch abort/throw -> client polls /files/exists, NEVER calls /files/orphan; per Finding 111 strict 4-way classification); cap rejection (step 14) and quarantine on error (step 15) are exercised when time permits.

## Open Questions for Owner (Before Lane 1 Execution / at L1-1 EXIT GATE)

1. Supabase project tier + bucket file_size_limit confirmation.
2. Lane 1 access model confirmation: admin-gated entry + per-admin owner of own projects.
3. Lane 1 smoke PDF source: pre-generated text-bearing PDF (default; reportlab one-liner) during L1-7 prep, reuse existing fixture, or owner-supplied. Current plan default is reportlab-generated text-bearing PDF containing the literal "Engine v2 lane 1 smoke text" so smoke step 10 can verify Docling actually extracted submission text (Finding 55); owner-supplied PDFs may be committed ONLY if explicitly anonymized + approved (Finding 50).
4. CONFIRM CLEAN-SLATE schema (Findings 39, 44, 51): run `SELECT to_regclass('public.v2_projects'), to_regclass('public.v2_submission_files'), to_regclass('public.v2_extraction_runs');` -- all three MUST return null. If any return non-null, drop that table CASCADE before applying the current plan patch. The patch's defensive ALTERs cover column-additions and NAMED status CHECK migrations for partial prior schema but UNNAMED CHECK constraints from older partial schema must be dropped manually (Finding 51); the patch is not a full migration tool for arbitrary prior schema.

(HITL enum question deferred to Lane 2.)

## ASCII / Real-Owner-Content Guardrails

- All new MD docs / commit messages / code comments plain ASCII per CLAUDE.md PLAIN ASCII ONLY rule.
- No protected literals (HHRA / HHERA / site numbers / contractor / personnel / project names) in committed source.
- Staged-only hygiene scan: PowerShell-safe (see Module L1-7); excludes binary fixtures by extension; allows `2026` year.
- This plan file (hazy-watching-pillow.md) is ASCII-clean.

## Rollback Plan

Each commit per-module. `git revert <sha>` per regression. v1 untouched. v2 Lane 1 is admin-gated, opt-in via URL.

Schema patch is idempotent. To roll back schema: `DROP TRIGGER trg_enforce_project_caps_v2 ON v2_submission_files; DROP FUNCTION enforce_project_caps_v2(); DROP POLICY ... ; DROP TABLE v2_extraction_runs CASCADE; DROP TABLE v2_submission_files CASCADE; DROP TABLE v2_projects CASCADE;` (in dependency order). Storage objects in v2-submissions bucket can be cleared separately.

## Cross-References

- Plan history: see changelog above for round-by-round detail. Current state is v7.19 (codex-GREEN at R32 + R33 audit corrections), with cumulative 12 Opus + 16 codex desktop rounds in this session closing ~116 findings.
- Engine-v2 backend master: `6f125686` (head; lane completion `a5e2d982` + Module F docs).
- v1 extractor: `C:\Projects\Regulatory-Review\engine\scripts\dashboard_extract.py`.
- Supabase docs: TUS resumable uploads; storage access control; file limits.
- Prior plan file at `C:\Users\jasen\.claude\plans\sorted-stargazing-kahn.md` (v6.x) is SUPERSEDED by the current plan file. Retain prior file for audit trail; do not edit it.
- Memory anchors: `engine_v2_lane_completion_2026_05_11.md`, `v2_frontend_plan_ready_2026_05_11.md` (both reference v6.x; update to point to the current plan file after ExitPlanMode).

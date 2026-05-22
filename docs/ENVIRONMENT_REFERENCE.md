# Environment Variable Reference

**Lifecycle:** REFERENCE
**Source of truth:** the code that reads each variable, plus `.env.example`. This document is current as of 2026-04-20 and was derived from `grep -rohE 'process\.env\.[A-Z_][A-Z0-9_]+' src/ scripts/` plus per-variable file reads. If you add a new env var, add an entry here and update `.env.example`.

## How to use

- For **local development**, copy `.env.example` to `.env.local` and fill in any variables you need. Local engine and Regulatory Review (RR) integration variables are optional unless you are working in those areas.
- For **Vercel deployments**, set Supabase variables in the Vercel project settings. Local-engine and RR-integration variables should generally **not** be set in Vercel (the engine is a local dev convenience).
- This document does not cover OS-provided variables (`PATH`, `TEMP`, `TMP`, `COMSPEC`, `SYSTEMROOT`) that the codebase reads only for subprocess spawn environments, nor `NODE_ENV` (Next.js framework standard).

## Required variables

### `NEXT_PUBLIC_SUPABASE_URL`

- **Required:** Always. Without this the app cannot start.
- **Read by:** `src/middleware.ts:57`, `src/lib/api-guards.ts:15`, `src/app/api/auth/callback/route.ts:16`, plus other Supabase server clients.
- **Format:** `https://<project>.supabase.co`
- **Sensitivity:** Public (already exposed to the browser bundle as `NEXT_PUBLIC_*`).

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- **Required:** Always.
- **Read by:** Same call sites as `NEXT_PUBLIC_SUPABASE_URL`.
- **Format:** Long opaque JWT.
- **Sensitivity:** Public anon key — safe to ship in the client bundle. Do **not** confuse with the service-role key.

## Optional — local dev / engine integration

### `LOCAL_ENGINE_ENABLED`

- **Required:** Only for routes guarded by `requireLocalEngine()`. Server-side runtime gate.
- **Read by:** `src/lib/api-guards.ts:57`, `src/lib/feature-flags.ts:7`.
- **Values:** `'true'` enables; anything else (including unset) disables.
- **Effect when unset:** API routes guarded by `requireLocalEngine()` return HTTP 503.
- **Sensitivity:** Non-secret; runtime feature flag.

### `NEXT_PUBLIC_LOCAL_ENGINE`

- **Required:** Only when client UI needs to know whether the local engine is available (conditional render).
- **Read by:** `src/lib/feature-flags.ts:16`.
- **Values:** `'true'` shows engine UI; anything else hides it.
- **Notes:** Build-time inlined — set this **at build time** (Vercel build env or local `.env.local` before `npm run build`). Changing it after build has no effect on the client bundle.
- **Sensitivity:** Public (`NEXT_PUBLIC_*`).

### `REG_REVIEW_ENGINE_BASE_PATH`

- **Required:** Only when running the dashboard against an RR engine in a non-default location.
- **Read by:** `src/lib/regulatory-review/launch-evaluation.ts:16`.
- **Default:** `'C:/Projects/Regulatory-Review/engine'`.
- **Effect:** Used to locate `scripts/orchestrators/run_shadow_evaluation.py` when launching an evaluation subprocess.
- **Sensitivity:** Non-secret path.

### `REG_REVIEW_PYTHON_PATH`

- **Required:** Recommended in practice. The default fallback `'python'` only works if a file literally named `python` (no `.exe`) exists at the process working directory, which is unusual on Windows.
- **Read by:** `src/app/api/regulatory-review/projects/[id]/extract/route.ts:103`, `src/lib/regulatory-review/launch-evaluation.ts:160`.
- **Default:** `'python'`. Both call sites then transform it via `configuredPython.replace(/python\.exe$/i, 'pythonw.exe')` and verify the resulting path with `existsSync`.
- **Format:** A **full path ending in `python.exe`** (e.g. `C:/Users/<you>/AppData/Local/Programs/Python/Python311/python.exe`). The `python.exe` suffix is rewritten to `pythonw.exe` so extraction/evaluation runs windowless on Windows.
- **Notes:** Pointing this at a directory does **not** work — the `.replace()` will not match, `existsSync()` will pass for the directory, and `spawn()` will then fail trying to execute the directory. The error message in `launch-evaluation.ts:166` ("directory containing pythonw.exe") is misleading; the code wants a full file path. Fail-closed behavior: if `pythonw.exe` does not exist after the rewrite, both routes return / throw rather than silently falling back to `python.exe`.
- **Sensitivity:** Non-secret path.

### `OLLAMA_BASE_URL`

- **Required:** Only for `src/lib/ollama/model-registry.ts` callers.
- **Read by:** `src/lib/ollama/model-registry.ts:57`.
- **Default:** `'http://localhost:11434'`.
- **Sensitivity:** Non-secret URL.

### `OLLAMA_URL`

- **Required:** Only when launching evaluation subprocesses that need to inherit an Ollama URL.
- **Read by:** `src/lib/regulatory-review/launch-evaluation.ts:144`.
- **Effect:** When set, forwarded to the evaluation subprocess environment as `OLLAMA_URL`. When unset, not forwarded.
- **Notes:** Distinct from `OLLAMA_BASE_URL`. Both exist; do not assume they are interchangeable.
- **Sensitivity:** Non-secret URL.

### `EVAL_STALE_TIMEOUT_MS`

- **Required:** No.
- **Read by:** `src/app/api/regulatory-review/projects/[id]/evaluate-status/route.ts:99`.
- **Default:** `30 * 60 * 1000` (30 minutes — `DEFAULT_EVAL_STALE_TIMEOUT_MS` at `evaluate-status/route.ts:32`).
- **Effect:** Maximum age before an in-progress evaluation status file is treated as stale and cleared.
- **Sensitivity:** Non-secret integer (milliseconds).

### `EXTRACT_STALE_TIMEOUT_MS`

- **Required:** No.
- **Read by:** `src/app/api/engine-v2/projects/[id]/extract-status/route.ts` (`getStaleMs()`).
- **Default:** `3600000` (60 minutes -- `DEFAULT_STALE_MS = 3600000` at `extract-status/route.ts:40`).
- **Effect:** Same semantics as `EVAL_STALE_TIMEOUT_MS` for extraction status.
- **Sensitivity:** Non-secret integer (milliseconds).

### `HITL_PACKET_DIR`

- **Required:** Only when HITL packet files live somewhere other than the default RR evaluation output path.
- **Read by:** `src/lib/hitl-packets/discovery.ts:27`, `src/app/(dashboard)/hitl-packets/page.tsx:128`.
- **Default:** `path.join(process.cwd(), '..', 'Regulatory-Review', '1_Active_Reviews', 'Teck_Trail-WARP', '2_Evaluation_Output')` — a sibling-repo relative path.
- **Effect:** Base directory the discovery layer scans for `HITL_PACKET_*.{json,csv,md}` files.
- **Sensitivity:** Non-secret path. Validate before exposing — the discovery layer enforces a path-traversal guard on session IDs.

## Optional — observability / production

### `NEXT_PUBLIC_APP_VERSION`

- **Required:** No.
- **Read by:** `src/lib/logging.ts:54`.
- **Default:** `'1.0.0'`.
- **Effect:** Tagged on structured log entries.
- **Sensitivity:** Public (`NEXT_PUBLIC_*`).

### `NEXT_PUBLIC_SENTRY_DSN`

- **Required:** Only to enable browser Sentry reporting.
- **Read by:** `src/instrumentation-client.ts:22`.
- **Default:** Unset → Sentry initializes with no DSN (effectively disabled).
- **Sensitivity:** Public (`NEXT_PUBLIC_*`); DSNs are designed to be public per Sentry's threat model.

### `REDIS_URL`

- **Required:** Together with `REDIS_TOKEN` to enable Upstash-backed distributed rate limiting in production.
- **Read by:** `src/lib/rate-limit-redis.ts:45,55`.
- **Default:** Unset → rate limiter falls back to in-memory storage with a console warning.
- **Format:** `https://<name>.upstash.io`.
- **Sensitivity:** Non-secret URL on its own; treated as sensitive when paired with the token.

### `REDIS_TOKEN`

- **Required:** Together with `REDIS_URL`.
- **Read by:** `src/lib/rate-limit-redis.ts:45,56`.
- **Default:** Unset → in-memory fallback (see `REDIS_URL`).
- **Sensitivity:** **Secret.** Treat as a credential. Do not commit; do not log.

### `SUPABASE_SERVICE_ROLE_KEY`

- **Required:** For audited Matrix Map CSV exports.
- **Read by:** `src/app/api/matrix-map/export/route.ts`.
- **Default:** Unset -> `POST /api/matrix-map/export` returns `500 service_role_not_configured`.
- **Effect:** Server-only service-role client writes `matrix_map.export_audit` and `matrix_map.service_role_audit` after export data is refetched under the authenticated admin session. `csv_exports` budget increment still requires a DB-side atomic increment RPC before it should be enabled in the route.
- **Sensitivity:** **Secret.** Treat as a privileged database credential. Never expose to browser code, logs, or client bundles.

## Variables in `.env.example` that are not currently consumed

`.env.example` ships commented-out entries for `REG_REVIEW_EXTRACTIONS_PATH`, `REG_REVIEW_OUTPUT_PATH`, and `REG_REVIEW_TEMP_UPLOAD_PATH`. A repo-wide grep finds **no readers** for these names in `src/` or `scripts/` as of 2026-04-20. They are aspirational / historical placeholders. Either wire them up at the call sites that currently hardcode equivalent paths, or remove them in a future cleanup pass.

## Adding a new env var

1. Choose the name. Use `NEXT_PUBLIC_*` only when the value must reach the browser bundle.
2. Decide: required, optional with default, or optional with feature off when unset?
3. Add to `.env.example` with a one-line comment.
4. Add a section here with: required-or-not, read-by file:line, default, effect, sensitivity.
5. If it controls a feature flag, prefer the existing `feature-flags.ts` pattern rather than reading `process.env.*` directly in components.

# engine_v2 frontend Lane 2d (v1 feature port) plan v0.3 -- 2026-05-13

Status: APPROVED -- owner decisions locked 2026-05-13; adversarial review
BLOCKERs from v0.2 addressed in v0.3. Ready for implementation.

Authored 2026-05-13 after Lane 2c shipped (commits f632fd6 + 03b3fca demo path
end-to-end with real verbatim policy text, live BGE embedder, real Ollama
qwen2.5:14b S2/S3/S4, tier-aware HITL + Word memo export), the Phase 2
codex-IMPORTANT fixes landed at dd2d5dd, and the Phase 2.5 history-list
staleness hotfix landed at f5f17d2.

v0.1 -> v0.2 changes: owner answered 7 open questions; Phase 2 backlog
items added as known-issues.

v0.2 -> v0.3 changes (adversarial review of v0.2 returned YELLOW with
4 BLOCKERs + several IMPORTANTs):
- BLOCKER 1 fixed: Item 1 (sequential evaluations queries) is CLOSED by
  Phase 2.5, not deferred. The .neq filter requires the latest query's
  id first, so Promise.all is structurally impossible. Backlog section
  updated.
- BLOCKER 2 fixed: ED-2d-10 no longer references a nonexistent shared
  `format.ts` helper. Lane 2d uses the established inline
  `toLocaleString('en-US', ...)` pattern from Lane 2a/2c.
- BLOCKER 3 fixed: L2d-3 docx scope DROPPED. Lane 2b's `buildMemo`
  produces a tier-grouped memo, not a per-policy table; reusing it
  from L2d-3 is either redundant (duplicates ExportMemoButton) or
  divergent (breaks byte-equality claim). L2d-3 now ships CSV + MD +
  HTML only. Owner Q7 intent (audit-grade docx; no v1 HTML-flavored
  .doc hack) is honored by leaving Lane 2b docx untouched.
- BLOCKER 4 fixed: L2d-3 POST-vs-GET rationale documented (CSRF gating
  + clean URLs for logging; blob download works identically for both).
- IMPORTANT: EXIT GATE vitest paths in L2d-2 and L2d-3 corrected to
  match the allowlist paths.
- IMPORTANT: ED-2d-11 expanded with explicit evaluation-page merge
  contract for parallel L2d-2 + L2d-3 work.
- IMPORTANT: ED-2d-5 specifies AbortSignal.timeout (not raw setTimeout)
  to avoid timer leaks on happy-stream-complete paths.
- IMPORTANT: L2d-1 checklist requires path.join (not string concat)
  for the engine DB path; brittleness centralized in policy_kb.ts.
- IMPORTANT: ED-2d-7 wording tightened to "PARKED per owner Q2 lock".
- IMPORTANT: L2d-2 timeline padded to 1.5-2.5d (best-case 10h is
  optimistic for SSE + Indigenous rotation + adapter + tests).
- MINOR: test-fixture non-ASCII (Metis with diacritic) clarified as
  intentional fold-test input vs production-string discipline.

Lane 2d ports three high-value features from v1 (`src/app/(dashboard)/regulatory-review/`
and `src/app/api/regulatory-review/`) into the engine_v2 surface:

1. Policy FTS5 search (KB browse + filter on the shared `engine/data/rraa_v3_2.db`).
2. AI Chat Assistant (Ollama-backed RAG with SSE streaming, Indigenous hard-stop,
   tier-aware constitutional constraints in the system prompt).
3. Multi-format export of the per-policy evaluation table (CSV / Markdown / HTML /
   Word; complements the existing `.docx` memo, which stays as the canonical
   narrative export).

Owner-flagged shortlist for Lane 2d (from `engine_v2_lane2c_complete_2026_05_12.md`):

| # | Feature | Budget | v1 source |
|---|---|---|---|
| 1 | Policy FTS5 search route + UI | 2-3h | `src/app/api/regulatory-review/search/route.ts` + `[submissionId]/components/PolicySearch.tsx` |
| 2 | AI Chat Assistant (RAG + SSE + Ollama) | 1-1.5d | `src/app/api/regulatory-review/assistant/chat/route.ts` + `[submissionId]/components/AssistantPanel.tsx` + `src/lib/ollama/prompts.ts` + `src/lib/ollama/model-registry.ts` |
| 3 | Multi-format export (CSV/MD/HTML/Word) | 3-4h | `src/lib/regulatory-review/memo-generator.ts` |
| 4 | Indigenous hard-stop pre-filter | bundled into #2 | `src/lib/ollama/prompts.ts` (`detectIndigenousContent` + `INDIGENOUS_HARD_STOP`) |

The plan pre-empts the obvious codex blocker classes from Lane 1 / 2a / 2b / 2c
review:

- FTS5 query string is built by an explicit sanitizer + tokenizer (no raw user
  text into `MATCH`); LIKE fallback escapes `%` / `_`.
- Chat retrieval is gated by `requireAdminForApi` + `requireLocalEngine`; the
  route is admin-only and never runs in Vercel.
- Indigenous hard-stop is checked on EVERY user turn, including
  prior-history turns, not just the new query (Lane 2c retro carry-forward).
- All Lane 2d date formatting uses the shared `format.ts` `toLocaleString("en-US", {...})`
  helper.
- SSE stream cleanup: abort signal listener + `try/finally` controller close,
  no orphan readers if the client disconnects.
- Multi-format export reuses tier-discretion invariants from `memo_builder.ts`
  via shared assertions (`assertVerdictAllowed`); no new tier logic introduced.
- ASCII-only across all artifacts.

---

## Backend contract carried forward

Lane 2c per-policy results (`v2_per_policy_results.raw_result_json` JSONB) and
evaluations (`v2_evaluations.raw_eval_result_json` JSONB) already surface:

- `policy_id`, `tier`, `ai_suggestion`, `confidence`, `summary`, `evidence_packet`,
  `evidence_slices` (schema 0.1.0 from engine_v2 `42bf961c`), `minority_findings`,
  `evidence_gaps`, `pathway_notes`.
- Telemetry / provenance fields used by `TelemetrySidebar`.

Lane 2c judgments table `v2_judgments` provides the HITL verdict + rationale
(append-only via `v2_judgment_history`). Lane 2d's multi-format export reads
the same join as `memo_builder.ts`; no new ingest plumbing is required.

Lane 2d's chat retrieval reads:

- Policy KB: `engine/data/rraa_v3_2.db` (5,968 policies, `policy_statements` +
  `policy_statements_fts`). Same path the v1 search route uses.
- Per-policy results + judgments: Supabase (`v2_per_policy_results`,
  `v2_judgments`) for hybrid-scope chat (current evaluation context). This
  replaces v1's `src/data/regulatory-review.db` `assessments.evidence_found`
  JSON-scan, which does not exist in the engine_v2 schema.
- Optional: engine_v2 `chunks.sqlite` (53 MB; 5,968 policies; columns include
  `policy_id`, `chunk_kind`, `field`, `content` -- read pattern documented in
  `engine_v2/src/rraa_v2/text_resolver.py:_FETCH_SQL`). NOT used directly in
  Lane 2d -- the search route already gets policy text from
  `policy_statements.original_text`. `chunks.sqlite` integration is a Lane 2e
  candidate (see Out of scope).

---

## Lane 2d scope (in)

- L2d-1: Policy FTS5 search -- API + UI panel mounted on the engine_v2
  project detail page.
- L2d-2: AI Chat Assistant -- SSE route + AssistantPanel, scoped to an
  evaluation (policy / submission / hybrid scope per v1 pattern, but
  "submission" scope reads engine_v2 per-policy results + judgments, not the
  v1 assessments DB).
- L2d-3: Multi-format export -- CSV / MD / HTML / Word for the per-policy
  results table on an evaluation. Re-uses the format-specific generators from
  v1 `memo-generator.ts` but with engine_v2 row shape adapters.
- L2d-4: Indigenous hard-stop pre-filter -- shipped INSIDE L2d-2 prompts. Not
  a separate phase. The v1 `detectIndigenousContent` + `INDIGENOUS_HARD_STOP`
  constants port verbatim.

## Lane 2d scope (out -- deferred to Lane 2e or later)

- Bulk select + pagination (Lane 2c shortlist item 4).
- Submission FTS5 over Docling-extracted text (Lane 2c shortlist item 5;
  better solved engine-side at ingest, not Lane 2d).
- Ingestion wizard pattern (Lane 2c shortlist item 6).
- Dedicated audit-trail schema (Lane 2c shortlist item 7;
  `v2_judgment_history` already exists, additional `review_sessions` table
  deferred).
- `chunks.sqlite` direct retrieval for chat (replaces FTS5 over
  `policy_statements`; small accuracy upside, large coupling cost; revisit if
  chat quality is insufficient).
- Model selection UI beyond `fast` / `deep` toggle (Lane 2e).
- Chat history persistence (turns are stateless within a session; client
  caches in component state only).
- Multi-evaluation comparison view.
- New visualizations or graph features.
- Schema changes beyond the optional `v2_chat_logs` (see Engineering
  Decisions, ED-2d-7).
- Engine-side changes (handle in engine_v2 worktree separately).

---

## Engineering Decisions

### ED-2d-1: One shared engine-v2 ollama client wrapper

The dashboard already has `src/lib/ollama/model-registry.ts`
(`MODEL_REGISTRY`, `resolveModel`, `getOllamaBaseUrl`) and
`src/lib/ollama/prompts.ts` (`detectIndigenousContent`,
`INDIGENOUS_HARD_STOP`, `buildSystemPrompt`, `buildContextPrompt`). Lane 2d
RE-USES these directly; no fork. The v1 chat route at
`src/app/api/regulatory-review/assistant/chat/route.ts` shows the contract.

For tier-aware engine_v2 context (per-policy results + judgments), Lane 2d
adds a thin engine-v2-specific context formatter at
`src/lib/engine-v2/chat_context.ts` that shapes Supabase rows into the same
`{ policies, submissions }` strings `buildContextPrompt` expects. The system
prompt is unchanged from v1 -- the tier constraints are identical (TIER_2 no
adequacy; TIER_3 no analysis; Indigenous hard-stop).

### ED-2d-2: Policy KB reads go through a single shared adapter

`src/lib/engine-v2/policy_kb.ts` (NEW) wraps `better-sqlite3` over
`engine/data/rraa_v3_2.db`. Two functions exported:

- `searchPolicies(query, { tier?, topic?, limit }): PolicySearchRow[]`
- `getPolicyById(policyId): PolicyRow | null`

Both open a read-only connection, run the query, and close. NO long-lived
connection (matches v1 pattern). The chat route's policy retrieval and the
search route both use this adapter, eliminating duplicate SQL between the
two routes (the v1 routes had near-identical FTS code).

### ED-2d-3: FTS5 query sanitizer is a pure function with tests

`src/lib/engine-v2/fts5_query.ts` (NEW) exports `buildFtsQuery(rawQuery): string | null`:

- Strip `'`, `"`, `;`, `--`, `*` from input.
- Split on whitespace; drop tokens shorter than 2 chars.
- Quote each token and append `*` (prefix match).
- Join with ` OR `.
- Return `null` if no usable tokens remain (caller then short-circuits to LIKE
  fallback or returns 400).

Defense in depth: the `MATCH` parameter is also a prepared-statement bind, so
even if the sanitizer regresses, SQL injection at the parser level is blocked.
The sanitizer's job is to keep the FTS5 query well-formed (no `MATCH` parse
errors that would surface as 500s).

### ED-2d-4: Local-engine guard everywhere

All Lane 2d routes call `requireAdminForApi` + `requireLocalEngine` (the same
pair the v1 chat route uses). If `LOCAL_ENGINE_ENABLED !== 'true'` the route
returns 503 with `{error: 'local_engine_disabled'}`. The engine-v2 page must
also short-circuit the panels to "Available locally only" via
`isLocalEngineClient()`.

### ED-2d-5: SSE handler has explicit teardown and abort

Lane 2d chat route mirrors v1's `ReadableStream({ async start(controller) ... })`
but adds:

- `request.signal` propagation to the Ollama `fetch` (so client disconnect
  cancels upstream).
- A single `try/finally` around the reader loop that calls
  `reader.cancel()` + `controller.close()` on any throw.
- An idle timeout via `AbortSignal.timeout(60_000)` (NOT raw
  `setTimeout` + `Promise.race`). Reason: raw setTimeout without a
  matched clearTimeout on the happy-stream-complete path leaks a timer
  for the full 60s after every successful stream. AbortSignal.timeout
  is GC-friendly and aborts cleanly. If a raw setTimeout pattern is
  unavoidable, the implementation MUST pair it with a clearTimeout in
  the `finally` block.
- `AbortSignal.timeout(10_000)` on the initial Ollama `POST` (connect
  timeout).

These are codex-IMPORTANT preemption controls -- the Lane 2c retro
flagged similar issues for `runExtractAdapter`. The Phase 2 backlog
Item 3 (Windows SIGTERM/SIGKILL semantics in evaluate/route.ts) is the
candidate first user of any shared process-kill helper this lane
extracts; defer the extraction unless a second user emerges.

### ED-2d-6: Indigenous hard-stop runs on the LATEST user turn AND any new
prior-history turn the client sends

The v1 chat route only checks the current `query`. Lane 2d strengthens this
to:

- Detect on `query` (current turn).
- Detect on the LAST user turn in `history[]` if any (defense against client-
  side history manipulation pushing the Indigenous content earlier and
  rephrasing the current turn).
- If detection fires anywhere, the route returns the `INDIGENOUS_HARD_STOP`
  SSE stream WITHOUT any retrieval or Ollama call (zero data egress on
  detection).

Test asserts both single-turn detection and history-rotation detection.

### ED-2d-7: Chat audit table PARKED per owner Q2 lock 2026-05-13 (schema retained for Lane 2e reference only -- deferred unless owner explicitly
requests)

Schema candidate: `v2_chat_logs` (`id`, `evaluation_id`, `reviewer_user_id`,
`turn_index`, `query`, `model`, `scope`, `indigenous_blocked` bool,
`retrieval_count`, `duration_ms`, `created_at`). The chat route would INSERT
one row per turn AFTER stream close.

DEFERRED for Lane 2d. Audit trail for evaluations already lives in
`v2_judgments` + `v2_judgment_history`; chat is reviewer scratchpad, not part
of the regulatory record. Add only if owner asks. If added, the table is
admin-RLS-gated identical to `v2_judgments`.

### ED-2d-8: Multi-format export shares the tier discretion assertion path

Lane 2b's `memo_builder.ts` already enforces:

- TIER_2 row verdict cell never "ADEQUATE".
- TIER_3 row verdict cell only "OBSERVATION_ONLY".

Lane 2d's CSV / MD / HTML generators MUST call the same
`assertVerdictAllowed(tier, verdict)` invariant before rendering each row,
and throw a typed error on regression. Test fixture asserts the invariant
across all four formats.

### ED-2d-9: Multi-format export is client-side download (no DB persistence)

CSV / MD / HTML are small (< 1 MB for 43-policy bench) and reviewer-scratch.
The export route serializes in-process and streams as
`Content-Disposition: attachment`. No `v2_*_exports` table for these formats.
The Word `.docx` memo (Lane 2b) stays as the canonical persisted export
because it is the document of record.

### ED-2d-10: Locale-locked everywhere (Lane 2b regression guard carried
forward)

All Lane 2d date / number formatters use `toLocaleString('en-US', ...)`
(or equivalent explicit-locale calls) inline, matching the existing
Lane 2a/2c pattern in `[projectId]/page.tsx` and
`[projectId]/evaluation/[evalId]/page.tsx`. Generated CSV / MD / HTML
embed dates via the same explicit-locale calls to avoid machine-locale
drift between development and CI smoke. NON-DROPPABLE.

v0.3 fix: the v0.1 / v0.2 draft of this ED referenced a "shared
`src/lib/engine-v2/format.ts` helper" that does NOT exist in the repo
(grep returned zero matches). Extracting a shared helper would itself
be a refactor with its own merge surface; Lane 2d uses the established
inline pattern. If a shared helper emerges in Lane 2e, this ED carries
forward unchanged in spirit.

### ED-2d-11: PerPolicyResultsTable is NOT edited by Lane 2d; evaluation page merge contract

To avoid Lane 2b-style multi-module merge conflicts on
`PerPolicyResultsTable.tsx`, Lane 2d adds NEW components alongside (search
panel, assistant panel, export dropdown) and only edits the parent page
container. The table itself is read-only from Lane 2d's perspective.

**Evaluation page merge contract** (added v0.3 per adversarial review):
both L2d-2 (AssistantPanel mount) and L2d-3 (ExportFormatMenu mount)
edit `[projectId]/evaluation/[evalId]/page.tsx`. Both modules MUST
append their new mount as a sibling JSX element to the existing layout,
NOT modify any pre-existing element. Concretely: each module's diff on
the evaluation page is a single insertion of `<AssistantPanel .../>`
or `<ExportFormatMenu .../>` in a documented region (e.g., below the
ExportMemoButton, above the PerPolicyResultsTable). Orchestrator commits
L2d-3 BEFORE L2d-2 (since L2d-3 ships first in the parallel pair); L2d-2
rebases on the committed L2d-3 diff before adding its mount. If both
modules try to edit the same JSX region, the orchestrator halts and
asks for a layout decision before re-spawning.

### ED-2d-12: ASCII-only everywhere

All TSX, TS, MD, and emitted CSV/MD/HTML/SQL strings are ASCII-only. The
Lane 2b memo builder's ASCII discipline applies. CSV escape rule is
identical to v1 `memo-generator.ts:escapeCSV`.

---

## Module breakdown

### L2d-1: Policy FTS5 search

File allowlist (EXCLUSIVE):

- NEW `src/lib/engine-v2/policy_kb.ts` (shared adapter; `searchPolicies` +
  `getPolicyById`)
- NEW `src/lib/engine-v2/fts5_query.ts` (pure sanitizer)
- NEW `src/lib/engine-v2/__tests__/fts5_query.test.ts`
- NEW `src/lib/engine-v2/__tests__/policy_kb.test.ts` (uses a fixture
  `:memory:` sqlite with the relevant tables; do NOT touch the real
  `rraa_v3_2.db`)
- NEW `src/app/api/engine-v2/policies/search/route.ts` (runtime=nodejs)
- NEW `src/app/api/engine-v2/policies/search/__tests__/route.test.ts`
- NEW `src/components/engine-v2/PolicySearchPanel.tsx`
- NEW `src/components/engine-v2/LocalEngineBadge.tsx` (per owner Q5 addendum;
  renders a small "Local engine only" chip when `!isLocalEngineClient()`)
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/ProjectDetailClient.tsx`
  (mount PolicySearchPanel + LocalEngineBadge)
- EDIT `src/app/(dashboard)/dashboard/engine-v2/page.tsx` (mount
  LocalEngineBadge in admin dashboard header)

API flow (GET):

1. `requireAdminForApi` -> 401/403.
2. `requireLocalEngine` -> 503 `{error: 'local_engine_disabled'}`.
3. Parse query string: `q` (>= 2 chars), `tier` ('all' or one of three),
   `topic` ('all' or non-empty), `limit` (default 20, max 100).
4. Call `buildFtsQuery(q)`. If null: short-circuit to LIKE fallback.
5. Call `searchPolicies(q, { tier, topic, limit })`. The adapter tries FTS5
   first (using sanitized query), falls back to LIKE on
   `sqlite_master`-style FTS5 failure.
6. Return `{ query, count, results, filters: { topics, tiers } }`.

PolicySearchPanel:

- Props: `{ projectId, defaultQuery? }`.
- Controlled text input, tier multi-select, topic select, result list with
  `PolicyResultCard` accordion (port the v1 component shape; trim the
  `TierBadge` import to use the existing dashboard `TierBadge`).
- "View details" deep-links to a future per-policy KB viewer (Lane 2e); for
  Lane 2d the deep link is a noop placeholder.
- Debounced input (250 ms) -- avoid hammering the route on every keystroke.
- Locale-locked date formatting if any source dates are rendered.

Acceptance criteria:

- GET `/api/engine-v2/policies/search?q=arsenic&limit=5` returns >= 1 result
  against the real `rraa_v3_2.db` (smoke -- owner-local).
- Query "', 1) DROP TABLE policy_statements; --" sanitizes to a safe FTS5
  expression OR returns 400 with `{error: 'query_too_short'}` -- never a 500.
- `q.length < 2` -> 400.
- Non-admin -> 403.
- LOCAL_ENGINE_ENABLED=false -> 503.

EXIT GATE (L2d-1):

- `npx vitest run src/lib/engine-v2/__tests__/fts5_query.test.ts src/lib/engine-v2/__tests__/policy_kb.test.ts src/app/api/engine-v2/policies/search/__tests__/route.test.ts` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint src/lib/engine-v2/policy_kb.ts src/lib/engine-v2/fts5_query.ts src/app/api/engine-v2/policies/search/route.ts src/components/engine-v2/PolicySearchPanel.tsx` GREEN.
- Manual smoke: open project detail page, expand search panel, type
  "arsenic", see >= 1 card; tier filter narrows result count; topic filter
  narrows result count.

Codex pre-emption checklist:

- [ ] `requireAdminForApi` + `requireLocalEngine` on every route handler.
- [ ] FTS5 sanitizer covers `*`, `'`, `"`, `;`, `--`, control chars, unicode
      surrogates.
- [ ] LIKE fallback escapes `%` and `_`.
- [ ] Empty-query handling returns 400, not 500.
- [ ] Topic / tier params validated against a closed enum (no arbitrary
      strings into SQL).
- [ ] Limit clamped to [1, 100].
- [ ] Engine DB path constructed via `path.join(process.cwd(), '..',
      'Regulatory-Review', 'engine', 'data', 'rraa_v3_2.db')` -- NOT
      string concatenation. Mirrors v1 chat/route.ts:27-34 pattern.
      Centralize the constant inside `policy_kb.ts` so the brittleness
      lives in one place.
- [ ] `better-sqlite3` connection is opened readonly and ALWAYS closed in
      `finally`.
- [ ] Rate limiting: NOTE as backlog (Lane 2e); single-admin local usage
      pattern makes this low priority.
- [ ] Locale-locked date rendering in result cards.
- [ ] ASCII-only strings in route + UI.
- [ ] Vitest covers happy path + injection edge cases + tier filter + topic
      filter + limit clamp.

### L2d-2: AI Chat Assistant

File allowlist (EXCLUSIVE):

- NEW `src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/chat/route.ts` (runtime=nodejs; SSE)
- NEW `src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/chat/__tests__/route.test.ts`
- NEW `src/app/api/engine-v2/assistant/models/route.ts` (NEW; thin clone of
  v1 models route, returns the registry-compatible model list -- already
  factored, but engine-v2-namespaced so the v1 namespace stays decoupled if/when
  v1 is retired)
- NEW `src/lib/engine-v2/chat_context.ts` (Supabase per-policy +
  judgments -> `{ policies, submissions }` strings)
- NEW `src/lib/engine-v2/__tests__/chat_context.test.ts`
- NEW `src/lib/engine-v2/indigenous_history_check.ts` (turn-rotation
  Indigenous hard-stop detector, wraps `detectIndigenousContent`)
- NEW `src/lib/engine-v2/__tests__/indigenous_history_check.test.ts`
- NEW `src/components/engine-v2/AssistantPanel.tsx` (port v1 shape,
  re-uses dashboard `TierBadge`)
- NEW `src/components/engine-v2/__tests__/AssistantPanel.test.tsx`
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`
  (mount AssistantPanel beside per-policy table)

Engineering decisions specific to L2d-2:

- Scopes: `policy` (FTS5 over `rraa_v3_2.db` only), `evaluation` (engine_v2
  per-policy + judgments for this `evalId` only; replaces v1 "submission"
  scope), `hybrid` (both).
- Modes: `fast` / `deep` per `MODEL_REGISTRY`.
- History capped at 10 turns (same as v1).
- The route validates `evalId` ownership + admin via the same
  `requireAdminForApi` + Supabase join pattern as the Lane 2b judgments route.
- SSE event stream: `citation` (per retrieved chunk), `delta` (token), `meta`
  (final), `done`, `error`.

API flow (POST `/api/engine-v2/projects/[id]/evaluation/[evalId]/chat`):

1. `requireAdminForApi`.
2. `requireLocalEngine` -> 503.
3. `checkCsrf` -> 415/403.
4. Parse JSON body. Zod-validate
   `ChatRequestSchema = { query: string(min 1), scope: enum, mode: enum, model?: string, history?: array(max 10) }`.
5. Ownership probe: SELECT `v2_evaluations` JOIN `v2_projects` WHERE
   `evaluations.id = $evalId AND projects.user_id = auth.uid()`. 404 if not
   found or not owned.
6. Indigenous hard-stop: `indigenousHistoryCheck(query, history)` -- if any
   match, stream `INDIGENOUS_HARD_STOP` + `meta` + `done`, return. NO retrieval,
   NO Ollama call.
7. Discover available Ollama models via `${baseUrl}/api/tags` with
   `AbortSignal.timeout(5000)`. `resolveModel(mode, available, preferred)`.
   If null: stream `error` + close.
8. Retrieve context per scope:
   - `policy` or `hybrid`: `policy_kb.searchPolicies(query, { limit: 5 })`.
   - `evaluation` or `hybrid`: `chat_context.retrieveEvaluationEvidence(evalId, query, 5)`
     which SELECTs `v2_per_policy_results` for this `evalId`, filters by
     simple keyword match against `summary` + `evidence_packet -> 'text'` +
     `pathway_notes`, and joins `v2_judgments` for HITL verdict context.
9. Format `{ policies, submissions }` strings via `chat_context.format*`.
10. Call `buildSystemPrompt()` + `buildContextPrompt({...}, query)`. Build
    `messages[]` (system + last 10 history turns + user).
11. Stream `citation` events for each retrieved item.
12. POST to `${baseUrl}/api/chat` with `stream: true`.
13. Read NDJSON, emit `delta` events.
14. Emit `meta` + `done`. On any throw, emit `error` + close. `try/finally`
    ensures controller close.
15. Idle timeout 60s on the reader (`Promise.race` against
    `setTimeout(60000).then(() => abort)`).

AssistantPanel:

- Props: `{ projectId, evaluationId }`.
- State: `messages`, `input`, `mode`, `scope`, `isStreaming`, `error`,
  `connectionStatus`, `modelInfo`.
- Mount-effect: GET `/api/engine-v2/assistant/models` to set
  `connectionStatus`.
- `sendMessage` opens a `fetch` to the chat route, parses SSE via the
  pattern from v1's `AssistantPanel.tsx` (manual `ReadableStream` reader +
  event/data parser).
- `abortRef = useRef<AbortController>()` for cancellation on unmount or
  clear-chat.
- `CitationList` sub-component identical to v1 shape.
- ASCII-only.

Acceptance criteria:

- Happy path: `scope='policy'`, `query='arsenic exceedance soil'`, `mode='fast'`
  -- returns at least one `citation` event + non-empty `delta` stream + final
  `meta` + `done`. Latency to first token < 3s on local qwen14b (best-effort).
- Indigenous content path: `query='Section 35 duty to consult'` returns
  `delta: INDIGENOUS_HARD_STOP` + `meta` + `done`, retrievalCount=0, no
  Ollama traffic.
- Indigenous history-rotation: `query='What is arsenic toxicity?'`,
  `history=[{ role:'user', content:'Tell me about traditional knowledge in TEK assessments'}]`
  -- returns Indigenous hard-stop (Lane 2d strengthens v1 behavior).
- Ollama unavailable: route streams `error: 'Ollama is not running or not reachable at ...'`.
- TIER_2 / TIER_3 policy mention in context never elicits "adequate" or
  "inadequate" in the streamed answer (snapshot test against canned Ollama
  stub stream -- not a determinism guarantee, but a regression check on the
  system prompt).
- Non-admin -> 403.
- LOCAL_ENGINE_ENABLED=false -> 503.

EXIT GATE (L2d-2):

- `npx vitest run src/lib/engine-v2/__tests__/chat_context.test.ts src/lib/engine-v2/__tests__/indigenous_history_check.test.ts src/components/engine-v2/__tests__/AssistantPanel.test.tsx src/app/api/engine-v2/projects/\[id\]/evaluation/\[evalId\]/chat/__tests__/route.test.ts` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint` on each new path GREEN.
- Manual smoke: open evaluation page, expand assistant panel, type
  "arsenic exceedance evidence in this evaluation", scope='hybrid',
  mode='fast', confirm citations + streamed answer. Try Indigenous prompt,
  confirm hard-stop. Stop Ollama, retry, confirm error event.

Codex pre-emption checklist:

- [ ] Indigenous hard-stop integration test covers (a) current query, (b)
      history rotation, (c) capitalization variants, (d) embedded match
      ("Mr. Metis Smith" should detect via the `metis` keyword; the
      ASCII fold is per ED-2d-12 -- production strings and source
      identifiers stay ASCII. Test fixtures MAY contain non-ASCII
      input to exercise the keyword detector's fold logic; that is
      data, not code, and is allowed).
- [ ] System prompt verbatim from v1 (no drift); `buildSystemPrompt` test
      snapshot-pinned.
- [ ] TIER-2-no-adequacy snapshot test (canned stub stream).
- [ ] SSE backpressure: confirm controller `enqueue` does not throw on slow
      client (use a slow reader fixture).
- [ ] Abort cleanup: client disconnect cancels Ollama upstream and closes
      the reader -- assert via `request.signal` propagation test.
- [ ] Auth gating: requireAdminForApi + requireLocalEngine + checkCsrf on
      POST.
- [ ] Idle timeout 60s: stub stream that stalls -> route emits
      `stream_idle_timeout` error.
- [ ] Ollama connect timeout: 10s via `AbortSignal.timeout`.
- [ ] Ownership probe: cross-owner `evalId` -> 404.
- [ ] Zod-strict request validation (extra keys rejected).
- [ ] Indigenous history-rotation test included.
- [ ] ASCII-only system prompts and panel text.
- [ ] No new polling loop (panel uses SSE, not poll).
- [ ] Locale-locked any timestamp shown in citation list.
- [ ] tsc + eslint + vitest clean.

### L2d-3: Multi-format export (CSV / Markdown / HTML)

v0.3 scope reduction: docx is OUT of L2d-3. Owner Q7 (2026-05-13)
locked "KEEP Lane 2b's docx library" -- the adversarial review of v0.2
correctly identified that Lane 2b's `buildMemo` produces a full memo
with overview + Tier 1/2/3 sections + footer, NOT a per-policy table.
Reusing it from L2d-3 either (a) duplicates the existing
`ExportMemoButton` (no value added) or (b) builds a NEW table-only
docx generator (which diverges from Lane 2b by design and breaks the
byte-equality claim). Cleaner answer: Lane 2b's docx memo is the
canonical docx artifact; L2d-3 covers the lightweight ad-hoc formats
ONLY. The owner Q7 intent (audit-grade docx; do not port v1's
HTML-flavored `.doc` hack) is HONORED by leaving Lane 2b docx
untouched and not adding any parallel docx path.

File allowlist (EXCLUSIVE):

- NEW `src/lib/engine-v2/export_formats.ts` (pure: per-policy rows +
  judgments + project + evaluation -> string in target format)
- NEW `src/lib/engine-v2/__tests__/export_formats.test.ts`
- NEW `src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/export/route.ts` (runtime=nodejs)
- NEW `src/app/api/engine-v2/projects/[id]/evaluation/[evalId]/export/__tests__/route.test.ts`
- NEW `src/components/engine-v2/ExportFormatMenu.tsx` (dropdown that
  POSTs to the export route with `?format=csv|md|html`; streams the
  attachment back)
- EDIT `src/app/(dashboard)/dashboard/engine-v2/[projectId]/evaluation/[evalId]/page.tsx`
  (mount ExportFormatMenu next to existing ExportMemoButton; the
  existing ExportMemoButton remains the docx entrypoint)

Engineering decisions specific to L2d-3:

- The three format generators are pure functions in `export_formats.ts`.
  They take `{ project, evaluation, perPolicy, judgments, options }` and
  return a `string` (CSV/MD/HTML).
- Generators port v1 `memo-generator.ts` (`generateCSV`,
  `generateMarkdown`, `generateHTML`) but adapt the row shape from v1's
  `LocalAssessment` + `LocalJudgment` to engine_v2's `V2PerPolicyResult`
  + `V2Judgment`.
- v1's `generateWordHTML` (HTML-flavored `.doc` hack) is NOT ported.
  The audit-grade `.docx` path is Lane 2b's `ExportMemoButton`
  exclusively.
- Tier discretion invariant: every generator calls
  `assertVerdictAllowed(tier, verdict)` on each row before rendering
  (ED-2d-8). Regression test asserts the invariant across all three
  formats.

POST-vs-GET rationale: the export route is `POST` (not GET) for two
reasons. First, CSRF gating per ED-2d-4 applies to any state-leaking
operation; even though the response is a file, the request enumerates
project + evaluation IDs that map to admin-only data and we want the
CSRF token check in the path. Second, browser blob download via
`fetch().then(r => r.blob())` works identically for GET and POST, so
there is no client-side cost. The L2d-3 client passes filter options
in the POST body (snapshot hash, format selection) rather than as
query string, which keeps the URL clean for logging.
- Tier discretion invariant: every generator calls
  `assertVerdictAllowed(tier, verdict)` on each row before rendering.
  Regression test fixes this across all four formats.
- No DB persistence -- export is streamed back to the client. CSV / MD / HTML
  / Word emit synchronously (< 1 MB for 43-policy bench).

API flow (POST `/api/engine-v2/projects/[id]/evaluation/[evalId]/export?format=csv|md|html`):

1. `requireAdminForApi`.
2. `checkCsrf`.
3. Ownership probe -> 403.
4. Parse `format` query param against closed enum; 400 on invalid.
5. SELECT `v2_evaluations` JOIN `v2_projects` JOIN `v2_per_policy_results`
   LEFT JOIN `v2_judgments`.
6. Call `export_formats.generate(format, { project, evaluation, perPolicy, judgments })`.
7. Return as `Content-Disposition: attachment` with the appropriate MIME and
   filename `evaluation-<eval_id_short>-<format>.<ext>`.

ExportFormatMenu:

- Dropdown with three items: CSV, Markdown, HTML. docx remains the
  province of the existing ExportMemoButton (Lane 2b path).
- On click: POST to the export route with the chosen format; on 200, stream
  the response into a download blob (same pattern as ExportMemoButton).
- Disabled while in-flight; surface 4xx/5xx errors inline.

Acceptance criteria:

- CSV file opens in Excel without parse errors.
- MD file renders correctly in any markdown viewer.
- HTML file is valid HTML5 (smoke check via parse).
- All three formats: TIER_2 rows never contain "ADEQUATE"; TIER_3 rows show
  "OBSERVATION_ONLY" only (regression assertion).
- All three formats: locale-locked dates ("en-US").
- Non-admin -> 403.
- Cross-owner `evalId` -> 404.
- Invalid format param -> 400.
- Lane 2b ExportMemoButton (docx) continues to work unchanged (no
  regression on the canonical document-of-record path).

EXIT GATE (L2d-3):

- `npx vitest run src/lib/engine-v2/__tests__/export_formats.test.ts src/app/api/engine-v2/projects/\[id\]/evaluation/\[evalId\]/export/__tests__/route.test.ts` GREEN.
- `npx tsc --noEmit` GREEN.
- `npx eslint` on new paths GREEN.
- Manual smoke: export each of CSV / MD / HTML / Word; open each; verify
  content matches the per-policy table.

Codex pre-emption checklist:

- [ ] Closed enum on `format` param (CSV / MD / HTML only; docx is NOT
      a L2d-3 format -- it remains exclusively on the Lane 2b memo path).
- [ ] CSV escape covers commas, quotes, newlines (port from v1 verbatim).
- [ ] HTML escape covers `&`, `<`, `>`, `"`, `'`.
- [ ] MD escape handles `|` and newlines in table cells.
- [ ] All three formats embed locale-locked dates.
- [ ] Tier discretion assertion present in every generator.
- [ ] Content-Disposition filename is ASCII-only and ext-correct per MIME
      (`.csv`, `.md`, `.html`).
- [ ] Lane 2b ExportMemoButton untouched; no edits to memo_builder.ts.
- [ ] Auth gating: requireAdminForApi + checkCsrf.
- [ ] Ownership probe runs before SELECT of per-policy + judgments.
- [ ] No SQL injection on `[id]` / `[evalId]` (UUID-shaped, validated by
      Zod string-uuid before query).
- [ ] ASCII-only strings in route + dropdown UI.
- [ ] Vitest covers each format + each tier invariant.

### L2d-4: Indigenous hard-stop pre-filter (BUNDLED INTO L2d-2)

Not a separate phase. L2d-2's `indigenous_history_check.ts` ports the v1
`detectIndigenousContent` + `INDIGENOUS_HARD_STOP` constants verbatim (they
already live at `src/lib/ollama/prompts.ts` and Lane 2d re-uses them; the
NEW file at `src/lib/engine-v2/indigenous_history_check.ts` only adds the
history-rotation wrapper).

If chat scope grows beyond L2d-2 (e.g., search-result-driven chat from
L2d-1's PolicySearchPanel), the hard-stop check must be applied at THAT
entry point too. Lane 2d's PolicySearchPanel does not feed Ollama, so no
additional check is needed there for L2d-1.

Reference constitutional rule from CLAUDE.md ("auto-elevate Indigenous to
TIER_3; keyword detection; 'Requires Statutory Decision Maker
determination' output"). This is NON-NEGOTIABLE per the project's
Constitution.

---

## Subagent file allowlists

| Module | Files (count) | Estimated budget |
|---|---|---|
| L2d-1 | policy_kb.ts, fts5_query.ts, policy_kb.test.ts, fts5_query.test.ts, search/route.ts, route.test.ts, PolicySearchPanel.tsx, ProjectDetailClient.tsx edit (8) | 2-3h |
| L2d-2 | chat/route.ts, chat/route.test.ts, assistant/models/route.ts, chat_context.ts, chat_context.test.ts, indigenous_history_check.ts, indigenous_history_check.test.ts, AssistantPanel.tsx, AssistantPanel.test.tsx, evaluation page edit (10) | 1-1.5d |
| L2d-3 | export_formats.ts, export_formats.test.ts, export/route.ts, export/route.test.ts, ExportFormatMenu.tsx, evaluation page edit (6) | 3-4h |

Sequencing:

- L2d-1 and L2d-3 have disjoint file allowlists. They can run in PARALLEL
  as soon as their respective EXIT GATEs are met.
- L2d-2 should run alone. Largest scope (SSE complexity + Ollama integration
  + Indigenous-history check). Sequential review benefits.
- Both L2d-1 and L2d-2 edit `ProjectDetailClient.tsx` vs the evaluation
  page -- different files, no conflict.
- L2d-3 edits the evaluation page; L2d-2 also edits it. The orchestrator
  must merge these edits last (small, additive: each mounts a new
  component next to existing ones).

Suggested order:

1. L2d-1 + L2d-3 in PARALLEL (different files, ~2-4h each).
2. L2d-2 sequential (~1-1.5d).
3. Orchestrator merges the evaluation page edit from L2d-2 + L2d-3 last.

---

## Verification (after each commit)

- `npx vitest run src/lib/engine-v2/__tests__/ src/app/api/engine-v2/`
- `npx tsc --noEmit`
- `npx eslint src/lib/engine-v2/ src/components/engine-v2/ src/app/api/engine-v2/`
- Manual smoke per module's EXIT GATE.

---

## EXIT GATE for Lane 2d (cumulative)

Owner action (before subagents start):

1. Confirm `LOCAL_ENGINE_ENABLED=true` in `.env.local`.
2. Confirm Ollama is running with at least one model from `MODEL_REGISTRY`
   loaded (`qwen2.5:14b` recommended; `mistral-nemo:latest` acceptable for
   fast mode).
3. Confirm `engine/data/rraa_v3_2.db` exists at the path
   `process.cwd() + '/../Regulatory-Review/engine/data/rraa_v3_2.db'`.

After implementation:

1. All three module EXIT GATEs met.
2. Cumulative `npx vitest run` GREEN (target: 925/934 PASS plus all new
   Lane 2d tests added, no regressions).
3. `npx tsc --noEmit` GREEN.
4. `npx eslint` GREEN.
5. Smoke: open project detail, do a policy search returning >= 1 result.
   Open an evaluation, open assistant panel, send a policy-scope query, get
   a streamed answer with at least one citation. Try Indigenous prompt, get
   hard-stop. Export the per-policy table as CSV, open in Excel. Export as
   Markdown, open in any MD viewer. Export as Word, open in Microsoft Word
   without repair prompt.
6. Confirm Lane 2b `.docx` memo export still works (no regression).
7. Confirm Lane 2c evaluation history list still works.

---

## Codex pre-emption checklist (lane-level rollup)

| Risk class | Lane 2d control |
|---|---|
| FTS5 query injection | Sanitizer + prepared statement bind + LIKE-fallback escape |
| SQL injection on UUID params | Zod string-uuid validation before any SELECT |
| SSE stream leaks | `try/finally` controller close + reader cancel + AbortSignal.timeout + idle timeout |
| Ollama unavailable failure mode | tags probe with 5s timeout + descriptive error event + 503 on local engine disabled |
| Indigenous drift | History-rotation detector + verbatim port of v1 constants + integration tests for capitalization / embedded matches |
| Tier-2 adequacy in export | `assertVerdictAllowed` in all four format generators + regression tests |
| Tier-3 verdict in export | Same |
| Hydration mismatch | All dates via shared `format.ts` `toLocaleString("en-US", ...)` |
| Auth bypass | requireAdminForApi + requireLocalEngine + checkCsrf on every state-changing route; requireLocalEngine on every read route that touches local sqlite |
| Cross-owner data access | Ownership probe via Supabase JOIN before any SELECT |
| RLS drift | No new tables in Lane 2d (audit table deferred); Supabase reads inherit Lane 2a/2b RLS |
| ASCII discipline | Tests assert no smart quotes in CSV / MD / HTML / Word output |
| Memo bytea regression (Lane 2c bug 2fe00ec) | Lane 2d does not touch memo route; isolation prevents regression |
| Polling single-flight regression | No new polling loops; SSE for chat; sync request-response for search and export |
| Subagent file collisions | Evaluation page edit merged last by orchestrator |
| Zod payload tightening | strict() on all new request schemas |

---

## Parallelization plan

- L2d-1 (search) and L2d-3 (export) PARALLEL: disjoint file allowlists, both
  small (2-4h). Two subagents.
- L2d-2 (chat) SEQUENTIAL after L2d-1 + L2d-3 merge: largest module, SSE +
  Ollama integration + Indigenous-history-check warrant focused
  adversarial review. One subagent.
- Commit cadence: one logical-module commit per subagent (Lane 2b pattern).
  Three Lane 2d commits expected:
  - `feat(engine-v2): L2d-1 policy FTS5 search`
  - `feat(engine-v2): L2d-3 multi-format export (CSV/MD/HTML/Word)`
  - `feat(engine-v2): L2d-2 AI chat assistant with SSE + Indigenous hard-stop`

---

## Adversarial review cadence

Per standing memory `feedback_codex_review_pre_commit_loop` and
`feedback_codex_unavailable_fallback`. Codex MCP was returning 401
Unauthorized through 2026-05-12 evening. Default to Opus adversarial subagent
fallback. Re-attempt codex MCP once per phase before resorting to Opus.

Order per phase:

1. Implementation subagent finishes module.
2. Orchestrator attempts `mcp__codex__codex` review.
3. If 401 / network error: spawn adversarial Opus subagent.
4. Iterate review/fix/re-review until green-light + zero outstanding
   IMPORTANT/BLOCKER findings.
5. Commit.

---

## Timeline estimate

- L2d-1: 2-3h.
- L2d-3: 3-4h.
- L2d-2: 1-1.5d.
- Parallel block (L2d-1 || L2d-3): max(L2d-1, L2d-3) = ~4h wall-clock.
- Sequential L2d-2: 1.5-2.5d wall-clock with codex iteration (best-case
  10h; pad for SSE edge cases, Indigenous history-rotation tests,
  AbortSignal.timeout wiring, and the chat retrieval adapter).

Cumulative: ~2 days clock-time including adversarial loops. Fits within a
single multi-session week without compaction risk if the orchestrator
checkpoints after each module.

---

## Risks

- chunks.sqlite path coupling: the search route reaches into the sibling
  `C:\Projects\Regulatory-Review\engine\data\rraa_v3_2.db` via
  `process.cwd() + '/../Regulatory-Review/...'`. This works in local
  development only. Vercel deployment returns 503. The `requireLocalEngine`
  guard short-circuits the route, so production behavior is well-defined,
  but reviewers must understand the deployment limitation. Lane 2e candidate:
  promote `rraa_v3_2.db` policy metadata into Supabase to enable cloud
  search. Out of scope for Lane 2d.

- Ollama instance contention: the live evaluator (Lane 2c) and the chat
  assistant (Lane 2d) both call `${OLLAMA_BASE_URL}/api/chat` against the
  same local instance. Concurrent use queues at Ollama's runtime. The
  assistant route's 10s connect timeout will fail loudly if a long evaluation
  is hogging the queue. Mitigation: surface the timeout error to the user
  with a clear message; do not retry automatically. Lane 2e candidate:
  shared Ollama pool manager. Out of scope for Lane 2d.

- SSE streaming reliability on reverse proxies / Vercel: production-deploy
  reverse proxies sometimes buffer SSE. The route is local-engine-only
  (503 in Vercel), so this is not a deployed-environment risk. For local
  dev (Next.js + node runtime), SSE works without intermediaries.

- FTS5 query injection: see the sanitizer + prepared-bind defense. The risk
  class is preempted; the codex pre-emption checklist surfaces it
  explicitly. Confidence: high.

- Indigenous prompt drift: v1's keyword list is broad and may produce false
  positives (e.g., "consent" appears in many non-Indigenous contexts). False
  positives produce a hard-stop response which is conservative and
  reviewer-correctable; false negatives (missing a real Indigenous topic) are
  the bigger concern and are mitigated by the history-rotation check.
  Periodically review the keyword list against false-negative incidents.

- Memo bytea round-trip regression (Lane 2c bug `2fe00ec`): Lane 2d does not
  touch the memo route or `v2_memo_exports`. Isolation prevents regression.
  Explicit non-regression smoke after Lane 2d ships.

- Hydration mismatch from non-locked locales (Lane 2c bug `af2f76a`): every
  Lane 2d date is rendered via `format.ts`. Regression guard via vitest
  snapshot tests.

- Browser SSE event-source quirks: Lane 2d does NOT use `EventSource` (it
  requires GET); it uses `fetch` + manual `ReadableStream` reader, identical
  to v1's `AssistantPanel.tsx` pattern. This handles POST + custom event
  names cleanly.

---

## Owner decisions (locked 2026-05-13)

Decisions are AUTHORITATIVE; subagents implementing Lane 2d must honor them.

1. **Chat eval scope = this `evalId` only.** Cross-eval comparison deferred
   to Lane 2e (needs comparison UX not in current scope).

2. **`v2_chat_logs` audit table = NO for Lane 2d.** Capture as Lane 2e schema
   work explicitly. Regulatory audit trail matters eventually but is not
   blocking Lane 2d. ED-2d-7's schema candidate stays parked.

3. **Export includes unjudged rows** with "Not yet judged" marker. Partial
   review state is real; reviewers export interim findings.

4. **Deep-link policy endpoint = NO for Lane 2d.** Nice-to-have; does not
   unblock core flows. Defer to Lane 2e.

5. **Vercel deploy = hide search/chat/export entirely** (Ollama cannot run
   on Vercel serverless). Owner addition: surface a small "Local-engine
   only" badge in the admin panel `/admin/engine-v2` so the features are
   visibly absent rather than silently missing. Implementation note: the
   badge belongs in the admin dashboard nav / feature-flag indicator, NOT
   in the regulatory-review surface. Add to L2d-1 module scope as a
   1-component addition (`src/components/engine-v2/LocalEngineBadge.tsx`
   conditionally rendered when `!isLocalEngineClient()`).

6. **Submission-scope chat = adapt to engine_v2 per-policy + HITL judgments.**
   Engine_v2 has the richer data model; duplicating v1's submission DB
   would create two sources of truth.

7. **Word format = KEEP Lane 2b `docx` library, DO NOT add docx to L2d-3.**
   v0.3 clarification (per adversarial review of v0.2): Lane 2b's
   `buildMemo` produces a full memo with overview + Tier 1/2/3 sections,
   not a per-policy table. Reusing it from L2d-3 either duplicates
   ExportMemoButton (no value) or builds a divergent docx generator
   (breaks the byte-equality claim). Cleaner answer: Lane 2b docx is the
   canonical docx artifact; L2d-3 ships CSV + MD + HTML only. v1's
   HTML-flavored `.doc` hack is NOT ported anywhere. Owner Q7 intent
   (audit-grade docx; do not regress to v1 hack) is honored by leaving
   Lane 2b docx untouched.

## Phase 2 backlog carry-over (known issues; deferred from dd2d5dd)

The Phase 2 adversarial review (Opus subagent, fallback per
`feedback_codex_unavailable_fallback.md` because codex MCP was 401 all
session) returned GREEN with 4 deferrable items. Item 2 is being fixed
in a Phase 2.5 hotfix landing BEFORE Lane 2d implementation begins.
Items 1, 3, 4 are documented here for tracking; they do not block Lane 2d
but should be folded into Lane 2d module work where the diffs are
adjacent.

### Item 1: Sequential evaluations queries (PERF) -- CLOSED by Phase 2.5
- Location: `src/app/(dashboard)/dashboard/engine-v2/[projectId]/page.tsx`
- Original concern: latest-full + history-slim queries ran sequentially
  rather than via `Promise.all`.
- Resolution: Phase 2.5 (`f5f17d2`) added `.neq("id", initialEvaluation.id)`
  to the history query, which structurally depends on the latest query's
  id resolving first. Promise.all is therefore NOT viable for this query
  pair without losing the exclusion filter that closes Item 2. Sequential
  is the correct semantic; the inline comment at page.tsx:81-84 documents
  this. Item 1 is CLOSED, not deferred.
- The cost is small because latest is `LIMIT 1` on the
  `(project_id, started_at DESC)` indexed path; the slim history query
  (no JSONB blob per dd2d5dd) is the bigger query and runs after.
- If the engine-v2 admin landing `src/app/(dashboard)/dashboard/engine-v2/page.tsx`
  has its own query strategy worth Promise.all-ing, that is a separate
  observation -- not part of Item 1.

### Item 3: Windows SIGTERM == SIGKILL semantics (COSMETIC)
- Location: `src/app/api/engine-v2/projects/[id]/evaluate/route.ts:191-222`
- Node on Windows maps both signals to `TerminateProcess`; the 2-second
  grace window is a no-op on the target dev platform. The inline comment
  implies graceful-then-forceful which is only true on POSIX.
- Disposition: when L2d-2 adds SSE teardown (similar timeout pattern),
  factor the kill semantics into a shared helper `src/lib/engine-v2/
  process_kill.ts` with platform-aware behavior and Windows-vs-POSIX
  inline doc. Adjust evaluate/route.ts comment to match. Otherwise
  leave as backlog.

### Item 4: JSON-stringified stderr tail reads awkwardly (COSMETIC)
- Location: `src/app/api/engine-v2/projects/[id]/evaluate/route.ts:213-214`
- `tailRepr = JSON.stringify(tail)` embeds escaped \n + surrounding
  quotes in the Error message; safe for downstream JSON serialization
  but unsightly if the raw error renders in the dashboard.
- Disposition: low-priority cosmetic. Lane 2e formatting pass.

---

## Budget

Lane 2b ~ 90-150 min parallel subagents. Lane 2c ~ wide-surface multi-day
arc. Lane 2d sits between: three modules, two of which are tight (search,
export), one of which is the biggest user-facing feature (chat). Realistic
budget: **2 days clock-time** with codex iteration. L2d-1 + L2d-3 in
parallel (~4h), L2d-2 sequential (~10h with adversarial loops), final
merge + smoke (~1h). Demo-ready by end of week.

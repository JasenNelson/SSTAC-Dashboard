# Submission-search full-text-search performance design (Top-50 row 44)

Status: DESIGN (design-only; no code change). 2026-07-21. Lane: reg-review (see note on the `MO`
mislabel below). Trigger: deferred until the searched corpus is large enough to feel the O(N) scan
(~1K assessments); **not yet hit**.

## 1. Context and the one reframe that matters

Row 44 is titled "Submission-search FTS performance plan" and traces to base row #42
(`SSTAC_TOP50_PRIORITY_TASKS_2026_07_14.md:221`). Its target is the **legacy regulatory-review
submission search**:

- Route: `src/app/api/regulatory-review/submission-search/route.ts`.
- UI: `src/app/(dashboard)/regulatory-review/[submissionId]/components/SubmissionSearch.tsx`.
- Store: **SQLite** `src/data/regulatory-review.db` via `better-sqlite3` (`route.ts:14-24`).

The current implementation is a full in-memory scan: it `SELECT`s every `assessments` row with a
non-null `evidence_found` (a JSON blob column), `JSON.parse`s each blob, and substring-matches query
terms against `excerpt` / `location` / `spec_description` inside the parsed array, per query
(`route.ts:79-121`). No index, no ranking, no stemming; results are arbitrary scan-order truncated to
`LIMIT` (default 20, max 100; `route.ts:67,141,149`). This is O(N) over all assessments on every
search.

**The reframe:** the task says "FTS" and the reconciled row tags it `MO`, but the target table
(`assessments` in `regulatory-review.db`) is **SQLite, not Postgres**, and the route is **local-dev
only + admin-gated** (precise dev-only behavior below: HTTP 503 on a missing native module, HTTP 500
on a missing DB file; `requireAdmin()` at `route.ts:53`). So:
- A literal "Postgres FTS" design does not apply to this table without first *moving* the data to
  Postgres (a real infra/schema change, not just an index).
- The performance problem, today, bites only a **local reviewer** with a large corpus -- not any
  deployed production user path. This is why it is genuinely deferrable.

Precise dev-only behavior (two distinct non-local failure modes): the route returns **HTTP 503**
"only available in local development" only when the `better-sqlite3` NATIVE MODULE fails to load
(the `require` catch leaves `Database` null; `route.ts:16-21,56-60`). If the module loads but the DB
file `src/data/regulatory-review.db` is absent/unopenable, `new Database(...)` throws inside the
route's broad `try/catch` and returns **HTTP 500** (`route.ts:77,177-184`). Either way the route is
non-functional outside a local dev checkout that ships both the native module and the DB file; it is
also `requireAdmin()`-gated (`route.ts:53`).

## 2. Current volume (why "not yet hit")

- The UI hardcodes an approximate corpus hint of **"841 excerpts"** (`SubmissionSearch.tsx:239`) --
  a display constant, not a live `COUNT(*)`. No route or script persists a live current count.
- The threshold is documented as ~1K assessments in `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md:106`
  and risk row (`:369`): "full-JSON-scan is O(N) ... Fine for <1K assessments. Phase B adds search
  index." Restated in `docs/NEXT_STEPS.md:140-141` and `docs/API_REFERENCE.md:413-415`.
- No source states >1K has been crossed -> consistent with the row-44 "not yet hit" note.

## 3. Prior art already in the repo (do not design from scratch)

Two working precedents exist; the design mirrors one and converges on the other rather than inventing
new infrastructure.

- **SQLite FTS5 (same route family, already shipped):** the sibling policy search
  `src/app/api/regulatory-review/search/route.ts:83-125` uses a SQLite FTS5 virtual table
  (`policy_statements_fts MATCH ? ORDER BY rank LIMIT ?`) with a `LIKE` fallback if the FTS5 query
  throws. This is the exact pattern to reuse for submission search. (Its `CREATE VIRTUAL TABLE` DDL
  lives in the external `Regulatory-Review` engine repo's `rraa_v3_2.db`, not this repo's migrations.)
- **Postgres FTS (successor surface, already shipped + bug-fixed):** engine_v2's
  `supabase/migrations/20260513_v2_submission_chunks.sql:26-45` defines `v2_submission_chunks` with a
  `content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED`, a `GIN` index,
  and a `search_submission_chunks(uuid, text, int)` RPC (`plainto_tsquery` + `ts_rank` +
  `ts_headline`, `SECURITY INVOKER`, `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated`;
  `ts_rank_cd` appears only in a shared SQL helper, not this RPC).
  engine_v2 is the planned port target of the legacy `regulatory-review` surface
  (`docs/engine_v2_frontend_lane2d_plan_v0_4_2026_05_12.md`).

## 4. Options

### Option 0 -- Converge on engine_v2 (do nothing new here)
If the legacy `regulatory-review` surface is being replaced by engine_v2, then the Postgres FTS at
`v2_submission_chunks` + `search_submission_chunks` already solves the same problem (rank-ordered,
snippet-highlighted, RLS-gated submission-text search). "Port the submission-search UX to engine_v2"
would retire the SQLite route entirely and inherit production-grade FTS for free. Cost: the engine_v2
port is its own multi-session lane, not a row-44-sized task.

### Option A (RECOMMENDED near-term) -- SQLite FTS5 denormalized excerpt table
Mirror the in-repo `policy_statements_fts` pattern. Because `evidence_found` is an unstructured JSON
blob, the design flattens excerpts into their own searchable rows:

- **Migration** (new `src/lib/sqlite/migrations/00X_submission_search_fts.sql`):
  - A content table `assessment_excerpts(id INTEGER PK, assessment_id INTEGER REFERENCES
    assessments(id) ON DELETE CASCADE, csap_id TEXT, submission_id TEXT, location TEXT,
    spec_description TEXT, excerpt TEXT, evidence_type TEXT, confidence TEXT, page_reference TEXT)`
    -- one row per evidence item, populated by flattening `assessments.evidence_found` at import
    time. The `ON DELETE CASCADE` is REQUIRED: the importer reimports by deleting the `submissions`
    row and relying on the `submissions -> assessments` cascade, so without a cascade from
    `assessments` to these excerpt rows SQLite's default NO ACTION child FK would block that delete
    (and break the idempotent re-import below).
  - An FTS5 virtual table `assessment_excerpts_fts USING fts5(excerpt, location, spec_description,
    content='assessment_excerpts', content_rowid='id')` (external-content FTS5, so the index does not
    duplicate the text).
  - `INSERT`/`UPDATE`/`DELETE` triggers keeping the FTS index in sync with `assessment_excerpts`
    (standard external-content FTS5 trigger trio), plus a one-time backfill from existing
    `evidence_found` blobs.
- **Populate** at ingest: extend `scripts/import-evaluation-results.ts` (which already writes
  `assessments`) to also flatten each `evidence_found` array into `assessment_excerpts` rows. Idempotent
  (delete-by-assessment then re-insert) so re-imports don't duplicate.
- **Query** (`submission-search/route.ts`): replace the in-memory scan with
  `SELECT ... FROM assessment_excerpts_fts JOIN assessment_excerpts ... WHERE assessment_excerpts_fts
  MATCH ? ORDER BY rank LIMIT ?`, building the MATCH string from sanitized terms
  (`term*` prefix-match, `OR`-joined) exactly as the sibling's query-string builder does
  (`search/route.ts:75-81`; the `MATCH`/join predicate itself is at `:104-105`), with the same `LIKE`
  fallback on FTS5 parse error. Preserve the optional `submissionId` filter and the existing result
  shape (`SearchResult`).
- **Pagination:** add real `LIMIT/OFFSET` (or a rank+id keyset cursor) -- the current route has none
  (`LIMIT`-only, no offset; `route.ts:141,149`). Low priority; the corpus is admin-facing.
- Cost: contained to the SQLite layer + the import script + the one route. No Supabase/Postgres/infra
  change. Matches the store and the repo's own recommendation.

### Option B -- Migrate the corpus to Supabase Postgres FTS
Move `assessments`/excerpts into a Supabase table with a generated `tsvector` + GIN index + an RPC,
exactly like `v2_submission_chunks`. Only worth it if the route must serve **production** users (it
does not today -- it 503s/500s outside local dev per section 1). This is a schema migration + RLS design + data pipeline,
i.e. much larger than row 44, and largely duplicates Option 0's already-built work. Not recommended
unless the owner decides the legacy route must go live independent of engine_v2.

## 5. Recommendation

1. **Confirm reachability first (D1).** If the route is only ever local-dev/admin, the O(N) scan is
   tolerable far past 1K for a single reviewer and this can stay deferred. Verify whether
   `/regulatory-review/.../submission-search` is reachable in the deployed Vercel environment at all
   (the 503 gate + local-only DB file suggest not).
2. **When the trigger is actually hit** (or a reviewer feels the latency), implement **Option A**
   (SQLite FTS5) -- it is the smallest correct change, matches the store, and reuses a proven in-repo
   pattern. Add a cheap `SELECT COUNT(*) FROM assessments` guard/log so "1K" is measured, not guessed
   (no live count exists today).
3. **Treat Option 0 (engine_v2 port) as the long-term convergence** -- if engine_v2 replaces the
   legacy surface, prefer porting over investing further in the SQLite route; do not build Option B on
   top of a surface slated for retirement.

## 6. Non-goals / scope

- No code change in this PR. This is a design artifact per Top-50 row 44 (SAFE, design-only).
- No Supabase write, migration, RLS change, or catalog touch.

## 7. Owner decisions (for the batched packet)

- **D1:** Is the legacy `submission-search` route reachable in production, or local-dev/admin only?
  (Drives whether row 44 ever needs implementing at all.)
- **D2:** When implementation is triggered -- Option A (SQLite FTS5 now) vs wait for the engine_v2 port
  (Option 0)?
- **D3:** Relabel row 44 lane `MO -> reg-review` in the Top-50 queue (`SSTAC_TOP50_RECONCILED_2026_07_20.md:191`
  tags it `MO`; the code is reg-review; base row #42 already tags it `reg-review`).

## 8. References (file:line, verified 2026-07-21 against origin/main = 46c6d0eb)
- Legacy route + in-memory scan: `src/app/api/regulatory-review/submission-search/route.ts:7,14-24,52-61,79-121,141,149`.
- `assessments` schema + indexes (no FTS): `src/lib/sqlite/migrations/001_create_review_tables.sql:27-47,81-85`.
- SQLite FTS5 prior art: `src/app/api/regulatory-review/search/route.ts:75-81` (MATCH-string builder),
  `:83-125` (FTS query + `LIKE` fallback).
- Postgres FTS prior art: `supabase/migrations/20260513_v2_submission_chunks.sql:26-45` + `..._search_rpc.sql`.
- Volume + deferral notes: `docs/regulatory-review/CHAT_AND_SEARCH_ENHANCEMENT_PLAN.md:106,369`,
  `docs/NEXT_STEPS.md:140-141`, `docs/API_REFERENCE.md:413-415`, `SubmissionSearch.tsx:239`.

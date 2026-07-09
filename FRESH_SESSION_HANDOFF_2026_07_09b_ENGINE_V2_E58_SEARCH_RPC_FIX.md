# Fresh Session Handoff -- Engine-v2 E-58 Search RPC Fix -- 2026-07-09

**Lane:** Regulatory Review / SSTAC engine-v2 (NOT Matrix Options -- see the separate, concurrent
`FRESH_SESSION_HANDOFF_2026_07_09_MATRIX_OPTIONS_POST_ORGANOMERCURY.md` for that lane).

## What shipped this session (4 PRs merged to main)

| PR | Merge SHA | Scope |
|---|---|---|
| #559 | `1f74a8a97b08ab808a3e0c171dba8b3b6bbe946a` | Fixed `search_submission_chunks` RPC ambiguous-column bug (new forward migration `20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql` + static safeguard test) |
| #560 | `a560ff0d7218ba0e4d2f61c66d0b81f03f34743f` | Added "Index submission evidence" CTA to `SubmissionSearchTab` for the `absent` indexing state (reuses the existing `POST /reindex` route -- no new backend write path) |
| #561 | `2b335124eade0f0f6595c7a5e4ee3f23e05ff684` | Clarified the real E-58 `evaluation_id`'s provenance in `scripts/gate2b/import_verify_e58.mjs` + a static safeguard test |
| #562 | `74bbdc2c559ea8237397bfdcf94e4f7ac755ee0e` | Reconciled the Supabase protocol (`CLAUDE.md`, `AGENTS.md`, vendored skill banner, `sessionstart` skill) to an owner-approved gated-write workflow |

Main tip after this session: `74bbdc2c559ea8237397bfdcf94e4f7ac755ee0e`.

## Real E-58 evaluation -- confirmed live and working

- **project_id:** `11111111-1111-1111-1111-111111111111` ("M6 Dress Rehearsal -- WARP + Pb HHRA +
  IH (42 CSAP-NPG-RP)")
- **evaluation_id:** `33333333-3333-3333-3333-333333333333`
- **status:** `completed`, **backend:** `live`
- **per-policy rows:** 42 (real synthesis text + varying confidence, not stub)
- **submission chunks:** 420, **citations:** 420
- **v2_submission_chunks_indexing_status:** `complete`, `error_message` null
- **v2_judgments:** 0

Route: `/dashboard/engine-v2/11111111-1111-1111-1111-111111111111/evaluation/33333333-3333-3333-3333-333333333333`

A failed duplicate live-import attempt (`evaluation_id 954db86d-1627-4d4a-b85e-fa64dd72fe09`,
blocked by a `run_id_engine` unique-constraint conflict against the real row above) was fully
cleaned up: owner-run `DELETE` confirmed, local staging directory removed and confirmed gone.

## Remaining owner action (the actual next step)

**Merging PR #559 does NOT deploy the fix.** The SQL below must be applied to production
separately. Inlined here (not just in a scratch file) so it survives to a fresh checkout.

### 1. Apply the migration in Supabase Studio SQL Editor

Paste the full contents of
`supabase/migrations/20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql`
and run it. It is a `CREATE OR REPLACE FUNCTION` -- idempotent, safe to run more than once.

Optional preflight (confirm the currently-live, still-buggy definition before overwriting):
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'search_submission_chunks';
```
Optional post-apply verification (should show `cpc.evidence_item_id`, not a bare
`evidence_item_id`, in the function body):
```sql
SELECT prosrc LIKE '%cpc.evidence_item_id%' AS fix_applied FROM pg_proc WHERE proname = 'search_submission_chunks';
```

### 2. Smoke-test Search submission on evaluation `33333333-3333-3333-3333-333333333333`

1. Log in to the application.
2. Navigate to `/dashboard/engine-v2/11111111-1111-1111-1111-111111111111/evaluation/33333333-3333-3333-3333-333333333333`.
3. Open the "Search-and-Ask" side panel.
4. Click the "Search submission" tab.
5. Type a query of 2+ characters (e.g. contamination, remediation, soil, arsenic).
6. Observe the result.

**Expected success:** HTTP 200, no error banners, real non-empty result rows with text snippets,
no "search_failed" text anywhere on screen or in the network panel.

**Rollback / stop conditions:**
1. Check the exact error detail text before assuming the fix failed.
2. If the error is still "column reference \"evidence_item_id\" is ambiguous," double-check the
   SQL was executed successfully against the correct target database environment.
3. If it's a different error or you're unsure, STOP immediately and report the exact error text.
   Do not retry blindly or attempt any further database changes.

## New Supabase protocol (from merged PR #562 -- read `CLAUDE.md`'s "Supabase Protocol (HIGH
AUTHORITY)" section for the full text)

- `/supabase` skill required reading before any Supabase-touching work.
- Reads/scoped verification queries: allowed via project-scoped MCP without owner paste.
- Any write (DDL, RPC replacement, RLS change, data write, migration application): exact
  SQL/operation drafted first -> GREEN `/codex-review` on that exact SQL -> explicitly flagged to
  the owner -> owner's explicit approval of that EXACT write -> only then may Claude run it via
  `/supabase`/project-scoped MCP.
- `apply_migration` (the MCP tool) remains separately gated -- passing the write gate above does
  not itself authorize this specific tool call.
- `v2_judgments`/verdict writes remain forbidden per "What AI Must Never Do" item 11's two narrow
  carve-outs, unchanged and unweakened by this policy.

## Other remaining items (deferred, not started this session)

- Export CSV/MD/HTML and Export memo verification against real (non-stub) data.
- One real judgment save against evaluation `33333333` (Save-judgment path already proven against
  a different, stub-backend evaluation earlier; never exercised against this specific real one).
- One real "Ask AI" chat query against evaluation `33333333` (needs a live Ollama session,
  owner-gated per `OLLAMA_SCHEDULE_PROTOCOL.md`).

Full detail on all of the above: `docs/NEXT_STEPS.md` 2026-07-09 entry; the PL/pgSQL root-cause
pattern behind the #559 bug: `docs/LESSONS.md` 2026-07-09 entry.

## Doc/manifest updates made alongside this handoff

- `docs/LESSONS.md` -- new entry: PL/pgSQL `RETURNS TABLE` column-name-shadowing pattern (the root
  cause of the #559 bug), with file references and a reusable fix pattern.
- `docs/NEXT_STEPS.md` -- new dated entry capturing the remaining owner-gated production-deploy
  action and other deferred verification items.
- `docs/_meta/docs-manifest.json` -- new `facts_history` entry
  (`session_2026_07_09_e58_search_rpc_fix`) summarizing the 4 merged PRs and current E-58 state.
- This handoff file.

## Git/process notes

- Worktree used throughout: `C:\Projects\SSTAC-Dashboard-worktrees\gate2b-2026-07-08`.
- Primary checkout (`C:\Projects\SSTAC-Dashboard`) was never touched by this workstream.
- This session's own dev-server process cluster (PIDs rooted at an `npm run dev` in the gate2b
  worktree, started 2026-07-08 ~18:24) was still running and confirmed not orphaned at last check;
  left running, not killed.

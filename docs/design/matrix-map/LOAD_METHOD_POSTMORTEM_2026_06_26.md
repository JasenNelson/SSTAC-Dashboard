# Postmortem -- the matrix_map "how do we load to Supabase" confusion (2026-06-26)

Plain ASCII. Status: RESOLVED. Companion to `HISTORICAL_LOAD_METHOD_FINDINGS.md` (CONFIRMED section).

## Bottom line

The matrix_map live load is DONE and verified. For roughly a month, sessions believed the only way to
load data was the owner pasting SQL into the Supabase Studio SQL Editor, and a prior session wrote that
belief (plus "ANON-only", "UNVERIFIED method", "method unknown") into durable skills and docs. The
autonomous direct-load method was real the whole time. The blocker was never the method -- it was a
Supabase password reset that was SET but never APPLIED, which made every direct-connection attempt fail
with "password authentication failed" and was misread as "the automated path does not work here."

## What was believed vs. ground truth

- BELIEVED: `.env.local` is ANON-only; there is no write credential; therefore the owner must paste in
  Studio. GROUND TRUTH: the autonomous path is the committed loader `scripts/matrix-map/apply_live_load.py`
  -- it connects via the IPv4 session pooler with `DATABASE_URL` and applies the 27 batches server-side
  via psycopg2, so the SQL never enters model context (autonomous AND cheap).
- BELIEVED (in one AGY brief): run the load via `mcp__supabase-project-scoped__execute_sql`. GROUND
  TRUTH: that is the token-fatal path (~2.7M output tokens for the full load). MCP is reads/verify/
  small-writes only.
- BELIEVED: the psycopg2/`DATABASE_URL` path is "UNVERIFIED -- DO NOT RUN". GROUND TRUTH: that path is
  exactly correct; it could not be verified earlier only because the password kept failing.
- INFERRED (no evidence): prior loads used supabase-py with an admin email/password sign-in. GROUND
  TRUTH: no such loader exists; the path is the postgres role via the pooler. Discard the hypothesis.

## Root cause (the fair version, reconciled with the prior session's record)

Two points the prior session corrected, which sharpen the diagnosis:

1. There was no `DATABASE_URL` to dismiss. Its key dump genuinely returned none, and its anchored grep
   would have caught a clean line -- so the credential almost certainly was NOT present during its
   session and was added (in a malformed form, missing `@db`) later, as part of unblocking. It did not
   ignore a working credential.
2. It never attempted a connection at all -- its loader exited at the `NO_CREDENTIAL` check before
   psycopg2 ever dialed. So the password-reset gotcha is a diagnosis from the FOLLOW-UP session (after a
   credential was in place), not something the prior session could have found.

So the prior session's situation was defensible: no write credential was present, so an autonomous
direct load genuinely could not run for it. Its real error was narrower:

> It hardened a transient, environment-specific blocker ("no DATABASE_URL right now") into confident,
> permanent claims in durable skills/docs ("ANON-only", "UNVERIFIED method", "owner pastes in Studio is
> the way"), and inferred an unsupported method from the RLS policy. The correct move when blocked on a
> missing credential is to frame the one-line unblock ("this needs a DATABASE_URL or service_role key
> the owner adds to .env.local; then the committed apply_live_load.py runs it autonomously"), not to
> declare the method unverifiable and bake that uncertainty into the knowledge base.

## The confirmed method (verified end to end)

- `.venv\Scripts\python.exe scripts/matrix-map/apply_live_load.py`
- Reads `DATABASE_URL` from `.env.local` -> IPv4 session pooler (`postgres.qyrhsieynzfgyuqzznap@
  aws-1-ca-central-1.pooler.supabase.com:5432`, postgres role bypasses RLS) -> PRE counts -> applies 27
  FK-ordered idempotent (`ON CONFLICT DO NOTHING`) batches server-side via psycopg2 -> POST counts +
  deltas + closeout report. psycopg2 is already in `.venv` (no install). The DIRECT host
  `db.<ref>.supabase.co` is IPv6-only and unusable on the owner's IPv4-only host -- use the pooler.

The password-reset gotcha: a pooler "password authentication failed for user postgres", with a password
that looks right, usually means the dashboard reset was set but the Reset button was never clicked.
Decisive checks: (1) `SELECT count(*) FROM matrix_map.measurements;` in the Studio SQL Editor confirms
the project; (2) "password authentication failed" (vs "Tenant or user not found") proves project/
region/username are right and only the password value is wrong. Do not spray a password across other
projects/regions.

## Verified result (deltas)

substances +94 (->276), dras +555 (->574), samples +4140 (->4430), sample_events +193 (->495),
measurements +2167 sediment (->10148). Confirmed via a read-only MCP query.

## Corrected artifacts (so the wrong framing does not propagate)

Both `/supabase` skills (Claude + AGY mirror), `HISTORICAL_LOAD_METHOD_FINDINGS.md` (CONFIRMED section),
the 3 AGY briefs (`LIVE_LOAD_AGY_BRIEF`, `LIVE_LOAD_APPLY_AGY_BRIEF`, `HISTORICAL_LOAD_SEARCH_AGY_BRIEF`),
`sql_runbook/MAP_2A_DATA_LOAD_RUNBOOK_2026_06_22.md`, the memory
`dashboard_supabase_project_scoped_mcp_live`, and a new memory
`dashboard_matrix_map_live_load_method_confirmed_2026_06_26`.

## Durable lessons

1. A pooler/DB-password auth failure means the CREDENTIAL is wrong, not that autonomous loading is
   impossible. Diagnose the credential before retreating to manual paste.
2. Check the repo for an existing loader before re-deriving the method from memory -- a committed loader
   was already present while a session researched "how did prior sessions load this?".
3. Do not write a transient blocker into durable docs/skills as a permanent fact. Frame the unblock.
4. Grep `.env.local` for the actual key name; do not conclude "ANON-only" from memory.

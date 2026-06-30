# AGY BRIEF -- deep-search: HOW did prior sessions load matrix_map data to live Supabase?

> ANSWERED + RESOLVED 2026-06-26: the question is settled. Method = the LOCAL psycopg2 + DATABASE_URL
> session-pooler loader `scripts/matrix-map/apply_live_load.py` (SQL runs server-side; never enters
> the agent context). Prior sessions had only loaded the 9-site seed; the enrichment load is now DONE.
> The reason this was hard to determine: an unapplied Supabase password reset blocked every direct
> connection, so no method could be confirmed-by-success. See
> `docs/design/matrix-map/HISTORICAL_LOAD_METHOD_FINDINGS.md` (CONFIRMED section). This search brief is
> retained as a historical record; no further search is needed.

Plain ASCII. READ-ONLY investigation; do NOT load/modify anything. Write findings to
`docs/design/matrix-map/HISTORICAL_LOAD_METHOD_FINDINGS.md` for the orchestrator to review.

## The question
Prior Claude-Code sessions loaded ALMOST ALL the `matrix_map` data into live Supabase
(project qyrhsieynzfgyuqzznap) -- tens of thousands of rows, autonomously. There MUST be a
script/doc/method for this. Find the ACTUAL mechanism + the exact runnable command + where the
write credential comes from. Do NOT assume; cite the file + line you found it in.

## Verified constraint (so you know what the method must satisfy)
`matrix_map` write RLS (checked via pg_policies): tables samples/sample_events/measurements/dras have
`cmd=ALL, roles={authenticated}` WITH CHECK = user is in `user_roles` with role 'admin' or
'matrix_admin'. So the load used ONE of: (a) a `service_role` key (bypasses RLS), (b) a `supabase-py`
or supabase-js client that SIGNS IN as an admin/matrix_admin user (email+password), (c) a Postgres
connection (`DATABASE_URL`, postgres role bypasses RLS), or (d) the app's own server-side loader.
Find which, and where the credential is stored/sourced.

## Search (cite paths)
1. `scripts/` (esp. matrix-map/) for ANY loader beyond `etl_bnrrm_to_supabase.py` -- a supabase-py /
   node / TS loader, an "apply"/"seed"/"push"/"upsert" script, or a `--apply` invocation actually used.
2. `src/app/api/**` + `src/lib/**` for a server-side loader/route that writes matrix_map (would use a
   service_role or server env key).
3. `docs/**` + root `*HANDOFF*.md` + `sql_runbook/**` for any record of the load being EXECUTED
   (commands, "loaded N rows", the credential used). NOTE: `MAP_2A_DATA_LOAD_RUNBOOK_2026_06_22.md`
   says owner-pastes-Studio but is flagged superseded; find the ACTUAL executed method.
4. `git log` / `git log -p` for commits about the seed/data load + any loader script added/used.
5. Env/secret handling: search for `SERVICE_ROLE`, `service_role`, `DATABASE_URL`, `sign_in`,
   `signInWithPassword`, `createClient`, `supabase.auth`, `upsert(` across the repo -- where does a
   WRITE-capable credential or admin sign-in come from? (Do NOT print secret VALUES.)

## Deliverable -- HISTORICAL_LOAD_METHOD_FINDINGS.md
The exact method (script path + invocation/command), the credential source (file/env var name, NOT
value), and whether it loads raw SQL vs row data. If multiple methods exist, say which was actually
used for the bulk load. If you truly find nothing, say so + list everything you checked. Concise,
plain ASCII. Do NOT execute any load.

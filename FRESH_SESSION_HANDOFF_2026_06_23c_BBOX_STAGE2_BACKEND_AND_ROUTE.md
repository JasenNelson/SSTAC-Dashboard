# SSTAC-Dashboard -- Session Handoff 2026-06-23c (bbox Stage 2 backend + route; Batch F prepped)

Supersedes FRESH_SESSION_HANDOFF_2026_06_23b. Plain ASCII. Checkpoint at low token budget.
Method: AGY workhorse (mechanical) + codex 5.5 xhigh ship gate + Claude thin orchestrator + project-scoped
Supabase MCP (live DB reads + the Stage 1 RPC apply).

## PRs this session (12 merged: #402-#410 + the docs/handoff PRs)
Earlier (see 2026-06-23 + 2026-06-23b handoffs): #402 PFDA, #403 Batch E wiring, #404/#405/#406/#408 docs,
#407 bbox Stage 1 RPC (migration APPLIED live).
- **#409 bbox Stage 2a backend (MERGED):** typed MatrixMapBbox + fail-safe toRpcBbox in
  src/lib/matrix-map/bbox.ts; fetch-samples-server takes a typed bbox. Zero runtime change. (Adopted from
  a parallel session + gap-fixed.)
- **#410 bbox Stage 2 samples route (MERGED):** NEW
  src/app/api/matrix-map/samples/route.ts -- GET browser-callable viewport fetch wrapping
  fetchMatrixMapSamplesServerSide(supabase, bbox). codex 5.5 xhigh GREEN round 2 (caught + fixed a P2
  cookie-refresh/logout class -> getAll/setAll + Set-Cookie propagation; a P3 Number(" ")===0 parse trap
  -> strict trim+finite). Build gate caught a Next typed-routes error -> parseBboxParams moved to bbox.ts.
  manifest 4534 -> 4544.

## bbox lane status (the active lane)
- **Stage 1 (RPC bbox + cap):** DONE + LIVE (migration 20260623000001 applied via MCP + verified).
- **Stage 2a (typed helper):** DONE (#409).
- **Stage 2 route (/api/matrix-map/samples):** DONE (#410, MERGED). DEAD CODE until the client wires it.
- **Stage 2 CLIENT (the real UX work):** NOT STARTED. Fully specced:
  docs/design/matrix-map/BBOX_STAGE2_CLIENT_PLAN_2026_06_23.md (MatrixMap.tsx line refs, debounced
  moveend/zoomend refetch via the new route, AbortController drop-in-flight, min-zoom, leaflet.markercluster,
  truncated->"zoom in" hint). NEEDS A BROWSER / VISUAL QA -> best as a focused fresh session.

## Batch F -- PREPPED, NOT BUILT (next session: wire it, ~30 min)
8 unwired-but-approved HH substances ready to wire into SUBSTANCE_LIBRARY (build-first, same pattern as
Batch E #403; all approved IRIS RfDs, single-endpoint, HH-only/0-eco; abs_dermal 0.03, ba_oral 1.0,
logKow/eco null). Verified values:
- 1_2_3_trimethylbenzene / 1_2_4_trimethylbenzene / 1_3_5_trimethylbenzene -- organic, rfd 0.01
- bromobenzene -- organic-halogenated, rfd 0.02
- isopropylbenzene (Cumene) -- organic, rfd 0.1
- chlorotoluene_2 (o-Chlorotoluene) -- organic-halogenated, rfd 0.02
- 1_2_4_5_tetrachlorobenzene -- organic-halogenated, rfd 0.0003
- 2_4_dinitrotoluene -- organic, rfd 0.002
Brief AGY to add 8 SUBSTANCE_LIBRARY entries (mirror benzene/TCE field set) + Batch F test block + length
bump; ~380 unwired-but-approved substances remain after this. Skip: atrazine (pesticide dermal), TCDD
(dioxin TEF), high-SF carcinogens (benzidine), methylnaphthalene_2 (key collision), nickel salts.

## OWNER-GATED / NEXT (priority order)
1. **bbox Stage 2 CLIENT** -- the real next lane (fresh browser session; spec ready).
2. **Batch F wiring** -- prepped; ~30 min hands-off.
3. **Full 345-site DB2 undated load** -- after Stage 2 client; snapshot-gated; I apply via MCP.
4. PFDA subchronic / more wiring batches -- deferred.

## Gate cheatsheet (docs/GATE_MODE_SOP.md)
codex (Spark exhausted till Jun 24 -> straight 5.5 xhigh, run in BACKGROUND for >9min tool-use) -> commit
(path-scoped) -> test:ci (4-shard) -> npx tsc --noEmit -> lint (changed files) -> docs:gate ->
build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10 -> test:e2e -> push -> PR -> merge on green
(gh pr merge <n> --squash --match-head-commit <FULL-sha>). Manifest base **4544**. Known flake: Node-24
vitest write EPIPE -> one rerun. NOTE: Next.js route files may ONLY export handlers + config (build gate
catches stray exports). Squash-merge-then-rebranch: always re-branch off freshly-pulled main.

## Process
Project-scoped Supabase MCP is LIVE for matrix_map writes (owner-OK; I applied the Stage 1 RPC + can run
the DB2 load via MCP). codex earned its keep this session: PFDA id-swap, AGY disjoint-ID error, bbox P1
spatial-oracle leak, route P2 cookie + P3 parse. [[feedback-bbox-scoped-private-aggregate-is-a-spatial-oracle]]

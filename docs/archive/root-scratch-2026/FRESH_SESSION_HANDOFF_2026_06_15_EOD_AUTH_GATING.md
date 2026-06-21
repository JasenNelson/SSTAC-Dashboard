# Fresh-Session Handoff -- 2026-06-15 EOD (matrix-options lane + auth)

Entry point for the next SSTAC-Dashboard session. Read L0 `C:\Projects\CLAUDE.md` + L1
`CLAUDE.md` + `docs/GATE_MODE_SOP.md` first. Memory topic file:
`dashboard_session_2026_06_15_mo_activations_plus_auth_hardening.md`.

## STATE
- origin/main tip: `57026d8` (= #330, MERGED). All 4 session PRs (#320/#328/#329/#330) are on main.
- Working tree clean. ALL session worktrees removed junction-safe (store 722); none remain.
- Orphans: my 4 Playwright e2e leftovers were killed; the rest (gdrive-mcp, codex mcp-server,
  windows-mcp, cursor-agent) are MCP/harness/other-lane -- NOT killed (owner: only kill my-lane procs).

## SHIPPED THIS SESSION (all full-pipeline: Opus + codex GREEN + 6 gates + CI, head-pinned squash)
- **#320** (f5dc559): TWN toddler 94 g/day -- selectable food-web receptor option (ran promote --apply on inline approval).
- **#328** (4528541): HC 2017 sediment -- Option B reference-only (currentness->current; NO records/scenario/script).
- **#329** (c7b78ee): AUTH robustness hardening -- middleware getAll/setAll + retryable/terminal error
  classification + redirectToLogin cookie-carry; gated /demo-matrix-graph; client AuthContext/Header desync fix.
- **#330** (57026d8): GATE /matrix-options to authenticated-only (owner directive; matcher + e2e skip-convention).
- **M5-A** CLOSED (no code).

## AUTH POSTURE (current, post-#330)
- The `(dashboard)` route group is **authenticated-only**. PUBLIC routes are ONLY: `/`, `/login`,
  `/signup`, `/cew-polls` (anonymous CEW conference voting -- attendees have no accounts, use a 6-digit code).
- **matrix-options is GATED** (#330; '/matrix-options/:path*' in the middleware matcher). The
  2026-05-20 "public by design" codex decision was NOT owner-approved and was reverted. DO NOT re-assert it.
- Gated routes use the middleware matcher (dashboard, twg, survey-results, cew-2025, regulatory-review,
  bn-rrm, demo-matrix-graph, matrix-options) AND/OR per-page getUser+redirect (admin, matrix-map,
  hitl-packets, wiks, cew-results, ...). Single-source-of-truth mirror: `src/lib/auth/route-access.ts`
  + drift test; docs `docs/operations/ROUTE_ACCESS_ALLOWLIST.md` + `MIDDLEWARE_GUIDE.md`.
- No sensitive-data exposure was ever found (RLS backstop: is_email_allowlisted rejects null auth.uid;
  v2_judgments owner+admin; service-role key backend-only).

## OWNER ACTIONS / OPEN ITEMS
- **VERIFY LOGIN ON PHONE** after Vercel deploys the auth changes (#329 + #330) -- the environment where
  the unexpected-logout symptom occurred. Automated e2e covers redirect/gating; only the owner can confirm
  the real authenticated round-trip with credentials.
- MO lane: the prior owner-gated queue (#320/#328/M5-A) is fully activated. No autonomous MO build pending
  (well is dry). Next MO work is owner-gated.

## PROTOCOLS / LESSONS (carry forward)
- Never present a codex-review decision baked into a code comment as "owner-approved." When fixing access
  control, use the EXISTING pattern (matcher / per-page getUser+redirect) -- do NOT invent new gating.
- Promote --apply writes IN-REPO JSON (not Supabase); activation = a gated PR. Promoting into a
  candidate_group_id slot can flip defaultSelectionPolicy (caught only by live test:ci).
- Subagent-authored AUTH/security code needs the full Opus+codex pipeline -- codex took 4 rounds on #329
  to catch 3 real bugs (lowercase-token regression, signOut-cookie-drop).
- Gating a route breaks e2e specs that navigated it anonymously (matrix-options.spec, ssd-workbench.spec) ->
  switch them to the existing "skip-if-redirected-to-/login" convention (admin-agentic-os.spec.ts).
- CI: Build/E2E `need` Unit Tests (~24m), so they don't appear in `gh pr checks` until Unit passes; not a hang.
- gate discipline: full 6 gates on the FINAL tip; head-pinned squash-merge with the full 40-char SHA; CI
  Build/E2E required (repo auto-merge disabled -> merge manually on green).

# Session Checkpoint -- Semi-Autonomous Run (2026-06-02)

## Delivered (all merged to main; standing per-session AI-merge authorization, owner veto via remote control)

1. **#201 bulk-approve RPC concurrency hardening** -- PR #230, squash `932610b`. New append-only
   migration `20260602000001_catalog_approve_staging_rows_bulk_concurrency_guards.sql`
   (advisory fast-fail lock + constraint-name check w/ status-conditional supersede + P0001
   count honesty). codex GREEN (holistic + targeted). Owner pasted the SQL into Supabase
   ("sql ran successful"). DONE.
2. **Track A -- Matrix-Options catalog stack** -- verified ALREADY LANDED. main has the full
   697-record `human_health_trv_values.json` (#220 + #221 merged 2026-06-01; #218/#219/#213
   closed). Nothing to do.
3. **Track B -- re-expose #206 value-groups view + saved-view coercion fix** -- PR #232, squash
   `cf4380c`. Re-added the "By Parameter" tab (orphaned in #210; it renders the #206
   incommensurate-unit badge), widened tab grid 2->3 cols, and unified saved-view coercion
   across localStorage + Supabase (`source-leads`->`sources`; preserve by-parameter/sources/
   values/assumptions; equations/unknown->values). codex YELLOW (loader/Supabase asymmetry) ->
   fixed + regression test -> codex GREEN (iPhone fallback; CLI backend was down). 5 gates
   GREEN, CI GREEN. DONE.
4. **Track E -- siteDataStore test coverage + eslint .tmp ignore** -- PR #233, squash `1a2e2ad`.
   Covered the previously-untested pure logic in `src/stores/bn-rrm/siteDataStore.ts` (~51% ->
   higher): `validateChemistry()` (CCME ISQG/PEL boundaries, exceedance ratios, ug/kg, empty
   payload) + read selectors (getSiteCount/getSelectedSites incl. stale-id drop/getSelectedSite/
   getSiteLocations/getSitesByRegion). Also fixed a local-gate papercut: `eslint.config.mjs` now
   ignores `.tmp/**` (the monitored build quarantines `.next` into `.tmp/next-quarantine-*`;
   `eslint .` was flagging false `no-require-imports` on those compiled artifacts after a build).
   Reviewed via cursor-agent gpt-5.3-codex-xhigh (ladder rung 4; codex CLI + iPhone app BOTH down)
   = GREEN; queued for codex re-confirm. 5 gates GREEN, CI GREEN. DONE.

## Key findings that reshaped the plan

- **Track B "zombie removal" was actually a feature re-expose.** `by-parameter` gated the #206
  value-groups + incommensurate-unit badge; deleting it would have removed a shipped feature.
  Owner chose re-expose (done) over delete.
- **Track C eco-staging SQL is already generated** (prior session, 2026-05-29/30). Local-only
  (`.tmp/catalog-paste/` is gitignored): `d0c00010-*.sql` = 60 EPA Eco-SSL rows;
  `d0c00005-*.sql` = 2305 P28 eco-soil rows. Both are `catalog_extraction_staging` INSERTs
  (pathway eco-soil-screening/eco-soil, `qa_status=needs_review`, verbatim excerpts, never
  promoted). OWNER PASTES from disk at a desktop, then HITL-samples/approves. No autonomous
  build remained.
- **Catalog HC/IRIS is mostly landed** (697 records incl. ~92 HC + validated IRIS). The
  remaining IRIS orphans need a careful re-baseline (below).
- **Track D frame variant is not a trivial scaffold.** `validateFrameVariants()` has a tripwire
  blocking any `parameterOverrides` row until override-injection is implemented, and a real
  variant needs verified regulatory values. Deferred to a desktop session.

## Owner actions (paste-gated; do at a desktop -- MCP unavailable)

- Paste eco staging SQL into Supabase Studio: `.tmp/catalog-paste/d0c00010-*.sql` (60 rows),
  then `d0c00005-*.sql` (2305 rows). Then HITL-sample/approve in CatalogStagingReview.
- Any earlier deferred `.tmp/catalog-paste/json-migration/*.sql` pastes.

## Remaining autonomous work (thinner than the original plan implied; prior sessions did the bulk)

1. **IRIS orphan expansion (highest value; do in a FRESH leaner session for regulatory-data
   care).** EPA authoritative Excel is at `C:\Users\jasen\Downloads\Chemicals_Details (1).xlsx`
   (local, parse with python openpyxl -- check `.venv/` first). Plan: re-baseline against the
   697-record main, identify IRIS substances in the Excel NOT yet present, extend the snapshot
   (`epa_iris_canonical_snapshot.json`), run `scripts/matrix-options/generate-catalog-records.mjs`
   on the orphan allow-list, validate-vs-Excel (2% tol; NEVER vs AI memory --
   [[dashboard-iris-values-validate-against-epa-excel-not-memory]]), units fail-closed
   ([[feedback-always-report-and-normalize-units]]). Exclude the known d0c00013 data-integrity
   rows (BaP SF, Cr(VI) SF, carbon-tet IUR).
2. **Track E test coverage (safe hygiene):** siteDataStore.validateChemistry (~51%, pure logic,
   bn-rrm lane) + sqlite/queries (~77%, needs mocks). The MO pure-logic targets
   (unitNormalization/regulatoryFrames/equationDispatch/ssd-upload/library) already have tests.
3. **Track D frame variant (desktop):** implement override-injection in `equationDispatch`
   (remove the tripwire) + first FRAME_VARIANTS row, with owner-verified override values + a
   `catalog_sources` row.
4. **Account-stamp saved-views localStorage cache (#13):** DEFERRED -- documented cosmetic; would
   require making the sync `loadSavedViews` async; low value/risk ratio.

## Infra / coordination notes

- Worktree `C:\Projects\SSTAC-Dashboard-worktrees\auto-mo-2026-06-02` left in place on branch
  `auto-staging-base` (== origin/main cf4380c). Junction-safe cleanup when done: `cmd //c rmdir
  node_modules` THEN `git worktree remove`. (Junction gotcha: use `cmd //c`, not `cmd /c`, in
  the Bash tool -- [[dashboard-msys-cmd-double-slash-for-mklink]].)
- Parallel session merged #229 (engine-v2 S4 read-side); disjoint from this lane.
- codex CLI backend (chatgpt.com) was intermittently DOWN this session; iPhone codex fallback
  used successfully for #232. Primary checkout still on stale `docs/matrix-options-session-2026-05-31`.

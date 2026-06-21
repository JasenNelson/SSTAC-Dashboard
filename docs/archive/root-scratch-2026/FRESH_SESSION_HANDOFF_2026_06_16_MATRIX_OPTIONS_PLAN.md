# Fresh-Session Handoff -- 2026-06-16 (Matrix-Options consolidated plan + Phase M-A start)

Entry point for the next SSTAC-Dashboard session. Read L0 `C:\Projects\CLAUDE.md` + L1 `CLAUDE.md` +
`docs/GATE_MODE_SOP.md` first. Memory topic: `dashboard_session_2026_06_16_autonomous_closeout_plus_coverage.md`.
Run trail: `~/.claude/plans/autonomous-closeout-12h-2026-06-15.md`.

## PRIORITY (owner, HIGH AUTHORITY)
Matrix-options is THE worklane priority. The Palette/Sentinel automated-bot PRs are a code-DAMAGE source --
do NOT work the bot backlog; never adopt bot branches (memory
`feedback_matrix_options_priority_and_bots_are_damage_source`).

## CANONICAL PLAN DOCS (read these first)
- `docs/MATRIX_OPTIONS_CONSOLIDATED_PLAN_2026_06_16.md` -- the strategy: 5 workstreams, Phase 0-5 roadmap,
  17 decisions (D1-D17), stale/drop list. Replaces the scattered ~25 MO handoffs.
- `docs/MATRIX_MAP_DATA_INGESTION_DESIGN_2026_06_16.md` -- the map data-growth design; DECISIONS CLOSED;
  concrete Phase M-A build steps.

## IMMEDIATE NEXT TASK: Phase M-A -- grow the map sediment dataset
Owner picked a fresh focused session for this. The bottleneck is COORDINATES, not reports. Steps (from the
ingestion design doc):
0. ADOPT canonical DB2 = the bnrrm-fixes worktree copy (62 MB, 2026-05-03; 345 sites / 7,815 stations /
   14,583 sediment_chemistry + toxicity/benthic/RA docs). Path:
   `C:\Projects\Regulatory-Review-worktrees\bnrrm-fixes\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db`.
   Schema authority: that worktree's `schema\bnrrm_training.sql` + `bn_learning/docs/`. DB1 (main checkout,
   16 MB / 50 sites) is STALE -- do not use. Snapshot DB2 + schema docs into our control (worktree-only = risk;
   do NOT commit the 62 MB DB to git).
1. GEOCODE generator: read all (site_id, registry_id, name) from DB2.sites -> query BC Contaminated Sites
   Registry WFS layer `pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW` (EPSG:4326) per registry_id -> (lat,lon);
   emit the existing geocoding-CSV contract for all ~345 sites (see `docs/design/matrix-map/PR_MAP_0_GEOCODING_DATA.csv`
   for the exact columns; coordinate_source='bc_csr_centroid', quality 'medium'). NEEDS a live WFS query to
   confirm the registry-id attribute field name on the layer (network).
2. ETL: point/extend `scripts/matrix-map/etl_bnrrm_to_supabase.py` at DB2 + the all-sites geocoding CSV;
   generalize the per-station precision resolution (PRECISION HIERARCHY: surveyed station coord = exact override
   tier 'high'; else inherit the site's registry centroid = approx tier 'medium'; future real sample coords
   override). Load the FULL dataset (not the 9-site seed). Emit the transaction-bracketed .sql artifact (dry-run).
3. LOAD: owner pastes the .sql into Supabase Studio (Supabase MCP is DEAD per project rule) or --apply via
   DATABASE_URL. Verify samples/measurements grow from ~290 to the new total; confirm the map renders.
4. HARDEN: substance CAS normalization + stable idempotency key for the adopted source; surface the
   coordinate-quality tier on the map UI.

## OTHER IN-FLIGHT MO DECISIONS (from the owner walkthrough)
- Calculator Phase 0 (small, non-gated, can run anytime): RELABEL jurisdiction -> frame/approach across the
  dropdown (`SharedGlobalInputs.tsx:140`), the "Jurisdictional Frameworks" tab + "JURISDICTION / REGION" panel
  (`MatrixDashboard.tsx:224`, `:649-654`), and the `Jurisdiction` type alias (`guide/content/jurisdictions.ts:17`);
  reserve "jurisdiction" for source provenance. Suppress the FrameVariantFallbackNotice for the baseline frame.
- Calculator pilot: BUILD ONE real frame variant for the pilot frame = BC CSR sediment numerical (populate a
  FRAME_VARIANTS row -- gated on owner-promoted sources). Comparison "matrix" view = DEFERRED.
- Catalog wiring: wire the 3 unwired calculators (eco-direct, eco-food, background -- empty SEEDABLE_KEYS) +
  finish HH receptors. Gated on owner promotions (AI proposes/verifies values, owner disposes via promote-*.mjs).

## STANDING CONSTRAINTS
- Read-only on other project trees (Regulatory-Review, Sediment-DRA-Pipeline, worktrees) -- parallel-session safe.
- Supabase MCP dead -> author SQL, owner pastes in Studio.
- Full 6 gates + Opus + codex before any push (GATE_MODE_SOP); head-pinned squash; CI green before merge.

## STATE
- origin/main: 4ea2855. Working tree clean (tracked). Planning docs are untracked on disk (review/commit at will).
- Earlier this session: 6 PRs merged (#331-#336) + 38 superseded bot PRs closed. See the prior handoff
  `FRESH_SESSION_HANDOFF_2026_06_16_BACKLOG_TRIAGE.md` for that phase.

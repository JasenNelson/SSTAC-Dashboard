# Matrix Interactive Map -- Design Artifacts

Canonical design artifacts for the SSTAC-Dashboard Matrix Interactive Map lane.
Promoted from gitignored `.tmp_*` scratch files on 2026-05-19 so they survive in git history.

## Contents

- `PLAN_V3_4_2.md` -- Interactive Map plan v3.4.2 (codex-GREEN through 8 rounds; 14 design residuals R-1..R-14 dispositioned with owner sign-off).
- `PRIVATE_GRANTS_DESIGN_V2_3.md` -- Private-grants + RLS + dev allowlist design v2.3 (default `public=false`; dev allowlist = jasen-only; DUA out of scope per owner override of codex E-1).
- `INVENTORY_AND_RECOMMENDATIONS_V2.md` -- Pre-design inventory of existing dashboard map surfaces + cross-project recommendations v2.
- `SEED_STATION_LIST_V1.md` -- Owner-approved seed station list v1 (9 sites: 4 Tier A surveyed + 5 Tier B BC CSR centroid).
- `PR_MAP_0_GEOCODING_REPORT_V1.md` -- PR-MAP-0 geocoding coverage report (40 -> 290 mappable stations; +7555 chem rows; 7 BC regions).
- `PR_MAP_0_GEOCODING_DATA.csv` -- PR-MAP-0 geocoding output CSV (station -> lat/lon + region).

## Codex Holistic Dispositions (PR-MAP-1)

Captured 2026-05-19 from the holistic strategic checkpoint (codex CLI, medium
effort). Final verdict was YELLOW solely on the layers-seed doc/reality
mismatch (closed via the comment + runbook update above). Two forward-looking
P3s carried over:

- **PR-MAP-7 revoke RPC required**: `private_data_grants` has admin `FOR ALL`
  RLS + authenticated `SELECT, INSERT` grants. Grant creation under the admin
  policy works in v1, but the admin UI's revoke/update flow must add a
  SECURITY DEFINER RPC (matrix_admin-gated; audit-row writer) rather than
  rely on direct authenticated UPDATE. Acceptance criterion for PR-MAP-7.

- **WHO-READ audit deferred to v1.x**: PR-MAP-1 audits visibility flips
  (`dra_visibility_audit`), service-role operations (`service_role_audit`),
  exports (`export_audit`), and future bridge tokens (`bridge_audit` in
  PR-MAP-6). It does NOT audit ordinary reviewer reads / identify queries.
  This is a conscious v1 scope decision; v1.x may revisit if BC EMA / DRIPA
  posture requires per-read attribution.

## Lane Status

- **PR-MAP-0 (geocoding):** DONE. Deliverables on disk; coverage report + data CSV committed alongside this README.
- **PR-MAP-1 (Supabase schema + RLS + grants + ETL):** IN PROGRESS on branch `feat/matrix-map-pr-map-1-schema`.
- Subsequent PR-MAP-2+ tickets follow the plan in `PLAN_V3_4_2.md`.

## Context Pointer

For the full fresh-session handoff (owner sign-off log, 4 parallel Explore subagent prompts,
audit trail of the 8 codex rounds, token-conservation strategy), see the gitignored
`.tmp_fresh_session_handoff_matrix_map_2026_05_19.md` at the repo root and the load-bearing
memory anchor `dashboard_matrix_interactive_map_lane_2026_05_19.md`.

## Conventions

- Plain ASCII only (per cross-project L0 CLAUDE.md section 1.1).
- These files are the canonical committed copies. The `.tmp_*` originals remain on disk
  as working scratch but are gitignored; treat the `docs/design/matrix-map/` versions
  as authoritative for review and downstream reference.

## PR-MAP-1 Deployment Runbook

Required steps after applying the PR-MAP-1 migrations to a Supabase project
(staging or prod). Migrations alone do not configure these; they live in
Supabase Dashboard / project API settings and must be applied manually.

1. **Apply migrations in order** (Supabase CLI or Studio):
   1. `20260519000001_matrix_map_schema.sql` -- schema + indexes + seed caps
   2. `20260519000002_matrix_map_rls.sql`    -- helpers + RPC + RLS policies + GRANTs

2. **Expose `matrix_map` schema to the API** (per codex PR-MAP-1 R1 P2-2):
   Supabase Dashboard -> Project Settings -> API -> "Exposed schemas".
   Add `matrix_map` to the comma-separated list. Default is `public, graphql_public`;
   target is `public, graphql_public, matrix_map`. Without this step,
   `supabase.schema('matrix_map').from('...')` (used by the /admin/matrix-map/health
   page and any future server actions) returns "schema is not exposed".

3. **Run the ETL** (server with `DATABASE_URL` + `psql` or `psycopg2`):
   ```
   python scripts/matrix-map/etl_bnrrm_to_supabase.py            # dry-run
   python scripts/matrix-map/etl_bnrrm_to_supabase.py --apply    # apply
   ```
   Idempotent: all 5 BN-RRM-keyed table inserts (substances, dras, samples,
   sample_events, measurements) use `ON CONFLICT DO NOTHING` per codex
   PR-MAP-1 R1 P2-1. Safe to re-run.

4. **Layer catalog (deferred to PR-MAP-2)**:
   PR-MAP-1 leaves `matrix_map.layers` EMPTY by design (codex PR-MAP-1
   holistic P2 disposition). PR-MAP-2 (map UI commit) will seed the 4
   base tile layers + 14 BC WMS overlays alongside the React-Leaflet
   wiring that consumes them. The /admin/matrix-map/health page does
   NOT query `layers`, so this deferral does not impact PR-MAP-1
   verification.

5. **Seed initial grants** (optional; matrix_admin only):
   Edit `supabase/seed/matrix_map/grants.yaml` with real DRA UUIDs (look them
   up via `SELECT id, title FROM matrix_map.dras WHERE public = false;`) then
   apply (apply runner ships with PR-MAP-7 admin UI; for v1 dev, hand-write
   the INSERT statements following the YAML template).

6. **Verify post-deploy** (admin SQL session):
   - 13 tables in matrix_map (`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'matrix_map'`)
   - 9 RLS-armed tables (verify block in `20260519000002_matrix_map_rls.sql` section 5)
   - 14 RLS policies (verify block; admin select + cascade select counts)
   - matrix_map_owner role exists + NOLOGIN
   - 3 SECURITY DEFINER functions owned by matrix_map_owner
   - `flip_dra_public` REJECTS service_role + non-admin callers
   - Visit `/admin/matrix-map/health` as an `admin` or `matrix_admin` user;
     all 7 sections should render without "schema is not exposed" errors.

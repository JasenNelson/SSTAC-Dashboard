# Fresh Session Handoff -- 2026-06-20 (Lane C plumbing + catalog batches)

Status anchor for the next matrix-options session. Plain ASCII only.

## What shipped this session (all 6-gate + codex mutual-agreement GREEN)

Started from `main` = `acf61e6` (eco backlog complete, #355 merged). Merged in order:

1. **PR #356 (C1)** `b318548` -- `chore(matrix-map)`: DB2 SHA-256 + venv pre-flight guard.
   New shared `scripts/matrix-map/db2_guard.py` (single source of the canonical DB2 hash from
   `DB2_ADOPTION.md`): `verify_db2_integrity` + `decide_integrity_check` + `check_venv`. Wired into
   `geocode_bc_csr.py` (enforces) + `etl_bnrrm_to_supabase.py` (enforces only for a DB2 source).
   18 stdlib tests.
2. **PR #357 (Catalog Batch A)** `bfead93` -- 5 BC Protocol 28 specialty metals
   (antimony/cobalt/manganese/silver/tin) added to `SUBSTANCE_LIBRARY`, HH-selectable. RfDs verified
   verbatim vs `human_health_trv_values.json` (`pv-p28-<key>-hh-*-rfd`). Count 69->74.
3. **PR #358 (C2)** `b9262745` -- `feat(matrix-map)`: ETL CAS-resolution mechanism. New
   `resolve_substance()` + curated `substance_cas_map.json` (12 verified CAS for the library-overlap
   substances). ETL now emits `cas_number` (was NULL) + flags the rest needs_review. FK-safe (both
   substances + measurements loops canonicalize identically). Validated by a dry-run against the REAL
   DB2 (no count regression: substances=181/measurements=7508). 15 stdlib tests.
4. **PR #359 (Catalog Batch B)** -- 6 HH-only PAHs (anthracene, fluoranthene, phenanthrene,
   acenaphthene, fluorene, carcinogen dibenzo[a,h]anthracene sf=7.3). Count 74->80.
   (Status: see git log; pushed + CI'd this session.)

Manifest `vitest_test_count`: 4109 (stale) -> 4195 (Batch A) -> 4201 (Batch B).

## Key facts / lessons

- **DB2 is accessible** at `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_training_DB2_20260503.db`
  (size matches the recorded 65,466,368 bytes; the C1 guard verifies it). 159 distinct
  `sediment_chemistry.parameter` values; only 13 overlap the library; ~145 are pulp-mill chemicals
  (chlorophenols/guaiacols/dioxins) + a `- Paramete` header-leak artifact (excluded by C2).
- **CI is slow + flaky:** the sharded Unit Tests job runs ~25-26 min; it intermittently fails with
  `write EPIPE` (structural OOM flake) -- RE-RUN the failed job (`gh run rerun <id> --failed`), do not
  treat as a real failure. E2E also sometimes needs the rerun. After a merge, open PRs go
  behind-main -> branch-protection requires up-to-date -> REBASE onto origin/main before pushing to
  avoid a CI re-run (or it blocks the merge).
- **Catalog PRs serialize:** they share `substanceLibrary.ts` + the test count + the manifest
  `facts_history`, so two catalog PRs in flight conflict. Branch each off the LATEST main (after the
  prior catalog PR merges). Lane C (Python ETL) is independent of catalog (different files).
- **CAS hazard:** the catalog's anthracene row `value_text` has a WRONG CAS (`120-20-7`; true is
  `120-12-7`) -- a pre-existing catalog data bug. CAS was deliberately kept OUT of the Batch B library
  prose. OWNER: fix the anthracene catalog `value_text`; verify other CAS in `value_text` fields.

## Next work (recommended order)

The catalog work-list (classified WIRE/RESEARCH/PIN) is the backbone. Remaining shippable batches:

- **C3 (Lane C, ETL full-dataset extension, dry-run only):** generalize `SEED_SITE_IDS` (1..9) AND
  the `TIER_A_SITE_IDS`/`TIER_B_SITE_IDS` frozensets to all 345 sites + per-station tier resolver +
  a `--site-ids` test seam. Reconcile the `.tmp` centroid-CSV input vs the committed
  `PR_MAP_8_GEOCODING_DATA_FULL.csv`. Merges as a dry-run `.sql` generator (NO load). Builds on C2's
  resolver. NOTE `DB2_ADOPTION.md:54-55` defers this to an owner-gated LOAD PR -- owner already
  approved building C3 dry-run now (override acknowledged).
- **Catalog Batch C (WIRE):** halogenated organics already-in-catalog (hexachlorobenzene, 1,4-dioxane,
  1,4-dichlorobenzene) -> verify catalog rows, add library entries (same pattern as A/B).
- **Catalog Batch E (PIN):** locate real URL + access-date for the ~18 pending_owner_export sources
  in `sources.json` (IRIS live tables, EPA Eco-SSL PAH/PCB, HC HHRA/DQRA, BC WLRS, TWN, EPA 2000
  AWQC -- many URLs already identified in this session's work-list). Source-pinning needs owner
  attestation per the catalog-mutation rule.
- **Catalog Batch F (RESEARCH):** the 6 PAHs with NO catalog values (acenaphthylene, chrysene,
  benzo[b/k]fluoranthene, benzo[ghi]perylene, indeno[123-cd]pyrene) + PFOA/PFOS -- need source
  research before a needs_review row.
- **CAS map expansion (C2 follow-up):** add verified CAS for the ~144 needs_review chemistry
  substances (pulp-mill tail) + pick the nonylphenol canonical CAS (owner: 84852-15-3 branched-tech
  is the usual environmental default).

## Owner-gated / deferred (do NOT build without owner)

- The Map DATA LOAD (Supabase): gated on **D-dates** (relax `event_date` nullable vs impute -- a
  dated-only load reproduces the existing ~7,472 seed, no map growth) + **D-visibility** (rows load
  `public=false`). Decision artifact: `docs/design/matrix-map/PR_MAP_8_LOAD_DECISION_REPORT.md`.
  Supabase MCP is DEAD -- owner pastes chunked `.sql` into Studio.
- D14 cross-pathway comparison view: DEFERRED this session (owner) -- low value until FRAME_VARIANTS
  populate (most cells render identical across frame columns today). Design preserved in the plan
  file `~/.claude/plans/explore-code-base-and-tranquil-bengio.md`.
- Promoting any of the build-first needs_review rows to `approved`: owner inline approval -> the
  owner-run promote-*.mjs script. AI never writes qa_status.

## Pointers
- Plan file (full design + review history): `~/.claude/plans/explore-code-base-and-tranquil-bengio.md`
- Catalog gap inventory + work-list: captured in this session's transcript (regenerate via an
  inventory subagent if needed).
- Gate discipline: `docs/GATE_MODE_SOP.md`. Roadmap: `docs/MATRIX_OPTIONS_CONSOLIDATED_PLAN_2026_06_16.md`.

# Fresh Session Handoff -- 2026-06-20b (Lane C + catalog expansion COMPLETE)

Current continuity anchor. Supersedes FRESH_SESSION_HANDOFF_2026_06_20_LANE_C_PLUS_CATALOG_BATCHES.md
(that one was committed mid-session via #360; this one covers the full run). Plain ASCII only.

## Shipped this session (8 PRs, all merged to main; tip e6a6091)

Started at `main` = acf61e6 (eco backlog complete, #355). All through the full pipeline:
ground-truth value verification -> web CAS verification -> Opus adversarial loop -> codex grind ->
codex gpt-5.5 xhigh -> 6 gates. NOTHING promoted (all build-first needs_review; no qa_status writes).

1. **#356 (C1)** b318548 -- DB2 SHA-256 + venv pre-flight guard. New shared
   `scripts/matrix-map/db2_guard.py` (single source of the DB2 hash from DB2_ADOPTION.md):
   verify_db2_integrity + decide_integrity_check + check_venv; wired into geocode_bc_csr.py (enforces)
   + etl_bnrrm_to_supabase.py (enforces only for a DB2 source). 18 stdlib tests.
2. **#357 (Catalog Batch A)** bfead93 -- 5 BC Protocol 28 specialty metals (antimony, cobalt,
   manganese, silver, tin) -> HH-selectable. 69->74.
3. **#358 (C2)** b926274 -- ETL CAS-resolution mechanism (resolve_substance + substance_cas_map.json).
   ETL now emits cas_number (was NULL) + flags the rest needs_review. FK-safe. 15 tests.
4. **#359 (Catalog Batch B)** 44c5d24 -- 6 HH-only PAHs (anthracene, fluoranthene, phenanthrene,
   acenaphthene, fluorene, carcinogen dibenzo[a,h]anthracene sf=7.3). 74->80.
5. **#360 (docs)** 57f4b4e -- mid-session handoff (now superseded by this file).
6. **#361 (fix)** 8d90d07 -- corrected anthracene CAS 120-20-7 -> 120-12-7 in the catalog value_text
   (robot-extraction typo; the catalog's own IRIS rows were already correct). Documentary only.
7. **#362 (Catalog Batch C)** 9254357 -- consolidated WIRE batch, 10 substances. 80->90. 7
   non-carcinogens (aluminum 1.0, boron 0.2, molybdenum 0.005, strontium 0.6, phenol 0.3, styrene
   0.2, acetone 0.9) + 3 carcinogens wired sf-only (hexachlorobenzene 1.6, pentachlorophenol 0.4,
   1,4-dioxane 0.1).
8. **#363 (CAS map)** e6a6091 -- expanded the ETL CAS map 12 -> 49 verified entries (12 more metals,
   15 PAHs, 7 PCB Aroclors, 3 chlorophenols). Real-DB2 dry-run: needs_review 144 -> 107.

Net: SUBSTANCE_LIBRARY 69 -> 90 (all build-first needs_review); ETL stamps 49 verified CAS.
manifest vitest_test_count 4109 -> 4211.

## Load-bearing facts / lessons

- **DB2 accessible** at `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_training_DB2_20260503.db`
  (size matches the recorded 65,466,368; C1 guard verifies it). 159 distinct chemistry params.
- **CI is slow + flaky:** sharded Unit Tests ~26 min; intermittent `write EPIPE` OOM flake on a shard
  -> `gh run rerun <id> --failed`. E2E starts AFTER Unit (so a PR is ~40 min to fully green); E2E
  itself ~12 min. After any merge, open PRs go behind base -> branch protection blocks ->
  `gh pr update-branch <n>` (fresh CI) before merge, OR rebase the local branch onto origin/main
  before push. Merge with `--match-head-commit <full-sha>` (NOT abbreviated).
- **Catalog PRs serialize** on substanceLibrary.ts + the test count + the manifest facts_history; do
  one at a time, branch each off the LATEST main. Lane C (scripts/matrix-map, Python/JSON) is
  independent and can run in parallel with a catalog PR.
- **CAS verification is mandatory + error-prone** (the anthracene 120-20-7 typo). Use a dedicated
  web-verification subagent (PubChem/CAS Common Chemistry/EPA), confirm digit order, keep CAS out of
  prose if unverified. The ETL CAS map keys on the substance_key SLUG of the DB2 spelling (PAH slugs
  are punctuation-stripped, e.g. benzoapyrene); enumerate DB2 to get exact slugs.
- **Build-first carcinogen convention:** wire sf-only (rfd null), cf. benzo_a_pyrene; note the
  non-cancer RfD in the catalog for HITL. contaminantClass enum lacks a generic "metal" -> use
  divalent-metal as the non-metalloid-metal bucket (document trivalent/monovalent in notes;
  it is descriptive-only, derivations only branch on organic-PAH + methyl-Hg).

## Next work (recommended order)

- **C3 (Lane C, ETL all-345-sites dry-run):** generalize SEED_SITE_IDS + TIER_A/B_SITE_IDS frozensets
  + per-station tier resolver + a --site-ids test seam; reconcile the .tmp centroid-CSV vs the
  committed PR_MAP_8_GEOCODING_DATA_FULL.csv. Dry-run .sql generator, NO load. Uses C2/C3 resolver.
  Owner already approved building dry-run now (overrides DB2_ADOPTION.md:54-55 deferral).
- **More catalog WIRE batches:** sweep remaining catalog-only substances with usable HH values
  (the inventory had ~350 catalog-only; this session wired the common ones). Same A/B/C pattern.
- **Batch E (PIN, owner-attestation):** pin the ~18 pending_owner_export sources in sources.json
  (real URL + access date; many URLs already identified).
- **Batch F (RESEARCH):** PFOA/PFOS + the mixed-isomer/obscure substances with no catalog value.
- **CAS map further expansion:** the remaining 107 needs_review ETL substances (dioxin/furan
  congeners, other chlorophenol isomers, guaiacols/catechols, petroleum hydrocarbons, organotins) --
  each needs isomer-specific CAS verification.

## Owner-gated / HITL decisions outstanding

- **nonylphenol CAS** -- pick the canonical form (84852-15-3 branched-technical is the usual
  environmental default) before it is pinned in the ETL map.
- **Carcinogen endpoint** for HCB / pentachlorophenol / 1,4-dioxane -- confirm cancer-SF vs
  non-cancer-RfD is the canonical screening endpoint (Batch C wired sf-only; RfD is in the catalog).
- **Map DATA LOAD (Supabase)** -- gated on D-dates (relax event_date nullable vs impute; a dated-only
  load reproduces the existing ~7,472 seed = no growth) + D-visibility (rows load public=false).
  Artifact: docs/design/matrix-map/PR_MAP_8_LOAD_DECISION_REPORT.md. Supabase MCP DEAD -> owner
  pastes chunked .sql into Studio.
- **Promotions** -- promote any build-first needs_review rows to approved via the owner-run
  promote-*.mjs (inline approval = attestation). AI never writes qa_status.
- **D14** comparison view -- deferred (low value until FRAME_VARIANTS populate). Design in
  `~/.claude/plans/explore-code-base-and-tranquil-bengio.md`.

## Pointers
- Plan file: `~/.claude/plans/explore-code-base-and-tranquil-bengio.md`
- Gate discipline: `docs/GATE_MODE_SOP.md`. Roadmap: `docs/MATRIX_OPTIONS_CONSOLIDATED_PLAN_2026_06_16.md`.

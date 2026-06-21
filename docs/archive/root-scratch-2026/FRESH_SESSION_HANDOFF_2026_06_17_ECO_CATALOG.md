# Fresh-Session Handoff -- 2026-06-17 (Eco-catalog generator + matrix-options eco defaults)

Entry point for the next SSTAC-Dashboard session. Read L0 `C:\Projects\CLAUDE.md` + L1 `CLAUDE.md` +
`docs/GATE_MODE_SOP.md` first. Codex-reviewed plan: `~/.claude/plans/explore-code-base-and-noble-firefly.md`
(the matrix-options continuation plan; hardened through Leg-1 Opus + ~12 codex rounds + a 4-perspective pass).

## STATE (where everything is -- nothing lost)
- `origin/main` = `c840a84`. This session MERGED two PRs to main:
  - **#337** `debe83d` -- jurisdiction->regulatory-frame relabel + baseline fallback-notice suppression.
  - **#338** `c840a84` -- DB2 adoption + BC CSR geocoder + map LOAD DECISION packet (NO load; owner-gated).
- **Eco work-in-progress (THIS handoff's subject)** is on a PUSHED branch, fully recoverable:
  - Branch `feat/matrix-options-eco-catalog-generator-2026-06-17` @ `7a409ef` (pushed to origin).
  - Worktree `C:\Projects\SSTAC-Dashboard-worktrees\eco-catalog-2026-06-17` (junctioned node_modules; may be cleaned -- recreate from the branch if gone).
  - Contains: `scripts/matrix-options/generate-eco-catalog-records.mjs` (the eco generator, smoke-tested) +
    the 3 candidate sheets under `docs/design/matrix-options/`.
- The 3 candidate sheets ALSO exist untracked in the primary checkout `docs/design/matrix-options/`.

## DONE this session
1. Plan `/codex-review` -> finalized plan (strategic course-correction folded in).
2. PR #337 + #338 built, gated, merged, worktrees junction-safe-cleaned.
3. **Eco-defaults RESEARCH (verified, from EPA/FCSAP via LOCAL Zotero localhost:23119)** -> 3 needs_review candidate sheets.
4. **Eco generator CORE** -- `generate-eco-catalog-records.mjs` written + the integrity-critical unit
   normalizer SMOKE-TESTED GREEN (ug/L, mg/L->ug/L x1000, mg/kg-bw/day; fail-closed on TEQ / missing-/day / wrong-class).

## WHY (the goal this unlocks)
The eco pathways (eco-direct, eco-food) have EMPTY `SEEDABLE_KEYS` -> they can't auto-compute from frame +
substance -> the cross-pathway comparison "matrix" view (Phase 1 / D14, the product's namesake) can only show
the 2 HH pathways. The owner confirmed the eco defaults exist in EPA guidance. Sourcing + seeding them ->
eco pathways auto-compute -> the comparison view shows ALL 4 pathways.

## THE TWO ECO VALUE CLASSES (do not conflate)
- **eco-direct (EqP)** -> `fcv_ug_per_L` (chronic aquatic-life criterion, ug/L) protecting INVERTEBRATES/FISH/PLANTS.
  Sheet: `ECO_AQUATIC_FCV_CANDIDATE_ROWS_2026_06_17.md`. Sources: EPA ESB Tier-2 SCV/FCV (primary, Zotero
  I2YMU9MP), EPA NRWQC CCC (LIVE-FETCHED 2026-06-17 -- NOT in Zotero -> PIN a dated PDF before promotion),
  CCME (chloroform/PCE only). ~44 nonionic-organic candidates. **EqP path is NONIONIC-ORGANICS-ONLY** -- metals/
  ions/ionizables/PFAS/TBT are CONTEXT ONLY (NOT seeded here; they route to a different sediment-metal screen).
- **eco-food (BSAF)** -> `TRV_eco_mg_per_kg_bw_day` (dose-based WILDLIFE TRV) for BIRDS/MAMMALS (per-receptor).
  Sheet: `ECO_TRV_CANDIDATE_ROWS_2026_06_17.md`. Source: FCSAP ERA Module 7 (En14-92/7-2021E, Zotero 7JQ2YJ9T,
  compiling USEPA Eco-SSL). 32 substances; ~46 value rows. TEQ rows (PCB/dioxin in ng TEQ/kg-bw/day) are a
  DISTINCT unit -> excluded from the standard mg/kg-bw/day rows.
- **EqP machinery scalars** -> `ECO_DEFAULTS_CANDIDATE_PACKET_2026_06_17.md`: fLipid=0.03 (universal; ITRC CS-1),
  foc=0.002 (EqP applicability FLOOR, labeled conservative; EPA ESB -- NOT a typical-site default), BSAF
  (substance-specific, ERDC DB -- separate effort).

## REMAINING for the eco-catalog-generator PR (exact next steps)
1. **Add eco source entries to `sources.json`** (rich schema -- copy an existing entry's shape): EPA ESB
   Compendium (EPA/600/R-02/016, 2008); EPA NRWQC aquatic-life (PIN a dated PDF first); FCSAP ERA Module 7
   (En14-92/7-2021E, 2021); USEPA Eco-SSL; ITRC CS-1 (2011); CCME WQG. (source_leads already exist:
   `source_leads/epa_ecossl_*`, `erdc_bsaf_*`, `wqciu_*`.) The generator THROWS on any unresolved source_id.
2. **Author the eco staging input** the generator reads (default path
   `matrix_research/reference_catalog/eco_staging/eco_values_staging_2026_06_17.json`). Per-row schema:
   `{substance_key, input_key (fcv_ug_per_L|TRV_eco_mg_per_kg_bw_day), display_name, raw_value, raw_unit,
   receptor (aquatic|mammal|bird), source_id, locator, source_excerpt, source_date, grade, cas, note, hold}`.
   Data = the 3 sheets. Set `hold:true` for the owner-flagged conflicts (Toxaphene, Aldrin, PCB-pending,
   older-FRV pesticides demeton/guthion/malathion/methoxychlor/mirex). substance_key MUST reconcile to
   EXISTING catalog keys (grep parameter_values.json; e.g. chromium_vi, benzo_a_pyrene). Group rows
   (lmw_pahs/hmw_pahs/total_phcs/etc.) likely need new keys -- flag.
3. **Generate:** `node scripts/matrix-options/generate-eco-catalog-records.mjs --dry-run` then `--write` ->
   `eco_values.json`. Verify counts + spot-check values vs the sheets.
4. **Wire `src/lib/matrix-options/provenance/catalog.ts`:** add `import ecoValuesRaw from
   '.../eco_values.json'` + spread into `PARAMETER_VALUE_RECORDS` (lines 19-21). **CHECK the
   `ParameterValueRecord` TS type** accepts the eco `receptor_groups` (['aquatic life','wildlife']),
   `species_groups` (benthic invertebrate/fish/aquatic plant/mammal/bird), and eco pathways/input_keys --
   widen the type if needed (run `npx tsc --noEmit`).
5. **Tests:** generator unit test (normalizeToCanonical + buildEcoRecord + the hold/TEQ/N-S/N-A exclusions) +
   a catalog-load assertion that eco rows appear. Bump the manifest test-count facts.
6. **6 gates + codex (targeted, integrity-critical regulatory transform) + PR.** This PR is catalog DATA +
   the generator; it changes NO calculator behavior (needs_review rows don't seed) -> low runtime risk.

## THEN (separate, owner-gated -- after the data PR + owner promotion)
- Owner PROMOTES the needs_review eco rows -> approved (AI never promotes without inline approval).
- Wire eco `SEEDABLE_KEYS` (`frameDefaults.ts`) + author `FRAME_DEFAULT_PROFILES` + add eco receptor
  scenarios (mammal/bird for eco-food) + eco calculator consumption -> eco pathways auto-compute.
- Build the comparison "matrix" view (Phase 1 / D14): MVP = all-4-pathway table; HH auto-compute; eco
  compute once their defaults are promoted+wired. (Exploration map was done this session -- re-derive from
  the 4 calculators' `sedS` result types + SharedGlobalInputs + getEquation.)

## OWNER-DISPOSITION items (gate generation/promotion; AI does not decide these)
(a) NRWQC -- pin a dated EPA PDF (it was live-fetched). (b) Toxaphene basis: ESB 0.039 vs NRWQC CCC 0.0002
(~195x). (c) PCB CCC 0.014 vs a second-fetch misread 0.03. (d) older-FRV-basis pesticide CCCs -- EqP
suitability. (e) wildlife-TRV provenance: FCSAP-compilation acceptable, or fetch primary USEPA Eco-SSL PDFs
(not in Zotero)? (f) fLipid 0.03 + foc 0.002-floor seed acceptance + source tier (ITRC = tier_3). (g) subset/scope.

## STANDING CONSTRAINTS
- No catalog promotion / qa_status by AI; needs_review only; inline owner approval = the attestation.
- Codex (targeted+holistic) before commit; full 6 gates before push; head-pinned squash; CI green before merge.
- Plain ASCII (code point <=127; the generator uses `\u` escapes for the mu regex). Path-scoped staging only.
- Worktree cleanup is junction-safe (fsutil reparsepoint delete + shared-store count gate; NEVER Remove-Item
  -Recurse on a junction). Read-only on other project trees. Supabase: owner says direct-connect works (verify).

## HOW TO RESUME
`git fetch origin`; the eco work is on `feat/matrix-options-eco-catalog-generator-2026-06-17` @ `7a409ef`
(generator + sheets). Recreate a worktree if needed: `git worktree add <path> feat/matrix-options-eco-catalog-generator-2026-06-17`
(+ junction node_modules + cp .env.local). Continue at "REMAINING" step 1.

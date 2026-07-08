# Matrix Options Backlog Execution Map - 2026-07-08

## Live Baseline

- `origin/main` at plan time: Includes `a49d0b9` and newer.
- Phase B PRs #540, #541, #542, and #543 are **merged**.
- Phase A3 (DL-PCB TEQ parallel screening card) PR #545 is **merged** and QA'd green.
- PRs #548, #549, and #550 are **merged**.
- Phase C is parked on missing primary source PDFs.
- Gate2B/Supabase/engine-v2 paths are out of scope for this Matrix Options run.

## Safe Now

### Documentation consolidation

Status: safe if path-scoped and reviewed.

Current generated docs:

- `docs/AGY_MATRIX_OPTIONS_12H_EXECUTION_PLAN_2026_07_08.md`
- `docs/MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md`
- `docs/MATRIX_OPTIONS_PHASE_C_SOURCE_PREFLIGHT_2026_07_08.md`
- `docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md`
- `docs/MATRIX_OPTIONS_ORGANOMERCURY_PACKET_2026_07_08.md`
- `docs/MATRIX_OPTIONS_BACKLOG_EXECUTION_MAP_2026_07_08.md`
- `docs/MATRIX_OPTIONS_E2E_ASSESSMENT_2026_07_08.md`
- `docs/MATRIX_OPTIONS_NEXT_LANE_RECOMMENDATION_2026_07_08.md`

These are docs-only and avoid forbidden paths. They are useful as a handoff PR once staging permissions are
available.

## Owner Decision Required

### Organomercury / `phenylmercuric_acetate`

Decision needed:
1. `abs_dermal` policy.
2. Contaminant class approach (Option A1: pragmatic `organic` bucket vs Option A2: explicit `organomercury` class).

Evidence packet: `docs/MATRIX_OPTIONS_NEXT_LANE_RECOMMENDATION_2026_07_08.md`.

Allowed implementation after decision:

- `src/lib/matrix-options/types.ts`
- `src/lib/matrix-options/substanceLibrary.ts`
- `src/lib/matrix-options/substanceApplicability.ts`
- Matrix Options tests

Forbidden:

- catalog JSON edits
- review/default status edits
- mercury backfill/conflation

### PCB key alias/deprecation housekeeping

Decision needed: whether to perform the optional alias/deprecation of `polychlorinated_biphenyls_total_pcbs`.

Important constraint: `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md:32` says Option A is
not a simple library edit. It requires catalog-row migration/alias handling because the plain key owns catalog
records. That crosses into catalog-handling scope and should not be part of this autonomous run.

### Cyanide speciation

Status: not a build gap right now.

Current source shows cyanide entries are already wired with `inorganic` class in
`src/lib/matrix-options/__tests__/substanceLibrary.test.ts:1005-1012`. Remaining work is policy/UX selection
guidance:

- `cyanide_free` versus `hydrogen_cyanide_and_cyanide_salts`
- silver cyanide versus generic silver
- potassium silver cyanide convention
- copper cyanide versus generic copper

Do not add more cyanide code until a selection convention is approved.

### Inhalation-only values/schema gap

Status: owner/product design required.

`docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md:101` records 48 clean inhalation-only values that
`SubstanceEntry` cannot hold. This is not a small Matrix Options patch because it needs schema/model/UI design
for inhalation endpoints.

### Ontario MECP TRV ingestion

Status: source archive is present but ingestion is owner-gated.

`docs/NEXT_STEPS.md:41-42` identifies `2026 Ontario MECP TRVs.zip`. Ingesting it would require a source
extraction and catalog proposal lane. Do not mutate catalog data in this autonomous run.

## Blocked By Sources

### Phase C TEF/RPF verification

Status: parked.

Missing primary sources:

- WHO-2005 / Van den Berg 2006 TEF evaluation
- WHO-1998 / Van den Berg 1998 TEF/RPF evaluation
- Health Canada PQRA H129-108-2021 source

Evidence packet: `docs/MATRIX_OPTIONS_PHASE_C_SOURCE_PREFLIGHT_2026_07_08.md`.

## Forbidden For This Run

- Supabase branching or MCP.
- Gate2B / engine-v2 work.
- Catalog mutation.
- Review/default status mutation.
- Worktree cleanup involving junctions (without explicit care).

## Recommended Sequence

1. Owner decides `phenylmercuric_acetate` `abs_dermal` AND contaminant class strategy.
2. Implement organomercury as a small code-only PR.
3. Owner provides Phase C primary PDFs.
4. Resume TEF/RPF verification.

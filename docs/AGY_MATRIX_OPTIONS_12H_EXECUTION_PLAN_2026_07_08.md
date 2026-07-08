# AGY Matrix Options 12H Execution Plan - 2026-07-08

You are AGY-primary orchestrator for the SSTAC-Dashboard Matrix Options worklane.

Run this plan unattended through Units 0-6. Choose the next eligible unit yourself. Use Gemini 3.5 Flash (High) for bounded mechanical edits, inventories, reports, tests, and fixture work when useful. Call Codex review yourself when review is required and available. Inspect diffs directly. Run gates. Commit with path-scoped staging. Push if auth/network permits.

Do not use Claude. Do not ask the owner to run routine AGY, Codex, test, git, review, or commit commands. Stop only on the explicit stop conditions below or for a genuinely owner-gated action.

## Hard Boundaries

Do not touch:

- `.mcp.json`
- Supabase config, env handling, branch tooling, migrations, SQL execution, or project tooling
- `src/lib/engine-v2/**`
- `src/app/api/engine-v2/**`
- `src/lib/engine-v2/eval_result_import.ts`
- `src/lib/engine-v2/evidence_slices.ts`
- `src/lib/engine-v2/memo_builder.ts`
- `src/lib/engine-v2/submission_chunks_indexing.ts`
- `src/lib/engine-v2/__tests__/**`
- `src/data/**` catalogs
- review statuses, `default_status`, `qa_status`, or catalog promotion/demotion data
- primary checkout dirty files unless this plan explicitly names the file

Never merge PRs. Owner merges.

Never run:

- `git add .`
- `git add -A`
- `git add -u`
- `git reset --hard`
- `git clean`
- `git checkout .`
- `git restore .`
- raw `npm run build`

Use path-scoped staging only. Use the monitored build:

```powershell
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
```

All authored files must be ASCII.

## Required Base

Work from a fresh clean worktree or clone based on current `origin/main`. Do not implement from the dirty primary checkout.

Expected known baseline at plan creation:

- `origin/main`: `3285998`
- PR #545: open, CLEAN, all checks green, branch `lane/mo-a3-dlpcb-teq-2026-07-07`
- Phase B PRs #540/#541/#542/#543: merged
- CI flake Node-22 fix #547: merged

If live state differs, trust live state and update the status artifact before continuing.

## Stop Conditions

Stop and write a closeout if any of these occur:

- Any command would require owner approval and there is no already-approved route.
- A needed action touches a hard-boundary path.
- A task requires catalog mutation or review-status mutation.
- A task requires Supabase, MCP, or Gate2B coordination.
- A merge is needed.
- A test/gate fails twice with the same unexplained failure.
- Codex review finds a blocker that cannot be fixed without changing scope.
- Worktree safety is uncertain, especially around Windows junctions.

## Current Artifacts To Read First

Read these files before choosing Unit 1+:

- `docs/MATRIX_OPTIONS_OVERNIGHT_STATUS_2026_07_08.md`
- `docs/MATRIX_OPTIONS_PHASE_C_SOURCE_PREFLIGHT_2026_07_08.md`
- `FRESH_SESSION_HANDOFF_2026_07_07b_PHASE_B_SHIPPED.md`
- `docs/MATRIX_OPTIONS_OWNER_DECISIONS_QUEUE_2026_07_02.md`
- `docs/MATRIX_OPTIONS_OWNER_DECISIONS_2026_07_06.md`
- `docs/MATRIX_OPTIONS_PCB_KEY_CONSOLIDATION_DECISION_2026_07_02.md`
- `e2e/matrix-options.spec.ts`
- `src/components/matrix-options/HHDirectContactCalculator.tsx`
- `src/components/matrix-options/__tests__/HHDirectContactCalculator.test.tsx`
- `src/lib/matrix-options/dlPcbTeqTdi.ts` if present on the branch being inspected

## Unit 0 - Live State And Safety Inventory

Goal: establish true current state without trusting prompts.

Actions:

1. Fetch origin.
2. Record `origin/main`, current branch, dirty status, and open Matrix Options PRs.
3. Check PR #545 state, checks, mergeability, and file list.
4. Verify Gate2B-sensitive paths are untouched in the working tree.
5. Write or update `docs/MATRIX_OPTIONS_AUTONOMOUS_RUN_STATUS_2026_07_08.md`.

Acceptance:

- Status file includes live commit hashes, PR states, dirty file list, and explicit forbidden-path overlap verdict.

## Unit 1 - PR #545 Readiness Packet

Goal: make the owner decision on #545 easy and evidence-backed.

Actions:

1. Inspect PR #545 diff against `origin/main`.
2. Verify these claims with file references:
   - Mass-based total-PCB direct-contact card remains present.
   - DL-PCB TEQ card renders only for `total_pcbs_aroclor_1254`.
   - Provisional / needs_review badge renders.
   - TDI resolver fails closed on missing, non-finite, non-positive, and unit mismatch cases.
   - No forbidden paths or catalog data were touched.
3. If authenticated browser testing is available without owner action, capture a browser screenshot or DOM evidence. If not available, do not block; rely on component and unit evidence.
4. Write `docs/MATRIX_OPTIONS_PR545_READINESS_2026_07_08.md`.

Acceptance:

- Readiness packet has exact file references and a direct verdict: ready to merge, needs follow-up, or blocked.
- No code change is required unless the packet finds a real defect.

## Unit 2 - Post-#545 Follow-Up Backlog

Goal: convert Matrix Options loose ends into implementable, owner-gated slices.

Actions:

1. Inventory open Matrix Options backlog from docs and source.
2. Separate items into:
   - safe now
   - owner decision required
   - blocked by sources
   - blocked by #545 merge
   - forbidden for this run
3. Pay special attention to:
   - organomercury class / `phenylmercuric_acetate`
   - PCB key alias/deprecation housekeeping
   - cyanide speciation
   - inhalation-only values/schema gap
   - Ontario MECP TRV ingestion
   - Phase C primary source acquisition
4. Write `docs/MATRIX_OPTIONS_BACKLOG_EXECUTION_MAP_2026_07_08.md`.

Acceptance:

- Each item has evidence, owner-decision status, allowed files, forbidden files, likely tests, and next action.

## Unit 3 - Organomercury Implementation Decision

Goal: determine whether the approved `organomercury` class can be implemented now without catalog mutation.

Actions:

1. Search source and catalog-derived data for `phenylmercuric_acetate`, `phenylmercuric`, `methyl-Hg`, `divalent-metal`, and `ContaminantClass`.
2. Determine whether `phenylmercuric_acetate` is present in selectable `SUBSTANCE_LIBRARY` or only in provenance/catalog snapshots.
3. If it is selectable and classification is code-only, implement:
   - add `organomercury` to the type union
   - classify only the approved substance(s)
   - add/update tests
4. If it is not selectable or implementation would require catalog mutation, do not implement. Write a decision packet instead.

Allowed implementation files if code-only:

- `src/lib/matrix-options/types.ts`
- `src/lib/matrix-options/substanceLibrary.ts`
- directly related Matrix Options tests

Forbidden:

- `src/data/**`
- provenance/catalog JSON hand edits
- review statuses

Acceptance:

- Either a committed code-only PR-ready change with tests, or `docs/MATRIX_OPTIONS_ORGANOMERCURY_PACKET_2026_07_08.md` explaining why implementation is blocked/no-op.

## Unit 4 - Matrix Options Auth-Gated E2E Assessment

Goal: determine whether a useful e2e increment exists without owner authentication.

Actions:

1. Inspect `e2e/matrix-options.spec.ts` and existing auth skip behavior.
2. Identify whether PR #545 can get a meaningful non-auth e2e assertion.
3. If meaningful, implement the smallest test.
4. If auth-gated and not meaningful, write `docs/MATRIX_OPTIONS_E2E_ASSESSMENT_2026_07_08.md` with the exact reason and a future authenticated test plan.

Acceptance:

- No brittle or always-skipped test is added.
- Any added test must run locally.

## Unit 5 - Safe Documentation Consolidation

Goal: preserve useful autonomous-run findings without polluting active handoffs.

Actions:

1. Review docs generated by this plan.
2. Consolidate duplicate or stale claims.
3. Correct any stale claims from AGY-generated inventory, especially false statements that merged Phase B PRs are still pending.
4. Ensure all docs are ASCII.
5. Commit docs-only updates if they are clean and useful.

Acceptance:

- Documentation does not contradict live `origin/main`.
- Staging is path-scoped.

## Unit 6 - Gates, Review, Push, Closeout

Goal: leave useful work in PR-ready or PR-created state.

For any code/test changes:

1. Run targeted tests first.
2. Run Codex review or equivalent independent review if available.
3. Iterate to GREEN.
4. Commit with path-scoped staging.
5. Run full push gate on final tip:
   - `npm run lint`
   - `npm run test:ci`
   - `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`
   - `npm run test:e2e`
6. Push and open a PR if auth/network permits.

For docs-only changes:

1. Verify ASCII.
2. Verify forbidden paths untouched.
3. Commit with path-scoped staging.
4. Push and open a PR if auth/network permits.

Closeout must include:

- What changed
- What was committed/pushed/PR'd
- What was intentionally not touched
- Gate results
- Remaining owner decisions
- Next recommended action
- Claude-token spend risk for next step: low/medium/high
- AGY delegation opportunity: yes/no

## Suggested Priority Order

1. Unit 0
2. Unit 1
3. Unit 3
4. Unit 2
5. Unit 4
6. Unit 5
7. Unit 6

If PR #545 merges during the run, refresh base state before any post-merge follow-up.

# Matrix Options Default Policy Evidence Library 12H Handoff - 2026-05-26

## Purpose

Use this handoff to continue the Matrix Options default-selection policy lane in
a fresh Codex session with up to 12 hours of autonomous work.

The next session is now the integrator for two disjoint uncommitted
implementation slices in the same checkout. The immediate priority is to
separate, review, commit, and push them cleanly:

1. Matrix Options default-policy UI projection.
2. SSD Supabase compatibility.

After both slices are committed separately and the combined tip is GREEN, the
session may continue with read-only policy discoverability and QA polish in the
Matrix Options lane.

## Current Repo State

Verified in `C:\Projects\SSTAC-Dashboard` after implementation work on
2026-05-26.

Expected pushed tip:

```text
518ec42 Add Matrix Options default policy UI projection
```

Expected live status at fresh-session start may include:

```text
## main...origin/main
 M CLAUDE.md
 M src/components/MatrixDashboard.tsx
 M src/components/matrix-options/CalculatorValueSearchPanel.tsx
 M src/components/matrix-options/EvidenceLibrary.tsx
 M src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx
 M src/lib/matrix-options/ssd/__tests__/supabase.test.ts
 M src/lib/matrix-options/ssd/supabase.ts
 M src/lib/matrix-options/ssd/types.ts
 M src/lib/matrix-options/ssd/upload.ts
?? .mcp.json
?? MATRIX_MAP_*.md
?? MATRIX_OPTIONS_*.md
?? coverage/
?? scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_multimedium_PATH_B.sql
?? scripts/matrix-map/etl_output_chunks/
?? src/components/matrix-options/DefaultPolicyDispositionNote.tsx
```

Important separation:

- `CLAUDE.md` is an intentional prior-session workflow guidance diff. Keep it
  separate from Matrix Options implementation commits unless the owner
  explicitly approves combining it.
- The `src/lib/matrix-options/ssd/*` tracked diffs are SSD Supabase
  compatibility work from a parallel session. Treat them as their own
  implementation slice with their own Commit protocol and exact-path commit.
- Do not stage, commit, push, restore, clean, or normalize anything from the
  parallel session until the integrator has reconstructed both slices and is
  intentionally committing each slice separately.
- Preserve all untracked Matrix Map, Matrix Options handoff, `.mcp.json`, ETL,
  `coverage/`, and other artifact files.
- Do not clean, delete, normalize, broad-stage, broad-restore, or broad-reset.
- Do not use `git add .`, `git add -A`, or `git add -u`.

## Required Read Order

Read these before editing:

1. `C:\Projects\AGENTS.md`
2. `C:\Projects\SSTAC-Dashboard\AGENTS.md`
3. `C:\Projects\SSTAC-Dashboard\MATRIX_OPTIONS_DEFAULT_POLICY_UI_FRESH_SESSION_HANDOFF_2026_05_25.md`
4. `C:\Projects\SSTAC-Dashboard\MATRIX_OPTIONS_PROTOCOL28_CLOSEOUT_HANDOFF_2026_05_25.md`
5. `C:\Projects\SSTAC-Dashboard\MATRIX_OPTIONS_V1_CLOSEOUT_HANDOFF_2026_05_25.md`
6. This handoff
7. `matrix_research/reference_catalog/protocol28_direct_source_verification_workflow.md`
8. `matrix_research/reference_catalog/README.md`
9. `src/lib/matrix-options/defaultSelectionPolicy.ts`
10. `src/lib/matrix-options/__tests__/defaultSelectionPolicy.test.ts`
11. `src/components/matrix-options/CalculatorValueSearchPanel.tsx`
12. `src/components/matrix-options/__tests__/CalculatorValueSearchPanel.test.tsx`
13. `src/components/matrix-options/EvidenceLibrary.tsx`
14. `src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx`
15. `src/components/MatrixDashboard.tsx`

Also inspect, but do not edit unless the work explicitly moves there:

- `matrix_research/reference_catalog/parameter_values.json`
- `matrix_research/reference_catalog/human_health_trv_values.json`
- `matrix_research/reference_catalog/sources.json`

## Reconstruct Live State

Run and record:

```powershell
git status --short --branch
git log --oneline -8
git diff --stat
git diff -- src/components/MatrixDashboard.tsx src/components/matrix-options/CalculatorValueSearchPanel.tsx src/components/matrix-options/DefaultPolicyDispositionNote.tsx src/components/matrix-options/EvidenceLibrary.tsx src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx
```

If tracked files outside the two implementation sets have changed, do not
revert or stage them. Report them as parallel-lane/user work and proceed only
with exact-path staging for the intended slice.

## Prior Session Implementation

The previous session implemented option 1 from the approved plan:

- Added `src/components/matrix-options/DefaultPolicyDispositionNote.tsx`.
- Replaced duplicated calculator lookup policy-label/tone/detail logic with the
  shared component.
- Passed the selected regulatory frame from `MatrixDashboard.tsx` into
  `EvidenceLibrary`.
- Added read-only policy notes to:
  - grouped parameter rows;
  - value table rows;
  - selected value detail panels.
- Added tests proving:
  - Health Canada can show as `Recommended candidate: approval required`;
  - Protocol 28 remains `Blocked: policy compilation`;
  - the selected regulatory frame changes policy projection;
  - the UI does not imply default promotion.

No catalog JSON, QA status, canonical-source status, default status, source
status, source files, Zotero attachments, or calculator runtime defaults were
mutated.

## Verification Already Completed

Prior session completed:

```powershell
npm run test:unit -- src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx src/components/matrix-options/__tests__/CalculatorValueSearchPanel.test.tsx src/lib/matrix-options/__tests__/defaultSelectionPolicy.test.ts
```

Result: passed after known Windows `spawn EPERM` rerun with escalation.

```powershell
npm run test:unit -- src/components/__tests__/MatrixDashboard.test.tsx
```

Result: passed after known Windows `spawn EPERM` rerun with escalation.

Also passed:

```powershell
npx tsc --noEmit
git diff --check
npm run lint
```

ASCII scan passed on touched files:

- `src/components/MatrixDashboard.tsx`
- `src/components/matrix-options/CalculatorValueSearchPanel.tsx`
- `src/components/matrix-options/DefaultPolicyDispositionNote.tsx`
- `src/components/matrix-options/EvidenceLibrary.tsx`
- `src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx`

Known non-blocking warnings:

- Existing lint warnings outside this Matrix Options lane.
- `next lint` deprecation warning.
- Missing Next.js ESLint plugin warning.
- Vitest `spawn EPERM` can occur on first run; rerun the same narrow command
  with escalation before treating it as a code failure.

## 12-Hour Autonomous Work Plan

### Phase 0 - Context and Conflict Check

Time box: 20 to 30 minutes.

- Read the required files in order.
- Verify live branch, HEAD, status, and diff.
- Confirm whether the current implementation diff is still present.
- Confirm unrelated SSD and `CLAUDE.md` diffs are not part of this lane.
- If another active session appears to be working in the same files, stop and
  recommend a separate branch/worktree.

### Phase 1 - Close Matrix Options Default-Policy Projection

Time box: 1.5 to 2.5 hours.

- Review the current diff for correctness, accessibility, and text fit.
- Tighten the shared policy component if needed.
- Preserve the read-only boundary.
- Run focused tests:

```powershell
npm run test:unit -- src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx src/components/matrix-options/__tests__/CalculatorValueSearchPanel.test.tsx src/lib/matrix-options/__tests__/defaultSelectionPolicy.test.ts
npm run test:unit -- src/components/__tests__/MatrixDashboard.test.tsx
npx tsc --noEmit
git diff --check
npm run lint
```

- Run Commit protocol. Use local codex review unless the owner explicitly
  authorizes external private-diff disclosure.
- Exact-path stage only:

```powershell
git add -- src/components/MatrixDashboard.tsx src/components/matrix-options/CalculatorValueSearchPanel.tsx src/components/matrix-options/DefaultPolicyDispositionNote.tsx src/components/matrix-options/EvidenceLibrary.tsx src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx
```

- Commit message recommendation:

```text
Add Matrix Options default policy evidence projection
```

### Phase 2 - Close SSD Supabase Compatibility Slice

Time box: 1.5 to 2.5 hours.

This slice belongs to the parallel ECOTOX Supabase setup session and should be
reviewed as a separate commit. Expected paths:

- `src/lib/matrix-options/ssd/supabase.ts`
- `src/lib/matrix-options/ssd/types.ts`
- `src/lib/matrix-options/ssd/upload.ts`
- `src/lib/matrix-options/ssd/__tests__/supabase.test.ts`

Reconstruct intent from the diff before committing. The observed shape is a
Supabase ECOTOX compatibility fallback for mirrors that do not expose
`reference_number` but do expose alternate reference metadata columns.

Run focused checks:

```powershell
npm run test:unit -- src/lib/matrix-options/ssd/__tests__/supabase.test.ts
npx tsc --noEmit
git diff --check
npm run lint
```

Run Commit protocol for this slice. Exact-path stage only:

```powershell
git add -- src/lib/matrix-options/ssd/supabase.ts src/lib/matrix-options/ssd/types.ts src/lib/matrix-options/ssd/upload.ts src/lib/matrix-options/ssd/__tests__/supabase.test.ts
```

Commit message recommendation:

```text
Add SSD Supabase reference metadata fallback
```

Do not mix this commit with Matrix Options default-policy UI files or
`CLAUDE.md`.

### Phase 3 - Browser and UX QA

Time box: 1 to 2 hours.

- Start the app if needed.
- Inspect `/matrix-options` or the Matrix Options dashboard route.
- Check desktop and mobile widths for:
  - Values By Parameter;
  - Values;
  - selected value detail panel;
  - calculator value lookup panel.
- Confirm text does not overflow compact table cells.
- Confirm Health Canada, IRIS, current defaults, and Protocol 28 dispositions
  are visually distinct but not promotional.
- Fix only UI issues inside the Matrix Options implementation files.

### Phase 4 - Read-Only Policy Discoverability

Time box: 3 to 4 hours.

Recommended autonomous next slice after both active implementation slices are
committed:

- Add a small read-only `Default policy` audit summary to References and Values.
- Count, for the active filtered library:
  - candidate pending approval;
  - manual decision required;
  - keep current default;
  - unsupported pathway.
- Add a saved review view or audit shortcut only if it can be implemented as a
  pure runtime projection, not catalog mutation.
- Tests must prove the counts are read-only and that Protocol 28 remains
  blocked.

Keep scope inside:

- `src/components/matrix-options/EvidenceLibrary.tsx`
- `src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx`
- `src/components/matrix-options/DefaultPolicyDispositionNote.tsx` only if the
  display helper needs a small addition.

Do not add catalog fields for policy decision state in this slice.

### Phase 5 - Focused Regression and Commit

Time box: 1.5 to 2 hours.

- Run focused tests, `npx tsc --noEmit`, `git diff --check`, ASCII scan, and
  `npm run lint`.
- Run Commit protocol on the second slice.
- Commit with exact-path staging only.

Suggested commit message:

```text
Add References default policy audit summary
```

### Phase 6 - Push Protocol

Time box: 2 to 3 hours.

Run full Push protocol once on the combined tip before any push:

```powershell
npm run lint
npm run test:unit
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
npm run test:e2e
```

Use the monitored build gate. Do not run raw `npm run build` from agent shells.

If a gate fails in a way that belongs to one of the two committed slices, fix it
in the relevant slice with a follow-up exact-path commit. If a gate fails
because of unrelated files outside these slices, report the blocker and do not
fold unrelated work into either commit.

### Phase 7 - Closeout

Time box: 30 to 45 minutes.

- Record commits, verification, unrun gates, and known warnings.
- Write a new handoff if any work remains.
- Recommend continue, switch slice, or close fresh.

## Product Invariants

- References and Values is a read-only review/database surface.
- Regulatory-frame selection changes lookup context and messaging only.
- Calculator defaults do not change in this lane.
- Protocol 28 remains policy-compilation/source-mining context.
- Health Canada and IRIS direct-source values remain read-only candidates until
  owner or delegated approval promotes them.
- No default promotion.
- No QA promotion.
- No canonical-source promotion.
- No source JSON or value JSON mutation.
- No owner/HITL workflow implementation in this autonomous slice.
- No source-file, PDF, spreadsheet, or Zotero attachment storage under
  `C:\Projects`.

## Stop Conditions

Stop and ask before proceeding if:

- live `HEAD` is not `518ec42` or a clearly newer expected commit;
- branch is not `main...origin/main`;
- the current Matrix Options implementation diff is missing or substantially
  different;
- the SSD compatibility diff is missing or substantially different from the
  expected four-file slice;
- unrelated tracked diffs overlap either implementation slice;
- the task appears to require catalog JSON mutation;
- a change would promote a value to calculator default or QA-approved;
- Protocol 28 would appear calculator-ready instead of policy-compilation
  blocked;
- source files or attachments would need to be copied into the repo;
- full Push protocol fails because of unrelated parallel-lane changes;
- external AI review of private repo diffs would be needed without explicit
  owner authorization.

## Paste-Ready Fresh Session Prompt

```text
Start in C:\Projects\SSTAC-Dashboard. This is an approved 12-hour autonomous
Matrix Options lane. Rebuild context first, then proceed unless a stop condition
fires.

Read, in order:
1. C:\Projects\AGENTS.md
2. C:\Projects\SSTAC-Dashboard\AGENTS.md
3. C:\Projects\SSTAC-Dashboard\MATRIX_OPTIONS_DEFAULT_POLICY_UI_FRESH_SESSION_HANDOFF_2026_05_25.md
4. C:\Projects\SSTAC-Dashboard\MATRIX_OPTIONS_PROTOCOL28_CLOSEOUT_HANDOFF_2026_05_25.md
5. C:\Projects\SSTAC-Dashboard\MATRIX_OPTIONS_V1_CLOSEOUT_HANDOFF_2026_05_25.md
6. C:\Projects\SSTAC-Dashboard\MATRIX_OPTIONS_DEFAULT_POLICY_EVIDENCE_LIBRARY_12H_HANDOFF_2026_05_26.md
7. matrix_research/reference_catalog/protocol28_direct_source_verification_workflow.md
8. matrix_research/reference_catalog/README.md
9. src/lib/matrix-options/defaultSelectionPolicy.ts
10. src/lib/matrix-options/__tests__/defaultSelectionPolicy.test.ts
11. src/components/matrix-options/CalculatorValueSearchPanel.tsx
12. src/components/matrix-options/__tests__/CalculatorValueSearchPanel.test.tsx
13. src/components/matrix-options/EvidenceLibrary.tsx
14. src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx
15. src/components/MatrixDashboard.tsx

Verify:
- git status --short --branch
- git log --oneline -8
- git diff --stat
- git diff -- src/components/MatrixDashboard.tsx src/components/matrix-options/CalculatorValueSearchPanel.tsx src/components/matrix-options/DefaultPolicyDispositionNote.tsx src/components/matrix-options/EvidenceLibrary.tsx src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx

Expected pushed commit:
518ec42 Add Matrix Options default policy UI projection

Expected separate tracked diffs:
- CLAUDE.md, intentional prior-session workflow guidance.
- src/lib/matrix-options/ssd/*, unrelated parallel SSD lane/user work. Do not
  edit, revert, stage, or commit these as part of this Matrix Options lane.

Preserve all untracked Matrix Map, Matrix Options handoff, .mcp.json, ETL,
coverage, and other artifact files. Do not clean, delete, broad-stage, or
normalize them.

Primary objective:
Act as the integrator. Reconstruct and close two separate implementation
slices:
1. Matrix Options default-policy UI projection.
2. SSD Supabase compatibility.

Run Commit protocol per slice, exact-path commit them separately, then run Push
protocol once on the combined tip. If time remains after both slices are GREEN,
continue with read-only default policy discoverability/audit polish. No default
promotion, no QA promotion, no catalog mutation, no owner/HITL promotion
workflow implementation.

Commit protocol:
- focused Matrix Options tests
- MatrixDashboard focused test
- npx tsc --noEmit
- git diff --check
- ASCII scan on touched files
- npm run lint
- local codex review to mutual GREEN

Push protocol before any push:
- npm run lint
- npm run test:unit
- npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
- npm run test:e2e

Use exact-path staging only. Keep CLAUDE.md separate. Keep the two
implementation slices in separate commits. If unrelated diffs block gates,
report the blocker and do not fold them into either implementation slice.
```

## Closeout Recommendation

Yes, close the current session after this handoff. The next session should start
from the paste-ready prompt above, because the worktree now contains multiple
separate uncommitted lanes and a fresh context is safer for a 12-hour autonomous
run.

# Matrix Map PR-MAP-4/5 Commit-Protocol Review - 2026-05-22

## Status

Commit-protocol review is complete for the MeasurementWorkbench UX slice.

## Reviewer Ladder

- Nested `codex review` CLI: attempted before the skill update was surfaced. Treat as unavailable for this session because nested Codex review is now documented as the wrong default inside an active Codex app/session.
- Cursor Agent CLI: available locally, but the Codex Desktop escalation reviewer rejected the attempt because it would transmit private workspace code and repository context to an external service.
- Claude Code Opus: skipped because the user noted it is token-blocked.
- Codex subagent review: completed with one P1 finding and one P2 finding.

## Findings And Disposition

- P1 row-click selection collapse: fixed. `requestPanToSample` now requests pan/highlight without replacing `selectedSampleIds`. Regression coverage added in `selectionStore.test.ts` and `MatrixMapRightPanel.test.tsx`.
- P2 export audit atomicity: accepted deferral. The concern is valid, but a complete fix needs DB-side transaction/RPC semantics or audit-schema changes. That is outside this no-DDL/no-RPC UX/filter slice. Do not describe it as fixed in commit or PR notes.

## Commit-Protocol Verdict

- Targeted verdict: GREEN after P1 fix, with P2 explicitly deferred.
- Holistic verdict: GREEN for PR-MAP-4/5 scope alignment. No Calculator guide, bridge audit, R-13 statistics, PR-MAP-6, PR-MAP-7, Supabase DDL/RPC, build, push, or unrelated build-monitor/font/layout work was included.
- Commit acceptability: acceptable for Commit protocol. Not acceptable for Push protocol until unit, e2e, lint, and monitored clean build are green on the final tip.

## In-Scope Files From This Slice

- `MATRIX_MAP_PR_MAP_4_5_REVIEW_BACKLOG_2026_05_22.md`
- `src/app/(dashboard)/matrix-map/MatrixMap.tsx`
- `src/app/api/matrix-map/export/route.ts`
- `src/app/api/matrix-map/export/__tests__/route.test.ts`
- `src/components/MatrixDashboard.tsx`
- `src/components/__tests__/MatrixDashboard.test.tsx`
- `src/components/matrix-options/MatrixMapRightPanel.tsx`
- `src/components/matrix-options/__tests__/MatrixMapLeftPanel.test.tsx`
- `src/components/matrix-options/__tests__/MatrixMapRightPanel.test.tsx`
- `src/stores/matrix-map/filterStore.ts`
- `src/stores/matrix-map/__tests__/filterStore.test.ts`
- `src/stores/matrix-map/measurementStore.ts`
- `src/stores/matrix-map/selectionStore.ts`
- `src/stores/matrix-map/__tests__/selectionStore.test.ts`

## Verification Already Run

- Focused unit tests after P1 fix: 6 files passed, 51 tests passed.
- Earlier `npx tsc --noEmit`: pass.
- Earlier `npm run lint`: pass with pre-existing warnings outside this slice.
- `git diff --check` on tracked in-scope files: pass before P1 fix; rerun before commit if committing from this exact state.

## Explicitly Not Run

- Raw `npm run build`, per owner instruction.
- Monitored clean build. Use `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10` later for Push protocol.

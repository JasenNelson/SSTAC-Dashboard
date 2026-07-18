# Matrix Options Default Policy QA Handoff - 2026-05-26

Status: CHECKPOINT after default-policy audit summary, review shortcuts, calculator cross-link, push, and focused browser QA.

## Live State

- Repo: `C:\Projects\SSTAC-Dashboard`
- Branch: `main`
- Pushed tip: `d64f1e8 Link calculator default policy candidates`
- Previous commits in this slice:
  - `06a102d Add default policy audit summary`
  - `de5a82c Add default policy review shortcuts`
- Expected tracked diff after this checkpoint: `CLAUDE.md` only, from prior-session workflow guidance. Keep it separate unless owner explicitly approves including it.
- Preserve existing untracked Matrix Map, Matrix Options handoff, `.mcp.json`, ETL, coverage, and QA artifact files.

## What Landed

- `src/components/matrix-options/EvidenceLibrary.tsx`
  - Added a read-only `DEFAULT POLICY AUDIT` panel in References & Values.
  - Added runtime-only shortcut filters for default-policy dispositions.
  - Candidate shortcut sets the Values by Parameter view and active filter chip without catalog mutation.
- `src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx`
  - Added coverage for the audit summary and runtime shortcut behavior.
- `src/components/matrix-options/CalculatorValueSearchPanel.tsx`
  - Added a read-only `Review candidate defaults` command in the calculator Value Search panel.
  - The command opens References & Values for the current pathway, substance, regulatory frame, and candidate input keys.
  - It preserves the full parameter-group context instead of filtering away current defaults.
- `src/components/matrix-options/__tests__/CalculatorValueSearchPanel.test.tsx`
  - Added coverage for the calculator-side shortcut request.

No catalog defaults, QA states, source statuses, source locators, owner approval workflow, or HITL promotion flow were implemented.

## Gates Run

- Commit protocol: targeted plus holistic review GREEN for both commits.
- Push protocol after `d64f1e8`: `npm run lint`, `npm run test:unit`, `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`, and `npm run test:e2e` all GREEN.
- Browser QA: local Chromium probe against `/matrix-options` GREEN after waiting for client hydration before tab clicks.
- Browser QA after `d64f1e8`: local Chromium probe verified Calculator -> Human Health Food -> `Review candidate defaults` opens References & Values with the expected candidate input filter, no promotion language, no console/page errors, and no desktop overflow.

Known environment note: sandboxed process spawn can fail with `spawn EPERM`; rerun narrow Vitest/browser probes with escalation before treating that as an app failure.

## QA Evidence

- `.tmp/matrix-options-default-policy-qa-report.json`
- `.tmp/matrix-options-default-policy-desktop.png`
- `.tmp/matrix-options-default-policy-candidate-shortcut-desktop.png`
- `.tmp/matrix-options-default-policy-mobile.png`
- `.tmp/matrix-options-default-policy-mobile-audit-visible.png`
- `.tmp/matrix-options-debug-report.json`
- `.tmp/matrix-options-debug-before-click.png`
- `.tmp/matrix-options-debug-after-click.png`
- `.tmp/matrix-options-calculator-default-candidate-shortcut-qa-report.json`
- `.tmp/matrix-options-calculator-default-candidate-shortcut-before.png`
- `.tmp/matrix-options-calculator-default-candidate-shortcut-after.png`

Browser QA notes:

- Desktop audit panel and candidate shortcut state render cleanly.
- Mobile audit panel stacks without horizontal overflow.
- Probe recorded zero console errors and zero page errors.
- The first failed probe was a test timing issue: it clicked the SSR tab before client hydration. Waiting for hydration resolved it.
- The calculator shortcut probe also waits for hydration before tab clicks.

## Stop Conditions

Stop and rebuild context before further edits if any of these happen:

- `git status --short --branch` shows tracked changes other than `CLAUDE.md` plus explicitly approved files.
- The pushed tip is no longer `d64f1e8` or a newer owner-approved Matrix Options commit.
- Another active session has touched `src/components/matrix-options/EvidenceLibrary.tsx`, `src/components/MatrixDashboard.tsx`, or the reference catalog.
- The next slice requires catalog mutation, default promotion, QA promotion, source locator mutation, or owner/HITL promotion workflow implementation.

## Recommended Next Slice

Recommended: continue read-only discoverability by adding one of these small projection-only improvements:

- Add a calculator-provenance receipt link that opens the same candidate default review context.
- Add a compact `candidate defaults` saved review view in References & Values.
- Add a focused e2e spec for `/matrix-options` References & Values and calculator shortcut smoke coverage.

Do not implement:

- Default promotion.
- QA promotion.
- Catalog mutation.
- Source-file storage.
- Owner/HITL approval workflow.

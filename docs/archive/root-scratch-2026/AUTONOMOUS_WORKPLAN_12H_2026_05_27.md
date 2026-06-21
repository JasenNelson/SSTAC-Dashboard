# SSTAC-Dashboard 12-Hour Autonomous Workplan
# 2026-05-27 ~10:30 PM PDT start, ~10:30 AM PDT end

**Status:** v5 EXECUTING -- 15 codex findings across 4 rounds, all addressed
**Author:** Claude Opus session (owner J. Nelson asleep)
**Base commit:** bedb3ef (3 commits ahead of origin/main a0e328c)
**Gate Mode:** Active per docs/GATE_MODE_SOP.md

---

## Autonomous Boundaries (from approved N+1..N+4 workplan)

### AI CAN (without owner):
- Write tests for existing behavior
- Profile and fix CI timeout issues
- Add read-only UI projections (no catalog state change)
- Harden types and dependency resilience
- Polish existing UX: empty states, loading states, error states
- Polish existing UX copy ONLY when it does NOT change regulatory meaning
- Eliminate `any` types in existing code
- Split large components into smaller ones (pure refactor, no behavior change)
- Add ARIA labels and keyboard navigation improvements

### AI CANNOT (requires owner):
- Promote any value to calculator default
- Change QA or canonical-source status
- Mutate catalog JSON (parameter_values, sources, etc.)
- Implement owner/HITL approval workflows
- Add source-file storage to the repo
- Design new interactive workflows (map panels)
- Change Protocol 28 from blocked to calculator-ready
- Close or supersede Jules PRs
- Invent new triage status semantics
- Change product copy that carries regulatory meaning
- Security changes that affect authentication flows or RLS policies

---

## Phase 0: Finish N+3 (COMPLETE)

- [x] e2e/ssd-workbench.spec.ts -- 4 tests, codex GREEN
- [x] ECOTOX UX polish -- onboarding callout + status dot, codex GREEN
- [x] Recharts type audit -- tickFormatter + labelFormatter hardened, codex GREEN
- [x] Full 4-gate suite GREEN (lint, 2206 unit, build, 135 e2e)
- [ ] Push blocked by auto-mode classifier. Do NOT retry push autonomously. Owner must approve.

---

## Phase 1: `any` Type Elimination -- Precheck-First (~3 hours)

**Source:** ROADMAP.md Phase 1 / UPGRADE_PLAN Task 1.4
**Why:** `any` types are silent runtime risks; TypeScript strict mode target

### 1A: Fresh precheck (30min)
- Use the Grep tool (NOT shell grep; codex P2 round 2: Windows grep fails with Win32 error 5)
- Search `src/` for `\bany\b` in .ts/.tsx files, excluding __tests__, *.test.*, *.spec.*, and node_modules (codex P2 R4: co-located test files inflate the ranking)
- Tally actual `any` counts by directory/file
- Codex P2 round 2 confirmed: matrix-options components/lib/API paths have NO real `any` hits
- Target the top 5 files by ACTUAL `any` density wherever they are in src/

### 1B: Eliminate `any` in highest-density files (2.5h)
- Work through the top 5 files from the precheck
- Create proper interfaces or narrow types for each `any` replacement
- TYPE-ONLY changes; NO runtime behavior changes; NO Zod/validation schemas
- One commit for the entire type elimination batch

### Gate: Targeted codex review + lint + unit + build

---

## Phase 2: Test Coverage Expansion -- Precheck-First (~3 hours)

**Source:** ROADMAP.md Phase 3 / Session N+4 scope
**Why:** Coverage gaps exist; precheck prevents duplicate test writing

### 2A: Coverage precheck (30min)
- Run `npm run test:coverage` to identify ACTUAL branch coverage gaps
- Codex P3 round 1 confirmed: hcp.ts, export.ts, upload.ts already have tests
- Target files with <50% branch coverage or zero tests
- Prioritize: API route unhappy paths, provenance resolver branches, uncovered utility edge cases

### 2B: Targeted test gap fill (2h)
- Write tests ONLY for verified gaps from 2A
- Focus on: error states, edge cases, unhappy paths
- Do NOT duplicate existing test coverage
- One commit for the test batch

### 2C: One additional e2e (30min, optional)
- Add one more e2e test if Playwright is stable
- Defer entirely if EPERM or instability detected

### Gate: Targeted codex review + full 4-gate before push

---

## Phase 3: UX Polish (~2.5 hours)

**Source:** Session N+3 scope + ROADMAP.md Phase 5
**Why:** Read-only UI projections, empty states, loading indicators

### 3A: Empty state + error state improvements (1.5h)
- Audit matrix-options tabs for missing empty states
- Add "No results" messages to filter states that produce zero results
- Add user-friendly error messages for network failures in SSD Workbench and Evidence Library
- Ensure no credential values are ever shown in error states
- All copy must be non-regulatory informational text

### 3B: Accessibility quick wins (1h)
- Add missing aria-label attributes on icon-only buttons
- Verify focus management on tab switches
- Check color contrast on status badges
- One commit for all UX + a11y changes

### Gate: Targeted codex review + full 4-gate before push

---

## Phase 4: Session Wrap-up (~1 hour)

### 4A: Final holistic codex review
- Run holistic review across all session commits
- Address any P1/P2 findings with targeted fix loops
- Iterate to mutual agreement GREEN

### 4B: Documentation
- Update MATRIX_OPTIONS_SESSION_HANDOFF with commits, gate results, codex trail
- Record any lessons learned
- Note what to tackle next for owner's return

### 4C: Safe exit
- PREFLIGHT: capture baseline PIDs at session start (codex P2 R4): `Get-Process node, chrome, firefox -ErrorAction SilentlyContinue | Select Id`
- At exit, check for orphaned processes from THIS session's gate runs (codex P2 R3+R4: this repo orphans Node/Chrome/Firefox, not Python; Playwright's chromium = chrome.exe on Windows):
  ```
  Get-Process node, chrome, firefox -ErrorAction SilentlyContinue
  ```
- Compare against pre-session baseline PIDs; only flag processes started DURING this session
- Report clean exit or flag stale processes for owner with PIDs

---

## Commit Cadence (3 commits, 1 push)

| Commit | Phase | Content |
|--------|-------|---------|
| 1 | Phase 1 | `any` type elimination batch |
| 2 | Phase 2 | Test coverage gap fill batch |
| 3 | Phase 3 | UX polish + accessibility batch |

Each commit gets targeted codex review before staging.
Push: NO autonomous push this session. Auto-mode classifier already blocked once; all commits stay local. Owner pushes on return (codex P1 R3+R4: do not retry blocked push).
If Playwright EPERM after retry: STOP and handoff (no push without e2e).
If gates get slow or context pressure builds: stop with handoff.
Holistic review fixups: if Phase 4 holistic review surfaces P1/P2, one bounded fixup commit (commit 4) is allowed + amend is allowed on commits 1-3. This does not open unlimited commit scope.

---

## Time Budget

| Phase | Hours | Cumulative | Notes |
|-------|-------|------------|-------|
| 0. N+3 (COMPLETE) | 0.0 | 0.0 | Push pending classifier |
| 1. Type elimination (precheck first) | 3.0 | 3.0 | Fresh grep -> top 5 files -> type-only |
| 2. Test coverage (precheck first) | 3.0 | 6.0 | Coverage report -> verified gaps only |
| 3. UX polish + a11y | 2.5 | 8.5 | Empty/error states + ARIA |
| 4. Wrap-up + holistic | 1.0 | 9.5 | Holistic codex + handoff |
| Gate overhead + buffer | 2.5 | 12.0 | Codex reviews + gate runs |

---

## Stop Conditions

- Unexpected tracked diffs (parallel session conflict)
- Package-manager drift
- CLAUDE.md entanglement with implementation
- Playwright EPERM after one cleanup attempt -> STOP, do NOT push (codex P1)
- Any task requiring default promotion, QA promotion, or catalog mutation
- Any UX text that could be read as a regulatory determination
- Context pressure or autocompaction risk (checkpoint + handoff)
- Two gate failures in one protocol run
- Process safety: >3 orphaned processes detected

---

## Risk Mitigations

| Risk | Mitigation |
|------|------------|
| Type changes breaking runtime | Lint + unit + build gates catch regressions; type-only changes have zero runtime effect |
| Targeting stale files | Precheck-first discipline in Phases 1+2; verify gap before writing |
| New tests duplicating coverage | Coverage report precheck; verify gap before writing |
| UX copy drifting into regulatory | Codex review explicitly checks for regulatory language |
| Playwright EPERM | One retry max, then STOP and handoff (codex P1: no waiver authority when owner asleep) |
| Context pressure | Checkpoint before multi-agent spawns; handoff if autocompact detected |
| Parallel session conflict | git status + .tmp_* mtime check before each phase |

---

## Codex Review Trail

### Workplan round 1 (holistic): RED
- [P1] FIXED: Stop on e2e failure, do not push without e2e
- [P2] FIXED: Rebaseline stale any targets with fresh precheck
- [P2] FIXED: Remove Zod/validation from type-only hardening
- [P2] FIXED: Reduce commit/push volume (7-10 -> 3 commits, 1 push)
- [P3] FIXED: Coverage precheck before writing tests

### Workplan round 2 (targeted re-review): findings below
- [P2] FIXED: Replace grep pipeline with Grep tool (Windows-safe)
- [P2] FIXED: Merged Phases 1+4 into single precheck-first type phase
- [P2] FIXED: Commit cadence now explicitly 3 commits + 1 push (table format)

### Workplan round 3 (targeted re-review of v3):
- [P1] FIXED: Push blocker is now a hard stop; no autonomous retry or bypass
- [P2] FIXED: Holistic review fixups get bounded commit 4 / amend path
- [P2] FIXED: Safe exit checks node/playwright/chromium/firefox, not python

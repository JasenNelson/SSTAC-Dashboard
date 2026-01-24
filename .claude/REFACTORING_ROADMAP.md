# PollResultsClient Refactoring - Visual Roadmap

## Project Overview

```
GOAL: Reduce 1,898-line god component to maintainable subcomponents
TIMELINE: 12-18 hours across 2-3 sessions (6 phases)
GRADE IMPACT: A- (85-89%) → A (90%+)
APPROACH: Incremental, test-first, skill-integrated
```

---

## Phase Roadmap

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION & INSTRUMENTATION (PREP)                        │
│ Setup testing infrastructure, linting, baseline metrics              │
│ Effort: 1-2 hours | Risk: NONE | Grade Impact: +0                   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: EXTRACT DATA FETCHING LAYER                                │
│ Create: usePollData.ts hook                                          │
│ Reduce: 1,898 → 1,698 lines (~200 line reduction)                   │
│ Effort: 2-3 hours | Risk: LOW | Grade Impact: +0.5                  │
│                                                                      │
│ ✓ Write tests first (usePollData.test.ts)                           │
│ ✓ Extract fetchPollResults and related state                        │
│ ✓ Lint, type-check, test, verify                                    │
│ ✓ Run /update-docs to capture pattern                               │
│ ✓ Commit: "refactor: extract data fetching into usePollData hook"  │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: EXTRACT RESULTS DISPLAY LOGIC                              │
│ Create: ResultsDisplay.tsx component                                │
│ Reduce: 1,698 → 1,200 lines (~500 line reduction)                   │
│ Effort: 3-4 hours | Risk: LOW | Grade Impact: +0.5                  │
│                                                                      │
│ ✓ Write tests first (ResultsDisplay.test.tsx)                       │
│ ✓ Extract all rendering JSX and render functions                    │
│ ✓ Lint, type-check, test, verify                                    │
│ ✓ Run /update-docs to capture pattern                               │
│ ✓ Commit: "refactor: extract results display component"             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 4: EXTRACT CHART RENDERING                                    │
│ Create: ChartRenderer.tsx component                                 │
│ Reduce: 1,200 → 800 lines (~400 line reduction)                     │
│ Effort: 2-3 hours | Risk: LOW | Grade Impact: +0.5                  │
│                                                                      │
│ ✓ Write tests first (ChartRenderer.test.tsx)                        │
│ ✓ Extract matrix graph and wordcloud rendering                      │
│ ✓ Lint, type-check, test, verify                                    │
│ ✓ Run /update-docs to capture pattern                               │
│ ✓ Commit: "refactor: extract chart rendering component"             │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 5: EXTRACT STATE MANAGEMENT                                   │
│ Create: useResultsState.ts hook                                     │
│ Reduce: 800 → 700 lines (~100 line reduction)                       │
│ Effort: 2-3 hours | Risk: MEDIUM | Grade Impact: +0.5               │
│                                                                      │
│ ✓ Write tests first (useResultsState.test.ts)                       │
│ ✓ Extract all UI state variables into hook                          │
│ ✓ Lint, type-check, test, verify                                    │
│ ✓ Run /update-docs to capture pattern                               │
│ ✓ Commit: "refactor: extract UI state into useResultsState hook"   │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 6: FINAL INTEGRATION & VERIFICATION                           │
│ Verify all components work together, comprehensive testing           │
│ Effort: 2-3 hours | Risk: LOW | Grade Impact: +0                    │
│                                                                      │
│ ✓ Run full test suite (unit + E2E)                                  │
│ ✓ Verify TypeScript, linting, build                                 │
│ ✓ Check POLLING_GATE requirements                                   │
│ ✓ Manual testing of all features                                    │
│ ✓ Performance verification                                          │
│ ✓ Run /update-docs for final summary                                │
│ ✓ Commit: "refactor: complete PollResultsClient decomposition"      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ RESULT                                                              │
│ ✓ PollResultsClient: 1,898 → ~700 lines (63% reduction)            │
│ ✓ 6 new components/hooks created                                    │
│ ✓ 8+ test files added                                               │
│ ✓ 100% test passing, zero regressions                               │
│ ✓ Full TypeScript type safety                                       │
│ ✓ POLLING_GATE verified                                             │
│ ✓ Grade achievement: A- → A (90%+)                                  │
│ ✓ Patterns documented in LESSONS.md                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## How to Get Started

### Before Any Work Begins

```bash
# 1. Read the strategy documents
cat .claude/REFACTORING_STRATEGY.md      # Full strategy
cat .claude/REFACTORING_CHECKLIST.md     # Step-by-step
cat .claude/REFACTORING_SKILLS_GUIDE.md  # Skills integration

# 2. Create your working branch
git checkout -b refactor/poll-results-phase-1

# 3. Verify baseline (should all pass)
npm run test          # All tests pass
npm run lint          # No errors
npm run build         # Successful build

# 4. You're ready for Phase 1
```

### Phase 1 Checklist (30 minutes - 1 hour)

```bash
# Already in branch: refactor/poll-results-phase-1

npm run lint -- --fix src/app/(dashboard)/admin/poll-results/
npx tsc --noEmit src/app/(dashboard)/admin/poll-results/
npm run test

mkdir -p src/app/(dashboard)/admin/poll-results/__tests__
mkdir -p src/app/(dashboard)/admin/poll-results/hooks/__tests__
mkdir -p src/app/(dashboard)/admin/poll-results/components/__tests__

git add -A
git commit -m "test: setup test infrastructure for PollResults refactoring"
```

### Phase 2 Workflow (2-3 hours)

```bash
# Still in same branch, but now doing Phase 2 work

# Step 1: Write tests first
touch src/app/(dashboard)/admin/poll-results/hooks/__tests__/usePollData.test.ts
npm run test -- --watch usePollData.test.ts
# [Tests fail - that's expected]

# Step 2: Implement hook
# [Create src/app/(dashboard)/admin/poll-results/hooks/usePollData.ts]

# Step 3: Verify tests pass
npm run test -- usePollData.test.ts

# Step 4: Lint and type check
npm run lint -- --fix src/app/(dashboard)/admin/poll-results/
npx tsc --noEmit

# Step 5: Verify full suite still passes
npm run test
npm run build

# Step 6: Document what you learned
/update-docs
# [Answer the prompts - document data extraction pattern]

# Step 7: Commit
git add -A
git commit -m "refactor: extract data fetching into usePollData hook

- Moved poll data fetching from component to dedicated hook
- Extracted Supabase queries and data processing
- Added comprehensive unit tests
- Reduced PollResultsClient by ~200 lines

Related: POLLING_GATE - Component refactoring, no API changes
"

# Step 8: Verify gates still satisfied
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**

# Step 9: End session safely
/safe-exit
```

---

## Timeline Estimates

### Option A: Focused Weekend (12-15 hours total)

```
Friday Evening:
  Phase 1 (setup)           1-2 hours
  Phase 2 (data layer)      2-3 hours
  Total: 3-5 hours

Saturday:
  Phase 3 (display)         3-4 hours
  Phase 4 (charts)          2-3 hours
  Total: 5-7 hours

Sunday:
  Phase 5 (state)           2-3 hours
  Phase 6 (integration)     2-3 hours
  Total: 4-6 hours

TOTAL: 12-18 hours ✓ All phases complete
```

### Option B: Spread Over Weeks (2-3 sessions)

```
Session 1:
  Phase 1 (setup)           1-2 hours
  Phase 2 (data layer)      2-3 hours
  Total: 3-5 hours

Session 2:
  Phase 3 (display)         3-4 hours
  Phase 4 (charts)          2-3 hours
  Total: 5-7 hours

Session 3:
  Phase 5 (state)           2-3 hours
  Phase 6 (integration)     2-3 hours
  Total: 4-6 hours

TOTAL: 12-18 hours ✓ All phases complete
```

---

## Success Looks Like

### At End of Phase 2
```
✓ npm run test             All passing
✓ npm run lint             No errors
✓ npm run build            Successful
✓ Lines: 1,898 → 1,698     200 line reduction visible
✓ usePollData hook created and tested
✓ /update-docs entry created
✓ Commit made, tests passing
```

### At End of Phase 3
```
✓ npm run test             All passing (no regressions)
✓ npm run test:e2e         Poll results E2E pass
✓ npm run lint             No errors
✓ npm run build            Successful
✓ Lines: 1,698 → 1,200     500 line reduction total
✓ ResultsDisplay component created and tested
✓ /update-docs entry created
✓ Commit made, tests passing
```

### At End of Phase 6
```
✓ npm run test             All 142+ tests passing
✓ npm run test:e2e         All E2E tests pass
✓ npm run lint             No errors, no warnings
✓ npm run build            Successful
✓ npm run docs:gate        POLLING_GATE verified
✓ Lines: 1,898 → ~700      63% total reduction
✓ 4 new components/hooks created
✓ 8+ test files added
✓ Performance: no degradation
✓ All features working
✓ /update-docs final entry created
✓ Grade achievement: A- → A (90%+)
```

---

## Critical Resources

### Primary Documents
- **Full Strategy:** `.claude/REFACTORING_STRATEGY.md` (complete plan)
- **Checklist:** `.claude/REFACTORING_CHECKLIST.md` (step-by-step tasks)
- **Skills Guide:** `.claude/REFACTORING_SKILLS_GUIDE.md` (skill usage)
- **This Roadmap:** `.claude/REFACTORING_ROADMAP.md` (visual overview)

### Project Documentation
- **Poll System Guide:** `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md`
- **Gate Requirements:** `docs/INDEX.md` (POLLING_GATE section)
- **Safe Practices:** `docs/poll-system/SAFE_POLL_UPDATE_PROTOCOL.md`

### Commands Cheat Sheet
```bash
# Quality checks (run frequently)
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run lint -- --fix     # Auto-fix linting
npx tsc --noEmit          # Type check
npm run build             # Full build

# Gate verification (before commits)
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**

# Skills
/update-docs              # Document patterns/lessons
/safe-exit                # Verify system health
```

---

## Key Principles

```
🎯 PRINCIPLE 1: Write Tests First
   - Tests define behavior before implementation
   - Tests ensure no regressions
   - Tests make extraction confidence high

🎯 PRINCIPLE 2: Extract Small, Focused Pieces
   - Each extraction should be <300 lines
   - One responsibility per component/hook
   - Easy to test, understand, debug

🎯 PRINCIPLE 3: Verify After Each Change
   - npm run test (after each extraction)
   - npm run lint (after each extraction)
   - npm run build (before each commit)

🎯 PRINCIPLE 4: Document What You Learn
   - /update-docs after each phase
   - Capture patterns for future use
   - Build knowledge base for team

🎯 PRINCIPLE 5: Keep POLLING_GATE Satisfied
   - Refactoring doesn't change APIs
   - No breaking changes to poll system
   - All requirements remain satisfied
```

---

## Risk Mitigation

```
RISK                          MITIGATION
─────────────────────────────────────────────────────────────
Regression in functionality   Comprehensive tests before/after
Breaking existing features    Small, focused extractions
Type safety issues           TypeScript strict mode + checks
Performance degradation      Performance testing in Phase 6
Missing gate requirements    Verify gates before each commit
Unsure where to start       Follow REFACTORING_CHECKLIST.md
```

---

## Next Steps Right Now

### 1. Read (10 minutes)
- This document (you're reading it!)
- REFACTORING_STRATEGY.md sections for relevant phases

### 2. Plan (5 minutes)
- Which phase will you start with?
- How much time do you have?
- Which session/day are you available?

### 3. Setup (10 minutes)
```bash
git checkout -b refactor/poll-results-phase-1
# OR if continuing:
git checkout refactor/poll-results-phase-X
```

### 4. Verify (5 minutes)
```bash
npm run test
npm run lint
npm run build
```

### 5. Follow Checklist (2-3 hours per phase)
- Open REFACTORING_CHECKLIST.md
- Follow step-by-step for your chosen phase

### 6. Use Skills
- After each phase: `/update-docs`
- After session ends: `/safe-exit`

### 7. Commit & Verify
- Create focused commits
- Run gate verification
- Tests all passing

---

## Expected Outcome

**Starting State:**
- PollResultsClient.tsx: 1,898 lines (god component)
- Tests: Moderate coverage
- Grade: A- (85-89%)

**Ending State:**
- PollResultsClient.tsx: ~700 lines (orchestrator component)
- usePollData.ts: Data fetching hook
- useResultsState.ts: UI state management hook
- ResultsDisplay.tsx: Results rendering component
- ChartRenderer.tsx: Chart rendering component
- Tests: 8+ new test files, 100% passing
- Grade: A (90%+)

**Benefits:**
- ✓ Easier to understand (smaller pieces)
- ✓ Easier to test (isolated concerns)
- ✓ Easier to maintain (focused responsibilities)
- ✓ Easier to reuse (extracted components/hooks)
- ✓ Easier to modify (changes isolated to one place)

---

## Questions?

**If stuck on a step:**
1. Re-read the relevant checklist section
2. Check the skills guide for command usage
3. Look at git diff to see what changed
4. Run tests to identify which is failing
5. Check types/lint for error messages

**If conceptually confused:**
1. Read REFACTORING_STRATEGY.md Phase section
2. Look at existing extracted components (QRCodeModal, FilterSidebar)
3. Run `/update-docs` to document your confusion (patterns help)

---

**Created:** January 24, 2026
**Status:** Ready to begin
**Total Time to Complete:** 12-18 hours (6 phases)
**Grade Impact:** A- (85-89%) → A (90%+)
**Framework:** Test-first, incremental, skill-integrated, gate-verified

### ⚡ You're Ready to Start! Begin with REFACTORING_CHECKLIST.md Phase 1.

# PollResultsClient Refactoring - Quick Reference Checklist

## Before Starting Any Phase

**Prerequisites:**
```
□ Read: docs/review-analysis/archive/POLL_SAFE_IMPROVEMENTS.md
□ Read: POLLING_GATE requirements in docs/INDEX.md
□ Read: docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md
□ Pull: Latest main branch
□ Verify: npm run test (all passing)
□ Verify: npm run lint (no errors)
□ Verify: npm run build (no errors)
```

**Setup:**
```
□ Create branch: git checkout -b refactor/poll-results-phase-X
□ Review: .claude/REFACTORING_STRATEGY.md (full strategy)
□ Plan: Which phase will I work on?
□ Estimate: How long do I have?
```

---

## Phase-by-Phase Checklist

### Phase 1: Foundation & Instrumentation

**Status: PREP (before any extraction)**

```
□ Run baseline linting
  npm run lint -- --fix src/app/(dashboard)/admin/poll-results/

□ Run baseline type check
  npx tsc --noEmit src/app/(dashboard)/admin/poll-results/

□ Run baseline tests
  npm run test

□ Create test structure
  mkdir -p src/app/(dashboard)/admin/poll-results/__tests__
  mkdir -p src/app/(dashboard)/admin/poll-results/hooks/__tests__
  mkdir -p src/app/(dashboard)/admin/poll-results/components/__tests__

□ Document current state
  - State variables count: ___
  - Functions count: ___
  - Total lines: 1,898

□ Commit infrastructure
  git add -A
  git commit -m "test: setup test infrastructure for PollResults refactoring"
```

---

### Phase 2: Extract Data Fetching Layer

**Target: usePollData.ts hook**
**Expected Reduction: ~200 lines (1,898 → 1,698)**

#### Step 1: Plan & Understand
```
□ Read: Current fetchPollResults logic (lines 64-180 approximately)
□ Understand: State initialization for poll data
□ Map: All state variables related to data fetching
□ Review: Error handling patterns
```

#### Step 2: Create Tests FIRST
```
□ Create: hooks/__tests__/usePollData.test.ts
□ Write tests for:
  - Fetching all three poll types
  - Combining poll results
  - Error handling
  - Loading states
  - Matrix data processing
□ Verify tests fail (TDD approach)
```

#### Step 3: Extract Component
```
□ Create: hooks/usePollData.ts
□ Extract: fetchPollResults function
□ Extract: Initial state setup
□ Create: Hook function returning data and methods
□ Verify: All imports included
```

#### Step 4: Update PollResultsClient
```
□ Import: const { ... } = usePollData();
□ Replace: Inline state declarations with hook
□ Remove: Supabase client creation from component
□ Remove: fetchPollResults function from component
□ Update: useEffect to use hook's fetchPollResults
```

#### Step 5: Lint & Type Check
```
□ npm run lint -- --fix src/app/(dashboard)/admin/poll-results/
□ npx tsc --noEmit
□ Fix: Any errors found
```

#### Step 6: Test & Verify
```
□ npm run test -- usePollData.test.ts (new tests pass)
□ npm run test (all tests pass, no regressions)
□ npm run test:e2e -- poll-results (manual E2E pass)
□ npm run build (no errors)
```

#### Step 7: Document Changes
```
□ Run: /update-docs
□ Document: Data fetching extraction pattern
□ Record: Lessons learned about hooks
□ Update: Session facts
```

#### Step 8: Commit
```
□ git add src/app/(dashboard)/admin/poll-results/hooks/
□ git add src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx
□ git commit -m "refactor: extract data fetching into usePollData hook

- Moved poll data fetching from component to dedicated hook
- Extracted Supabase queries and data processing
- Added comprehensive unit tests
- Reduced PollResultsClient by ~200 lines
- No functional changes, fully backward compatible

Related: POLLING_GATE - Component refactoring, no API changes
"
```

**Verification:**
```
□ File size: should be ~200 lines smaller
□ Tests: All passing (unit + E2E)
□ Types: No errors
□ Lint: No warnings
□ Gate: POLLING_GATE still satisfied
```

---

### Phase 3: Extract Results Display Logic

**Target: ResultsDisplay.tsx component**
**Expected Reduction: ~400-500 lines (1,698 → 1,200)**

```
□ Step 1: Plan & Understand
  - Review: All JSX rendering code
  - Map: All rendering functions
  - Define: Component interface

□ Step 2: Create Tests FIRST
  - Create: components/__tests__/ResultsDisplay.test.tsx
  - Test: Rendering with different props
  - Test: User interactions (expand/collapse)
  - Test: Filtering logic

□ Step 3: Extract Component
  - Create: components/ResultsDisplay.tsx
  - Move: All JSX rendering
  - Move: Related render functions
  - Define: Props interface

□ Step 4: Update PollResultsClient
  - Add: <ResultsDisplay {...props} />
  - Remove: Rendering code
  - Verify: All callbacks wired correctly

□ Step 5: Lint & Type Check
  - npm run lint -- --fix
  - npx tsc --noEmit

□ Step 6: Test & Verify
  - npm run test -- ResultsDisplay.test.ts
  - npm run test (all passing)
  - npm run build (no errors)

□ Step 7: Document Changes
  - /update-docs

□ Step 8: Commit
  - git add src/app/(dashboard)/admin/poll-results/components/ResultsDisplay.tsx
  - git add src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx
  - git commit -m "refactor: extract results display into ResultsDisplay component

  - Moved all results rendering logic to separate component
  - Extracted render functions and JSX
  - Added comprehensive tests
  - Reduced PollResultsClient by ~400 lines

  Related: POLLING_GATE - Display refactoring, no logic changes
  "

```

**Verification:**
```
□ File size: should be ~400-500 lines smaller total
□ Tests: All passing
□ Component: Renders correctly with different props
□ Interactions: All expand/collapse working
```

---

### Phase 4: Extract Chart Rendering

**Target: ChartRenderer.tsx component**
**Expected Reduction: ~300-400 lines (1,200 → 800)**

```
□ Step 1: Plan & Understand
  - Review: Chart rendering code
  - Map: Matrix graph logic
  - Map: WordCloud rendering

□ Step 2: Create Tests FIRST
  - Create: components/__tests__/ChartRenderer.test.tsx
  - Test: Chart visibility toggles
  - Test: Data rendering

□ Step 3: Extract Component
  - Create: components/ChartRenderer.tsx
  - Move: Chart rendering logic
  - Move: Chart state management

□ Step 4: Update PollResultsClient
  - Add: <ChartRenderer {...props} />
  - Remove: Chart rendering code

□ Step 5: Lint & Type Check
□ Step 6: Test & Verify
□ Step 7: Document Changes - /update-docs
□ Step 8: Commit
```

---

### Phase 5: Extract State Management

**Target: useResultsState.ts hook**
**Expected Reduction: ~100 lines (800 → 700)**

```
□ Step 1: Plan & Understand
  - Map: All UI state variables
  - Map: All state setters

□ Step 2: Create Tests FIRST
  - Create: hooks/__tests__/useResultsState.test.ts
  - Test: State updates
  - Test: Callbacks

□ Step 3: Extract Hook
  - Create: hooks/useResultsState.ts
  - Move: All state declarations
  - Create: Return object with all state

□ Step 4: Update PollResultsClient
  - Import: const state = useResultsState();
  - Replace: All state with hook state

□ Step 5: Lint & Type Check
□ Step 6: Test & Verify
□ Step 7: Document Changes - /update-docs
□ Step 8: Commit
```

---

### Phase 6: Final Integration & Verification

**Target: Verify everything works together**

```
□ Run Full Test Suite
  npm run test
  npm run test:e2e

□ Run Linting
  npm run lint

□ Run Build
  npm run build

□ Check Documentation Gates
  npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**

□ Performance Check
  - Measure render time (should be same or better)
  - No memory leaks
  - No performance regressions

□ Manual Testing
  - [ ] Load poll results page
  - [ ] Filter by TWG/CEW/All
  - [ ] Expand/collapse polls
  - [ ] View QR code modal
  - [ ] Export poll results
  - [ ] View matrix graphs
  - [ ] All interactions work smoothly

□ Final Documentation
  - /update-docs
  - Document: Complete refactoring approach
  - Document: Lessons learned
  - Update: ARCHITECTURE.md if needed

□ Final Commit
  git commit -m "refactor: complete PollResultsClient decomposition

  [commit message as in REFACTORING_STRATEGY.md]
  "

□ Verify Grade Impact
  - Tests passing: ✓
  - No regressions: ✓
  - Type safe: ✓
  - Lint clean: ✓
  - Lines reduced: 1,898 → ~700
  - Expected grade: A- → A (90%+)
```

---

## During Session - Keep This Visible

```
GOLDEN RULES:
✓ Write tests FIRST, then code
✓ Extract small, focused pieces
✓ Test after each extraction
✓ Lint and type-check after each change
✓ Commit frequently with clear messages
✓ Use /update-docs to capture patterns
✓ Verify POLLING_GATE requirements
✓ No breaking changes to existing APIs
```

**If You Get Stuck:**
1. Run full test suite - where do tests fail?
2. Check TypeScript errors - what types are wrong?
3. Review the component structure - did you miss a dependency?
4. Look at extracted component props - are they all passed?
5. Ask: "Can I test this component in isolation?"

**Quick Commands:**
```bash
# Check everything is working
npm run test && npm run lint && npm run build

# Just test the refactored component
npm run test -- PollResults

# Type check just this directory
npx tsc --noEmit src/app/(dashboard)/admin/poll-results/

# See what changed
git diff HEAD~1

# Run gate check
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**
```

---

## Success = All These Are True

- [ ] All 6 phases complete
- [ ] Test suite: ✓ All passing (no regressions)
- [ ] TypeScript: ✓ No errors
- [ ] ESLint: ✓ No warnings
- [ ] Build: ✓ Successful
- [ ] POLLING_GATE: ✓ All requirements met
- [ ] Performance: ✓ No degradation
- [ ] Functionality: ✓ All features working
- [ ] Documentation: ✓ Lessons captured
- [ ] Grade: ✓ A (90%+) achieved

---

## Skills to Use Throughout

1. **`/update-docs`** - After each phase
   - Captures extraction patterns
   - Documents lessons learned
   - Updates manifest facts

2. **`/safe-exit`** - End of session
   - Verify system health
   - Check for temp files
   - Ensure clean state

3. **Standard Commands:**
   - `npm run test` - Verify tests pass
   - `npm run lint -- --fix` - Auto-fix lint issues
   - `npx tsc --noEmit` - Type check
   - `npm run build` - Full build test
   - `npm run docs:gate` - Verify gate requirements

---

## Template for Next Session

```markdown
# Refactoring Session: Phase [X]

**Date:** YYYY-MM-DD
**Goal:** [Phase goal]
**Phase:** Phase [X] - [Name]
**Time Available:** [X hours]

**Starting Point:**
- [ ] Branch: refactor/poll-results-phase-X
- [ ] Latest code pulled
- [ ] All tests passing

**Work Completed:**
[List what was done]

**Blockers:**
[Any issues encountered]

**Tests Added:**
- [Test file names]

**Components/Hooks Created:**
- [File names]

**Lines Reduced:**
- Before: XXX lines
- After: XXX lines
- Reduction: XXX lines

**Lessons Documented:**
- [Pattern discovered]

**Next Session:**
- [ ] Move to Phase [X+1]
- [ ] Focus on: [specific task]
```

---

**Created:** January 24, 2026
**Framework:** Safe incremental refactoring with comprehensive verification
**Total Estimated Time:** 12-18 hours across 2-3 sessions
**Expected Grade Impact:** +2-3 points (A- → A, 90%+)

# Safe Incremental Refactoring Strategy: PollResultsClient

**Objective:** Reduce PollResultsClient.tsx from ~1,898 lines to maintainable, well-tested subcomponents while maintaining A- grade (85-89%) and progressing toward A (90%+).

**Approach:** Incremental, bite-sized iterations with testing, linting, and documentation at each step.

---

## Phase Overview

| Phase | Scope | Estimated Effort | Risk | Grade Impact |
|-------|-------|------------------|------|--------------|
| 1: Foundation & Instrumentation | Add test structure, add linting | 1-2 hours | NONE | +0 (prep) |
| 2: Extract Data Fetching Layer | Create DataFetcher component/hook | 2-3 hours | LOW | +0.5 |
| 3: Extract Results Display | Extract ResultsCard component | 3-4 hours | LOW | +0.5 |
| 4: Extract Chart Rendering | Extract ChartRenderer component | 2-3 hours | LOW | +0.5 |
| 5: Extract State Management | Create ResultsState hook | 2-3 hours | MEDIUM | +0.5 |
| 6: Final Integration & Verification | Test integration, verify gates | 2-3 hours | LOW | +0.5 |
| **TOTAL** | Full refactoring | **12-18 hours** | **LOW** | **+2-3 points** |

---

## Iteration Structure

Each iteration follows this pattern:

```
Step 1: Plan & Understand
  - Read relevant sections of code
  - Identify extraction boundaries
  - Plan component props/interface

Step 2: Create Tests FIRST
  - Write unit tests for new component
  - Write integration tests
  - Establish baseline coverage

Step 3: Extract Component
  - Create new file/component
  - Move logic
  - Update imports

Step 4: Lint & Type Check
  - Run ESLint
  - Run TypeScript compiler
  - Fix any issues

Step 5: Test & Verify
  - Run unit tests
  - Run E2E tests for affected paths
  - Verify no regressions

Step 6: Document Changes
  - Update docstrings
  - Run /update-docs skill
  - Log lessons learned

Step 7: Commit
  - Create focused commit
  - Reference related gate requirements
  - Push to branch
```

---

## Detailed Phase Breakdown

### Phase 1: Foundation & Instrumentation ✓ (PREP)

**Goal:** Establish testing and linting framework

**Tasks:**

1. **Add ESLint Configuration** (if not already present)
   ```bash
   npm run lint -- --fix src/app/(dashboard)/admin/poll-results/
   ```
   - Check for any pre-existing issues
   - Document baseline

2. **Create Test Structure**
   - Create `__tests__` directory for PollResults
   - Set up test utilities and mocks
   - Document test patterns for team

3. **Run TypeScript Check**
   ```bash
   npx tsc --noEmit src/app/(dashboard)/admin/poll-results/
   ```
   - Establish baseline type safety
   - Fix any type errors

4. **Document Current State**
   - List all state variables and their purposes
   - Map component responsibilities
   - Identify extraction candidates

**Skills to Use:**
- None (foundational setup)

**Commits:**
- `test: setup test infrastructure for PollResults refactoring`

---

### Phase 2: Extract Data Fetching Layer

**Goal:** Separate data fetching concerns from rendering logic

**Extraction Target:** `usePollData.ts` hook

**What to Extract:**
```typescript
// From PollResultsClient.tsx, extract:
- fetchPollResults callback
- Supabase queries for all three poll types
- Data processing/transformation logic
- Loading and error states for data fetching
```

**New Hook Signature:**
```typescript
export function usePollData() {
  const [pollResults, setPollResults] = useState<PollResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);

  const fetchPollResults = useCallback(async () => { /* ... */ }, []);

  return { pollResults, matrixData, loading, error, fetchPollResults };
}
```

**Tasks:**

1. **Create Tests First** (`usePollData.test.ts`)
   ```typescript
   describe('usePollData', () => {
     it('should fetch and combine poll results from all three types', async () => {});
     it('should handle missing data gracefully', async () => {});
     it('should set loading state correctly', async () => {});
     it('should set error state on fetch failure', async () => {});
     it('should process and combine matrix data', async () => {});
   });
   ```

2. **Create Hook File** (`hooks/usePollData.ts`)
   - Extract fetchPollResults logic
   - Extract state initialization
   - Create hook function

3. **Update PollResultsClient**
   - Replace inline logic with: `const { pollResults, matrixData, loading, error, fetchPollResults } = usePollData();`
   - Remove Supabase client creation from main component

4. **Lint & Type Check**
   ```bash
   npm run lint -- --fix src/app/(dashboard)/admin/poll-results/
   npx tsc --noEmit
   ```

5. **Test**
   ```bash
   npm run test -- usePollData.test.ts
   npm run test:e2e -- poll-results
   ```

6. **Document**
   ```bash
   /update-docs
   # In skill: Document the data fetching extraction pattern
   ```

7. **Commit**
   ```bash
   git add src/app/(dashboard)/admin/poll-results/hooks/usePollData.ts
   git commit -m "refactor: extract data fetching logic into usePollData hook

   - Moved poll data fetching from PollResultsClient into dedicated hook
   - Improved separation of concerns: data vs rendering
   - Added unit tests for data fetching
   - Reduces PollResultsClient by ~200 lines

   Related: POLLING_GATE - No API changes, component refactoring only
   "
   ```

**Expected Line Count Reduction:** ~200 lines (1,898 → 1,698)

**Skills to Use:**
- None (standard refactoring)

---

### Phase 3: Extract Results Display Logic

**Goal:** Separate results rendering from state management

**Extraction Target:** `ResultsDisplay.tsx` component

**What to Extract:**
```typescript
// Results rendering logic:
- Poll group rendering
- Poll item rendering
- Vote count display
- Expansion/collapse logic for poll groups
- Question selection display
```

**New Component Signature:**
```typescript
interface ResultsDisplayProps {
  pollResults: PollResult[];
  selectedQuestion: string | null;
  onSelectQuestion: (question: string) => void;
  expandedPoll: string | null;
  onTogglePoll: (pollId: string) => void;
  expandedGroup: string | null;
  onToggleGroup: (groupName: string) => void;
  filterMode: 'all' | 'twg' | 'cew';
}

export function ResultsDisplay(props: ResultsDisplayProps) {
  // Rendering logic
}
```

**Tasks:**

1. **Create Tests First** (`components/__tests__/ResultsDisplay.test.tsx`)
   ```typescript
   describe('ResultsDisplay', () => {
     it('should render poll groups', () => {});
     it('should toggle poll expansion', () => {});
     it('should display selected question', () => {});
     it('should filter by mode (all/twg/cew)', () => {});
     it('should call callbacks on interaction', () => {});
   });
   ```

2. **Create Component** (`components/ResultsDisplay.tsx`)
   - Extract all JSX rendering for results
   - Extract related render functions
   - Keep props minimal and clear

3. **Update PollResultsClient**
   - Replace JSX with: `<ResultsDisplay {...props} />`
   - Keep state management in parent

4. **Lint & Type Check**

5. **Test**

6. **Document via /update-docs**

7. **Commit**

**Expected Line Count Reduction:** ~400-500 lines (1,698 → 1,200)

**Skills to Use:**
- None (standard extraction)

---

### Phase 4: Extract Chart Rendering

**Goal:** Isolate chart rendering logic from main component

**Extraction Target:** `ChartRenderer.tsx` component

**What to Extract:**
```typescript
// Chart-related rendering:
- Matrix graph display logic
- WordCloud rendering
- Chart styling and configuration
- Chart-specific state (show/hide toggles)
```

**New Component Signature:**
```typescript
interface ChartRendererProps {
  matrixData: MatrixData[];
  showMatrixGraphs: {[key: string]: boolean};
  onToggleMatrix: (key: string) => void;
  pollResults: PollResult[];
  filterMode: 'all' | 'twg' | 'cew';
}

export function ChartRenderer(props: ChartRendererProps) {
  // Chart rendering logic
}
```

**Tasks:**

1. **Create Tests First**
2. **Create Component**
3. **Update PollResultsClient**
4. **Lint & Type Check**
5. **Test**
6. **Document**
7. **Commit**

**Expected Line Count Reduction:** ~300-400 lines (1,200 → 800)

**Skills to Use:**
- None

---

### Phase 5: Extract State Management

**Goal:** Consolidate UI state management

**Extraction Target:** `useResultsState.ts` hook

**What to Extract:**
```typescript
// UI State management:
- expandedPoll
- expandedGroup
- selectedQuestion
- filterMode
- leftPanelVisible
- qrCodeExpanded
- expandedPollGroup
- showMatrixGraphs
- showPresentationControls
- lastRefresh
```

**New Hook Signature:**
```typescript
export function useResultsState() {
  const [filterMode, setFilterMode] = useState<'all' | 'twg' | 'cew'>('all');
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  // ... other state

  return {
    filterMode, setFilterMode,
    expandedPoll, setExpandedPoll,
    // ... other state setters
  };
}
```

**Tasks:**

1. **Create Tests First** - Test state updates and callbacks
2. **Create Hook**
3. **Update PollResultsClient** - Use hook instead of inline state
4. **Lint & Type Check**
5. **Test**
6. **Document**
7. **Commit**

**Expected Line Count Reduction:** ~100 lines (800 → 700)

**Skills to Use:**
- None

---

### Phase 6: Final Integration & Verification

**Goal:** Verify all components work together, run full test suite, verify gates

**Tasks:**

1. **Run Full Test Suite**
   ```bash
   npm run test
   npm run test:e2e
   npm run lint
   ```

2. **Verify TypeScript**
   ```bash
   npm run build
   ```

3. **Check Documentation Gates**
   ```bash
   npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**
   ```

4. **Performance Check**
   - Measure render time before/after
   - Ensure no performance regressions

5. **Manual Testing**
   - Test all poll filtering modes
   - Test QR code modal
   - Test export functionality
   - Test matrix graphs

6. **Update Documentation**
   - Run `/update-docs` final time
   - Document entire refactoring
   - Document lessons learned

7. **Final Commit**
   ```bash
   git commit -m "refactor: complete PollResultsClient decomposition

   - Extracted data fetching into usePollData hook
   - Extracted results display into ResultsDisplay component
   - Extracted chart rendering into ChartRenderer component
   - Extracted UI state into useResultsState hook
   - Reduced file from 1,898 to ~700 lines
   - All tests passing, no regressions
   - Full TypeScript type safety

   Grade impact: +2-3 points (A- to A)
   Related: POLLING_GATE - Comprehensive refactoring, full test coverage
   "
   ```

**Skills to Use:**
- `/update-docs` - Capture final refactoring lesson

---

## Supporting Tasks & Skills

### 1. **Linting at Each Step**

```bash
# After each extraction
npm run lint -- --fix src/app/(dashboard)/admin/poll-results/

# Specific checks
npx eslint src/app/(dashboard)/admin/poll-results/ --max-warnings=0
```

### 2. **TypeScript Type Safety**

```bash
# After each change
npx tsc --noEmit src/app/(dashboard)/admin/poll-results/

# Check for unused variables/imports
npx tsc --listUnusedLocals --noEmit
```

### 3. **Testing Strategy**

**Unit Tests** (for each component/hook):
- Props validation
- State updates
- Callbacks
- Error handling
- Edge cases

**Integration Tests** (for refactored PollResultsClient):
- Data flows through hooks to components correctly
- All interactions still work
- Performance acceptable

**E2E Tests** (existing test suite):
- Poll filtering still works
- Export functionality still works
- QR code modal still works
- Matrix graphs still work

### 4. **Gate Compliance**

Since this touches `src/app/(dashboard)/admin/poll-results/**`, the **POLLING_GATE** applies.

**Required Verification:**
```bash
# Run gate check
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**

# This requires all POLLING_GATE sections to exist in docs
# They do: POLL_SYSTEM_COMPLETE_GUIDE.md, SAFE_POLL_UPDATE_PROTOCOL.md, etc.
```

### 5. **Documentation via /update-docs Skill**

At the end of each phase, use the `/update-docs` skill to:
- Document the extraction approach
- Record any patterns discovered
- Update LESSONS.md with reusable patterns
- Update manifest facts with progress

**Example lesson to capture:**
```
## 2026-01-24 - Incremental Component Extraction Pattern

**Date:** January 24, 2026
**Area:** Component Refactoring
**Impact:** MEDIUM (enables 200+ line reductions)
**Status:** Implemented

### Problem
Large components (1,000+ lines) become hard to maintain, test, and reason about.

### Pattern
Extract in order:
1. Data layer (hooks) - cleanest separation
2. Display logic (components) - simplest tests
3. State management (hooks) - consolidates logic
4. Integrate & verify

### Key Takeaway
Extract from "leaf" concerns outward; leaves are easiest to test and reason about.
```

### 6. **Using Claude Skills**

**Applicable Skills:**

- **`/update-docs`** (Created this session!)
  - Use after each phase to document patterns
  - Capture lessons learned
  - Update manifest facts with refactoring progress

- **`/safe-exit`** (mentioned in documentation)
  - Use before ending session to verify system health
  - Ensure no temp files, clean state

- **`/commit`** (if available)
  - Create focused commits at each phase
  - Ensure commit messages are clear and gate-compliant

- **Future: Code generation/analysis skills**
  - Could help generate test boilerplate
  - Could help identify extraction opportunities
  - Could help with TypeScript type inference

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Regression in functionality | Comprehensive test coverage before & after |
| Performance degradation | Performance testing at phase 6 |
| Type safety issues | TypeScript strict mode, type checking at each step |
| Breaking changes | Incremental, reversible extractions |
| Gate requirements missed | Check POLLING_GATE docs before starting |
| Breaking existing tests | Run full test suite after each phase |

---

## Success Criteria

- [x] Phase 1: Test infrastructure in place
- [ ] Phase 2: usePollData hook extracted and tested
- [ ] Phase 3: ResultsDisplay component extracted and tested
- [ ] Phase 4: ChartRenderer component extracted and tested
- [ ] Phase 5: useResultsState hook extracted and tested
- [ ] Phase 6: Full integration verified

**Final State:**
- ✓ PollResultsClient.tsx reduced from 1,898 to ~700 lines
- ✓ All tests passing (unit, integration, E2E)
- ✓ No TypeScript errors
- ✓ No ESLint violations
- ✓ POLLING_GATE requirements satisfied
- ✓ Grade impact: +2-3 points (A- → A)
- ✓ All lessons documented in LESSONS.md

---

## Session Planning Template

**For Next Session:**

```markdown
## Refactoring Session: Phase [X]

**Goal:** [Phase goal]
**Estimated Time:** [X-Y hours]
**Phase:** Phase [X] - [Name]

**Before Starting:**
- [ ] Read POLLING_GATE requirements
- [ ] Review POLL_SYSTEM_COMPLETE_GUIDE.md
- [ ] Pull latest main branch
- [ ] Run: npm run test (baseline)
- [ ] Run: npm run lint (baseline)

**During Session:**
- [ ] Create tests first (step 2)
- [ ] Extract component (step 3)
- [ ] Lint & type check (step 4)
- [ ] Test & verify (step 5)
- [ ] Document (step 6)
- [ ] Commit (step 7)

**After Session:**
- [ ] Run /update-docs to capture lessons
- [ ] Verify all tests passing
- [ ] Verify gate requirements still met
- [ ] Document any blockers

**Deliverable:** Focused commit, new tests, new component, reduced lines
```

---

## Next Steps

1. **Start Phase 1 when ready** - Establish testing and linting infrastructure
2. **Use `/update-docs` at each phase** - Capture patterns and lessons
3. **Reference POLLING_GATE** - Ensure all requirements remain satisfied
4. **Target completion in 2-3 sessions** - 12-18 hours total effort
5. **Expected result** - A grade (90%+) achievement

---

**Created:** January 24, 2026
**Purpose:** Safe, incremental refactoring with comprehensive testing and documentation
**Framework:** Skill-informed approach with /update-docs integration

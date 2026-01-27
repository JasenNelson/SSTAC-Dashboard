# Claude Skills Integration for Safe Refactoring

This guide explains which Claude skills to use throughout the refactoring process and how to use them effectively.

---

## Overview: Skills Map

| Skill | When to Use | Purpose | Expected Output |
|-------|-----------|---------|-----------------|
| `/update-docs` | End of each phase | Document patterns & lessons | LESSONS.md entry |
| `/safe-exit` | End of session | Verify system health | Clean state verification |
| ESLint/TypeScript | After each change | Code quality | Lint/type errors fixed |
| Git/Test suite | After each change | Verify integrity | Green test results |

---

## Skill 1: `/update-docs` (Primary Integration)

### When to Use

After completing each of these phases:
- Phase 2: Data fetching extraction ✓
- Phase 3: Results display extraction ✓
- Phase 4: Chart rendering extraction ✓
- Phase 5: State management extraction ✓
- Phase 6: Final integration & verification ✓

### How to Use

**After Phase 2 Complete:**

```
/update-docs

# In the skill prompt:
```

**Session Summary:**
- Completed Phase 2: Extracted usePollData hook
- Reduced PollResultsClient from 1,898 to 1,698 lines (~200 line reduction)
- All tests passing, no regressions

**Work Done:**
- Created usePollData hook (hooks/usePollData.ts)
- Moved all data fetching logic from component to hook
- Added comprehensive unit tests
- Updated PollResultsClient to use hook

**Lessons to Capture:**
- **Pattern: Data Layer Extraction**
  - Problem: Component mixing data fetching with rendering
  - Solution: Extract fetch logic into dedicated hook
  - File References: hooks/usePollData.ts
  - Key Takeaway: Data hooks should handle all data concerns; component only coordinates
  - Applies To: Any large component with data fetching

**Manifest Updates:**
- Progress: Phase 2/6 complete (33%)
- Refactoring approach: Incremental hook/component extraction
- Tests added: usePollData.test.ts

**Documentation Updates:**
- docs/ARCHITECTURE.md: Add "Component Extraction Pattern" section
- docs/LESSONS.md: Add data layer extraction lesson
```

### What It Captures

The `/update-docs` skill will:
1. ✓ Create entry in docs/LESSONS.md with the pattern
2. ✓ Update docs/_meta/docs-manifest.json facts section with progress
3. ✓ Register the lesson with proper metadata
4. ✓ Update session tracking in NEXT_STEPS.md
5. ✓ Validate all documentation consistency

### Benefits

- **Knowledge Retention:** Patterns documented for future reference
- **Progress Tracking:** Each phase's work is recorded
- **Grade Visibility:** Manifest facts show refactoring progress
- **Team Onboarding:** Lessons help future developers understand approach

---

## Skill 2: `/safe-exit` (Session Cleanup)

### When to Use

**At the end of each work session**, before exiting Claude:

```
/safe-exit
```

### What It Checks

1. ✓ System memory pressure
2. ✓ Claude temp directory size
3. ✓ Database lock state
4. ✓ Task output file count
5. ✓ Python/Node processes

### Why It Matters

- Ensures you don't exit with hanging processes
- Prevents post-exit crashes
- Validates system health
- Logs diagnostic information

### Expected Output

```
SAFE TO EXIT

System Health:
- Memory: 45% used (OK)
- Claude temp: 127 MB (OK)
- Task files: 12 (OK)
- Database: UNLOCKED (OK)
- Processes: 0 (OK)

You can now run /exit
```

---

## Skill 3: Standard CLI Commands (Built-in)

These are NOT Claude skills but are essential to the process:

### `npm run lint -- --fix`

**When:** After each extraction
**Purpose:** Fix linting issues automatically

```bash
npm run lint -- --fix src/app/(dashboard)/admin/poll-results/
```

**Expected Output:**
```
✓ No errors found
✓ 2 warnings fixed
```

### `npx tsc --noEmit`

**When:** After TypeScript changes
**Purpose:** Type check without generating files

```bash
npx tsc --noEmit src/app/(dashboard)/admin/poll-results/
```

**Expected Output:**
```
✓ No errors
```

### `npm run test`

**When:** After each extraction (verify baseline)
**Purpose:** Run full test suite

```bash
npm run test

# OR run specific test:
npm run test -- usePollData.test.ts
```

**Expected Output:**
```
✓ 142 tests passing
✓ 0 tests failing
✓ Coverage: 85%+
```

### `npm run test:e2e -- poll-results`

**When:** After each major extraction
**Purpose:** Verify end-to-end functionality

```bash
npm run test:e2e -- poll-results
```

**Expected Output:**
```
✓ E2E tests for poll-results passed
```

### `npm run build`

**When:** Final verification before commit
**Purpose:** Full production build check

```bash
npm run build
```

**Expected Output:**
```
✓ Build successful
✓ No errors
```

### `npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**`

**When:** Before final commit
**Purpose:** Verify documentation gates still satisfied

```bash
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**
```

**Expected Output:**
```
✓ POLLING_GATE requirements verified
✓ All required sections present
✓ Gate passed
```

---

## Integration Workflow: Phase-by-Phase

### Phase 2: Data Fetching Extraction

```
1. Create tests
   npm run test -- --watch usePollData.test.ts
   [Tests fail - expected]

2. Implement hook
   [Code usePollData.ts]

3. Verify quality
   npm run lint -- --fix
   npx tsc --noEmit
   npm run test -- usePollData.test.ts

4. Full verification
   npm run test
   npm run build

5. Document pattern
   /update-docs
   [Capture data extraction pattern]

6. Commit
   git commit -m "..."

7. Check gates
   npm run docs:gate -- --files ...

8. Session end
   /safe-exit
```

### Phase 3: Results Display Extraction

```
[Same workflow as Phase 2]

1. Create tests for ResultsDisplay
2. Implement ResultsDisplay component
3. Verify: lint, types, tests
4. Full verification: test, build
5. Document: /update-docs
6. Commit
7. Check gates
8. Session end: /safe-exit
```

### Phases 4-5

```
[Same workflow repeats]
```

### Phase 6: Final Integration

```
1. Full test suite
   npm run test
   npm run test:e2e

2. Full lint & type check
   npm run lint
   npx tsc --noEmit

3. Full build
   npm run build

4. Gate verification
   npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**

5. Manual testing
   [Test all features in browser]

6. Final documentation
   /update-docs
   [Document complete refactoring]

7. Final commit
   git commit -m "refactor: complete PollResultsClient decomposition"

8. Session end
   /safe-exit
```

---

## Using `/update-docs` Effectively

### Template: After Each Phase

```
/update-docs

WORK COMPLETED THIS PHASE:
- Extracted [component/hook name]
- Added [X] tests
- Reduced [component] by [Y] lines
- All tests passing, no regressions

LESSONS TO CAPTURE:
- [Pattern Name]: [One sentence description]
  Files: [relevant file paths]
  Applies to: [what this generalizes to]

GRADE PROGRESS:
- Lines reduced: 1,898 → [new count]
- Tests added: [count]
- Type safety: [assessment]
- Phase: [X]/6 complete

NEXT PHASE:
- Will extract: [what]
- Expected reduction: [lines]
- Key focus: [area]
```

### Template: Final Documentation (Phase 6)

```
/update-docs

SESSION SUMMARY:
Completed full refactoring of PollResultsClient.tsx

PHASES COMPLETED:
- Phase 2: usePollData extraction
- Phase 3: ResultsDisplay extraction
- Phase 4: ChartRenderer extraction
- Phase 5: useResultsState extraction

FINAL METRICS:
- Lines: 1,898 → ~700 (63% reduction)
- Components created: 2 (ResultsDisplay, ChartRenderer)
- Hooks created: 2 (usePollData, useResultsState)
- Tests added: 8 test files
- Coverage: 85%+ maintained
- Regressions: 0

PATTERNS DOCUMENTED:
1. Data Layer Extraction
2. Display Component Extraction
3. Chart Rendering Isolation
4. UI State Consolidation

GRADE IMPACT:
- Component quality: +2-3 points
- Test coverage: +0.5 points
- Code organization: +0.5 points
- Estimated total: +3 points (A- → A)

KEY LEARNINGS:
[Use LESSONS.md format]

ARCHITECTURE UPDATES:
- Updated docs/ARCHITECTURE.md with extraction pattern
- Added component hierarchy diagram
- Documented dependency flow

RECOMMENDATIONS FOR NEXT WORK:
- Consider similar extraction for [other large component]
- Pattern proved effective: can be replicated
- Test-first approach eliminated regressions
```

---

## Avoiding Common Mistakes

### ❌ Don't: Extract Before Testing

```bash
# WRONG - Extract first, then write tests
# This leads to hard-to-test code

# RIGHT - Write tests first
npm run test -- --watch new-component.test.ts
# [Watch fails] -> Code component -> Tests pass
```

### ❌ Don't: Skip Linting Between Changes

```bash
# WRONG - Code for hours, lint once at end
# Many issues pile up

# RIGHT - Lint frequently
npm run lint -- --fix [file]  # After each extraction
```

### ❌ Don't: Ignore TypeScript Errors

```bash
# WRONG - Code with 'any' types
const data: any = fetchPollResults();

# RIGHT - Use proper types
const data: PollResult[] = fetchPollResults();
```

### ❌ Don't: Skip Gate Verification

```bash
# WRONG - Commit without checking gates
git commit -m "..."

# RIGHT - Verify gates before commit
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**
```

### ❌ Don't: Extract Too Large Pieces

```bash
# WRONG - Extract 500+ lines in one go
# Hard to test, hard to verify

# RIGHT - Extract 100-200 lines at a time
# Easier to test, easier to verify, easier to debug
```

### ✓ DO: Use `/update-docs` to Capture Patterns

This is your chance to document what you learn so future work benefits from it.

---

## Quick Reference: Skill Usage During Refactoring

```
START OF SESSION:
✓ Pull latest code
✓ Review REFACTORING_STRATEGY.md
✓ Choose which phase to work on

DURING PHASE:
✓ Write tests first
✓ Extract component/hook
✓ npm run lint -- --fix
✓ npx tsc --noEmit
✓ npm run test

AFTER PHASE:
✓ npm run build
✓ /update-docs [capture pattern]
✓ git commit

BETWEEN PHASES:
✓ npm run test:e2e (spot check)
✓ npm run docs:gate (verify gates)

END OF SESSION:
✓ /update-docs [final summary]
✓ /safe-exit [verify system health]
✓ git status [verify all committed]
```

---

## Success Metrics

**You know you're doing it right when:**

- ✓ Tests pass after each extraction
- ✓ No lint warnings
- ✓ Build succeeds
- ✓ Gate verification passes
- ✓ Each commit is small and focused
- ✓ `/update-docs` captures a pattern each time
- ✓ No regressions in E2E tests
- ✓ `/safe-exit` shows clean state

**You might have a problem if:**

- ✗ Tests are failing
- ✗ TypeScript has errors
- ✗ Lint has warnings
- ✗ Build fails
- ✗ Gates fail
- ✗ E2E tests regress
- ✗ Cannot write focused commits
- ✗ Unsure what pattern you learned

---

## Next Steps

1. **Before First Phase:**
   - Read REFACTORING_STRATEGY.md (full picture)
   - Read REFACTORING_CHECKLIST.md (step-by-step)
   - Set up branch and testing

2. **During Each Phase:**
   - Follow checklist step-by-step
   - Use CLI commands to verify quality
   - Use `/update-docs` to capture patterns

3. **End of Session:**
   - Final `/update-docs` with summary
   - `/safe-exit` to verify clean state
   - Commit all work

4. **Next Session:**
   - Continue with next phase
   - Reference previous `/update-docs` entries
   - Build on documented patterns

---

**Created:** January 24, 2026
**Purpose:** Guide skill usage throughout safe, incremental refactoring
**Integration:** `/update-docs` skill captures patterns; standard CLI verifies quality; `/safe-exit` ensures clean state

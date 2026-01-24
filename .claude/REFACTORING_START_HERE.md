# 🚀 START HERE: Safe Incremental Refactoring Plan

## Executive Summary

A comprehensive, safe, incremental refactoring strategy for PollResultsClient.tsx has been created and is ready for implementation.

**Key Metrics:**
- **Timeline:** 12-18 hours across 2-3 sessions
- **Phases:** 6 phases (foundation → integration)
- **Code Reduction:** 1,898 → ~700 lines (63% reduction)
- **Grade Impact:** A- (85-89%) → A (90%+)
- **Risk Level:** LOW (test-first approach with verification at each step)

---

## What's Ready for You

Four comprehensive planning documents in `.claude/`:

### 1. **REFACTORING_ROADMAP.md** ← START HERE FIRST
Visual overview with:
- Phase roadmap (ASCII art diagram)
- Quick start guide (5-step process)
- Timeline options (weekend vs spread over weeks)
- Success criteria at each phase
- **Read this first (15 minutes) to understand the full picture**

### 2. **REFACTORING_CHECKLIST.md**
Step-by-step checklists for each phase:
- Before starting any phase
- Tick boxes for progress tracking
- Pre-work verification checklist
- Quick commands reference
- **Use this during actual work (follow step-by-step)**

### 3. **REFACTORING_STRATEGY.md**
Detailed strategy document:
- Full 6-phase breakdown with code examples
- Test-first approach explained
- Expected line count reduction per phase
- Risk mitigation
- **Reference this for detailed understanding**

### 4. **REFACTORING_SKILLS_GUIDE.md**
Claude skill integration guide:
- When to use `/update-docs` (after each phase)
- How to capture patterns
- Integration with `/safe-exit` skill
- Common mistakes to avoid
- **Reference this for skill usage during work**

---

## The 6-Phase Plan at a Glance

```
Phase 1: Foundation & Instrumentation (PREP)
  ├─ Setup testing infrastructure
  ├─ Establish linting baselines
  └─ Duration: 1-2 hours

Phase 2: Extract Data Fetching → usePollData hook
  ├─ Write tests first
  ├─ Move Supabase queries to hook
  ├─ Reduce: 1,898 → 1,698 lines
  ├─ Grade: +0.5
  └─ Duration: 2-3 hours

Phase 3: Extract Display Logic → ResultsDisplay component
  ├─ Extract all JSX rendering
  ├─ Extract render functions
  ├─ Reduce: 1,698 → 1,200 lines
  ├─ Grade: +0.5
  └─ Duration: 3-4 hours

Phase 4: Extract Charts → ChartRenderer component
  ├─ Move matrix graph rendering
  ├─ Move wordcloud rendering
  ├─ Reduce: 1,200 → 800 lines
  ├─ Grade: +0.5
  └─ Duration: 2-3 hours

Phase 5: Extract State → useResultsState hook
  ├─ Consolidate UI state management
  ├─ Reduce: 800 → 700 lines
  ├─ Grade: +0.5
  └─ Duration: 2-3 hours

Phase 6: Final Integration & Verification
  ├─ Run full test suite
  ├─ Verify gates & performance
  ├─ Manual testing
  ├─ Grade: +0 (consolidation)
  └─ Duration: 2-3 hours

TOTAL: 12-18 hours | Grade Impact: +2-3 points | Risk: LOW
```

---

## How to Get Started Today

### Step 1: Read Overview (15 minutes)
```bash
cat .claude/REFACTORING_ROADMAP.md
```
This gives you the visual roadmap and quick start guide.

### Step 2: Choose Your Approach (5 minutes)
```
Option A: Focused weekend (12-15 hours total)
  Friday: Phase 1 + Phase 2
  Saturday: Phase 3 + Phase 4
  Sunday: Phase 5 + Phase 6

Option B: Spread over weeks (2-3 sessions)
  Session 1: Phase 1 + Phase 2
  Session 2: Phase 3 + Phase 4
  Session 3: Phase 5 + Phase 6
```

### Step 3: Plan Your First Phase (5 minutes)
When will you start? What phase will you do first?
- Recommended: Start with Phase 1 (setup) + Phase 2 (data extraction)
- Estimated time for Phase 1-2: 3-5 hours

### Step 4: Setup Your Branch (5 minutes)
```bash
git checkout -b refactor/poll-results-phase-1

# Verify baseline
npm run test      # All passing?
npm run lint      # No errors?
npm run build     # Successful?
```

### Step 5: Follow Checklist During Work (2-3 hours)
```bash
cat .claude/REFACTORING_CHECKLIST.md
# Follow Phase 1 checklist step-by-step
```

### Step 6: Use Skills at Each Phase
- After Phase 2: `/update-docs` to capture data extraction pattern
- After Phase 3: `/update-docs` to capture display extraction pattern
- ... repeat for phases 4-5
- After Phase 6: `/update-docs` final summary + `/safe-exit`

### Step 7: Commit & Verify
```bash
npm run test              # All passing?
npm run lint              # No warnings?
npm run build             # Successful?
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**
git commit -m "refactor: extract [component/hook name]"
```

---

## Key Principles

### 🎯 TEST FIRST
Write tests **before** extracting code. This ensures:
- Behavior is well-defined
- Extraction is safer
- No regressions

### 🎯 SMALL ITERATIONS
Extract ~100-200 lines at a time. This ensures:
- Easy to test
- Easy to understand
- Easy to debug if something goes wrong

### 🎯 VERIFY CONSTANTLY
After each extraction: lint, type-check, test, build
- Catches issues immediately
- Maintains confidence
- Makes commits small and focused

### 🎯 DOCUMENT PATTERNS
Use `/update-docs` after each phase:
- Captures extraction patterns
- Builds knowledge base
- Helps future work

### 🎯 RESPECT GATES
POLLING_GATE applies because this is poll system code:
- No breaking API changes
- All requirements stay satisfied
- Verify gates before commits

---

## What Makes This Approach Safe

✓ **Test-First**
  Tests define behavior; extraction follows tests. Zero regression risk.

✓ **Incremental**
  Small pieces with full testing. Not all-at-once big bang.

✓ **Verified**
  Lint, type-check, test, build, gate-check after each step.

✓ **Documented**
  Clear checklists, step-by-step guidance, skill integration.

✓ **Reversible**
  If something goes wrong, just revert the last commit.

---

## Success Metrics

**You'll know it's working when:**
- ✓ Tests pass after each extraction
- ✓ Lint shows no warnings
- ✓ Build succeeds
- ✓ Line count visibly decreases
- ✓ `/update-docs` captures patterns
- ✓ Commits are small and focused
- ✓ POLLING_GATE verification passes
- ✓ No E2E test regressions

---

## Expected Final Result

**Before Refactoring:**
```
src/app/(dashboard)/admin/poll-results/
├── PollResultsClient.tsx (1,898 lines - god component)
├── components/
│   ├── QRCodeModal.tsx (extracted)
│   └── FilterSidebar.tsx (extracted)
├── hooks/
│   └── usePollExport.ts (extracted)
└── types.ts
```

**After Refactoring:**
```
src/app/(dashboard)/admin/poll-results/
├── PollResultsClient.tsx (~700 lines - orchestrator)
├── components/
│   ├── QRCodeModal.tsx (extracted)
│   ├── FilterSidebar.tsx (extracted)
│   ├── ResultsDisplay.tsx (NEW - rendering)
│   └── ChartRenderer.tsx (NEW - charts)
├── hooks/
│   ├── usePollExport.ts (extracted)
│   ├── usePollData.ts (NEW - data fetching)
│   └── useResultsState.ts (NEW - UI state)
├── types.ts
└── __tests__/
    ├── usePollData.test.ts (NEW)
    ├── useResultsState.test.ts (NEW)
    ├── ResultsDisplay.test.tsx (NEW)
    ├── ChartRenderer.test.tsx (NEW)
    └── ... integration tests
```

**Results:**
- 63% code reduction (1,898 → ~700 lines)
- 4 new reusable components/hooks
- 8+ test files with 100% passing
- Full TypeScript type safety
- Grade: A- → A (90%+)

---

## Files Available Now

```
.claude/REFACTORING_START_HERE.md      ← This file
.claude/REFACTORING_ROADMAP.md         ← Read first
.claude/REFACTORING_CHECKLIST.md       ← Use during work
.claude/REFACTORING_STRATEGY.md        ← Detailed reference
.claude/REFACTORING_SKILLS_GUIDE.md    ← Skills reference
```

---

## Quick Commands Reference

```bash
# After each extraction
npm run lint -- --fix
npx tsc --noEmit
npm run test

# Before each commit
npm run build
npm run docs:gate -- --files src/app/(dashboard)/admin/poll-results/**

# Skills to use
/update-docs              # After each phase
/safe-exit                # End of session
```

---

## Next Step Right Now

1. Open: `.claude/REFACTORING_ROADMAP.md`
2. Read: "How to Get Started" section
3. Follow from there

You have all the guidance you need. The planning is complete.

**Time to Start:** Less than 1 hour to get through Phase 1 setup

---

## Support

If you get stuck:

1. **Check the checklist** - REFACTORING_CHECKLIST.md has exact steps
2. **Check the strategy** - REFACTORING_STRATEGY.md has detailed explanation
3. **Check the skills guide** - REFACTORING_SKILLS_GUIDE.md explains command usage
4. **Look at git diff** - `git diff` shows what changed
5. **Run tests** - `npm run test` shows which tests are failing
6. **Use `/update-docs`** - Document what you learned

---

**Created:** January 24, 2026
**Status:** READY TO BEGIN
**Commitment Level:** LOW - Each phase is self-contained and reversible
**Grade Impact:** HIGH - +2-3 points toward A grade

### 🎯 Begin with REFACTORING_ROADMAP.md

---

## Session Planning Template

For your next work session, use this template:

```markdown
# Refactoring Session: Phase [X]

**Date:** YYYY-MM-DD
**Goal:** [Phase goal]
**Phase:** Phase [X] - [Name]
**Time Available:** [X hours]

## Before Starting
- [ ] Branch checked out: refactor/poll-results-phase-X
- [ ] npm run test (baseline passing)
- [ ] npm run lint (baseline passing)
- [ ] npm run build (baseline successful)

## Work Completed
[List what was done]

## Metrics
- Lines before: XXX
- Lines after: XXX
- Tests added: XX
- Tests passing: YY/YY

## Lessons Documented
- Ran: /update-docs
- Pattern captured: [name]

## Next Session
- [ ] Start Phase [X+1]
- [ ] Focus on: [specific task]

## Blockers
[Any issues encountered]
```

Save this and use it for tracking progress across sessions!

---

You're ready. Begin whenever you're ready. 🚀

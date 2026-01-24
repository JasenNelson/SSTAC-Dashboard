# SSTAC-Dashboard Lessons Learned

**Document Purpose:** Capture reusable patterns, architectural decisions, and challenges discovered during development. These lessons apply beyond individual tasks and save time for future work.

**Quality Filter:** Only lessons that:
- Apply to future work in this project or similar projects
- Would save significant time if known earlier
- Represent patterns or architectural principles
- Involve multiple files or cross-system concerns

---

## 2026-01-24 - Native Modules in Serverless Environments [CRITICAL]

**Date:** January 24, 2026
**Area:** Deployment / Environment Compatibility
**Impact:** CRITICAL (blocked production deployment)
**Status:** Implemented & Validated
**Session:** Vercel deployment failure resolution

### Problem or Discovery

`better-sqlite3` native C++ module caused webpack compilation failure in Vercel's serverless environment. The module requires native compilation which is not possible in Vercel's build environment, but the application needed to support both local development (with SQLite) and serverless deployment (without SQLite).

### Root Cause or Context

Three cascading issues created the deployment failure:

1. **Webpack Static Analysis Issue**: Webpack statically analyzes all imports during build time, even if they're only used conditionally at runtime. When code directly imports `better-sqlite3`, webpack attempts to resolve and bundle the module.

2. **Native Module Incompatibility**: Vercel's serverless environment cannot compile native C++ modules because:
   - No C++ compiler available in build environment
   - No Python build tools available
   - No persistence between build steps for pre-compiled binaries

3. **Direct Imports in Routes**: Multiple API routes had direct imports at the module level:
   ```typescript
   // This causes webpack to try resolving better-sqlite3 even if it's never called
   import Database from 'better-sqlite3';
   ```

### Solution or Pattern

**Three-Pronged Approach for Multi-Environment Support:**

**1. Webpack Configuration (next.config.ts:12-18)**
```typescript
webpack: (config: any) => {
  // Mark better-sqlite3 as external to prevent webpack from trying to bundle it
  // This is a native module that only works in local development, not in serverless
  config.externals = config.externals || [];
  config.externals.push('better-sqlite3');
  return config;
}
```
This tells webpack: "Don't try to resolve or bundle this module; it's an external dependency."

**2. Lazy Loading in Core Client (src/lib/sqlite/client.ts:25-36)**
```typescript
let Database: any = undefined;

function loadDatabase() {
  if (Database === undefined) {
    try {
      // Only require at runtime when actually needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      Database = require('better-sqlite3');
    } catch {
      // better-sqlite3 not available (expected in serverless)
      Database = null;
    }
  }
  return Database;
}

export function getDatabase(): any {
  const DatabaseModule = loadDatabase();
  if (!DatabaseModule) {
    throw new Error(
      'SQLite database is not available in this environment. ' +
      'better-sqlite3 is required for local development only. ' +
      'This feature is not supported in serverless/Vercel deployments.'
    );
  }
  // ... rest of implementation
}
```
This delays module loading until runtime and gracefully handles missing modules.

**3. Conditional Imports in API Routes (e.g., src/app/api/regulatory-review/search/route.ts:14-19)**
```typescript
let Database: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Database = require('better-sqlite3');
} catch {
  // better-sqlite3 not available
}

export async function GET(request: NextRequest) {
  if (!Database) {
    return NextResponse.json(
      { error: 'Policy search is only available in local development' },
      { status: 503 }
    );
  }
  // ... rest of implementation
}
```
This prevents TypeScript from trying to statically analyze the import and returns a helpful error if called in serverless.

### File References

**Configuration Files:**
- `F:\sstac-dashboard\next.config.ts:12-18` - Webpack externals configuration
- `.claude/skills/update-docs/SKILL.md` - Documentation system for this project

**Core SQLite Client:**
- `F:\sstac-dashboard\src\lib\sqlite\client.ts:25-36` - Lazy loading implementation
- `F:\sstac-dashboard\src\lib\sqlite\client.ts:50-85` - Database initialization with error handling

**API Routes Using Pattern:**
- `F:\sstac-dashboard\src\app\api\regulatory-review\search\route.ts:14-19` - Policy search API
- `F:\sstac-dashboard\src\app\api\regulatory-review\submission-search\route.ts:14-19` - Submission search API

**Related Infrastructure (31 files added in this session):**
- Entire `src/lib/sqlite/` directory - Database utilities
- Entire `src/app/api/regulatory-review/` directory - API routes
- Entire `src/components/regulatory-review/` directory - UI components
- Entire `src/lib/regulatory-review/` directory - Utility functions

### Key Takeaway

**For any feature requiring native modules, use lazy loading + webpack externals to support both local development (with module) and serverless deployment (without module).**

This pattern allows gradual feature development in local environments without blocking production deployments. The feature works fully in local development while gracefully degrading in serverless environments.

### Related Patterns

- **Lazy Loading vs Direct Imports**: Direct imports force static analysis; lazy loading with try-catch allows runtime resolution
- **Webpack Externals**: Essential for any native module; prevents webpack from attempting resolution
- **Error Handling Strategy**: Return 503 Service Unavailable instead of failing the entire build; allows deployed application to function for other features

### Prevention Checklist

- [ ] For any native module dependency, mark it as external in webpack config
- [ ] Use lazy loading with try-catch for module imports
- [ ] Test locally with module installed
- [ ] Test production build without installing native modules (simulate serverless)
- [ ] Ensure API routes return helpful error messages instead of crashing
- [ ] Document which features require native modules and why

---

## 2026-01-24 - Incremental Component Extraction Pattern [MEDIUM]

**Date:** January 24, 2026
**Area:** Component Architecture / Refactoring
**Impact:** HIGH (enables 1500+ line reductions with 51 new tests)
**Status:** Completed Phases 2-5, Verified Phase 6
**Session:** PollResultsClient refactoring Phases 2-6 (6-part comprehensive refactoring)

### Problem or Discovery

Large monolithic components (1,000+ lines) become increasingly difficult to maintain, test, and reason about. Refactoring them all-at-once is risky and can introduce regressions. The challenge is how to decompose them safely while maintaining functionality and test coverage.

### Root Cause or Context

The PollResultsClient.tsx component had grown to 1,898 lines, mixing:
- Data fetching logic (Supabase queries)
- Data processing and combining
- UI state management
- Rendering and display logic
- Export functionality

This mix of concerns made it hard to:
- Test individual concerns in isolation
- Reuse data fetching logic in other components
- Modify rendering without affecting data layer
- Understand component flow

### Solution or Pattern

**Incremental Extraction Strategy (Test-First Approach):**

**Phase 1: Foundation & Instrumentation**
- Create test directory structure (`__tests__/`)
- Establish baseline (all tests passing)
- Document current component state (line count, responsibilities)

**Phase 2: Extract Data Fetching Layer**
1. **Write tests first** (`usePollData.test.ts`):
   - Test hook initialization
   - Test data fetching behavior
   - Test error handling
   - Test state updates

2. **Create hook** (`usePollData.ts`):
   - Move Supabase query logic
   - Move data processing functions
   - Extract state management for data
   - Return clean interface: `{ pollResults, loading, error, matrixData, fetchPollResults, setMatrixData }`

3. **Update component**:
   - Replace inline logic with hook
   - Remove Supabase client creation
   - Import and use hook

4. **Verify quality**:
   - `npm run lint -- --fix` (auto-fix issues)
   - `npx tsc --noEmit` (type check)
   - `npm run test` (all tests pass)
   - `npm run build` (production build succeeds)
   - `npm run docs:gate` (gate requirements satisfied)

5. **Document pattern**:
   - Use `/update-docs` to capture the extraction pattern
   - Update LESSONS.md with reusable insights
   - Update manifest facts with refactoring progress

6. **Commit**:
   - Focused commit with clear message
   - Include metrics in commit message (line reduction, test additions)
   - Reference gate requirements

**Phase 3: Extract Display Logic → `ResultsDisplay.tsx`**
1. Created 1,084-line component with all poll rendering logic (wordcloud, ranking, single-choice)
2. Added 23 new tests covering all poll types and rendering scenarios
3. Reduced PollResultsClient: 1,178 → 403 lines (775 line reduction, 66%)
4. Test suite: 148 → 171 tests (0 regressions)

**Phase 4: Extract Matrix Graphs → `MatrixGraphRenderer.tsx`**
1. Created 155-line component for prioritization and holistic matrix graph rendering
2. Added 10 new tests with 100% conditional coverage
3. Reduced ResultsDisplay: 1,084 → 902 lines (182 line reduction)
4. Test suite: 171 → 181 tests (0 regressions)

**Phase 5: Extract UI State → `useResultsState.ts`**
1. Created 50-line hook managing 11 UI state variables and toggle function
2. Added 12 new comprehensive tests covering all state transitions
3. Centralized state management, improved component clarity
4. Test suite: 181 → 193 tests (0 regressions)

**Phase 6: Final Integration & Verification**
- ✓ Full test suite: 193 tests passing (100%)
- ✓ TypeScript: 0 compilation errors
- ✓ Build: Production build successful
- ✓ Gates: POLLING_GATE verified PASS
- ✓ All quality checks passed

### File References

**Phase 2: Data Fetching Layer**
- Hook: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\usePollData.ts` (323 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\__tests__\usePollData.test.ts`
- Usage: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\PollResultsClient.tsx:12`

**Phase 3: Display Logic**
- Component: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\ResultsDisplay.tsx` (1,084 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\__tests__\ResultsDisplay.test.tsx` (433 lines, 31 tests)

**Phase 4: Matrix Graphs**
- Component: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\MatrixGraphRenderer.tsx` (155 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\components\__tests__\MatrixGraphRenderer.test.tsx` (263 lines, 10 tests)

**Phase 5: UI State Management**
- Hook: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\useResultsState.ts` (50 lines)
- Tests: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\hooks\__tests__\useResultsState.test.ts` (12 tests)
- Usage: `F:\sstac-dashboard\src\app\(dashboard)\admin\poll-results\PollResultsClient.tsx:14-32`

**Related Commits:**
- Phase 1: `90e7404` - test: setup test infrastructure
- Phase 2: `51f59e4` - refactor: extract data fetching into usePollData hook
- Phase 3: `5ca6a04` - refactor: extract poll results display logic into ResultsDisplay component
- Phase 4: `a9a2ada` - refactor: extract matrix graph rendering into MatrixGraphRenderer component
- Phase 5: `594cb68` - refactor: extract UI state management into useResultsState hook

**Test Progression:**
- Baseline: 142 tests (10 test files)
- After Phase 2: 148 tests (+6)
- After Phase 3: 171 tests (+23)
- After Phase 4: 181 tests (+10)
- After Phase 5: 193 tests (+12)

### Key Takeaway

**Incremental, test-first extraction of concerns into smaller, focused components/hooks is the safest way to refactor large monolithic components. Each phase should:**
- Write tests before extracting
- Extract 100-500 lines at a time
- Verify quality after each step
- Document patterns using `/update-docs`

This approach eliminates regression risk, maintains test coverage, and builds reusable patterns.

### Related Patterns

- **Test-First Development**: Writing tests before code ensures behavior is well-defined
- **Separation of Concerns**: Each extracted component/hook has single responsibility
- **Incremental Delivery**: Small focused commits are easier to review and revert if needed
- **Pattern Documentation**: Using `/update-docs` captures knowledge for future work

### Complete Metrics (Phases 2-5)

**Line Reduction Progress:**
- Baseline: 1,898 lines (PollResultsClient monolithic)
- After Phase 2: 1,178 lines (distributed) - 720 line reduction (38%)
- After Phase 3: 403 lines (PollResultsClient) - 775 line reduction (66%)
- After Phase 4: 902 lines (ResultsDisplay) - 182 line reduction in ResultsDisplay
- After Phase 5: 403 lines (PollResultsClient) - Improved clarity, state management centralized

**Final Component Architecture:**
- PollResultsClient: 403 lines (orchestration)
- ResultsDisplay: 902 lines (rendering)
- MatrixGraphRenderer: 155 lines (matrix graphs)
- usePollData: 323 lines (data fetching)
- useResultsState: 50 lines (UI state)
- Total: 1,833 lines distributed across focused files

**Test Coverage Expansion:**
- Baseline: 142 tests (10 files)
- Final: 193 tests (14 files, +51 new tests)
- Breakdown: Phase 2: +6, Phase 3: +23, Phase 4: +10, Phase 5: +12
- Health: 193/193 passing (100% pass rate, 0 regressions)

**Quality Assurance:**
- TypeScript: 0 compilation errors
- ESLint: 0 errors in new/modified files
- Build: Successful production build
- Gates: POLLING_GATE verified PASS
- Architecture: Clear separation of concerns
- Maintainability: Each component/hook has single responsibility

### Prevention Checklist

- [ ] Write tests BEFORE extracting code
- [ ] Extract ~100-500 lines per phase
- [ ] Run lint + type check + test after each extraction
- [ ] Verify full build succeeds
- [ ] Check gate requirements still satisfied
- [ ] Use `/update-docs` to capture pattern
- [ ] Create focused commit with metrics
- [ ] Continue with next phase only after validation

---

## Adding New Lessons

When adding lessons to this document:

1. **Use the template above** with all sections (Problem, Root Cause, Solution, File References, Key Takeaway)
2. **Include specific file paths with line numbers** for code examples
3. **Make it reusable** - would this help someone solving a similar problem?
4. **Focus on patterns** - not one-off fixes, but patterns that apply broadly
5. **Link to related files** - docs/NEXT_STEPS.md, docs/ARCHITECTURE.md, etc.

**To add a new lesson, use `/update-docs` skill at end of session.**

---

## Table of Contents

1. [2026-01-24 - Native Modules in Serverless Environments](#2026-01-24---native-modules-in-serverless-environments-critical) [CRITICAL]
2. [2026-01-24 - Incremental Component Extraction Pattern](#2026-01-24---incremental-component-extraction-pattern-high) [HIGH - Phases 2-5 Complete]

---

**Last Updated:** January 24, 2026 (Phases 2-5 Complete, Phase 6 Verified)
**Lesson Count:** 1 critical, 1 high (comprehensive 6-phase refactoring)
**Refactoring Status:** ✓ COMPLETE (Incremental extraction pattern proven and documented)
**Maintained By:** Claude Sessions with /update-docs skill

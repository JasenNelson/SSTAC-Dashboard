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

---

**Last Updated:** January 24, 2026
**Lesson Count:** 1 critical, 0 medium/low
**Maintained By:** Claude Sessions with /update-docs skill

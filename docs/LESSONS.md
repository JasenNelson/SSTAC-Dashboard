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

## 2026-01-24 - Python Gitignore Rules Interfering with JavaScript Projects [MEDIUM]

**Date:** January 24, 2026
**Area:** Git / DevOps Configuration
**Impact:** MEDIUM (caused Vercel build failure, required force-push to fix)
**Status:** Resolved
**Session:** TWGReviewClient Phase 2 refactoring deployment

### Problem or Discovery

Created 12 new component files in `src/app/(dashboard)/twg/review/parts/` directory. All files were present locally and built successfully. However, after pushing to remote, Vercel build failed with "Module not found" errors for all Part components. Investigation revealed the files were never committed to Git due to `.gitignore` rules.

**Root Cause:** The `.gitignore` file inherited Python packaging rules that ignored `/parts/` directories globally (line 64: `parts/`), originally intended for Python `setuptools` but applying to all `parts/` directories in the repo, including JavaScript component directories.

### Root Cause or Context

The `.gitignore` file at repository root contains comprehensive Python development exclusions copied from Python templates. One rule:

```
# Python Distribution / packaging
.Python
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib64/
parts/           # ← This line causes the issue
sdist/
```

This rule prevents Git from tracking ANY directory named `parts/` anywhere in the repo. When we created `src/app/(dashboard)/twg/review/parts/`, Git ignored all files in it automatically, but:

1. Local build succeeded (files existed on disk)
2. `git status` showed only new files outside the ignored `parts/` directory
3. `git add` silently skipped the ignored `parts/` directory
4. `git push` sent incomplete code to remote
5. Vercel build cloned incomplete code and failed on missing imports

The error was silent - Git didn't warn that files were being ignored; they just weren't staged.

### Solution or Pattern

**Three-step fix for language-template gitignore conflicts:**

**1. Add .gitignore exception for project-specific directories (before other rules)**

Edit `.gitignore` to add exceptions BEFORE the conflicting rule:

```gitignore
*.pem

# Exception for Next.js component parts directory
!src/app/**/parts/

# Log files
npm-debug.log*
```

The `!` prefix means "don't ignore these". Placement matters - exceptions must come before the rule they override.

**2. Force-add ignored files to staging**

```bash
git add -f src/app/(dashboard)/twg/review/parts/
```

The `-f` (force) flag stages files even if they're in `.gitignore`.

**3. Amend previous commit or create new commit**

```bash
# If commit not yet pushed:
git commit --amend --no-edit

# If already pushed, amend then force-push:
git push --force-with-lease
```

### File References

- `.gitignore` line 20-21: Added exception rule
- Commit: `2f42ae5` - Shows 12 Part components added after amendment
- Related files:
  - `src/app/(dashboard)/twg/review/parts/Part1ReviewerInformation.tsx` (and 11 others)
  - `src/app/(dashboard)/twg/review/components/TWGReviewFormContainer.tsx:4-15` (imports Part components)

### Key Takeaway

**When creating new directories in language-specific projects:**

1. **Check .gitignore for conflicting rules** - Search for your directory name in all .gitignore files
2. **Add exceptions for project-specific paths** - Use `!pattern/` to override global ignore rules
3. **Verify with `git status -u`** - Shows untracked files; empty means something is being ignored
4. **Force-add if needed** - Use `git add -f` to stage ignored files
5. **Test before pushing** - Build locally with `npm run build` to catch import errors

### Prevention Checklist

- [ ] Search .gitignore for any patterns matching your new directory names
- [ ] Add exceptions for new component directories at top of .gitignore
- [ ] After creating new files, run `git status` and verify they appear as untracked
- [ ] Run `git add .` and check status again - files should move to staged
- [ ] Run local build (`npm run build`) before pushing to catch import errors
- [ ] Test Vercel preview build - catches what CI will see
- [ ] Use `git diff --cached` to review all changes before committing

---

## 2026-01-25 - Multi-Layer Security Hardening Pattern [HIGH]

**Date:** January 25, 2026
**Area:** Security / API Protection
**Impact:** HIGH (fixes 3 critical vulnerabilities, adds 6 security headers)
**Status:** Implemented & Verified
**Session:** Phase 2 Security Hardening (Tasks 2.1-2.5)

### Problem or Discovery

Production applications face multiple independent security threats that require a coordinated defense strategy:
1. Authentication bypass vulnerabilities (localStorage fallbacks)
2. Unprotected public endpoints allowing unauthorized access
3. Missing security headers leaving application vulnerable to MIME sniffing, clickjacking, XSS
4. Rate limiting only working per-instance (not across distributed deployments)
5. Weak user ID generation allowing predictable identifiers
6. File uploads without validation enabling malicious file execution

A piecemeal approach fixing one vulnerability at a time leaves application exposed to others. Phase 2 demonstrated the value of a coordinated security hardening strategy.

### Root Cause or Context

Security vulnerabilities accumulate over time as features are added without comprehensive security review:

1. **Admin Bypass Issue**: Early implementation cached admin status in localStorage for performance. When database was slow or unavailable, fallback to localStorage allowed unauthenticated users to gain admin privileges by setting `localStorage.admin_status = true` in browser console.

2. **Public Endpoint Issue**: Announcements endpoint was initially public to allow all users to see notifications. However, without authentication, it exposed user data to external attackers.

3. **Missing Security Headers**: Headers like Content-Security-Policy, X-Frame-Options, and X-Content-Type-Options are not added by default by Next.js. Without them, browsers apply minimal protection, leaving application vulnerable to:
   - MIME sniffing attacks (content treated as wrong type)
   - Clickjacking (app loaded in invisible iframe and user tricked into clicking)
   - XSS attacks (inline scripts executed without restriction)

4. **Rate Limiting per Instance**: In-memory rate limiting only works on single server. In production with load balancing across multiple instances, each instance maintains separate rate limit counters. Attacker hitting different instances can exceed rate limits.

5. **Timestamp-based User IDs**: CEW polls generate user IDs using `${timestamp}_${Math.random()}`. Timestamp is predictable, Math.random() is not cryptographically secure. Attacker can guess valid user IDs and impersonate other voters.

6. **Unvalidated File Uploads**: File upload endpoint accepted any file type and size, enabling:
   - Malicious executable uploads
   - Server storage exhaustion (large file bombs)
   - Type confusion (upload executable with .pdf extension)

### Solution or Pattern

**Coordinated Multi-Layer Security Strategy (Defense in Depth):**

**1. Authentication & Authorization - Server-Side Only (src/lib/admin-utils.ts)**
```typescript
// REMOVE all localStorage fallbacks
// Admin status ALWAYS verified server-side
export async function isUserAdmin(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .single();

  const isAdmin = !!roleData;
  return isAdmin; // Always return server-verified result, never fallback
}
```

**Pattern:** Never trust client-side caches for security-sensitive data. Always verify server-side. Fail secure (return false) on any error.

**2. Protect Public Endpoints (src/app/api/announcements/route.ts)**
```typescript
export async function GET(request: NextRequest) {
  const supabase = await createAuthenticatedClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required' },
      { status: 401 }
    );
  }

  // Only authenticated users can see announcements
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  return NextResponse.json(announcements);
}
```

**Pattern:** Default to "require authentication". Only make endpoints truly public if explicitly required (and document why). Use explicit user auth check at start of route.

**3. Comprehensive Security Headers (src/middleware.ts)**

```typescript
// Content-Security-Policy: Restrict resource loading sources
response.headers.set(
  'Content-Security-Policy',
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; " +
  "font-src 'self' data:; " +
  "connect-src 'self' https://*.supabase.co"
)

// X-Content-Type-Options: Prevent MIME type sniffing
response.headers.set('X-Content-Type-Options', 'nosniff')

// X-Frame-Options: Prevent clickjacking
response.headers.set('X-Frame-Options', 'DENY')

// X-XSS-Protection: Enable browser XSS protection
response.headers.set('X-XSS-Protection', '1; mode=block')

// Referrer-Policy: Don't leak referrer info to third-party
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

// Permissions-Policy: Disable unnecessary browser features
response.headers.set(
  'Permissions-Policy',
  'geolocation=(), microphone=(), camera=(), payment=()'
)

// Strict-Transport-Security: Force HTTPS (production only)
if (process.env.NODE_ENV === 'production') {
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )
}
```

**Pattern:** Add security headers in middleware (applies to all responses). Set in middleware instead of individual routes for consistency.

**4. Distributed Rate Limiting (src/lib/rate-limit-redis.ts)**

```typescript
export async function checkRateLimitRedis(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const isRedisAvailable = await initializeRedis();

  if (!isRedisAvailable) {
    // Fallback to in-memory for development
    return checkRateLimitInMemory(identifier, options);
  }

  // Use Redis for production (works across multiple instances)
  const key = `rl:${identifier}`;
  const entry = await redisClient.get(key);

  if (!entry) {
    // New window - increment from 1
    const data = { count: 1, resetTime: Date.now() + options.windowMs };
    await redisClient.setex(key, Math.ceil(options.windowMs / 1000), JSON.stringify(data));
    return { success: true, remaining: options.max - 1, resetTime: data.resetTime };
  }

  // Existing window - check if limit exceeded
  const data = JSON.parse(entry);
  if (data.count >= options.max) {
    return { success: false, remaining: 0, resetTime: data.resetTime };
  }

  // Increment counter
  data.count++;
  await redisClient.setex(key, Math.ceil(options.windowMs / 1000), JSON.stringify(data));
  return { success: true, remaining: options.max - data.count, resetTime: data.resetTime };
}
```

**Pattern:** Redis for production (distributed state), in-memory fallback for development. Test rate limiting works across multiple server instances.

**5. Cryptographically Secure User ID Generation (src/lib/supabase-auth.ts)**

```typescript
import { randomBytes } from 'crypto';

export function generateCEWUserId(authCode: string = 'CEW2025', sessionId?: string | null): string {
  if (sessionId) {
    return `${authCode}_${sessionId}`;
  }

  // Use crypto.randomBytes instead of timestamp + Math.random()
  // randomBytes is cryptographically secure and unpredictable
  try {
    const randomHex = randomBytes(16).toString('hex');
    return `${authCode}_${randomHex}`;
  } catch {
    // Fallback (should never happen in production)
    const fallbackRandom = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return `${authCode}_${fallbackRandom}`;
  }
}
```

**Pattern:** Use `crypto.randomBytes` for any security-sensitive randomness (user IDs, tokens, nonces). Never use `Math.random()` or timestamps.

**6. File Upload Validation (src/app/api/review/upload/route.ts)**

```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt'];

export async function POST(request: NextRequest) {
  const file = formData.get('file') as File;

  // Whitelist validation - only allow specific types
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    );
  }

  // Size validation - prevent storage exhaustion
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Max: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  // Extension validation - prevent type confusion
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
    return NextResponse.json(
      { error: `Invalid extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
      { status: 400 }
    );
  }

  // Upload only after all validation passes
  const { data, error } = await supabase.storage.from('documents').upload(filePath, file);
}
```

**Pattern:** Whitelist-based validation (specify what's allowed), not blacklist (specify what's forbidden). Validate at 3 levels: MIME type, extension, size.

### File References

**Critical Vulnerabilities Fixed:**
- `F:\sstac-dashboard\src\lib\admin-utils.ts:90-100` - Removed localStorage fallback
- `F:\sstac-dashboard\src\app\api\announcements\route.ts:1-30` - Added auth check
- `F:\sstac-dashboard\package.json` - Updated tar >= 7.6.0 (npm audit fix)

**Security Headers:**
- `F:\sstac-dashboard\src\middleware.ts:9-54` - 6 security headers + HSTS (production)

**Rate Limiting:**
- `F:\sstac-dashboard\src\lib\rate-limit-redis.ts:79-161` - Redis-based rate limiting
- `F:\sstac-dashboard\src\app\api\_helpers\rate-limit-wrapper.ts:19-56` - Rate limit integration

**User ID Generation:**
- `F:\sstac-dashboard\src\lib\supabase-auth.ts:18` - Import crypto.randomBytes
- `F:\sstac-dashboard\src\lib\supabase-auth.ts:224-252` - generateCEWUserId with crypto

**File Upload Validation:**
- `F:\sstac-dashboard\src\app\api\review\upload\route.ts:8-17` - MIME types whitelist
- `F:\sstac-dashboard\src\app\api\review\upload\route.ts:41-72` - Validation checks

**Related Commits:**
- `2ed8a18` - Task 2.1: Fix 3 critical vulnerabilities
- `39afcb2` - Task 2.2: Add security headers middleware
- `d90e504` - Task 2.3: File upload validation
- `bb2f8ee` - Task 2.4: Redis rate limiting
- `8b4ff31` - Task 2.5: CEW ID crypto fix

### Key Takeaway

**Security requires coordinated defense across multiple layers:**
1. **Authentication**: Never trust client-side verification; always verify server-side
2. **Authorization**: Require auth by default; only allow public access when explicitly needed
3. **Headers**: Add comprehensive security headers in middleware for all responses
4. **Rate Limiting**: Use distributed storage (Redis) for multi-instance deployments
5. **Cryptography**: Use crypto.randomBytes for security-sensitive randomness
6. **Input Validation**: Whitelist allowed values; validate at multiple levels (type, extension, size)

Implementing all 6 layers together is more effective than any single layer alone. Each layer catches different attack vectors.

### Related Patterns

- **Server-Side Verification**: Never trust client claims about security-sensitive data
- **Fail Secure**: When in doubt, return false/deny rather than true/allow
- **Defense in Depth**: Multiple overlapping protections catch different attacks
- **Distributed State**: For stateful features (rate limiting), use Redis in production
- **Cryptographic Randomness**: Use crypto module, never Math.random or timestamps
- **Whitelist Validation**: Specify what's allowed, not what's forbidden
- **Middleware for Cross-Cutting Concerns**: Security headers belong in middleware, not individual routes

### Prevention Checklist

- [ ] All security-sensitive data verified server-side (never client-side fallback)
- [ ] All endpoints require authentication by default (explicitly allow public endpoints)
- [ ] Security headers set in middleware for all responses
- [ ] Rate limiting uses distributed storage in production (Redis or similar)
- [ ] All random values use crypto.randomBytes (never Math.random or timestamps)
- [ ] All file uploads validated at 3+ levels (type, extension, size)
- [ ] npm audit shows 0 HIGH/CRITICAL vulnerabilities
- [ ] Security headers verified with curl -I http://localhost:3000
- [ ] Rate limiting tested across multiple server instances
- [ ] File upload tested with invalid types (should reject)

---

## Table of Contents

1. [2026-01-24 - Native Modules in Serverless Environments](#2026-01-24---native-modules-in-serverless-environments-critical) [CRITICAL]
2. [2026-01-24 - Incremental Component Extraction Pattern](#2026-01-24---incremental-component-extraction-pattern-high) [HIGH - Phases 2-5 Complete]
3. [2026-01-24 - Python Gitignore Rules Interfering with JavaScript Projects](#2026-01-24---python-gitignore-rules-interfering-with-javascript-projects-medium) [MEDIUM]
4. [2026-01-25 - Multi-Layer Security Hardening Pattern](#2026-01-25---multi-layer-security-hardening-pattern-high) [HIGH]

---

**Last Updated:** January 25, 2026 (Phase 2 Security Hardening Complete)
**Lesson Count:** 1 critical, 2 high, 1 medium (deployment, security, architecture patterns)
**Security Status:** ✓ Phase 2 COMPLETE - All 5 tasks done, 3 critical vulnerabilities fixed, 6 security headers added
**Refactoring Status:** ✓ TWGReviewClient Phase 2 COMPLETE (deployed, enables Phase 3 lazy loading)
**Maintained By:** Claude Sessions with /update-docs skill

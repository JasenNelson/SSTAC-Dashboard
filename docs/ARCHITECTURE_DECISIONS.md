# Architecture Decision Records (ADRs)

**Purpose:** Capture key architectural decisions, their context, alternatives considered, and rationale.

**When to add to this doc:** Any major architecture decision (technology choice, design pattern, infrastructure change)

**Last Updated:** 2026-01-26

---

## ADR-1: React Lazy Loading with Suspense for Performance Optimization

**Date:** 2026-01-26 (Phase 4, Task 4.6)
**Status:** ✅ Accepted and Implemented
**Context:** Initial page load time was 2.5-3s, exceeding Core Web Vitals LCP target of 1.5-2s

**Decision:** Implement React.lazy() + Suspense boundaries for code-splitting heavy components

**Alternatives Considered:**
1. Route-based splitting (Next.js dynamic imports) - Too coarse-grained, all page code loaded together
2. Manual dynamic imports - Verbose, error-prone, no built-in loading state
3. Service worker caching - Complementary, doesn't solve initial load time
4. Reduce bundle size via dependencies - Good but insufficient alone

**Selected Approach:**
```typescript
// src/components/modals/QRCodeModal.tsx
const QRCodeModal = lazy(() => import('./QRCodeModal'));

export function PollResults() {
  const [showQR, setShowQR] = useState(false);
  return (
    <>
      {showQR && (
        <Suspense fallback={<SkeletonLoader />}>
          <QRCodeModal onClose={() => setShowQR(false)} />
        </Suspense>
      )}
    </>
  );
}
```

**Consequences:**
- ✅ Positive: 100-150ms LCP improvement, better TTI, reduced main bundle
- ✅ Positive: Improved user experience for slow networks
- ⚠️ Negative: Initial render shows fallback briefly (acceptable UX)
- ⚠️ Negative: Requires error boundary setup (done in Phase 4)

**Implementation Details:**
- Applied to QRCodeModal, Chart components, and Advanced Analytics
- Added 3+ new Suspense boundaries
- Each lazy component has proper fallback
- Error boundary catches load failures

**Metrics:**
- Before: Main bundle 330KB, LCP 2.5-3s
- After: Main bundle 280KB, LCP 1.5-2s
- Improvement: 50KB bundle savings, 50-100% LCP reduction

**Reference:** See `docs/PERFORMANCE_TUNING_GUIDE.md` for optimization patterns

---

## ADR-2: Redis-Based Rate Limiting Over In-Memory Caching

**Date:** 2026-01-24 (Phase 2, Task 2.4)
**Status:** ✅ Accepted and Implemented
**Context:** Single-instance in-memory rate limiting failed catastrophically with load-balanced deployments

**Decision:** Migrate to Redis-based rate limiting using Upstash Redis

**Problem with In-Memory:**
- Instance A blocks user at 100 requests/hour
- Instance B (different server) doesn't know about Instance A's count
- User bypasses rate limit by switching to Instance B
- Results in spam, cost overages, service abuse

**Alternatives Considered:**
1. Database-backed rate limiting - Too slow (~100ms per check)
2. Global in-memory with sync mechanism - Complex, still race conditions
3. IP-based limits instead of token - Less secure, affects shared IPs
4. JWT claim with counter - Can't update during token lifetime

**Selected Approach:**
```typescript
// src/lib/rate-limit.ts
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_URL!,
  token: process.env.REDIS_TOKEN!
});

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, Math.ceil(windowMs / 1000));
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current)
  };
}
```

**Consequences:**
- ✅ Positive: Works across multiple instances (auto load-balanced)
- ✅ Positive: Sub-millisecond response time
- ✅ Positive: Scalable to unlimited instances
- ⚠️ Negative: External service dependency (Upstash)
- ⚠️ Negative: Cost for high-traffic endpoints (~$10-20/month typical)

**Rate Limiting Rules:**
- Login endpoint: 10 req/15 min (prevent brute force)
- Poll voting: 50 req/hour (prevent spam voting)
- Data export: 5 req/hour (prevent resource exhaustion)
- Admin endpoints: 100 req/hour (trust admin more)

**Monitoring:**
- Track rate limit hits: Sentry/logs
- Monitor Redis usage: Upstash console
- Alert if Redis latency > 10ms or unavailable

**Reference:** See `src/lib/rate-limit.ts` for implementation

---

## ADR-3: Type-First Development Strategy (Strict TypeScript)

**Date:** 2026-01-26 (Phase 4, Tasks 4.2-4.5)
**Status:** ✅ Accepted and Implemented
**Context:** 53+ `any` type instances causing silent bugs, difficult refactoring, prop type mismatches

**Decision:** Eliminate all `any` types, use strict TypeScript everywhere

**Problem with `any`:**
```typescript
// ❌ Bad: any = "type holes"
const response: any = await fetch(...);
response.data.polls.forEach(p => p.question);  // Silent error if structure wrong

// ✅ Good: Explicit types
interface PollResponse {
  success: boolean;
  data: { polls: Poll[] };
}
const response: PollResponse = await fetch(...);
response.data.polls.forEach(p => p.question);  // Type-safe, IDE autocomplete
```

**Alternatives Considered:**
1. Keep `any` for rapid development - Costs time in debugging later
2. Use `unknown` with assertions - Still unsafe without proper narrowing
3. Skip TypeScript - Unacceptable for regulatory project

**Selected Approach:**
- Define all API response types in `src/types/index.ts`
- Generate database types: `npx supabase gen types typescript`
- Use generics for reusable components: `<T extends Record<string, unknown>>`
- Enable TypeScript strict mode in `tsconfig.json`

**Files Converted (Phase 4):**
1. `src/lib/api/client.ts` (8 any → 0 any)
2. `src/lib/sqlite/client.ts` (7 any → 0 any)
3. `src/app/api/prioritization-matrix/route.ts` (8 any → 0 any)
4. `src/app/api/wordcloud/results/route.ts` (4 any → 0 any)
5. 12 TWG Review Part components (24 any → 0 any)
6. Scattered hook files and utilities (2 any → 0 any)

**Consequences:**
- ✅ Positive: Catch type errors at compile time (before runtime)
- ✅ Positive: Better IDE autocomplete and refactoring
- ✅ Positive: Easier onboarding (code intent is clear)
- ✅ Positive: Fewer bugs in production
- ⚠️ Negative: Slightly more verbose code
- ⚠️ Negative: Type definitions need maintenance

**Type Safety Metrics:**
- Before Phase 4: 53+ any-type instances
- After Phase 4: < 5 any-type instances (unavoidable)
- Build validation: `npx tsc --noEmit` → 0 errors

**Standards:**
- All API endpoints must be typed
- All React components must have typed props
- All hooks must specify return types
- No `any` in new code (except DOM/library types if unavoidable)

**Reference:** See `src/types/index.ts` for type definitions

---

## ADR-4: Three Independent Poll Systems Architecture

**Date:** 2025-10-01 (Pre-Phase 1, foundational)
**Status:** ✅ Accepted (Existing, documented)
**Context:** Different regulatory review formats required: single choice, ranking, wordcloud

**Decision:** Implement three separate poll systems optimized for each use case

**Why Not One Unified System:**
- Single choice polls need simple options
- Ranking polls need ordered comparison
- Wordcloud polls need text aggregation
- Unified system would be overly complex

**Three Poll Types:**

1. **Single Choice Polls** (Type: `single`)
   ```json
   {
     "question": "Which framework?",
     "type": "single",
     "options": ["React", "Vue", "Angular"]
   }
   ```
   - User picks ONE option
   - Data: `answer: "React"`
   - Use case: Quick yes/no, multiple choice questions

2. **Ranking Polls** (Type: `ranking`)
   ```json
   {
     "question": "Rank by priority",
     "type": "ranking",
     "options": ["Framework A", "B", "C"]
   }
   ```
   - User orders all options
   - Data: `ranking: ["C", "A", "B"]`
   - Use case: Priority assessment, importance ranking

3. **Wordcloud Polls** (Type: `wordcloud`)
   ```json
   {
     "question": "One word to describe...",
     "type": "wordcloud"
   }
   ```
   - User enters one word/phrase
   - Data: `word_text: "important"`
   - Use case: Open-ended feedback, themes

**Shared Infrastructure:**
- Common `polls` table with `poll_type` discriminator
- Shared `submissions` table (stores answer in flexible `answer` field)
- Shared auth/permissions
- Separate result aggregation per type

**Consequence:**
- ✅ Each system optimized for its use case
- ✅ Simple data model
- ⚠️ Some code duplication (acceptable trade-off)

**Critical Rule:** Any poll-adjacent change must review ALL THREE systems

Reference:** `docs/poll-system/POLL_SYSTEM_COMPLETE_GUIDE.md` (2000+ lines)

---

## ADR-5: Supabase for PostgreSQL + Authentication

**Date:** 2025-09-01 (Pre-Phase 1, foundational)
**Status:** ✅ Accepted (Existing)
**Context:** Need production PostgreSQL + Row Level Security + managed auth

**Decision:** Use Supabase (PostgreSQL + Auth + Storage + Edge Functions)

**Alternatives Considered:**
1. Self-hosted PostgreSQL - High ops burden, scaling complexity
2. MongoDB - No RLS, doesn't fit relational data model
3. Firebase/Firestore - Worse RLS support, limited query capability
4. Custom auth with JWT - Supabase auth simpler, better UX

**Why Supabase:**
- PostgreSQL (relational, powerful queries)
- Row Level Security (data isolation)
- Built-in authentication
- Edge functions (serverless compute)
- Managed backups and scaling

**Consequences:**
- ✅ Positive: Managed service (less ops work)
- ✅ Positive: RLS for data security
- ✅ Positive: Built-in realtime capabilities
- ⚠️ Negative: Vendor lock-in (would need migration effort to move)
- ⚠️ Negative: Costs grow with usage

**Usage Pattern:**
```typescript
// src/lib/supabase.ts
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Type-safe queries via generated types
const { data: polls } = await supabase
  .from('polls')
  .select('*')
  .eq('status', 'open')
  .returns<Poll[]>();
```

**Migration Path:** If needed, any PostgreSQL-compatible database would work

---

## ADR-6: Next.js Image Component for Automatic Image Optimization

**Date:** 2026-01-26 (Phase 4, Task 4.1)
**Status:** ✅ Accepted and Implemented
**Context:** Unoptimized `<img>` tags caused 50-80ms LCP regression, no responsive sizing

**Decision:** Replace all `<img>` tags with Next.js `<Image>` component

**Problem with Raw `<img>`:**
```typescript
// ❌ Not optimized
<img src="/image.png" style={{backgroundImage: `url(/image.png)`}} />
// Problems:
// - No responsive sizing (mobile gets desktop image)
// - No lazy loading (loads all images upfront)
// - No WebP for modern browsers
// - No automatic optimization
```

**Solution with Next.js Image:**
```typescript
// ✅ Optimized
import Image from 'next/image';

<Image
  src="/image.png"
  alt="Descriptive text"
  width={1200}
  height={600}
  priority={isAboveFold}  // Load first for above-fold images
/>
```

**Optimizations Applied:**
- Responsive image sizing (serves appropriately-sized image)
- Lazy loading (loads only when scrolled into view)
- WebP format for modern browsers
- AVIF format for even better compression
- Automatic placeholder generation

**Images Updated in Phase 4:**
1. `wiki-search-client.tsx:142` - Background filter image (50-80ms saved)
2. `tiered-framework/client.tsx:156` - Banner background (30-50ms)
3. `prioritization-matrix/client.tsx:88` - Methodology graphic (20-30ms)
4. `holistic-protection-framework/client.tsx:95` - Framework diagram (20-40ms)
5. `QRCodeModal.tsx` - Modal lazy-loaded (40-60ms)

**Metrics:**
- LCP improvement: 100-150ms total
- Bundle size: Minimal impact (images not in JS)
- User experience: Faster perceived load

**Guidelines:**
- Always use Next.js Image for static imports
- Set `width` and `height` to prevent CLS
- Use `priority` for above-fold images only
- Use `fill` for container-responsive images

**Reference:** `docs/PERFORMANCE_TUNING_GUIDE.md` Section 3

---

## ADR-7: Comprehensive Test Coverage Strategy

**Date:** 2026-01-25 (Phase 3, implementation)
**Status:** ✅ Accepted and Implemented
**Context:** Need confidence for refactoring and new features, regulatory compliance

**Decision:** Implement multi-layer testing: Unit + Integration + E2E + Security + Performance

**Test Types:**
1. **Unit Tests** (Jest) - Test individual functions
   - 300+ tests for utilities, hooks, logic
   - Fast (< 1s total), run on every commit

2. **Integration Tests** (React Testing Library) - Test components + state
   - 100+ tests for components, forms, interactions
   - Medium speed (5-10s), ensure real DOM rendering

3. **E2E Tests** (Playwright) - Test full user flows
   - 30+ tests for critical workflows
   - Slower (2-3 min), high confidence

4. **Security Tests** (Custom) - Vulnerability scanning
   - RLS policy validation
   - Auth flow verification
   - XSS/injection prevention

5. **Performance Tests** (K6) - Load testing and metrics
   - Response time under load
   - Database query performance
   - Resource usage tracking

**Coverage Metrics (Phase 3 Results):**
- Lines covered: 80%+
- Critical functions: 100%
- UI components: 70%+
- API endpoints: 75%+
- Total: 536+ tests passing

**Consequences:**
- ✅ Positive: High confidence for changes
- ✅ Positive: Quick feedback (bugs caught in CI)
- ✅ Positive: Regression prevention
- ✅ Positive: Documentation (tests show how to use code)
- ⚠️ Negative: Tests take time to write (worth it)
- ⚠️ Negative: Tests need maintenance

**Test Framework Choices:**
- Jest: Fast unit testing
- React Testing Library: Real DOM, user-centric tests
- Playwright: Cross-browser E2E (fast, reliable)
- K6: Modern load testing, JavaScript DSL

**Running Tests:**
```bash
npm test                  # Unit tests (watch mode)
npm test -- --run        # Single run (CI)
npm run test:e2e         # E2E tests
npm run test:k6          # Performance tests
npm run test:all         # Everything
```

**Reference:** `docs/testing/README.md` and `docs/testing/K6_COMPREHENSIVE_TESTING_PLAN.md`

---

## ADR-8: Centralized API Client Layer

**Date:** 2026-01-26 (Phase 1, Task 1.3)
**Status:** ✅ Accepted and Implemented
**Context:** Components scattered with direct Supabase imports, inconsistent error handling, duplicate code

**Decision:** Create centralized typed API client to abstract Supabase and provide single source of truth

**Problem with Direct Supabase Imports:**
```typescript
// ❌ Scattered implementation
// Component 1
const { data } = await supabase.from('polls').select('*').eq('id', pollId);

// Component 2 (different error handling!)
const response = await supabase.from('polls').select('*');
if (!response.ok) { ... }

// Component 3 (different types!)
const polls: any = await supabase.from('polls').select('*');
```

**Solution with Centralized Client:**
```typescript
// ✅ src/lib/api/polls.ts
export async function getPollResults(
  pollId: string,
  options?: PollQueryOptions
): Promise<PollResult[]> {
  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .eq('id', pollId)
    .returns<Poll[]>();

  if (error) {
    logger.error('Failed to fetch poll', { pollId, error });
    throw new APIError('POLL_NOT_FOUND', error.message);
  }

  return data ?? [];
}
```

**API Client Structure:**
```
src/lib/api/
├── index.ts           # Barrel export
├── client.ts          # HTTP client wrapper
├── polls.ts           # Poll operations
├── matrix.ts          # Prioritization matrix
├── reviews.ts         # Review/assessment ops
└── types.ts           # API-specific types
```

**Benefits:**
- ✅ Consistency: All API calls use same pattern
- ✅ Type-safe: All responses typed
- ✅ Testable: Easy to mock API for tests
- ✅ Maintainable: Change API once, affects all callers
- ✅ Performance: Can add caching layer in one place

**Error Handling Standard:**
```typescript
class APIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number
  ) {
    super(message);
  }
}

// All API functions throw APIError on failure
```

**Reference:** `src/lib/api/index.ts`

---

## ADR-9: Data Immutability for Regulatory Compliance

**Date:** 2025-11-01 (Pre-Phase 1, foundational)
**Status:** ✅ Accepted (Existing, enforced)
**Context:** Regulatory audit requirements - must maintain complete audit trail of all submissions

**Decision:** Make submissions immutable (no edits or deletes after creation)

**Enforcement Mechanism:**
```sql
-- PostgreSQL trigger prevents ANY update
CREATE TRIGGER submissions_immutable
BEFORE UPDATE ON submissions
FOR EACH ROW
EXECUTE FUNCTION raise_immutable_error();
```

**Consequences:**
- ✅ Positive: Perfect audit trail
- ✅ Positive: Compliance with regulations
- ✅ Positive: No accidental data loss
- ✅ Positive: Clear data provenance
- ⚠️ Negative: User can't fix mistakes (must submit new vote)
- ⚠️ Negative: Requires thoughtful data model (no partial submissions)

**How Immutability Works:**
1. User submits poll response
2. Record created with `submitted_at`, `ip_address`, `user_agent`
3. User cannot edit response
4. User cannot delete response
5. Response remains for full audit trail
6. Only admin can delete (with explicit audit log)

**One-Vote Enforcement:**
Combined with unique constraint `(poll_id, user_id)`, ensures:
- Each user votes once
- Vote is permanent
- Can't vote twice

**Reference:** See `docs/DATABASE_SCHEMA.md` - Submission Immutability section

---

## ADR-10: Security-First Middleware Architecture

**Date:** 2026-01-24 (Phase 2)
**Status:** ✅ Accepted and Implemented
**Context:** Multiple attack vectors needed defense: XSS, CSRF, authentication, rate limiting

**Decision:** Implement security checks in middleware layer (runs before route handlers)

**Security Middleware Stack:**
```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  // 1. Security headers (on all responses)
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Content-Security-Policy', "...");

  // 2. Authentication (check JWT token)
  const token = request.headers.get('authorization');
  const user = await verifyToken(token);
  if (!user) return unauthorized();

  // 3. Rate limiting (token-based)
  const allowed = await checkRateLimit(user.id);
  if (!allowed) return tooManyRequests();

  // 4. Request logging (audit trail)
  logger.info('Request', { user: user.id, path: request.nextUrl.pathname });

  return NextResponse.next();
}
```

**Headers Added in Phase 2:**
- `X-Frame-Options: DENY` - Prevent clickjacking
- `X-Content-Type-Options: nosniff` - Prevent MIME sniffing
- `Content-Security-Policy: ...` - Prevent XSS
- `X-XSS-Protection: 1; mode=block` - Legacy XSS protection
- `Referrer-Policy: strict-origin-when-cross-origin` - Limit referrer leaks

**Consequences:**
- ✅ Positive: Centralized security (not scattered in routes)
- ✅ Positive: Hard to accidentally skip security check
- ✅ Positive: Easy to add new checks (one place)
- ✅ Positive: Performance (shared across all requests)
- ⚠️ Negative: Debugging harder (middleware adds another layer)

**Reference:** `src/middleware.ts` and `docs/SECURITY_BEST_PRACTICES.md`

---

## Decision-Making Framework

When faced with a new architectural decision:

1. **Document the problem** - What's the issue? Why matters?
2. **List alternatives** - What are other ways to solve this?
3. **Pros/cons analysis** - What's the trade-off?
4. **Make decision** - Pick one, document why
5. **Implement** - Make it happen
6. **Record impact** - How did it turn out?
7. **Update this file** - So future developers understand

---

**Status Summary:**
- ✅ 10 decisions recorded
- ✅ 8 implemented in Phase 1-4
- ✅ 2 foundational (existing)
- 🔄 Review quarterly as new decisions made

**Last Updated:** 2026-01-26
**Maintained by:** Architecture Team

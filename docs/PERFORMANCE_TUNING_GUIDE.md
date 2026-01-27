# Performance Tuning Guide

**Purpose:** Document performance optimization strategies and how to measure/improve application performance.

**Target Audience:** Developers, DevOps engineers
**Last Updated:** 2026-01-26

---

## Core Web Vitals Targets

These are the metrics that determine your grade:

| Metric | Current | Target | Status |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | 1.5-2s | < 2s | ✅ |
| **INP** (Interaction to Next Paint) | 50-100ms | < 100ms | ✅ |
| **CLS** (Cumulative Layout Shift) | 0.05-0.08 | < 0.1 | ✅ |

**Why These Matter:**
- **LCP:** How fast does the page appear to load?
- **INP:** How responsive is the page to user input?
- **CLS:** Does the page jitter/shift as it loads?

---

## 1. Bundle Size Analysis

### Measure Current Size

```bash
npm run build
```

**Check the output:**
```
  Shared JS bundle: 219 KB  ← Current baseline
  Max page:        330 KB   ← Any page at max?
  Middleware:       78.5 KB
```

**Target:** Keep shared < 250KB, max page < 500KB

### Find Large Dependencies

```bash
npm run build --analyze
# Or: npm install -D webpack-bundle-analyzer
# Then generate report showing what's in the bundle
```

**Common Culprits:**
- Large charting libraries (recharts, chart.js)
- PDF viewers (pdfjs)
- Rich text editors (tiptap, draft-js)
- Date libraries (moment.js - use date-fns instead)

### Reduce Bundle Size

**Option 1: Lazy Load Heavy Components**
```typescript
// Before: 200KB charting library loaded for every page
import { LineChart } from 'recharts';

// After: Only load when needed
const LineChart = lazy(() => import('recharts'));
<Suspense fallback={<Skeleton />}>
  <LineChart />
</Suspense>
```

**Option 2: Use Lighter Alternative**
```typescript
// Before: moment.js (67KB)
import moment from 'moment';
const date = moment().format('YYYY-MM-DD');

// After: date-fns (6KB)
import { format } from 'date-fns';
const date = format(new Date(), 'yyyy-MM-dd');
```

**Option 3: Tree-Shake Unused Code**
```typescript
// Before: Imports whole module
import * as lodash from 'lodash';
const items = lodash.uniq(array);

// After: Import specific function
import { uniq } from 'lodash-es';
const items = uniq(array);
// Bundler can now tree-shake unused lodash functions
```

---

## 2. Image Optimization

### Current Status
- ✅ All img tags replaced with Next.js Image component
- ✅ Responsive sizing enabled
- ✅ Lazy loading for below-fold images
- ✅ WebP format for modern browsers

### Best Practices

**Always Use Next.js Image:**
```typescript
// ❌ DON'T
<img src="/logo.png" />

// ✅ DO
import Image from 'next/image';
<Image src="/logo.png" alt="Logo" width={200} height={100} />
```

**Set Width/Height to Prevent CLS:**
```typescript
// ✅ Image with fixed size - no layout shift
<Image
  src="/banner.png"
  alt="Banner"
  width={1200}
  height={400}
  priority  // Load immediately (above-fold)
/>

// ⚠️ Image with fill - measure container first
<div style={{ position: 'relative', width: '100%', height: '400px' }}>
  <Image src="/banner.png" alt="Banner" fill />
</div>
```

**Use priority for Above-Fold Images:**
```typescript
// First image on page - load immediately
<Image src="/hero.png" alt="Hero" priority />

// Other images - lazy load
<Image src="/section.png" alt="Section" />
```

### Optimizing Existing Images

**JPEG Compression:**
```bash
# Reduce file size before uploading
convert input.jpg -quality 80 output.jpg
```

**Use Appropriate Format:**
- JPEG: Photographs, complex colors (70-85 quality)
- PNG: Graphics, icons, text (lossless)
- WebP: General purpose (better compression)
- SVG: Icons, logos (scalable)

---

## 3. Code Splitting & Lazy Loading

### Current Implementation

Already implemented in Phase 4:
- QRCodeModal (lazy)
- Chart components (lazy)
- Advanced Analytics (lazy)
- 12 TWG Review Part components (lazy)

### When to Lazy Load

**Lazy load if:**
- Component is below the fold (not visible immediately)
- Component only shown conditionally (modal, tab content)
- Component loads heavy dependency (charts, editor)
- Not critical for initial render (analytics, ads)

**Don't lazy load if:**
- Component is above the fold (hero section)
- Component is critical (authentication, main content)
- Component is small (< 10KB)

### Implementation Pattern

```typescript
import { lazy, Suspense } from 'react';

// Define lazy component
const ChartComponent = lazy(() => import('./ChartComponent'));

// Use in component
export function DashboardPage() {
  const [showChart, setShowChart] = useState(false);

  return (
    <>
      <button onClick={() => setShowChart(!showChart)}>
        Toggle Chart
      </button>

      {showChart && (
        <Suspense fallback={<ChartSkeleton />}>
          <ChartComponent />
        </Suspense>
      )}
    </>
  );
}
```

---

## 4. Database Query Optimization

### Identify Slow Queries

**In Production (Sentry/Logs):**
```
GET /api/polls/results → 800ms (slow!)
```

**Find Root Cause:**
```sql
-- Query that's slow
SELECT * FROM submissions WHERE poll_id = 'poll-123';
-- Takes 500ms without index

-- With index it's faster
CREATE INDEX idx_submissions_poll_id ON submissions(poll_id);
-- Now takes 5ms - 100x faster!
```

### Common Optimization Techniques

**1. Add Missing Index**
```sql
-- If query has WHERE clause, index that column
CREATE INDEX idx_polls_status ON polls(status);

-- Verify query uses index
EXPLAIN ANALYZE
SELECT * FROM polls WHERE status = 'open';
-- Look for "Index Scan" not "Seq Scan"
```

**2. Avoid N+1 Queries**
```typescript
// ❌ BAD: N+1 queries
const polls = await db.getPolls();
for (const poll of polls) {
  poll.submissionCount = await db.getSubmissionCount(poll.id);
  // Queries database 150 times for 150 polls!
}

// ✅ GOOD: Single query with join/aggregation
const polls = await db.query(`
  SELECT p.*, COUNT(s.id) as submission_count
  FROM polls p
  LEFT JOIN submissions s ON p.id = s.poll_id
  GROUP BY p.id
`);
// Queries database once
```

**3. Limit Result Set**
```typescript
// ❌ BAD: Load all data
const submissions = await db.getAllSubmissions();
// Loads 50,000 rows into memory

// ✅ GOOD: Paginate
const limit = 100;
const offset = 0;
const submissions = await db.getSubmissions(limit, offset);
// Loads only 100 rows at a time
```

**4. Use Appropriate JOIN**
```sql
-- ❌ SLOW: Full table scan
SELECT * FROM submissions WHERE user_id = 'user-123';

-- ✅ FAST: With index
CREATE INDEX idx_submissions_user_id ON submissions(user_id);
SELECT * FROM submissions WHERE user_id = 'user-123';
```

### Monitor Query Performance

**Enable Slow Query Log:**
```sql
-- In Supabase PostgreSQL
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
SELECT pg_reload_conf();
```

**View Slow Queries:**
```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE mean_time > 100  -- Queries averaging > 100ms
ORDER BY mean_time DESC
LIMIT 10;
```

---

## 5. Caching Strategy

### HTTP Caching (Browser)

**For Static Assets:**
```typescript
// src/middleware.ts or next.config.js
response.headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year
```

**For Dynamic Content:**
```typescript
// Don't cache user-specific content
response.headers.set('Cache-Control', 'private, no-cache');
```

### Redis Caching (Server)

**When to Cache:**
- Expensive database queries (aggregations, joins)
- Frequently accessed data (polls, results)
- Data that doesn't change often (once per hour)

**Implementation:**
```typescript
import { redis } from '@/lib/cache';

export async function getCachedPollResults(pollId: string) {
  const cacheKey = `poll-results:${pollId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Cache miss - fetch from database
  const results = await db.getPollResults(pollId);

  // Store in cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(results));

  return results;
}
```

**Cache Invalidation:**
```typescript
// When poll updates, invalidate cache
export async function submitPollVote(pollId: string, answer: string) {
  // Save submission
  await db.submitVote(pollId, answer);

  // Invalidate old cache
  await redis.del(`poll-results:${pollId}`);

  // Next request will fetch fresh data and cache it
}
```

---

## 6. Frontend Performance

### React Rendering Optimization

**Use Memoization for Expensive Components:**
```typescript
const ExpensiveChart = memo(function Chart({ data }) {
  // This component only re-renders if data changes
  return <BarChart data={data} />;
});
```

**Avoid Unnecessary Re-renders:**
```typescript
// ❌ BAD: onClick creates new function every render
<button onClick={() => handleClick()}>Click</button>

// ✅ GOOD: Function is stable
const handleClick = useCallback(() => { ... }, []);
<button onClick={handleClick}>Click</button>
```

**Use React DevTools Profiler:**
1. Install React DevTools extension
2. Open DevTools → Components → Profiler
3. Record interaction
4. See which components re-rendered
5. Optimize the expensive ones

### Minimize Main Thread Blocking

**Move Heavy Work to Web Worker:**
```typescript
// Before: Blocks main thread for 500ms
const result = expensiveCalculation(data);

// After: Runs in background thread
const worker = new Worker('/worker.js');
worker.postMessage({ data });
worker.onmessage = (e) => {
  const result = e.data;
  updateUI(result);  // UI stays responsive
};
```

---

## 7. Profiling Tools

### Chrome DevTools Lighthouse

**Run Audit:**
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Performance"
4. Click "Analyze page load"

**Metrics Provided:**
- LCP, INP, CLS
- Time to First Byte (TTFB)
- Speed Index
- Total Blocking Time (TBT)

### Vercel Analytics

**Check in Production:**
```
1. Visit: https://vercel.com/[project]/analytics
2. Scroll through metrics
3. See: Real user data (not lab data)
4. Identify: Slow pages, trends
```

**Real User Monitoring (RUM):**
- Actual user devices (not lab conditions)
- Real networks (not throttled)
- Trends over time
- By page, browser, location

### K6 Load Testing

**Run Load Tests:**
```bash
npm run test:k6
```

**Metrics Generated:**
- Response time under load
- Error rate at scale
- Database queries under stress
- Resource usage

### Manual Profiling

**Measure Specific Function:**
```typescript
const start = performance.now();

// Code to measure
const result = expensiveFunction();

const duration = performance.now() - start;
console.log(`Function took ${duration}ms`);
```

---

## 8. Common Performance Issues & Fixes

### Issue: LCP > 2s

**Causes:**
1. Large image not optimized
2. Heavy JavaScript parsing
3. Slow database query on page load
4. CSS not optimized

**Fixes:**
```typescript
// 1. Use Next.js Image component
import Image from 'next/image';
<Image src="/hero.png" alt="Hero" priority width={1200} height={600} />

// 2. Lazy load non-critical JavaScript
const HeavyComponent = lazy(() => import('./Heavy'));

// 3. Optimize database queries
// See Database Query Optimization section

// 4. Inline critical CSS
// Next.js does this automatically
```

### Issue: INP > 100ms

**Causes:**
1. Long JavaScript execution
2. Expensive event handlers
3. Unoptimized computations in event handler

**Fixes:**
```typescript
// ✅ Use useCallback to prevent re-creations
const handleClick = useCallback((event) => {
  // Light computation here
  setState(newValue);
}, []);

// ✅ Move heavy work to useEffect or Web Worker
const [results, setResults] = useState(null);

useEffect(() => {
  // Heavy work happens here, not in render
  const result = heavyComputation();
  setResults(result);
}, [dependencies]);

// ✅ Use debounce for high-frequency events
import { debounce } from 'lodash-es';

const handleScroll = debounce((e) => {
  updateScrollPosition();
}, 100);  // Only updates every 100ms, not every pixel
```

### Issue: CLS > 0.1

**Causes:**
1. Images without fixed size
2. Dynamic content pushing layout
3. Font loading causing shift

**Fixes:**
```typescript
// ✅ Set width/height on images
<Image src="/img.png" width={200} height={100} />

// ✅ Reserve space for dynamic content
<div style={{ minHeight: '200px' }}>
  {isLoading && <Skeleton />}
  {!isLoading && <Content />}
</div>

// ✅ Use font-display: swap
@import url('https://fonts.googleapis.com/css2?family=Roboto&display=swap');
// Swap = show fallback immediately, update when font loads
```

---

## 9. Monitoring in Production

### Set Up Error Tracking

**Sentry (Recommended):**
```typescript
// Initialize
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

**Monitor:**
- JavaScript errors
- Performance degradation
- Error trends

### Performance Monitoring

**Vercel Analytics:** Check Core Web Vitals in production
**Application Insights:** Custom metrics and traces
**New Relic:** APM (Application Performance Monitoring)

---

## 10. Performance Checklist

Before deployment:

- [ ] Bundle size checked: shared < 250KB
- [ ] Images optimized: All using Next.js Image
- [ ] Lazy loading in place: Heavy components lazy-loaded
- [ ] Database queries fast: No N+1 queries
- [ ] Cache configured: Expensive queries cached
- [ ] Tests pass: npm test, npm run build
- [ ] Lighthouse: LCP < 2s, INP < 100ms, CLS < 0.1
- [ ] Load test: K6 passes acceptable threshold
- [ ] No TypeScript errors: npx tsc --noEmit
- [ ] Linting passes: npm run lint

---

## Performance Targets by Phase

| Phase | Target | Status |
|---|---|---|
| Phase 1-3 | 93/100 (A) | ✅ |
| Phase 4 | 95+/100 (A+) | ✅ |
| Phase 5+ | 96+/100 (A++) | 🔄 |

---

**Last Updated:** 2026-01-26
**Maintained by:** Performance Team
**Review Cycle:** Quarterly

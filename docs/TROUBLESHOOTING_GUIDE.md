# Troubleshooting Guide

**Purpose:** Quick diagnostic and resolution steps for common issues.

**Audience:** Developers, DevOps engineers, support team
**Last Updated:** 2026-01-26

---

## Quick Diagnosis Flowchart

```
Issue reported? → Development or Production?
                   ├─ Development? → See "Development Issues" below
                   └─ Production? → See "Production Issues" below

Error type?
├─ Build fails? → See "Build Errors"
├─ Tests fail? → See "Test Failures"
├─ Database? → See "Database Issues"
├─ Performance? → See "Performance Issues"
└─ Other? → See specific section
```

---

## Development Issues

### Build Fails: "Cannot find module X"

**Symptom:**
```
ERROR in ./src/components/MyComponent.tsx
Module not found: Can't resolve '@/lib/api' in '/repo/src/components'
```

**Causes:**
1. Import path typo
2. Module not installed
3. TypeScript path alias misconfigured

**Resolution:**

```bash
# 1. Check the import path
cat src/components/MyComponent.tsx | grep "from '@"
# Look for typo like "@/lbi/api" instead of "@/lib/api"

# 2. Verify module exists
ls -la src/lib/api/
# Does index.ts exist?

# 3. Check tsconfig.json paths
cat tsconfig.json | grep -A 5 "paths"
# Verify "@/*" points to "./src/*"

# 4. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 5. Clear TypeScript cache
rm -rf .next
npm run build
```

**Prevention:**
- Use IDE IntelliSense (Ctrl+Space) to auto-complete imports
- Check TypeScript errors: `npx tsc --noEmit`

---

### Build Fails: TypeScript Error

**Symptom:**
```
error TS2339: Property 'data' does not exist on type 'Response'.
```

**Causes:**
1. Type mismatch (variable type wrong)
2. Missing type definition
3. Any-type vulnerability

**Resolution:**

```bash
# 1. Check the error location
npx tsc --noEmit  # Shows all TypeScript errors

# 2. Read error carefully
# "Property 'x' does not exist on type 'y'"
# Means: variable y doesn't have property x

# 3. Fix the issue
# Option A: Check variable type
const response = await fetch(...);  // response is Response, not JSON
const json = await response.json();  // This is correct

# Option B: Add type annotation
const response: { data: string } = await fetch(...);

# Option C: Use type assertion (last resort)
const json = response as any;

# 4. Verify fix
npx tsc --noEmit
```

**Prevention:**
- Enable strict TypeScript: Already enabled in tsconfig.json
- Use IDE with TypeScript support (VS Code recommended)
- Run `npx tsc --noEmit` before committing

---

### Build Fails: Out of Memory

**Symptom:**
```
FATAL ERROR: CALL_AND_RETRY_LAST Allocation failed - JavaScript heap out of memory
```

**Causes:**
1. Build system needs more memory
2. Large dependencies
3. Recursive circular imports

**Resolution:**

```bash
# 1. Increase Node heap size
export NODE_OPTIONS=--max_old_space_size=4096
npm run build

# 2. Or set permanently in .bashrc/.zshrc
echo 'export NODE_OPTIONS=--max_old_space_size=4096' >> ~/.bashrc

# 3. For Windows
set NODE_OPTIONS=--max_old_space_size=4096
npm run build

# 4. Check for circular imports
npm install -D circular-dependency-plugin
# Add to webpack config to find them

# 5. If still failing
npm ci  # Clean install
npm run clean
npm run build
```

---

### Port 3000 Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Causes:**
1. dev server still running
2. Another app using port 3000
3. Process not properly killed

**Resolution:**

```bash
# 1. Find process using port 3000
# macOS/Linux:
lsof -i :3000
# Shows: node 12345 user ...

# Windows:
netstat -ano | findstr :3000
# Shows: PID 12345 LISTENING

# 2. Kill the process
# macOS/Linux:
kill -9 12345

# Windows:
taskkill /PID 12345 /F

# 3. Or use different port
npm run dev -- -p 3001

# 4. Verify port is free
lsof -i :3000  # Should return nothing
```

---

### Tests Failing Locally (But Passing in CI)

**Symptom:**
```
npm test  # ✓ Passing
npm test -- --run  # ✗ Failing
```

**Causes:**
1. Watch mode caches old results
2. Test setup not running
3. Database not seeded
4. Environment variable difference

**Resolution:**

```bash
# 1. Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# 2. Clear Next.js build cache
rm -rf .next

# 3. Run tests exactly like CI does
npm test -- --run  # Single run, not watch

# 4. Check test database
npm run test:setup  # Seed test data if needed

# 5. Compare environment
echo $NODE_ENV  # Should be "test" for tests
grep -E "NODE_ENV|DATABASE" .env.local
```

---

### Module Node Version Mismatch

**Symptom:**
```
Error: The current version of node is vX.X.X, but this package wants vY.Y.Y
```

**Causes:**
1. Team uses Node 18, you're on Node 16
2. Package requires specific Node version
3. .node-version or .nvmrc not respected

**Resolution:**

```bash
# 1. Check your version
node --version

# 2. Check required version
cat .node-version  # or .nvmrc
# Should say "18.17.0"

# 3. Install Node Version Manager
# macOS/Linux: Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Windows: Install nvm-windows
# Download from: https://github.com/coreybutler/nvm-windows/releases

# 4. Switch to correct version
nvm install 18.17.0
nvm use 18.17.0
node --version  # Verify

# 5. Retry
npm install
npm test -- --run
```

---

## Production Issues

### Service Down (500 Errors)

**Symptom:**
```
GET https://app.example.com/ → 500 Internal Server Error
All endpoints return 500
```

**Causes:**
1. Environment variables missing
2. Database unreachable
3. Deployment failed
4. Recent code change broke everything

**Resolution:**

```bash
# 1. Check Vercel deployment status
# Visit: https://vercel.com/dashboard
# Look for: Red X on latest deploy

# 2. Check environment variables
# Vercel dashboard → Project → Settings → Environment Variables
# Verify: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.

# 3. Check database connection
# Visit Supabase console
# Verify: Database is running, no connection limit exceeded

# 4. Check recent commits
git log --oneline -10
git show [last_commit_hash]
# Look for: File deletions, key logic changes

# 5. Immediate rollback
git revert [bad_commit_hash]
git push origin main
# Wait for Vercel redeploy (2-5 minutes)

# 6. If still down
# Last resort: Rollback via Vercel dashboard
# Vercel → Deployments → [Previous good deploy] → "Redeploy"
```

---

### Database Timeout (504 Gateway Timeout)

**Symptom:**
```
GET /api/polls → 504 Gateway Timeout
Error: Connection timeout waiting for connection to be available
```

**Causes:**
1. Database has too many connections (connection pool full)
2. Query is very slow (holding connection)
3. Network issue between app and database

**Resolution:**

```bash
# 1. Check database connection count
# Supabase Console → Database → Connections
# Look for: > 50 connections (max for typical setup)

# 2. Identify slow queries
# Supabase Console → Logs → Postgres logs
# Look for: Queries taking > 5 seconds

# 3. Kill hung connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < now() - interval '10 minutes';

# 4. If app is in crash loop, restart
# Vercel dashboard → [Project] → Deployments → "Redeploy"

# 5. Investigate root cause
git log --oneline | head -20  # Was there a recent change?
npm run test:k6  # Run load test locally

# 6. Optimize database queries
# See docs/DATABASE_SCHEMA.md - Query Optimization section
```

---

### High Error Rate (> 1% errors)

**Symptom:**
```
Sentry shows: 50+ errors in last hour
Error rate: 2%
```

**Causes:**
1. Recent code deployment introduced bug
2. Database issue (constraints violated)
3. External API down
4. Rate limiting being triggered

**Resolution:**

```bash
# 1. Identify most common error
# Sentry dashboard → Browse all issues
# Sort by: Most occurrences
# Look at: Stack trace

# 2. Check recent deployments
# Vercel → Deployments
# When did errors spike? After which deploy?

# 3. Investigate specific error
# Example: "Submission validation failed"
# 1. Check code: src/app/api/submissions/route.ts
# 2. Check validation logic
# 3. Check database constraints

# 4. Check external dependencies
# Example: "Supabase request failed"
# Verify: Database is up
# Check: Supabase status page

# 5. Options to fix
# A. Deploy hotfix immediately
# B. Revert previous change
# C. Scale/restart to recover

git revert [problematic_commit]
git push origin main

# Wait for Vercel redeploy
# Verify errors drop
```

---

### Slow Response Times (>1 second)

**Symptom:**
```
Vercel Analytics shows: Response time P95 = 1200ms
API endpoint takes 3+ seconds
```

**Causes:**
1. Slow database query (missing index)
2. Heavy JavaScript execution
3. N+1 query problem
4. Large response payload

**Resolution:**

```bash
# 1. Identify slow endpoint
# Vercel Analytics → [Page/API]
# See: Which specific endpoint is slow

# 2. Profile locally
# Repeat request locally
time curl https://api.example.com/polls
# See actual duration

# 3. Check database performance
# If database query slow:
EXPLAIN ANALYZE
SELECT * FROM submissions WHERE poll_id = 'poll-123';
# Look for: "Seq Scan" (bad) vs "Index Scan" (good)

# 4. Add index if missing
CREATE INDEX idx_submissions_poll_id ON submissions(poll_id);

# 5. Check for N+1 queries
# Example: Loading 100 polls, then getting submission count for each
# Fix: Use JOIN to get count in single query

# 6. Optimize code
# See docs/PERFORMANCE_TUNING_GUIDE.md

# 7. Deploy fix
npm run build  # Verify build succeeds
git push origin main
```

---

### High Memory Usage

**Symptom:**
```
Vercel logs show: Memory usage 512MB (out of 1GB)
Response times degrading
```

**Causes:**
1. Memory leak in application
2. Large dataset cached in memory
3. Connection pool not releasing connections
4. Recursive function causing stack overflow

**Resolution:**

```bash
# 1. Check memory trend
# Vercel dashboard → [Project] → Analytics
# Look for: Memory increasing over time = leak

# 2. Review recent changes
git log --oneline | head -10
# What was deployed? Any new caching?

# 3. Find leak source
# Restart application (restart all containers)
# Vercel dashboard → Deployments → "Redeploy"

# If memory spike is immediate:
# Problem is in initialization code

# If memory grows slowly:
# Problem is in route handlers (request processing)

# 4. Common leak sources
# - Event listeners not removed
# - Cache not garbage-collected
# - Database connections not released
# - Intervals/timers not cleared

# 5. Fix and redeploy
# See code, identify leak
# Write fix
# npm test && npm run build
# git push
```

---

### Database Disk Space Full

**Symptom:**
```
Supabase Console shows: Database disk 99% full
New inserts failing with: "No space left on device"
```

**Causes:**
1. Database grew larger than expected
2. Old data not purged (logs, archives)
3. Backups taking space
4. Large file uploads in database

**Resolution:**

```bash
# 1. Check actual usage
# Supabase Console → Database → Overview
# See: Disk space used, breakdown by table

# 2. Identify large tables
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

# 3. Archive old data
# Example: Move submissions older than 1 year to archive
CREATE TABLE submissions_archive AS
SELECT * FROM submissions
WHERE submitted_at < now() - interval '1 year';

DELETE FROM submissions
WHERE submitted_at < now() - interval '1 year';

# 4. Optimize space
VACUUM ANALYZE;  # Reclaim space

# 5. Upgrade database
# If permanent growth: Upgrade Supabase plan
# Supabase console → Project → Settings → Billing
```

---

## Test Issues

### Tests Fail: "Cannot find testid 'submit-button'"

**Symptom:**
```
TestError: Unable to find an element with the test id of submit-button
```

**Causes:**
1. Button not rendered (conditional logic)
2. ID is different (typo)
3. Button is lazy-loaded (async)

**Resolution:**

```typescript
// 1. Check component renders button
// src/components/Form.tsx
<button data-testid="submit-button">Submit</button>

// 2. Check test finds it
// src/components/__tests__/Form.test.tsx
const button = screen.getByTestId('submit-button');

// 3. If button is async/lazy
// Wait for it
const button = await screen.findByTestId('submit-button');

// 4. Debug: See what's actually rendered
screen.debug();  // Prints DOM to console

// 5. If component has conditional rendering
// Example: Only show button if loggedIn
if (!user) return <div>Please log in</div>;
return <button data-testid="submit">Submit</button>;

// Test must set up auth first
const { render } = createTestContext({ isLoggedIn: true });
render(<Form />);
```

---

### Tests Hang / Timeout

**Symptom:**
```
Test timeout after 5000ms waiting for element
```

**Causes:**
1. Element never appears (logic issue)
2. Promise never resolves
3. Async operation forgot `.catch()`

**Resolution:**

```bash
# 1. Increase timeout (temporary)
const element = await screen.findByTestId('btn', {}, { timeout: 10000 });

# 2. Debug: See current state
screen.debug();  // Print DOM

# 3. Check if element is hidden
const element = screen.queryByTestId('btn');
// queryBy returns null if not found (doesn't wait)
// findBy waits and throws if not found

# 4. Verify async operation completes
// ✅ Good: async function awaited
await userEvent.click(button);
const result = await screen.findByTestId('result');

// ❌ Bad: async operation not awaited
userEvent.click(button);  // Missing await
const result = screen.getByTestId('result');  // Runs before operation completes

# 5. Check for infinite loops
// In test or component
while (true) { ... }  // Will hang forever
```

---

### E2E Test Fails: "Page not loaded"

**Symptom:**
```
Playwright error: Timeout waiting for page to load
```

**Causes:**
1. Dev server not running
2. URL wrong
3. Page has JavaScript error
4. Element selector doesn't exist

**Resolution:**

```bash
# 1. Verify dev server running
npm run dev
# Should show: ✓ Ready in X.Xs

# 2. Test the URL manually
# Open http://localhost:3000 in browser
# See if page loads

# 3. Increase timeout
page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

# 4. Check browser logs
const logs = await page.evaluate(() => {
  return window.console.logs;  // All console messages
});
console.log(logs);

# 5. Check for JavaScript errors
page.on('error', error => console.log(error));
```

---

## Other Common Issues

### Redis Connection Failed

**Symptom:**
```
Error: Connection timeout - unable to reach Redis
```

**Resolution:**
- Development: Run `npx supabase start` to start Redis locally
- Production: Check Upstash console - is Redis instance active?
- Check env vars: REDIS_URL, REDIS_TOKEN correct in production?

---

### "Submission already exists"

**Symptom:**
```
Error: Unique constraint violation on (poll_id, user_id)
```

**Causes:**
User already voted on this poll

**Resolution:**
User can't vote twice - this is by design (prevents fraud). User must try different poll.

---

### Login Not Working

**Symptom:**
```
Access code accepted, but still on login page
```

**Resolution:**
1. Check token is stored in cookie: DevTools → Application → Cookies
2. Check AuthContext: <AuthProvider> wraps app?
3. Check redirect: Should go to /admin after login
4. Clear browser cache: Ctrl+Shift+Delete → Clear all

---

### Rate Limit Too Strict

**Symptom:**
```
429 Too Many Requests - user can't vote
```

**Resolution:**
1. Check limit configured correctly: See OPERATIONS_RUNBOOK.md
2. Increase limit if too strict: Edit src/lib/rate-limit.ts
3. Check Redis is working: Rate limits need Redis

---

### Import Errors in Tests

**Symptom:**
```
Cannot find module '@/lib/api'
```

**Resolution:**
- Check tsconfig.json paths are correct
- Restart IDE (sometimes TypeScript cache is stale)
- Clear .next folder: rm -rf .next

---

## Escalation Procedures

### When You're Stuck

**Step 1:** Check this guide for your issue
**Step 2:** Check related docs:
- `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/DATABASE_SCHEMA.md`

**Step 3:** Check existing issues
- GitHub: https://github.com/sstac/dashboard/issues
- Search for error message

**Step 4:** Ask for help
- Slack: #engineering channel (production issues)
- Code review: Link to PR with error
- Provide: Error message, steps to reproduce, what you've tried

---

## Getting Help

### Resources
- **Poll System Issues:** See `docs/poll-system/POLL_SYSTEM_DEBUGGING_GUIDE.md` (2000+ lines of debugging help)
- **Performance Issues:** See `docs/PERFORMANCE_TUNING_GUIDE.md`
- **Security Issues:** See `docs/SECURITY_BEST_PRACTICES.md`
- **Operations:** See `docs/OPERATIONS_RUNBOOK.md`

### Key Contacts
- Pull up the team member who owns the component
- For type issues: Check `src/types/index.ts`
- For API issues: Check `src/lib/api/index.ts`
- For database: Check `src/lib/db/queries.ts`

---

**Last Updated:** 2026-01-26
**Maintained by:** Engineering Team
**Review Cycle:** Add new issues as they occur

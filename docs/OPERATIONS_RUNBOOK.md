# Operations Runbook

**Purpose:** Guide for operations team to deploy, monitor, and respond to issues in production.

**Audience:** DevOps engineers, SREs, operations managers

**Last Updated:** 2026-01-26

---

## Quick Reference

### Critical Numbers
- **Normal Response Time:** 100-300ms
- **LCP Target:** 1.5-2s
- **Error Rate Target:** < 0.1%
- **Uptime Target:** 99.9% SLA
- **Database Max Connections:** 50
- **Redis Max Connections:** 20

### Emergency Contacts
- **On-Call Engineer:** [Slack #on-call]
- **Database Admin:** [Contact]
- **Security Team:** [Contact]

### Critical Status Pages
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Supabase Console:** https://app.supabase.com
- **Upstash Redis:** https://console.upstash.com
- **Sentry Error Tracking:** https://sentry.io

---

## Daily Checks (5 minutes)

### Morning Checklist
```bash
# 1. Check application health
curl -X GET https://[app-url]/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-01-26T10:00:00Z",
#   "checks": {
#     "database": "ok",
#     "redis": "ok",
#     "external_apis": "ok"
#   }
# }

# 2. Check Vercel deployment status
# Visit: https://vercel.com/dashboard
# Verify: Latest deploy succeeded ✓

# 3. Monitor error rates (Sentry)
# Visit: https://sentry.io/
# Check: Error count < 10 in last hour

# 4. Check database connections
# Supabase console → Database → Connections
# Verify: Active connections < 30 (out of 50 max)

# 5. Monitor application performance
# Visit: https://vercel.com/analytics
# Check metrics:
# - Response time < 300ms
# - LCP < 2s
# - Error rate < 0.1%
```

### What To Do If Issues Found
- **Database connections high?** → Check for hung queries (see Troubleshooting)
- **Error rate elevated?** → Review error log (see Error Handling section)
- **Response time slow?** → Check bundle size, database performance
- **Health check failing?** → See Incident Response section

---

## Deployment Procedures

### Pre-Deployment Checklist
```bash
# 1. Verify all tests pass
npm run test -- --run
# Expected: All 536+ tests pass

# 2. Check code quality
npm run lint
npx tsc --noEmit
# Expected: 0 errors

# 3. Build for production
npm run build
# Expected: Succeeds with ~300KB bundle

# 4. Review changes
git log origin/main..HEAD --oneline
# Expected: Meaningful commit messages

# 5. Get code review approval
gh pr list --search "is:open is:pr" | head -5
# Expected: PR approved by teammate

# 6. Run security audit
npm audit
# Expected: 0 HIGH/CRITICAL vulnerabilities

# 7. Verify database migrations
npx supabase db push --dry-run
# Expected: Shows changes, ready to apply
```

### Standard Deployment (Vercel)

Vercel auto-deploys on git push to main:

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push and create PR
git push origin feature/my-feature
gh pr create --title "Add new feature" --body "Description"

# 4. Get approval
# (Wait for code review)

# 5. Merge to main
gh pr merge [PR_NUMBER] --merge

# 6. Verify deployment
# Vercel automatically deploys
# Visit: https://vercel.com/dashboard
# Wait for "READY" status

# 7. Smoke test
curl -X GET https://[app-url]/api/health
# Expected: { "status": "healthy" }
```

### Database Migrations

For database schema changes:

```bash
# 1. Create migration
npx supabase migration new add_new_column

# 2. Edit migration file (generates in migrations/)
# Add SQL commands

# 3. Test locally
npx supabase db push

# 4. Verify migration works
npm test -- db-migration

# 5. Include in PR
# Supabase auto-applies to dev environment

# 6. Apply to production
# On deployment, run:
npx supabase db push --remote
```

### Rollback Procedure

If deployment causes issues:

```bash
# 1. Identify last known good commit
git log --oneline | head -10
# Find commit before bad one

# 2. Revert the change
git revert [BAD_COMMIT_HASH]
git push origin main

# 3. Wait for Vercel to redeploy (2-5 minutes)
# Visit: https://vercel.com/dashboard

# 4. Verify rollback
curl -X GET https://[app-url]/api/health

# 5. Investigate issue
# Run diagnostic commands (see Troubleshooting)

# 6. Fix issue on feature branch
git checkout -b hotfix/fix-issue
# [Make fixes]
git push origin hotfix/fix-issue
# [Create PR, get approval, merge]
```

---

## Monitoring & Alerting

### Key Metrics to Monitor

**Response Time (p95)**
```
Target: < 300ms
Warning: 300-500ms
Critical: > 500ms

Monitor via: Vercel Analytics, Sentry
```

**Error Rate**
```
Target: < 0.1%
Warning: 0.1-1%
Critical: > 1%

Monitor via: Sentry, application logs
```

**Database Connections**
```
Target: < 30 (of 50 max)
Warning: 30-40
Critical: > 40

Monitor via: Supabase console
```

**Redis Memory**
```
Target: < 100MB (of 256MB)
Warning: 100-200MB
Critical: > 200MB

Monitor via: Upstash console
```

**Disk Space (PostgreSQL)**
```
Target: < 50% (of 8GB typical)
Warning: 50-80%
Critical: > 80%

Monitor via: Supabase console
```

### Setting Up Alerts (Recommended)

**Sentry Alerts:**
```
1. Visit: https://sentry.io/settings/alerts/
2. Create alert: Error count > 20 in 1 hour → Slack notification
3. Create alert: Error rate > 0.5% → Page on-call engineer
```

**Vercel Alerts:**
```
1. Visit: https://vercel.com/[project]/settings/alerts
2. Create alert: Build fails → Slack notification
3. Create alert: Response time > 500ms → Email
```

**Supabase Alerts:**
```
1. Visit: https://app.supabase.com/project/[id]/settings/general
2. Monitor: Database disk usage
3. Monitor: Connection count
```

---

## Common Issues & Resolution

### High Memory Usage

**Symptom:** Response time slow, memory spike in Vercel logs

**Diagnosis:**
```bash
# 1. Check memory usage (Vercel dashboard)
# https://vercel.com/[project]/analytics

# 2. Check for memory leaks
# Review recent code changes: git log --oneline | head -20

# 3. Check database query performance
# See "Slow Database Queries" section below
```

**Resolution:**
```bash
# Option 1: Increase bundle size efficiency
npm run build --analyze
# Look for large libraries, consider lazy loading

# Option 2: Optimize database queries
# Run EXPLAIN ANALYZE on slow queries (Supabase)

# Option 3: Clear Redis cache
redis-cli FLUSHALL  # Or via Upstash console
```

### Database Connection Timeout

**Symptom:** Requests fail with "ECONNREFUSED" or timeout

**Diagnosis:**
```bash
# 1. Check Supabase status
curl https://status.supabase.com/api/v2/status.json

# 2. Check connection count
# Supabase console → Database → Connections

# 3. Check for hung connections
# SQL query: SELECT pid, now() - query_start FROM pg_stat_activity WHERE state != 'idle';
```

**Resolution:**
```bash
# Option 1: Restart application (Vercel redeploy)
gh workflow run deploy.yml

# Option 2: Close hung connections (Supabase)
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '30 minutes';

# Option 3: Increase connection pool
# Supabase settings → Connection pooler mode
```

### Redis Cache Misses

**Symptom:** Performance degrades, database queries increase

**Diagnosis:**
```bash
# 1. Check Redis status
# Upstash console → Database → Monitor

# 2. Check cache hit rate
# Application metrics (Sentry/Vercel)

# 3. Identify missing cache keys
# Review recent code changes
```

**Resolution:**
```bash
# Option 1: Warm cache on deployment
curl https://[app-url]/api/admin/cache/warm

# Option 2: Extend cache TTL
# Edit cache configuration in src/lib/cache.ts

# Option 3: Increase Redis memory
# Upstash console → Resize database
```

### Deployment Failure

**Symptom:** "Deploy failed" in Vercel dashboard, build logs show errors

**Diagnosis:**
```bash
# 1. Check build logs
# Vercel dashboard → [Project] → Deployments → [Failed deploy]

# 2. Common build failures:
# - TypeScript errors: npm run build
# - Missing env vars: Check .env files
# - Dependency issue: npm install --force

# 3. Check git status
git status
git log --oneline | head -5
```

**Resolution:**
```bash
# Option 1: Fix the issue locally
# Reproduce error: npm run build
# Fix TypeScript errors: npx tsc --noEmit
# Test: npm test -- --run
# Push fix: git push origin [branch]

# Option 2: Revert to previous version
git revert [BAD_COMMIT]
git push origin main

# Option 3: Skip Vercel cache (last resort)
# Vercel dashboard → Project settings → Deployments → "Redeploy"
```

---

## Incident Response

### Incident Assessment (First 5 minutes)

When you discover an issue:

```
1. ASSESS severity:
   - Critical: Service down, data corruption, security breach
   - High: Degraded performance (p95 > 1s), error rate > 5%
   - Medium: Intermittent errors < 5%, performance slow
   - Low: Single user issue, cosmetic bug

2. TRIAGE (who needs to know):
   - Critical: Page on-call engineer + team lead + security
   - High: Notify team lead + on-call engineer
   - Medium: Slack #incidents channel
   - Low: Create GitHub issue

3. CONTAIN (stop further damage):
   - Database issue? Check connection limits
   - Memory leak? Restart application
   - Security issue? Disable affected feature
   - Data issue? Pause writes to that table

4. COMMUNICATE:
   - Create incident ticket
   - Update status page
   - Notify stakeholders
   - Post updates every 15 minutes
```

### Critical Incident: Service Completely Down

**Steps:**
```bash
# 1. Verify it's actually down
curl -X GET https://[app-url]/api/health
curl -X GET https://[app-url]  # Check main page

# 2. Check infrastructure status
# - Vercel: https://status.vercel.com
# - Supabase: https://status.supabase.com
# - Upstash: https://upstash.statuspage.io

# 3. Try immediate restart
# Vercel Dashboard → [Project] → Deployments → "Redeploy"
# Wait 2-5 minutes for deploy

# 4. If still down, check logs
# Vercel: Dashboard → Functions → Logs
# Supabase: Console → Logs
# Check for errors: "connection refused", "out of memory", "FATAL"

# 5. Last resort: Rollback
git revert [LATEST_COMMIT]
git push origin main
# Wait for Vercel redeploy

# 6. Post-mortem
# Create GitHub issue: "Incident: Service down at [TIME]"
# Include: cause, resolution, prevention
```

### High Severity: Database Issues

**Steps:**
```bash
# 1. Check database status
# Supabase Console → Overview → Health

# 2. Check connection pool
# Supabase → Database → Connections
# If > 50: Terminal hanging connections (see "Database Timeout" section)

# 3. Check disk space
# Supabase → Database → Overview → "Disk space"
# If > 7GB (of 8GB): Need to clean up or upgrade

# 4. Check for slow queries
# Supabase → Logs → Database logs
# Look for queries taking > 1s

# 5. If query is slow:
SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 5;
# Run EXPLAIN ANALYZE on slow query
# Look for sequential scans on large tables (add index)

# 6. If unable to recover:
# Restore from backup:
# Supabase → Database → Backups → Restore
# Select backup before issue started
```

### Security Incident Response

**Steps:**
```bash
# 1. IMMEDIATE: Identify severity
# - RCE (Remote Code Execution): CRITICAL → kill application
# - Data breach: CRITICAL → enable audit logging, restrict access
# - XSS vulnerability: HIGH → deploy fix ASAP
# - Auth bypass: CRITICAL → force logout all users

# 2. CONTAINMENT:
# - Kill application: Vercel Dashboard → [Project] → disable
# - Restrict access: Supabase → RLS policies → block external access
# - Force logout: Clear Redis session cache
# - Revoke keys: Rotate API keys if exposed

# 3. INVESTIGATION:
# - Review logs: Sentry, Vercel, Supabase for suspicious activity
# - Check git history: Who made changes? What changed?
# - Review database: Any unauthorized data accessed/modified?
# - Check API logs: Which endpoints were hit?

# 4. REMEDIATION:
# - Patch vulnerable code
# - Update dependencies: npm audit fix
# - Deploy fix: Follow normal deployment procedure
# - Verify fix: Security scan, code review

# 5. DISCLOSURE (if needed):
# - Notify affected users (if data exposed)
# - Consult legal team
# - File security report (if required by regulations)
# - Update documentation

# 6. POST-INCIDENT:
# - Write security advisory
# - Update SECURITY_BEST_PRACTICES.md
# - Add regression test to prevent repeat
# - Schedule team security review
```

---

## Scheduled Maintenance

### Weekly (Monday 2 AM UTC)

```bash
# 1. Database maintenance
# Supabase → Database → Maintenance
# Auto-vacuum should run (enabled by default)

# 2. Backup verification
# Check: Last backup successful
# Supabase → Database → Backups
# Verify: Restore test succeeds

# 3. Dependency updates (if automated)
# Review: Dependabot/Renovate PRs
# Merge: Safe, non-breaking updates
# Skip: Major versions (reviewed separately)
```

### Monthly (First Monday)

```bash
# 1. Performance review
# Analyze: Last 30 days metrics
# Check: Trends, anomalies
# Document: Findings

# 2. Capacity planning
# Monitor: Database disk usage
# Trend: Growing? Optimize or upgrade
# Monitor: Redis memory
# Trend: Growing? Increase TTL or size

# 3. Security audit
npm audit
# Review: New CVEs in dependencies
npm audit fix
# Deploy: If necessary
```

### Quarterly (Jan 1, Apr 1, Jul 1, Oct 1)

```bash
# 1. Disaster recovery test
# Restore: From 1-month-old backup
# Verify: All data intact
# Test: Application works
# Document: RTO/RPO

# 2. Architecture review
# Review: Any scaling issues
# Review: Any security concerns
# Plan: Needed upgrades

# 3. Update runbooks
# Review: This file
# Update: Any changed procedures
# Share: Team review
```

---

## Performance Optimization

### Identify Slow Endpoints

```bash
# Check Vercel Analytics
# https://vercel.com/[project]/analytics

# Look for: Endpoint response time > 500ms
# Common culprits:
# 1. Database query not indexed
# 2. N+1 query problem
# 3. Large response payload
# 4. External API call
```

### Database Query Optimization

```sql
-- Find slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Run EXPLAIN ANALYZE on slow query
EXPLAIN ANALYZE
SELECT * FROM polls WHERE status = 'open';

-- If "Seq Scan" on large table, add index:
CREATE INDEX idx_polls_status ON polls(status);

-- Verify query now uses index:
EXPLAIN ANALYZE
SELECT * FROM polls WHERE status = 'open';
-- Should show "Index Scan" not "Seq Scan"
```

### Redis Cache Optimization

```bash
# Check cache size
redis-cli INFO memory
# Look for: used_memory_human

# Check key usage
redis-cli --scan --pattern "*" | wc -l

# Clear old cache
redis-cli FLUSHDB  # Only if sure!

# Monitor real-time
redis-cli MONITOR  # See all commands
```

### Bundle Size Optimization

```bash
# Analyze bundle
npm run build --analyze
# Look for: Unexpectedly large dependencies

# Use lazy loading
# src/components/LazyComponent.tsx
const LazyComponent = lazy(() => import('./Component'));

# Use dynamic imports
// src/pages/page.tsx
const Chart = dynamic(() => import('recharts'), { ssr: false });
```

---

## Backup & Disaster Recovery

### Backup Frequency

**Automatic Supabase Backups:**
- Daily: Keep for 7 days
- Weekly: Keep for 4 weeks
- Monthly: Keep indefinitely

**Manual Backup (Before Major Change):**
```bash
# Export database backup
pg_dump -h [host] -U postgres [db_name] > backup.sql

# Export as CSV (for specific table)
COPY polls TO STDOUT WITH CSV HEADER;
```

### Restore Procedure

**From Supabase Backup:**
```bash
# 1. Supabase Dashboard
# Database → Backups → [Select backup] → "Restore"

# 2. Verification
# Connect to database
psql -h [restored-host] -U postgres [db_name]
# SELECT COUNT(*) FROM polls;  # Verify data

# 3. Test application
npm run test -- db-recovery

# 4. Update connection string (if host changed)
# Update .env SUPABASE_URL
```

**Point-in-Time Recovery:**
```bash
# If within 24 hours, can restore to specific time
# Contact Supabase support or use console:
# Database → Backups → "Point in time recovery"
```

---

## Scaling Considerations

### When to Scale

**Vertical Scaling (bigger machine):**
- Response time consistently > 500ms
- Memory usage > 500MB
- CPU > 80% sustained

**Horizontal Scaling (more instances):**
- Load distributing unevenly
- Need redundancy
- Expected traffic spike

### Scaling Checklist

```bash
# Before scaling:
1. [ ] Optimize database queries (see Performance section)
2. [ ] Verify caching working
3. [ ] Check bundle size
4. [ ] Review recent changes

# Scaling process:
1. [ ] Update Vercel plan (if needed)
2. [ ] Update Supabase plan (if needed)
3. [ ] Update Redis plan (if needed)
4. [ ] Deploy & monitor
5. [ ] Document change in runbook
```

---

## Template: Post-Incident Report

Use this template after resolving an incident:

```markdown
# Incident Report: [Service] - [Date]

## Summary
[1-2 sentence summary of what happened]

## Timeline
- 14:23 UTC: Issue detected
- 14:28 UTC: Root cause identified
- 14:35 UTC: Fix deployed
- 14:40 UTC: Service recovered

## Root Cause
[Technical explanation]

## Impact
- Duration: 17 minutes
- Affected Users: ~50 (5% of active)
- Error Rate: 42%
- Data Lost: None

## Resolution
[What was done to fix it]

## Prevention
[What will prevent this in future]

## Follow-up Tasks
- [ ] Add monitoring for this condition
- [ ] Update [documentation]
- [ ] Add regression test
- [ ] Schedule team review
```

---

## Emergency Contacts

Keep this updated:

| Role | Name | Slack | Phone |
|---|---|---|---|
| On-Call Engineer | [Name] | @[user] | [Phone] |
| Team Lead | [Name] | @[user] | [Phone] |
| Security Lead | [Name] | @[user] | [Phone] |
| DevOps | [Name] | @[user] | [Phone] |
| Database Admin | [Name] | @[user] | [Phone] |

---

**Last Updated:** 2026-01-26
**Reviewed by:** [Name]
**Next Review:** [Date]

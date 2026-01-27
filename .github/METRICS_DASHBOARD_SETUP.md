# Performance Metrics Dashboard (Phase 6)

**Status:** Configuration and Implementation Guide
**Last Updated:** 2026-01-26
**Responsibility:** DevOps & Performance Team

---

## Overview

This document describes the performance metrics dashboard for real-time visibility into application health, performance, and usage metrics.

**Dashboard Components:**
- Core Web Vitals monitoring (LCP, INP, CLS)
- API performance metrics (latency, error rates)
- Database performance (query times, connection health)
- Infrastructure metrics (memory, CPU, edge network)
- Business metrics (users, requests, poll participation)

---

## 1. Vercel Analytics Dashboard

### 1.1 Setup

1. Navigate to https://vercel.com/dashboard/[project-name]/analytics
2. Create custom dashboard (if not default)
3. Add widgets for key metrics

### 1.2 Core Web Vitals Widget

**Configure:**
- Metric: Largest Contentful Paint (LCP)
- Target: < 2.0 seconds
- Frequency: Real-time (updated every 5 minutes)
- Timeframe: Last 7 days with trend line

**Display:**
- Current value (e.g., "1.8s")
- Target status (🟢 Green = on target)
- Percentile breakdown (p50, p75, p95, p99)
- Comparison to previous period

**Widget 2: Interaction to Next Paint (INP)**
- Metric: Interaction to Next Paint
- Target: < 100 milliseconds
- Display: Real-time with trend
- Percentiles: p50, p75, p95

**Widget 3: Cumulative Layout Shift (CLS)**
- Metric: Cumulative Layout Shift
- Target: < 0.1
- Display: Real-time with distribution
- Page-by-page breakdown

### 1.3 Performance Comparison

Add comparison widget:

| Metric | Target | Current | Trend | Status |
|--------|--------|---------|-------|--------|
| LCP | < 2.0s | 1.8s | ↓ 5% | ✅ |
| INP | < 100ms | 72ms | ↑ 2% | ✅ |
| CLS | < 0.1 | 0.08 | → 0% | ✅ |

---

## 2. API Performance Dashboard

### 2.1 Dashboard Components

**Widget 1: API Response Time**
- Metric: API response time (milliseconds)
- Breakdown by endpoint:
  - `/api/polls` (target: <200ms)
  - `/api/polls/:id/vote` (target: <500ms)
  - `/api/prioritization-matrix` (target: <1000ms)
  - `/api/wordcloud/results` (target: <800ms)
  - `/api/regulatory-review/search` (target: <500ms)

**Widget 2: API Error Rate**
- Metric: % of requests returning 4xx/5xx
- Target: < 0.1%
- Breakdown by endpoint
- Breakdown by status code (400, 401, 403, 404, 500, 502, 503)

**Widget 3: API Request Volume**
- Metric: Requests per minute
- Trend over 24 hours
- Breakdown by endpoint
- Peak usage times

**Widget 4: API Latency Percentiles**
- p50 (median)
- p75
- p95
- p99

Example:
```
GET /api/polls
- p50: 120ms
- p75: 180ms
- p95: 350ms
- p99: 800ms
```

### 2.2 Setting Up API Metrics

Vercel automatically tracks API response times. To enable custom metrics:

1. In `.next/server/api-routes-manifest.json` (auto-generated)
2. Vercel Functions dashboard shows execution time
3. Access via: https://vercel.com/[project]/functions

### 2.3 Creating Custom API Metrics

Add metrics to middleware:

```typescript
// src/middleware.ts
import { recordMetric } from '@/lib/metrics';

export function middleware(request: NextRequest) {
  const start = performance.now();

  // Process request
  const response = NextResponse.next();

  // Record metric
  const duration = performance.now() - start;
  const path = request.nextUrl.pathname;

  recordMetric('api_response_time', duration, {
    method: request.method,
    path,
    status: response.status,
  });

  return response;
}
```

---

## 3. Database Performance Dashboard

### 3.1 Key Metrics to Track

**Metric 1: Query Response Time**
- P50 response time
- P95 response time
- P99 response time
- Trend: Last 24 hours

**Metric 2: Slow Query Detection**
- Number of queries > 1000ms
- Top slow queries (by frequency)
- Queries needing optimization

**Metric 3: Connection Pool Status**
- Active connections (current / max)
- Connection wait time
- Connection failures

**Metric 4: Database Load**
- Queries per second
- Peak load (concurrent queries)
- CPU usage

### 3.2 Supabase Metrics

Access Supabase metrics:
1. Go to Supabase dashboard → [project] → Monitoring
2. View:
   - Query performance
   - Connection pool status
   - Disk usage
   - Network I/O

### 3.3 Creating Database Dashboards

In Vercel or custom dashboard:

```
Database Performance (Last 24 Hours)
┌─────────────────────────────────────┐
│ Query Response Time                 │
│ p50: 45ms | p95: 120ms | p99: 850ms │
├─────────────────────────────────────┤
│ Slow Queries (>1000ms)              │
│ 3 queries detected                   │
│ Top: SELECT * FROM submissions (5x)  │
├─────────────────────────────────────┤
│ Connection Pool                     │
│ 15/20 active connections            │
│ Avg wait: 2ms                        │
└─────────────────────────────────────┘
```

---

## 4. Infrastructure Metrics

### 4.1 Vercel Metrics

**Access:** https://vercel.com/[project]/analytics/usage

Metrics provided:
- Function duration (execution time)
- Function memory usage
- Edge Network bandwidth
- Data transfer (request/response)
- Regions (response time by region)

### 4.2 Cold Start Monitoring

Track function cold starts:

| Deployment | Cold Start Time | Warm Request |
|-----------|-----------------|--------------|
| Baseline | 850ms | 45ms |
| Phase 4 optimized | 720ms | 42ms |
| Phase 6 current | 650ms | 40ms |
| Target | < 500ms | < 50ms |

### 4.3 Edge Network Performance

Monitor by region:
- us-east-1: 45ms avg
- eu-west-1: 70ms avg
- ap-southeast-1: 120ms avg

---

## 5. Business Metrics Dashboard

### 5.1 User Engagement Metrics

**Widget 1: Active Users**
- Daily Active Users (DAU)
- Monthly Active Users (MAU)
- Trend: Last 30 days

**Widget 2: Poll Participation**
- Total polls created
- Polls with submissions
- Submission rate (%)
- Most popular polls

**Widget 3: Regulatory Review Progress**
- Documents reviewed
- Assessment completion rate (%)
- Average review time
- Completion trend

### 5.2 Traffic Metrics

**Widget 1: Request Volume**
- Requests per hour
- Peak usage time
- Traffic sources (organic, direct, referrer)

**Widget 2: User Sessions**
- Session duration (average)
- Pages per session
- Bounce rate (%)

**Widget 3: Conversion Funnels**
- Login → Poll participation
- Document view → Assessment completion
- Signups → First action

---

## 6. Creating Custom Dashboards (All Free)

### 6.1 Vercel Analytics Dashboard (Completely Free)

1. Go to Vercel Dashboard → Analytics (free, included)
2. View automatically-generated metrics:

   **Core Web Vitals Widget** (automatic)
   - LCP, INP, CLS with trends
   - Real-time updates
   - Last 30 days history
   - No setup needed

   **API Performance Widget** (automatic)
   - Response time by endpoint
   - Error rates
   - Request volume
   - No configuration needed

   **Regional Performance** (automatic)
   - Edge network latency
   - By geographic region
   - No extra cost

### 6.2 Custom Dashboard with Supabase (Free)

Create your own metrics dashboard by querying logs:

**Query: Error rate dashboard**
```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_errors,
  COUNT(CASE WHEN level = 'CRITICAL' THEN 1 END) as critical_errors
FROM error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;
```

**Query: API performance dashboard**
```sql
SELECT
  source,
  COUNT(*) as request_count,
  ROUND(AVG(CAST(context->>'duration' AS NUMERIC))::numeric, 2) as avg_duration_ms,
  MAX(CAST(context->>'duration' AS NUMERIC)) as max_duration_ms
FROM logs
WHERE source = 'api'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY source
ORDER BY request_count DESC;
```

**Query: User activity dashboard**
```sql
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as active_users,
  COUNT(*) as total_events
FROM logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 6.3 Simple HTML Dashboard (Optional)

Create a basic HTML page to display metrics:

```typescript
// src/app/dashboard/metrics/page.tsx
export default async function MetricsDashboard() {
  // Query Supabase for metrics
  const errorCount = await getErrorCount();
  const avgResponseTime = await getAvgResponseTime();
  const activeUsers = await getActiveUsers();

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      <Card>
        <h3>24h Errors</h3>
        <p className="text-2xl">{errorCount}</p>
      </Card>
      <Card>
        <h3>Avg Response Time</h3>
        <p className="text-2xl">{avgResponseTime}ms</p>
      </Card>
      <Card>
        <h3>Active Users</h3>
        <p className="text-2xl">{activeUsers}</p>
      </Card>
    </div>
  );
}
```

---

## 7. Real-Time Alerts on Dashboard

### 7.1 Alert Threshold Configuration

Add alert indicators to dashboard:

**LCP Alert**
```
IF LCP > 2.5s (target: <2.0s)
  Status: 🔴 RED
  Action: "Review image optimization, code splitting"

IF LCP > 2.0s and < 2.5s
  Status: 🟡 YELLOW
  Action: "Monitor, no immediate action needed"

IF LCP < 2.0s
  Status: 🟢 GREEN
  Action: "Target met"
```

**API Response Time Alert**
```
IF endpoint response time > 1000ms (target: <500ms)
  Status: 🔴 RED
  Action: "Check database performance, cache status"

IF endpoint response time > 500ms
  Status: 🟡 YELLOW
  Action: "Monitor performance"
```

**Error Rate Alert**
```
IF error rate > 1% (target: <0.1%)
  Status: 🔴 RED
  Action: "Check Sentry for error details"

IF error rate > 0.5%
  Status: 🟡 YELLOW
  Action: "Trending upward"
```

### 7.2 Dashboard Auto-Refresh

Configure dashboard refresh rates:
- 5 minutes: Real-time metrics (API, errors)
- 1 hour: Business metrics (user engagement)
- 24 hours: Trend analysis

---

## 8. Historical Analysis & Reporting

### 8.1 Weekly Performance Report

Create automated report:

```markdown
## Weekly Performance Report (Jan 20-26, 2026)

### Core Web Vitals
- LCP: 1.8s (target: <2.0s) ✅
- INP: 72ms (target: <100ms) ✅
- CLS: 0.08 (target: <0.1) ✅

### API Performance
- Avg response time: 185ms ✅
- Error rate: 0.05% ✅
- 99th percentile: 850ms ✅

### Database Performance
- Avg query time: 45ms ✅
- Slow queries: 3 (improvement from 8)
- Connection pool health: 100% ✅

### Traffic & Usage
- DAU: 2,340 (↑ 12% from last week)
- Polls submitted: 450 (↑ 8%)
- Regulatory reviews: 23 complete (↑ 15%)

### Infrastructure
- Uptime: 99.98% ✅
- Cold start time: 650ms (↓ 100ms)
- Edge latency: 45ms avg ✅

### Action Items
- [ ] None - all metrics on target
- [ ] Review 3 slow queries for optimization
- [ ] Monitor DAU growth trend
```

### 8.2 Monthly Trend Analysis

Compare month-over-month:

```
January 2026 vs December 2025

Core Web Vitals:
- LCP: 1.8s (was 1.9s) ↓ 5% improvement
- INP: 72ms (was 85ms) ↓ 15% improvement
- CLS: 0.08 (was 0.09) ↓ 11% improvement

API Performance:
- Response time: 185ms (was 210ms) ↓ 12% faster
- Error rate: 0.05% (was 0.12%) ↓ 58% fewer errors
- Throughput: 50k req/day (was 35k req/day) ↑ 43% growth

User Growth:
- DAU: 2,340 (was 1,820) ↑ 29% growth
- Polls/day: 65 (was 45) ↑ 44% growth
- Reviews/day: 3.3 (was 2.1) ↑ 57% growth
```

---

## 9. Dashboard Maintenance

### 9.1 Weekly Checklist

- [ ] Review dashboard metrics
- [ ] Check for anomalies or trends
- [ ] Verify alerts triggered correctly
- [ ] Update alert thresholds if needed
- [ ] Document any issues in runbook

### 9.2 Monthly Checklist

- [ ] Generate monthly report
- [ ] Analyze trends month-over-month
- [ ] Review slowest API endpoints
- [ ] Identify optimization opportunities
- [ ] Update performance targets if needed

### 9.3 Quarterly Checklist

- [ ] Full dashboard review
- [ ] Update metric definitions
- [ ] Recalibrate alert thresholds
- [ ] Add new metrics if needed
- [ ] Team training on dashboard usage

---

## 10. Dashboard Access & Permissions

### 10.1 Access Levels

| Role | Access | Permissions |
|------|--------|-------------|
| DevOps | Full | View, edit, delete dashboards |
| Engineering Lead | Full | View, edit, create dashboards |
| Developers | View-only | Monitor metrics, read alerts |
| Support | View-only | Limited access (user-facing metrics) |
| Management | Summary | Weekly reports only |

### 10.2 Sharing Dashboards

**Public Share:**
- Generate public link from Vercel
- Share with stakeholders
- No authentication required

**Team Share:**
- Add team members in Vercel settings
- Assign roles (viewer, editor)
- Activity log for audit trail

---

## 11. Integration with Other Systems

### 11.1 Dashboard → Slack Automation

Post metrics to Slack daily:

```
@team Daily Metrics Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Core Web Vitals: All Green (LCP 1.8s, INP 72ms, CLS 0.08)
✅ API Performance: 185ms avg, 0.05% error rate
✅ Database: Healthy (45ms avg query time)
✅ Uptime: 99.98% (1 incident, 14-second resolution)
📈 Traffic: 2,340 DAU (+12% week over week)
```

### 11.2 Dashboard → Incident Management

Escalate anomalies to incident management:

```
Anomaly Detected:
- API response time spike to 2500ms
- Error rate jumped to 2.5%
- Database connection pool near capacity

Action:
- Created PagerDuty incident #12345
- Notified on-call engineer
- Triggered automated runbook
```

---

## 12. Dashboard Checklist (Phase 6 Task 4)

Before considering metrics dashboard complete:

**Vercel Analytics Setup:**
- [ ] Core Web Vitals dashboard created
- [ ] API Performance dashboard created
- [ ] All 3 CVW metrics displaying
- [ ] Percentile breakdowns visible
- [ ] Trend lines showing

**Custom Metrics:**
- [ ] API response time tracking
- [ ] Error rate tracking
- [ ] Request volume tracking
- [ ] Database query performance tracking
- [ ] All metrics sending to Vercel

**Alerts Configured:**
- [ ] LCP > 2.5s alert set
- [ ] API response time > 1s alert set
- [ ] Error rate > 1% alert set
- [ ] Database connection alert set
- [ ] All alerts routed to Slack

**Reporting:**
- [ ] Weekly automated report created
- [ ] Monthly trend analysis configured
- [ ] Dashboard shared with stakeholders
- [ ] Historical data accessible

**Documentation:**
- [ ] Dashboard usage guide created
- [ ] Metric definitions documented
- [ ] Alert threshold rationale recorded
- [ ] Interpretation guide for team

---

## 13. Next Steps

**Immediate (This Sprint):**
- [ ] Set up Vercel Analytics dashboards
- [ ] Configure Core Web Vitals widgets
- [ ] Create API performance dashboard
- [ ] Set up alerts

**Short Term (Next Sprint):**
- [ ] Add custom metrics to middleware
- [ ] Implement database metrics tracking
- [ ] Create weekly automated report
- [ ] Train team on dashboard

**Medium Term (Within 6 weeks):**
- [ ] Full monitoring validation (Task 6.5)
- [ ] Quarterly review and optimization
- [ ] Expand to Datadog (if scaling)
- [ ] Add ML-based anomaly detection

---

**Document Status:** Implementation in Progress
**Last Updated:** 2026-01-26
**Maintained by:** DevOps & Performance Team

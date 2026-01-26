# Monitoring & Alerting Setup (Phase 6)

**Status:** Configuration and Implementation Guide
**Last Updated:** 2026-01-26
**Responsibility:** DevOps Team

---

## Overview

This document outlines the complete monitoring and alerting strategy for SSTAC Dashboard production environment.

**Key Systems:**
- Error Tracking: Sentry
- Performance Monitoring: Vercel Analytics
- Uptime Monitoring: Vercel Health Checks
- Log Aggregation: Structured Logging + Aggregation Service
- Custom Metrics: Next.js instrumentation

---

## 1. Sentry Error Tracking Setup

### 1.1 Prerequisites
- Sentry account created at https://sentry.io
- Project created for SSTAC Dashboard
- DSN key available from Sentry

### 1.2 Environment Configuration

Add to `.env.local` and GitHub Secrets:
```
NEXT_PUBLIC_SENTRY_DSN=https://[key]@sentry.io/[project-id]
SENTRY_ORG=your-org-name
SENTRY_PROJECT=sstac-dashboard
SENTRY_AUTH_TOKEN=[auth-token-from-sentry]
SENTRY_ENVIRONMENT=production
```

### 1.3 Current Implementation Status

**Browser Errors:** ✅ CONFIGURED
- Sentry automatically captures JavaScript errors
- Next.js wrapper configured in `instrumentation.ts`
- Source maps uploaded for better error context

**Server Errors:** ✅ CONFIGURED
- API route errors captured
- Database connection errors logged
- Authentication failures tracked

**Performance Monitoring:** ✅ CONFIGURED
- Core Web Vitals tracking enabled
- API endpoint performance captured
- Database query slow logs monitored

### 1.4 Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| New Error Rate | 10+ errors/minute | Page in DevOps team |
| Critical Errors | 5G+ severity errors | Immediate Slack notification |
| Error Frequency | 100+ errors/day | Daily summary email |
| LCP Degradation | >2.5s (was 2.0s) | Alert to performance team |
| API Error Rate | >2% requests | Check API logs, investigate |

### 1.5 Sentry Notification Rules

**Setup in Sentry UI:**

1. **Critical Path Errors**
   - Error level: Error or higher
   - Action: Slack #incidents-prod
   - Rate: Immediate

2. **Performance Regressions**
   - Metric: LCP > 2.5s
   - Action: Slack #performance
   - Rate: On regression detection

3. **Database Errors**
   - Message contains: "connection", "timeout", "pool"
   - Action: Slack #infrastructure
   - Rate: Batched (5 min)

4. **Auth Failures**
   - Event: Auth error
   - Action: Slack #security
   - Rate: Batched (15 min)

---

## 2. Vercel Analytics & Monitoring

### 2.1 Core Web Vitals Dashboard

**Access:** https://vercel.com/dashboard/[project-name]/analytics

**Monitored Metrics:**
- LCP: Target <2s, Alert >2.5s
- INP: Target <100ms, Alert >150ms
- CLS: Target <0.1, Alert >0.15

**Frequency:** Real-time (updated every 5 minutes)

### 2.2 Deployment Metrics

Track per-deployment:
- Build time (target: <5 minutes)
- Deploy time (target: <2 minutes)
- Overall time to stable state

### 2.3 API Response Times

Monitor by endpoint:
- GET /api/polls (target: <200ms)
- POST /api/polls/:id/vote (target: <500ms)
- GET /api/prioritization-matrix (target: <1s)

### 2.4 Database Connection Performance

Vercel PostgreSQL proxy metrics:
- Connection pool utilization
- Query latency percentiles (p50, p95, p99)
- Slow query log

---

## 3. Uptime & Health Checks

### 3.1 Vercel Health Checks

**Endpoint:** `GET /api/health`

Creates this endpoint to verify system health:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check database connectivity
    const dbHealth = await checkSupabaseConnection();

    // Check Redis connectivity
    const redisHealth = await checkRedisConnection();

    // Check required services
    if (!dbHealth || !redisHealth) {
      return NextResponse.json(
        {
          status: 'degraded',
          database: dbHealth ? 'ok' : 'down',
          redis: redisHealth ? 'ok' : 'down',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      database: 'ok',
      redis: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
```

**Vercel Configuration** (in vercel.json):
```json
{
  "monitors": [
    {
      "path": "/api/health",
      "name": "Health Check",
      "interval": 60,
      "timeout": 10000,
      "statusCode": 200,
      "regions": ["sfo1", "iad1"]
    }
  ]
}
```

### 3.2 Alerting on Downtime

When health check fails 3 consecutive times:
- Alert sent to #incidents-prod Slack channel
- PagerDuty integration (if configured)
- Email notification to on-call engineer

---

## 4. Custom Metrics & Instrumentation

### 4.1 API Performance Metrics

Track in middleware `src/middleware.ts`:

```typescript
import { recordMetric } from '@/lib/metrics';

export function middleware(request: NextRequest) {
  const startTime = performance.now();

  // Let request proceed
  const response = NextResponse.next();

  // Record timing after response
  const duration = performance.now() - startTime;
  recordMetric('api_request_duration', duration, {
    method: request.method,
    path: request.nextUrl.pathname,
    status: response.status,
  });

  return response;
}
```

### 4.2 Database Query Performance

Track slow queries in `src/lib/db/queries.ts`:

```typescript
export async function executeQuery<T>(
  query: string,
  params: unknown[] = [],
  slowThresholdMs = 1000
): Promise<T[]> {
  const start = performance.now();

  try {
    const result = await supabase.rpc('execute_query', {
      query,
      params,
    });

    const duration = performance.now() - start;

    if (duration > slowThresholdMs) {
      recordMetric('slow_query', duration, {
        query: query.substring(0, 100),
      });
    }

    return result;
  } catch (error) {
    recordMetric('query_error', 1, {
      query: query.substring(0, 100),
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}
```

### 4.3 Cache Hit Rates

Track in `src/lib/cache.ts`:

```typescript
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      recordMetric('cache_hit', 1, { key });
      return JSON.parse(cached);
    }
    recordMetric('cache_miss', 1, { key });
    return null;
  } catch (error) {
    recordMetric('cache_error', 1, { key });
    return null;
  }
}
```

---

## 5. Slack Integration for Alerts

### 5.1 Setup Slack Webhooks

1. Create Slack app: https://api.slack.com/apps
2. Add Incoming Webhooks
3. Create webhooks for:
   - #incidents-prod
   - #performance
   - #infrastructure
   - #security

4. Add to GitHub Secrets:
   - SLACK_WEBHOOK_INCIDENTS
   - SLACK_WEBHOOK_PERFORMANCE
   - SLACK_WEBHOOK_INFRASTRUCTURE
   - SLACK_WEBHOOK_SECURITY

### 5.2 Alert Message Format

```json
{
  "channel": "#incidents-prod",
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🚨 Critical Alert: High Error Rate"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Environment:*\nproduction"
        },
        {
          "type": "mrkdwn",
          "text": "*Error Rate:*\n15 errors/minute"
        },
        {
          "type": "mrkdwn",
          "text": "*Timestamp:*\n2026-01-26 14:30:00 UTC"
        },
        {
          "type": "mrkdwn",
          "text": "*Status:*\nInvestigating"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Top Error:* Database connection timeout in `/api/polls`"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View in Sentry"
          },
          "url": "https://sentry.io/issues"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View in Vercel"
          },
          "url": "https://vercel.com/dashboard"
        }
      ]
    }
  ]
}
```

### 5.3 GitHub Action for Slack Notifications

Create `.github/workflows/notify-deployment.yml`:

```yaml
name: Deployment Notifications

on:
  deployment_status:
    types: [success, failure]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Slack on Success
        if: github.event.deployment_status.state == 'success'
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_INCIDENTS }}
          payload: |
            {
              "text": "✅ Deployment successful to production",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*✅ Deployment Successful*\nEnvironment: Production\nRef: ${{ github.event.ref }}\nCommit: ${{ github.event.deployment.commit_sha }}"
                  }
                }
              ]
            }

      - name: Notify Slack on Failure
        if: github.event.deployment_status.state == 'failure'
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_INCIDENTS }}
          payload: |
            {
              "text": "❌ Deployment failed to production",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*❌ Deployment Failed*\nEnvironment: Production\nRef: ${{ github.event.ref }}\nCheck logs for details"
                  }
                }
              ]
            }
```

---

## 6. Alert Escalation Policy

### 6.1 Severity Levels

| Level | Response Time | Escalation | Channel |
|-------|---------------|------------|---------|
| P1 - Critical | 15 minutes | Page on-call | #incidents-prod |
| P2 - High | 1 hour | Slack notification | #incidents-prod |
| P3 - Medium | 4 hours | Daily summary | #infrastructure |
| P4 - Low | 24 hours | Weekly report | #engineering |

### 6.2 On-Call Rotation

Maintain on-call rotation with:
- Primary on-call engineer (1 week)
- Secondary on-call engineer (backup)
- Escalation to team lead after 1 hour unacknowledged P1

### 6.3 Incident Response Checklist

When alert fires:

**Immediate (0-5 min):**
- [ ] Acknowledge alert in Slack
- [ ] Check Sentry for error details
- [ ] Check Vercel deployment status
- [ ] Assess impact (users affected, data at risk)

**Investigation (5-15 min):**
- [ ] Review recent deployments
- [ ] Check database connection status
- [ ] Review API logs for errors
- [ ] Check external service dependencies

**Response (15-60 min):**
- [ ] Implement fix or workaround
- [ ] Deploy fix if needed
- [ ] Verify resolution
- [ ] Communicate status to team

**Post-Incident (1-24 hours):**
- [ ] Document root cause
- [ ] Create ticket for prevention
- [ ] Update runbooks
- [ ] Share lessons learned

---

## 7. Monitoring Dashboard

### 7.1 Key Metrics to Display

**System Health:**
- API uptime percentage (target: 99.9%)
- Database connection status
- Cache availability (Redis)
- Authentication service status

**Performance:**
- LCP by page (target: <2s)
- INP by endpoint (target: <100ms)
- CLS per page (target: <0.1)
- API response times (p50, p95, p99)

**Errors:**
- Error rate (target: <0.1%)
- Error types distribution
- Top error messages
- Error spike detection

**Traffic:**
- Requests per minute
- Active users
- Geographic distribution
- Browser/device breakdown

### 7.2 Create Custom Dashboard

Access: https://vercel.com/dashboard/[project]/analytics/custom

Add widgets for:
- Real User Monitoring (RUM) data
- Deployment history
- Performance trends
- Error trends

---

## 8. Verification Checklist

Before considering monitoring complete:

**Sentry:**
- [ ] Project created and DSN configured
- [ ] Error tracking working (test by throwing error)
- [ ] Source maps uploaded
- [ ] Alert rules configured
- [ ] Slack integration working

**Vercel Analytics:**
- [ ] Core Web Vitals displaying correctly
- [ ] API response times showing
- [ ] Database metrics visible
- [ ] Custom dashboard created

**Health Checks:**
- [ ] `/api/health` endpoint responding
- [ ] Vercel monitors configured
- [ ] Slack notifications working
- [ ] Down-time alerts tested

**Metrics:**
- [ ] API performance recorded
- [ ] Database queries tracked
- [ ] Cache hits/misses logged
- [ ] Custom metrics appearing in dashboards

**Slack Integration:**
- [ ] Webhooks configured
- [ ] Test notifications sent
- [ ] Alert formatting correct
- [ ] On-call team received notifications

---

## 9. Maintenance Schedule

### Weekly
- [ ] Review error trends in Sentry
- [ ] Check Core Web Vitals in Vercel
- [ ] Verify health checks passing
- [ ] Review on-call notes

### Monthly
- [ ] Clean up old alerts/incidents in Sentry
- [ ] Update alert thresholds based on metrics
- [ ] Review monitoring coverage gaps
- [ ] Audit log retention policies

### Quarterly
- [ ] Full monitoring system review
- [ ] Update runbooks based on incidents
- [ ] Load test alert systems
- [ ] Team training on incident response

---

## 10. Next Steps

1. **Immediate (This Sprint)**
   - [ ] Set up Sentry project
   - [ ] Configure Vercel analytics
   - [ ] Implement /api/health endpoint
   - [ ] Create Slack webhooks

2. **Short Term (Next Sprint)**
   - [ ] Implement custom metrics
   - [ ] Create incident response runbook
   - [ ] Set up on-call rotation
   - [ ] Load test monitoring systems

3. **Medium Term (Within 6 weeks)**
   - [ ] Implement log aggregation (Task 6.3)
   - [ ] Create metrics dashboard (Task 6.4)
   - [ ] Full monitoring validation (Task 6.5)
   - [ ] Team training and runbook refinement

---

**Document Status:** Implementation in Progress
**Last Updated:** 2026-01-26
**Maintained by:** DevOps Team

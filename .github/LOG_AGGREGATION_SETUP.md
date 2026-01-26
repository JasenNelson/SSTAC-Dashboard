# Log Aggregation Setup (Phase 6)

**Status:** Configuration Guide and Implementation Plan
**Last Updated:** 2026-01-26
**Responsibility:** Infrastructure & DevOps Team

---

## Overview

This document outlines the log aggregation strategy for SSTAC Dashboard, enabling centralized log collection, searching, and analysis across all environments.

**Key Components:**
- Structured logging utility in application code
- Log aggregation service (LogRocket, Datadog, or CloudWatch)
- Log retention and archival policy
- Real-time log search and filtering
- Log-based alerting

---

## 1. Structured Logging Implementation

### 1.1 Current Status

✅ **Logging Utility Created:** `src/lib/logging.ts`

Provides consistent JSON-structured logging with:
- Log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
- Automatic timestamp and environment tracking
- Request ID correlation
- Source classification (server, client, api, database)
- Context variables for debugging

### 1.2 Usage Throughout Application

**Server-side logging:**

```typescript
import { logger } from '@/lib/logging';

// In API routes
export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  logger.setRequestId(requestId);

  try {
    const data = await fetchData();
    logger.info('Data fetched successfully', { count: data.length });
    return NextResponse.json(data);
  } catch (error) {
    logger.error('Data fetch failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// In database functions
export async function getPollResults(pollId: string) {
  const start = performance.now();
  const query = `SELECT * FROM poll_results WHERE poll_id = $1`;

  try {
    const results = await db.query(query, [pollId]);
    const duration = performance.now() - start;

    logger.logDatabaseQuery(query, duration, true, {
      pollId,
      resultCount: results.length,
    });

    return results;
  } catch (error) {
    logger.logDatabaseQuery(query, performance.now() - start, false, {
      pollId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    throw error;
  }
}

// In middleware
export function middleware(request: NextRequest) {
  const start = performance.now();
  const response = NextResponse.next();
  const duration = performance.now() - start;

  logger.logApiRequest(
    request.method,
    request.nextUrl.pathname,
    response.status,
    duration,
    {
      userAgent: request.headers.get('user-agent'),
    }
  );

  return response;
}
```

**Security event logging:**

```typescript
// In authentication flows
logger.logAuthEvent('login', userId, {
  method: 'sso',
  provider: 'cognito',
});

logger.logAuthEvent('failed_login', undefined, {
  reason: 'invalid_credentials',
  attemptCount: 3,
});

// In authorization checks
if (!hasPermission(user, resource)) {
  logger.logSecurityEvent('unauthorized_access', 'warn', {
    userId: user.id,
    resource,
    action: 'read',
  });
}
```

### 1.3 Implementation Checklist

- [ ] Import logger in all API route files
- [ ] Add logging to database query functions
- [ ] Add logging to middleware/authentication
- [ ] Add logging to error handlers
- [ ] Add logging to background jobs
- [ ] Test log output format in development
- [ ] Verify logs appear in production

---

## 2. Log Aggregation Service Selection

### 2.1 Comparison of Options

| Service | Cost | Features | Integration | Best For |
|---------|------|----------|-------------|----------|
| **LogRocket** | $99-499/mo | Session replay, log aggregation, error tracking | NPM package + API | Full product monitoring |
| **Datadog** | $15-150+ per host | APM, logs, infrastructure, alerting | Agent-based | Large-scale infrastructure |
| **CloudWatch** | Pay-per-log | AWS-native, integrated with Lambda/RDS | Built-in to AWS | AWS-first deployments |
| **Sentry** | $29-499/mo | Error tracking, performance, logs | API/SDK | Error and performance focus |
| **LogTail** | $75-300/mo | Simple log aggregation, search, alerts | API/HTTP | Lightweight log collection |

### 2.2 Recommendation: Multi-Service Approach

**For optimal coverage, use combination:**

1. **Sentry** (Primary error tracking)
   - Already configured from Phase 2
   - Captures errors, performance metrics
   - Provides alerting

2. **LogRocket** OR **LogTail** (Log aggregation)
   - Collects all logs
   - Provides full-text search
   - Session context
   - Cost-effective (~$100-200/month)

3. **Datadog** (Optional, if scaling)
   - Replace LogRocket/LogTail at scale
   - Infrastructure monitoring
   - Business metrics
   - Expensive ($150+/month minimum)

### 2.3 Recommended Setup for Phase 6

**Use: Sentry + LogTail**
- Sentry: Error tracking and performance (already configured)
- LogTail: Centralized log aggregation via HTTP API
- Cost: $0 (Sentry) + $100/month (LogTail) = $100/month
- Complexity: Low
- Time to implement: 2-3 hours

---

## 3. LogTail Integration (Recommended)

### 3.1 Setup

1. Create account at https://logtail.com
2. Create source for SSTAC Dashboard
3. Copy source token
4. Add to `.env.local` and GitHub Secrets:
   ```
   LOGTAIL_SOURCE_TOKEN=your_token_here
   ```

### 3.2 Implementation

Create `src/lib/logtail-client.ts`:

```typescript
import { logger } from './logging';

const LOGTAIL_ENDPOINT = 'https://in.logtail.com';
const sourceToken = process.env.LOGTAIL_SOURCE_TOKEN;

export async function sendLogToTail(entry: {
  timestamp: string;
  level: string;
  message: string;
  context: Record<string, unknown>;
  environment: string;
  requestId?: string;
  userId?: string;
  source: string;
}): Promise<void> {
  if (!sourceToken) return; // Skip if not configured

  try {
    await fetch(`${LOGTAIL_ENDPOINT}/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sourceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dt: entry.timestamp,
        level: entry.level,
        message: entry.message,
        meta: {
          ...entry.context,
          environment: entry.environment,
          requestId: entry.requestId,
          userId: entry.userId,
          source: entry.source,
        },
      }),
    });
  } catch (error) {
    // Silently fail - don't let logging errors break the app
    console.error('Failed to send log to LogTail:', error);
  }
}
```

### 3.3 Using LogTail Dashboard

**Access:** https://logtail.com/dashboard

**Key Features:**
- Full-text log search
- Filtering by field (level, environment, userId, etc.)
- Log tailing (real-time)
- Log statistics (error rates, response times)
- Alerts on patterns

**Example Queries:**
```
level:ERROR                          # All errors
level:ERROR environment:production   # Errors in production only
message:"database" duration:>1000    # Slow database queries
userId:user-123                      # Logs for specific user
source:api method:POST               # All POST API requests
```

---

## 4. Structured Log Retention Policy

### 4.1 Log Retention Schedule

| Environment | Retention | Purpose | Cost |
|-------------|-----------|---------|------|
| Development | 7 days | Debugging | Free tier |
| Staging | 30 days | Testing | $25/month |
| Production | 90 days | Compliance | $150/month |
| Archive | 1 year | Legal/Audit | $10/month storage |

### 4.2 Implementation

In LogTail settings:
1. Go to Settings → Log Retention
2. Set development logs: 7 days
3. Set production logs: 90 days
4. Enable archival to S3 for compliance

---

## 5. Log-Based Alerting

### 5.1 Create Alerts in LogTail

**Alert: Error Rate Spike**
```
Query: level:ERROR environment:production
Threshold: 10+ errors per minute
Action: POST to Slack webhook
Frequency: Immediately
```

**Alert: Database Slow Queries**
```
Query: source:database duration:>1000
Threshold: 5+ queries per hour
Action: POST to Slack webhook
Frequency: Hourly digest
```

**Alert: Authentication Failures**
```
Query: event:failed_login
Threshold: 5+ failures per 10 minutes
Action: POST to Slack webhook
Frequency: Immediately
```

**Alert: High Memory Usage**
```
Query: source:server context.memory:>500
Threshold: Any
Action: POST to Slack webhook
Frequency: Immediately
```

### 5.2 Slack Integration

In LogTail:
1. Settings → Integrations → Slack
2. Connect Slack workspace
3. Add webhook for #incidents-prod

---

## 6. Log Analysis & Troubleshooting

### 6.1 Common Log Queries

**Find all errors in last hour:**
```
level:ERROR timestamp:[now-1h TO now]
```

**Find slow API endpoints:**
```
source:api duration:>1000
```

**Find authentication failures:**
```
event:failed_login OR message:"Unauthorized"
```

**Find specific user activity:**
```
userId:user-123
```

**Find errors by environment:**
```
level:ERROR environment:production
```

**Database connection issues:**
```
source:database message:"connection" OR message:"timeout"
```

### 6.2 Log-Based Debugging

**Example: Track user issue**
1. Get userId from Vercel dashboard or support ticket
2. Search LogTail for `userId:user-123`
3. Review API calls, database queries, errors
4. Identify root cause
5. Fix and verify in logs

---

## 7. Integration with Other Systems

### 7.1 LogTail → Sentry

Send critical logs to Sentry for alerting:

```typescript
import * as Sentry from '@sentry/nextjs';

logger.error('Critical error', {
  message: 'Database connection failed',
});

// Also send to Sentry for immediate alerting
Sentry.captureException(new Error('Database connection failed'));
```

### 7.2 LogTail → Slack

Webhook URL in LogTail alerts:
```
https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

Message format (customizable in LogTail):
```
:alert: [PRODUCTION] Error Rate Spike
5 errors/minute (threshold: 10)
Errors occurring in: /api/polls/vote
Action: Investigating
```

### 7.3 LogTail → BI Tools

Export logs to:
- Google Sheets (weekly summary)
- Data warehouse (for analytics)
- Dashboard tools (Metabase, Grafana)

---

## 8. Compliance & Security

### 8.1 Data Privacy

- No PII in logs (emails, passwords, credit cards)
- Mask sensitive fields in log context
- Comply with GDPR/CCPA data retention

**Implementation:**

```typescript
// BAD - Contains PII
logger.info('User login', {
  email: user.email,           // ❌ PII
  password: user.password,     // ❌ PII
});

// GOOD - Masked/limited data
logger.info('User login', {
  userId: user.id,             // ✅ Safe
  method: 'sso',
  timestamp: new Date(),
});
```

### 8.2 Log Access Control

- Only DevOps team has access to LogTail
- Use role-based access control (RBAC)
- Audit log access in LogTail settings
- Regular access reviews

### 8.3 Encryption

- All logs transmitted over HTTPS
- Logs encrypted at rest in LogTail
- Service agreement with LogTail for compliance

---

## 9. Log Aggregation Checklist

Before considering Phase 6 Task 3 complete:

**Logging Utility:**
- [ ] `src/lib/logging.ts` implemented
- [ ] Logger imported in all API routes
- [ ] Logger used in middleware
- [ ] Logger used in database functions
- [ ] Logger used in auth/security events
- [ ] Log format verified in development

**LogTail Setup:**
- [ ] LogTail account created
- [ ] Source token obtained and secured
- [ ] LOGTAIL_SOURCE_TOKEN added to secrets
- [ ] Logs appearing in LogTail dashboard
- [ ] Search/filtering working

**Alerts Configured:**
- [ ] Error rate alert created
- [ ] Slow query alert created
- [ ] Auth failure alert created
- [ ] Slack integration working
- [ ] Test alerts verified

**Compliance:**
- [ ] No PII in logs verified
- [ ] Data retention policy set
- [ ] Access control configured
- [ ] GDPR/compliance review done

---

## 10. Integration with Vercel Logs

### 10.1 Accessing Vercel Function Logs

Vercel stores function logs automatically. Access via:
```
https://vercel.com/[team]/[project]/functions
```

Logs include:
- Function execution logs
- Errors and exceptions
- Cold start timing
- Function duration

### 10.2 Correlating Logs

Link Vercel logs with LogTail logs using requestId:

```typescript
// In API route
const requestId = request.headers.get('x-vercel-id') || crypto.randomUUID();
logger.setRequestId(requestId);

// This requestId appears in:
// - Vercel function logs (as x-vercel-id header)
// - LogTail logs (in context)
// - Sentry errors (if error occurs)

// Allows tracing single request across systems
```

---

## 11. Log Rotation & Archival

### 11.1 Automatic Log Rotation

LogTail automatically rotates logs based on:
- Age (90 days for production)
- Size (per plan limits)
- Retention policy

No manual rotation needed.

### 11.2 Archive to Cold Storage

For compliance/audit:

```typescript
// Periodically (weekly) export logs to S3
// Configuration in LogTail → Settings → Storage
```

Cost: ~$10/month for S3 storage of 90-day archive

---

## 12. Next Steps

**Immediate (This Sprint):**
- [ ] Implement structured logging utility ✅
- [ ] Add logging to API routes
- [ ] Add logging to database functions
- [ ] Create LogTail account
- [ ] Configure alerts

**Short Term (Next Sprint):**
- [ ] Verify logs in production
- [ ] Test alert notifications
- [ ] Document common log queries
- [ ] Train team on log searching

**Medium Term (Within 6 weeks):**
- [ ] Implement log-based monitoring (Task 6.4)
- [ ] Create custom dashboards
- [ ] Full monitoring validation (Task 6.5)
- [ ] Quarterly log review & optimization

---

**Document Status:** Implementation in Progress
**Last Updated:** 2026-01-26
**Maintained by:** DevOps & Infrastructure Team

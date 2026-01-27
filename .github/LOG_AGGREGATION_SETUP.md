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

## 2. Log Storage Architecture (Using Supabase - FREE)

### 2.1 Free Solution Overview

**Logs stored directly in your Supabase database** (same service you already use):
- ✅ No new services or costs
- ✅ Full ownership of your data
- ✅ Unlimited queries and search
- ✅ Retention as long as you want
- ✅ Integrated with your existing data

### 2.2 Log Storage Tables

Create two tables in Supabase for log storage:

**Table 1: Application Logs** (all logs)
```sql
CREATE TABLE logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  environment TEXT,
  request_id TEXT,
  user_id TEXT,
  source TEXT,
  version TEXT
);

CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_environment ON logs(environment);
```

**Table 2: Error Logs** (errors only, for faster querying)
```sql
CREATE TABLE error_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB,
  user_id TEXT,
  request_id TEXT,
  source TEXT,
  environment TEXT,
  stack_trace TEXT
);

CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
```

### 2.3 Implementation: Zero Additional Cost

All logs go directly to Supabase tables - no external services needed.

---

## 3. Log Storage in Supabase (Free - Included)

### 3.1 Setup (No External Service Needed)

1. Create log tables in Supabase (SQL above in Section 2)
2. Create API endpoint to store logs: `src/app/api/logs/store/route.ts`
3. Logger sends errors to database automatically
4. All logs searchable via SQL queries

### 3.2 Implementation: API Endpoint for Log Storage

Create `src/app/api/logs/store/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const entry = await request.json();

    // Store in appropriate table based on level
    const table = entry.level === 'ERROR' ? 'error_logs' : 'logs';

    const { error } = await supabase.from(table).insert([{
      level: entry.level,
      message: entry.message,
      context: entry.context,
      environment: entry.environment,
      request_id: entry.requestId,
      user_id: entry.userId,
      source: entry.source,
      version: entry.version,
    }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    // Log to console but don't fail the request
    console.error('Failed to store log:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
```

### 3.3 Searching Logs in Supabase

**Via Supabase SQL Editor:**

```sql
-- All errors in production
SELECT * FROM error_logs
WHERE environment = 'production'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Errors for specific user
SELECT * FROM error_logs
WHERE user_id = 'user-123'
ORDER BY created_at DESC;

-- Count errors by hour
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as error_count,
  level
FROM logs
WHERE created_at > NOW() - INTERVAL '48 hours'
GROUP BY DATE_TRUNC('hour', created_at), level
ORDER BY hour DESC;

-- Search by message
SELECT * FROM logs
WHERE message ILIKE '%database%'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### 3.4 Query Logs via API

Create `src/app/api/logs/query/route.ts` for programmatic access:

```typescript
// GET /api/logs/query?level=ERROR&limit=100&hours=24
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level') || 'ERROR';
  const limit = parseInt(searchParams.get('limit') || '100');
  const hours = parseInt(searchParams.get('hours') || '24');

  const { data } = await supabase
    .from('error_logs')
    .select('*')
    .eq('level', level)
    .gt('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  return NextResponse.json(data);
}
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

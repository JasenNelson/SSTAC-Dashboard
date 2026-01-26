# Security Best Practices Guide

**Purpose:** Provide security guidelines and checklists for developers to follow when coding.

**Audience:** All developers
**Last Updated:** 2026-01-26

---

## Quick Security Checklist

Use this before every commit:

- [ ] No hardcoded secrets (API keys, tokens, passwords)
- [ ] All user inputs are validated at system boundary
- [ ] SQL queries use parameterized statements (no string concatenation)
- [ ] Authentication check on protected endpoints
- [ ] Authorization check (user has required role)
- [ ] Error messages don't leak system details
- [ ] Rate limiting applied if endpoint is public
- [ ] No XSS vulnerabilities (use React built-in escaping)
- [ ] CSRF token checked (if needed)
- [ ] Sensitive data not logged

---

## 1. Secure Coding Principles

### 1.1 Input Validation

**Principle:** Never trust user input

**Rule:** Validate at system boundary (API entry point)

**Where:** `src/app/api/*/route.ts`

**Example:**
```typescript
// ✅ GOOD: Validate at entry
export async function POST(request: Request) {
  const body = await request.json();

  // Validate input
  if (!body.pollId || typeof body.pollId !== 'string') {
    return NextResponse.json(
      { error: 'Invalid pollId' },
      { status: 400 }
    );
  }

  if (body.pollId.length > 100) {
    return NextResponse.json(
      { error: 'pollId too long' },
      { status: 400 }
    );
  }

  // Now it's safe to use
  const result = await db.getPollResults(body.pollId);
  return NextResponse.json(result);
}
```

**What to Validate:**
- Type (string, number, array, etc.)
- Length (max 255 chars, etc.)
- Format (email format, date format, etc.)
- Range (0-100 for percentage, etc.)
- Allowed values (enum: 'open'|'closed')
- File size (if upload)

**Common Validation Library:**
```typescript
import { z } from 'zod';  // If using schema validation

const SubmitPollSchema = z.object({
  pollId: z.string().min(1).max(100),
  selectedOption: z.string().min(1),
});

const parsed = SubmitPollSchema.parse(body);
```

### 1.2 Output Encoding

**Principle:** Encode data before output to prevent XSS

**Where:** React components

**React Automatically Escapes:**
```typescript
// ✅ SAFE: React escapes special characters
const answer = "<script>alert('xss')</script>";
<div>{answer}</div>  // Renders as text, not executable

// ❌ DANGEROUS: Using dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: answer }} />
// Would execute script!
```

**Guidelines:**
- **Use `{variable}` for text content** - React escapes automatically
- **Avoid `dangerouslySetInnerHTML`** - Only for trusted content (rare)
- **Sanitize before display** - Use DOMPurify if must accept HTML

### 1.3 SQL Injection Prevention

**Principle:** Never concatenate user input into SQL queries

**Supabase Uses Parameterized Queries:**
```typescript
// ✅ SAFE: Parameterized query
const { data } = await supabase
  .from('polls')
  .select('*')
  .eq('id', pollId);  // pollId is safely parameterized

// ❌ DANGEROUS: String concatenation (never do this!)
const query = `SELECT * FROM polls WHERE id = '${pollId}'`;
// If pollId = "'; DROP TABLE polls; --"
// Query becomes: SELECT * FROM polls WHERE id = ''; DROP TABLE polls; --'
// This deletes the entire polls table!
```

**Rules:**
- Use Supabase client methods (they parameterize)
- Use database client with parameterized queries
- Never string-concat user input into queries
- Use prepared statements with placeholders

### 1.4 CSRF Protection

**Principle:** Prevent cross-site request forgery attacks

**In Next.js:**
- Next.js **automatically handles CSRF for form submissions**
- Cookies are secure (SameSite=Lax by default)
- No additional action needed for normal forms

**If Making Custom API Calls:**
```typescript
// ✅ SAFE: Automatic CSRF protection
fetch('/api/polls/123/vote', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Next.js adds X-CSRF-Token automatically
  },
  credentials: 'include'  // Include cookies
});
```

---

## 2. API Security

### 2.1 Authentication Check

**Principle:** Verify user identity before allowing access

**Every Protected Route Must Check:**
```typescript
// src/app/api/admin/analytics/route.ts
import { getAuthenticatedUser } from '@/lib/supabase-auth';

export async function GET(request: Request) {
  // 1. Get authenticated user
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // 2. User is authenticated, continue
  const analytics = await db.getAnalytics();
  return NextResponse.json(analytics);
}
```

**Authentication Method:**
- CEW Users: 6-digit code (one-time login)
- TWG/SSTAC/Admin: SSO (identity provider)
- Token stored in httpOnly cookie (secure, not accessible via JavaScript)

### 2.2 Authorization Check

**Principle:** Verify user has permission for this action

**Check User Role:**
```typescript
export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Authorization: only admins can export
  if (user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: admin role required' },
      { status: 403 }
    );
  }

  // User is admin, proceed
  const data = await db.exportAllData();
  return NextResponse.json(data);
}
```

**Role Hierarchy:**
- `admin` - Full access
- `sstac_member` - Assessment, view polls
- `twg_member` - Assessment, vote on polls
- `cew_user` - Vote on polls only

**Rule:** If checking `role`, also check `is_active` to prevent revoked users

### 2.3 Error Messages

**Principle:** Don't leak system details in error messages

**❌ BAD:**
```typescript
try {
  const user = await db.getUser(userId);
} catch (error) {
  // ❌ Leaks database schema
  return NextResponse.json(
    { error: error.message },  // "column 'users.email' doesn't exist"
    { status: 500 }
  );
}
```

**✅ GOOD:**
```typescript
try {
  const user = await db.getUser(userId);
} catch (error) {
  // ✅ Generic message to user
  logger.error('Failed to get user', { userId, error });
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
  // Actual error logged for debugging, not exposed to user
}
```

**Guidelines:**
- **Development:** Detailed errors in logs (for debugging)
- **User-facing:** Generic messages only
- **Don't expose:** Database schema, file paths, library versions
- **Do expose:** Which input field has problem (validation)

### 2.4 Rate Limiting

**Principle:** Prevent abuse by limiting requests per user

**Applied Globally:**
```typescript
// src/middleware.ts
const allowed = await checkRateLimit(
  user.id,
  100,      // 100 requests
  3600000   // per 1 hour
);

if (!allowed) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429 }
  );
}
```

**Special Limits (Stricter):**
```typescript
// Authentication endpoint - prevent brute force
export async function POST(request: Request) {
  const allowed = await checkRateLimit(request.ip, 10, 900000);
  if (!allowed) return NextResponse.json({error: 'Too many attempts'}, {status: 429});

  // Login logic...
}

// File upload - prevent resource exhaustion
export async function POST(request: Request) {
  const allowed = await checkRateLimit(user.id, 5, 3600000);
  if (!allowed) return NextResponse.json({error: 'Upload limit exceeded'}, {status: 429});

  // Upload logic...
}
```

---

## 3. Database Security

### 3.1 Row-Level Security (RLS)

**Principle:** Database enforces access control, not just application

**How It Works:**
```sql
-- RLS Policy: Users can only see their own submissions
CREATE POLICY user_submission_isolation ON submissions
USING (user_id = current_user_id)
WITH CHECK (user_id = current_user_id);
```

**Benefit:** Even if application has bug, database prevents unauthorized access

**Always Assume RLS Enabled** - Don't rely solely on application checks

### 3.2 Prepared Statements

**Principle:** Use database prepared statements, never string concatenation

**✅ Supabase (Safe):**
```typescript
const { data } = await supabase
  .from('polls')
  .select('*')
  .eq('poll_type', pollType)  // Parameterized
  .returns<Poll[]>();
```

**✅ Raw SQL with Placeholders:**
```typescript
const result = await db.query(
  'SELECT * FROM polls WHERE poll_type = $1',
  [pollType]  // Parameter values separate
);
```

**❌ String Concatenation (NEVER):**
```typescript
// ❌ DANGEROUS - SQL injection vulnerability
const query = `SELECT * FROM polls WHERE poll_type = '${pollType}'`;
```

### 3.3 Sensitive Data Protection

**Principle:** Don't store sensitive data unless absolutely necessary

**What NOT to Store:**
- Passwords (use authentication provider like Supabase Auth)
- API keys (use environment variables, not database)
- Credit cards (use payment processor, not database)
- Social security numbers (minimum required only)

**What to Store Securely:**
- User email (hash if not needed plaintext)
- User role (for authorization checks)
- Audit logs (who did what when)

**Encryption Example:**
```typescript
// For truly sensitive fields
import { encrypt, decrypt } from '@/lib/encryption';

// Storing
const encrypted = await encrypt(sensitiveValue);
await db.users.update({ encrypted_field: encrypted });

// Retrieving
const encrypted = user.encrypted_field;
const decrypted = await decrypt(encrypted);
```

---

## 4. File Upload Security

### 4.1 File Type Validation

**Principle:** Whitelist allowed file types, don't blacklist bad ones

**✅ Implementation:**
```typescript
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // Whitelist approach
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PDF, DOCX, TXT' },
      { status: 400 }
    );
  }

  // File type is safe
  return uploadFile(file);
}
```

**Why Whitelist:**
- Blacklist always incomplete (new malicious types created)
- Whitelist is explicit about what's allowed
- Easier to review and maintain

### 4.2 File Size Validation

**Principle:** Prevent resource exhaustion from large files

**Implementation:**
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB

if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { error: 'File too large. Maximum 10MB.' },
    { status: 413 }
  );
}
```

**Size Limits by File Type:**
- PDF: 10MB typical
- Document: 5MB typical
- Image: 1MB typical

### 4.3 Virus Scanning (Optional)

**If Added:** Scan all uploads

```typescript
import { scanFile } from '@/lib/antivirus';

const isSafe = await scanFile(file);
if (!isSafe) {
  return NextResponse.json(
    { error: 'File failed security scan' },
    { status: 400 }
  );
}
```

---

## 5. Dependency Security

### 5.1 npm Audit

**Before Every Deployment:**
```bash
npm audit
```

**If Vulnerabilities Found:**
```bash
# Try auto-fix
npm audit fix

# If that fails, manually update:
npm update [package-name]

# If still broken, find alternative package
```

**Never Ignore Vulnerabilities:**
- HIGH/CRITICAL: Fix before deploying
- MODERATE: Fix in next sprint
- LOW: Monitor, update when convenient

### 5.2 Automated Dependency Updates

**Dependabot (GitHub):**
- Automatically checks for updates
- Creates PRs with fixes
- Review and merge when CI passes

**CI Should Block Merges:**
- If vulnerabilities exist
- If tests fail
- If type checking fails

---

## 6. Security Headers

**Implemented in Phase 2:**

```typescript
// src/middleware.ts
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('Content-Security-Policy', '...');
response.headers.set('X-XSS-Protection', '1; mode=block');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
```

**What Each Does:**
- `X-Frame-Options: DENY` - Can't be embedded in `<iframe>`
- `X-Content-Type-Options: nosniff` - Browser won't guess MIME type
- `Content-Security-Policy` - Restrict script sources to prevent XSS
- `X-XSS-Protection` - Legacy XSS filter (mostly obsolete, doesn't hurt)
- `Referrer-Policy` - Limit what URL info is sent to external sites

---

## 7. Authentication Flow Security

### 7.1 CEW User Authentication
```
1. User enters 6-digit access code on login page
2. System verifies code (rate-limited, checked against valid codes)
3. System generates device fingerprint (combination of browser/device info)
4. System creates user ID: [code]_[random-string] (not timestamp!)
5. JWT token issued with 24-hour expiry
6. Token stored in httpOnly, secure cookie (not accessible via JavaScript)
7. Token used in Authorization header for subsequent requests
```

**Security Properties:**
- ✅ Code-based (not email-based, safer for users)
- ✅ Device fingerprint (prevents code sharing across devices)
- ✅ Random user ID (not sequential or guessable)
- ✅ Short expiry (24 hours, session-based)
- ✅ httpOnly cookie (prevents JavaScript XSS theft)

### 7.2 Token Expiration

**Tokens Expire After 24 Hours:**
```typescript
// User must re-authenticate every day
const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

// Frontend detects expiry
if (token.expiresAt < new Date()) {
  // Redirect to login
  window.location.href = '/login';
}
```

**Why Short Expiry:**
- Leaked token has limited time window
- Forces regular re-authentication
- User data fresher (role changes detected daily)

---

## 8. Code Review Checklist

**Before Approving PR, Verify:**

- [ ] No hardcoded secrets
- [ ] All inputs validated
- [ ] Auth check on protected endpoints
- [ ] Authorization check on admin endpoints
- [ ] Error messages generic (no system details)
- [ ] No SQL injection risks (parameterized queries)
- [ ] No XSS risks (React escaping used)
- [ ] Rate limiting applied (if public endpoint)
- [ ] Sensitive data not logged
- [ ] Dependencies up-to-date
- [ ] Tests cover security cases
- [ ] Type checking passes

---

## 9. Incident Response

### 9.1 If Vulnerability Found in Code

**Steps:**
1. Create CRITICAL GitHub issue
2. Isolate: Disable vulnerable feature if possible
3. Investigate: What data could be exposed?
4. Fix: Write code fix
5. Test: Add regression test
6. Deploy: Hotfix to production
7. Notify: Affected users if data exposed
8. Review: Post-mortem to prevent repeat

### 9.2 If Dependency Vulnerability Found

**Steps:**
```bash
# 1. Check details
npm audit

# 2. Update dependency
npm update [vulnerable-package]

# 3. If update fails, use alternative
npm uninstall [vulnerable-package]
npm install [alternative-package]

# 4. Test
npm test

# 5. Deploy
git push origin [branch]
```

---

## 10. Phase 2 Vulnerability Fixes (Case Study)

### 10.1 localStorage Admin Bypass (FIXED)
**Issue:** Admin status cached in localStorage without server verification
**Fix:** Always verify admin status server-side
**Prevention:** Code review + RLS enforced

### 10.2 Public Endpoints Without Auth (FIXED)
**Issue:** `/api/announcements` was public, leaking data
**Fix:** Added `getAuthenticatedUser()` check
**Prevention:** Template for endpoints, copy-paste pattern

### 10.3 Outdated npm Packages (FIXED)
**Issue:** tar package had file overwrite vulnerability
**Fix:** `npm audit fix` to update to secure version
**Prevention:** Regular `npm audit` before deployment

### 10.4 Single-Instance Rate Limiting (FIXED)
**Issue:** In-memory rate limiting bypassed with load balancer
**Fix:** Redis-based rate limiting (shared across instances)
**Prevention:** Architecture review for stateful code

---

## Testing Security

### Unit Test Example
```typescript
describe('Authentication', () => {
  it('should reject unauthenticated requests', async () => {
    const response = await fetch('/api/admin/analytics');
    expect(response.status).toBe(401);
  });

  it('should reject non-admin users', async () => {
    const response = await fetch('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${cewUserToken}` }
    });
    expect(response.status).toBe(403);
  });
});
```

### Integration Test Example
```typescript
describe('SQL Injection Prevention', () => {
  it('should safely handle special characters in input', async () => {
    const response = await fetch('/api/polls', {
      method: 'POST',
      body: JSON.stringify({
        question: "'; DROP TABLE polls; --"
      })
    });
    expect(response.status).toBe(200);
    // Table still exists, not dropped
    const polls = await db.getPollCount();
    expect(polls).toBeGreaterThan(0);
  });
});
```

---

## Resources

- **OWASP Top 10:** https://owasp.org/www-project-top-ten/
- **Supabase Security:** https://supabase.com/docs/guides/platform/security
- **Next.js Security:** https://nextjs.org/docs/app/building-your-application/routing/middleware
- **npm Security:** https://docs.npmjs.com/cli/v8/commands/npm-audit

---

**Status:** Phase 2 security improvements implemented
**Next Review:** Quarterly security audit
**Last Updated:** 2026-01-26

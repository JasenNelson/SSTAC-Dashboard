# Supabase Auth Utility - Documentation

**Status:** ✅ Created and Tested (Week 7-8 Preparation)  
**File:** `src/lib/supabase-auth.ts`  
**Risk Level:** 🟢 **ZERO RISK** - Utility prepared, not yet integrated

---

## 📋 Overview

The `supabase-auth.ts` utility extracts common Supabase client creation patterns from API routes, eliminating code duplication across 18+ API endpoints.

### Current State
- ✅ Utility functions created and tested
- ✅ 26 comprehensive unit tests passing
- ⏸️ **NOT YET INTEGRATED** - Existing code unchanged
- 📝 Ready for future incremental migration

---

## 🎯 Purpose

This utility standardizes three main patterns used throughout the codebase:

1. **Authenticated Client Pattern** - For routes requiring user authentication
2. **Anonymous Client Pattern** - For CEW polls and public access
3. **Page Path Detection** - Automatically selects client type based on route

---

## 📚 API Reference

### `createAuthenticatedClient()`

Creates a Supabase client with cookie-based authentication support.

**Returns:** `Promise<SupabaseClient>`

**Usage:**
```typescript
import { createAuthenticatedClient } from '@/lib/supabase-auth';

const supabase = await createAuthenticatedClient();
const { data: { user } } = await supabase.auth.getUser();
```

**Characteristics:**
- Reads and writes authentication cookies
- Supports session management
- Handles cookie errors gracefully
- Used in 15+ authenticated API routes

---

### `createAnonymousClient()`

Creates a Supabase client without cookie handling (anonymous access).

**Returns:** `Promise<SupabaseClient>`

**Usage:**
```typescript
import { createAnonymousClient } from '@/lib/supabase-auth';

const supabase = await createAnonymousClient();
// Use for anonymous submissions or public data
```

**Characteristics:**
- No cookie reading/writing
- Suitable for CEW poll submissions
- No authentication required
- Used in CEW poll routes

---

### `getAuthenticatedUser(supabase)`

Helper to get the authenticated user from a Supabase client.

**Parameters:**
- `supabase: SupabaseClient` - Authenticated Supabase client

**Returns:** `Promise<User | null>`

**Usage:**
```typescript
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

const supabase = await createAuthenticatedClient();
const user = await getAuthenticatedUser(supabase);

if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

### `requireAuthenticatedUser(supabase)`

Ensures user is authenticated, throws if not.

**Parameters:**
- `supabase: SupabaseClient` - Authenticated Supabase client

**Returns:** `Promise<User>` (never null)

**Throws:** `Error('Unauthorized')` if not authenticated

**Usage:**
```typescript
import { createAuthenticatedClient, requireAuthenticatedUser } from '@/lib/supabase-auth';

const supabase = await createAuthenticatedClient();
try {
  const user = await requireAuthenticatedUser(supabase);
  // user is guaranteed to be non-null
} catch (error) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

### `createClientForPagePath(pagePath)`

Creates the appropriate client type based on page path.

**Parameters:**
- `pagePath: string` - The page path (e.g., '/cew-polls/...' or '/survey-results/...')

**Returns:** `Promise<{ supabase: SupabaseClient, isCEWPage: boolean }>`

**Usage:**
```typescript
import { createClientForPagePath } from '@/lib/supabase-auth';

const { supabase, isCEWPage } = await createClientForPagePath('/cew-polls/holistic-protection');

if (isCEWPage) {
  // Handle anonymous CEW submission
  const userId = generateCEWUserId('CEW2025');
} else {
  // Handle authenticated submission
  const user = await getAuthenticatedUser(supabase);
}
```

**Logic:**
- Paths starting with `/cew-polls/` → Anonymous client
- All other paths → Authenticated client

---

### `generateCEWUserId(authCode, sessionId?)`

Generates unique user IDs for CEW poll submissions.

**Parameters:**
- `authCode: string` - CEW authentication code (default: 'CEW2025')
- `sessionId?: string | null` - Optional session ID from headers

**Returns:** `string` - Unique user ID

**Usage:**
```typescript
import { generateCEWUserId } from '@/lib/supabase-auth';

// With session ID from headers
const sessionId = request.headers.get('x-session-id');
const userId = generateCEWUserId('CEW2025', sessionId);

// Without session ID (fallback to timestamp-based)
const userId = generateCEWUserId('CEW2025', null);
```

**Format:**
- With session ID: `{authCode}_{sessionId}`
- Without session ID: `{authCode}_{timestamp}_{randomSuffix}`

---

## 🔄 Migration Guide

### Current Pattern (Before Migration)

```typescript
// Typical authenticated route pattern
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }); } catch (error) {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) {}
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // ... rest of route logic
}
```

### New Pattern (After Migration)

```typescript
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';

export async function POST(request: NextRequest) {
  const supabase = await createAuthenticatedClient();
  const user = await getAuthenticatedUser(supabase);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // ... rest of route logic
}
```

### CEW Route Pattern (Before Migration)

```typescript
// Typical CEW route pattern
const isCEWPage = pagePath.startsWith('/cew-polls/');
let supabase, finalUserId;

if (isCEWPage) {
  const cookieStore = await cookies();
  supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get() { return null; },
        set() {},
        remove() {},
      },
    }
  );
  
  const sessionId = request.headers.get('x-session-id') || `session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  finalUserId = `${authCode || 'CEW2025'}_${sessionId}`;
} else {
  // ... authenticated pattern
}
```

### CEW Route Pattern (After Migration)

```typescript
import { createClientForPagePath, getAuthenticatedUser, generateCEWUserId } from '@/lib/supabase-auth';

const { supabase, isCEWPage } = await createClientForPagePath(pagePath);
let finalUserId;

if (isCEWPage) {
  const sessionId = request.headers.get('x-session-id');
  finalUserId = generateCEWUserId(authCode || 'CEW2025', sessionId);
} else {
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  finalUserId = user.id;
}
```

---

## 📊 Impact Analysis

### Files That Could Benefit

**Authenticated Routes (15+ files):**
- `src/app/api/discussions/route.ts`
- `src/app/api/discussions/[id]/route.ts`
- `src/app/api/review/save/route.ts`
- `src/app/api/review/submit/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `src/app/api/announcements/route.ts`
- `src/app/api/milestones/route.ts`
- And more...

**CEW Routes (6+ files):**
- `src/app/api/polls/submit/route.ts`
- `src/app/api/ranking-polls/submit/route.ts`
- `src/app/api/wordcloud-polls/submit/route.ts`
- And more...

**Total Lines Saved:** ~300-400 lines of duplicated code

---

## 🧪 Testing

The utility includes 26 comprehensive unit tests covering:

- ✅ Authenticated client creation
- ✅ Anonymous client creation
- ✅ Cookie handling (get, set, remove)
- ✅ Error handling
- ✅ User authentication helpers
- ✅ Page path detection
- ✅ CEW user ID generation
- ✅ Integration scenarios

**Run tests:**
```bash
npm run test:unit -- src/lib/supabase-auth.test.ts
```

---

## 🚀 Future Migration Plan

### Phase 1: Preparation (✅ Complete)
- [x] Create utility functions
- [x] Write comprehensive tests
- [x] Document usage patterns

### Phase 2: Gradual Integration (Future - Week 9-12)
1. **Week 9:** Migrate 1-2 low-traffic routes
   - Test in staging
   - Monitor for issues
   - Deploy to production

2. **Week 10:** Migrate 2-3 more routes
   - Continue gradual rollout
   - Gather feedback

3. **Week 11-12:** Migrate remaining routes
   - Complete migration
   - Remove old patterns
   - Update documentation

### Migration Strategy

**One Route at a Time:**
- Update one API route
- Test thoroughly in staging
- Deploy and monitor
- Wait 1-2 days before next route
- Easy rollback per route

**Rollback Plan:**
- Git tags before each migration
- Feature flag option (if needed)
- Keep old code until all routes migrated

---

## ⚠️ Important Notes

### DO NOT Migrate Yet

This utility is **prepared but not integrated**. Existing code continues to work unchanged.

**Reasons:**
- ✅ Zero risk to production users
- ✅ Allows thorough testing period
- ✅ Can be validated in staging first
- ✅ Easy rollback if issues arise

### Integration Requirements

Before integrating, ensure:
- [ ] Staging environment available
- [ ] Monitoring set up (Sentry, logs)
- [ ] Rollback procedure tested
- [ ] Team understands new patterns
- [ ] Documentation reviewed

---

## 📝 Code Examples

### Example 1: Simple Authenticated Route

```typescript
import { createAuthenticatedClient, getAuthenticatedUser } from '@/lib/supabase-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createAuthenticatedClient();
  const user = await getAuthenticatedUser(supabase);
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data, error } = await supabase
    .from('discussions')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
  
  return NextResponse.json({ discussions: data });
}
```

### Example 2: CEW Poll Route

```typescript
import { 
  createClientForPagePath, 
  getAuthenticatedUser, 
  generateCEWUserId 
} from '@/lib/supabase-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { pagePath, pollIndex, question, options, optionIndex, authCode } = await request.json();
  
  const { supabase, isCEWPage } = await createClientForPagePath(pagePath);
  let finalUserId;
  
  if (isCEWPage) {
    const sessionId = request.headers.get('x-session-id');
    finalUserId = generateCEWUserId(authCode || 'CEW2025', sessionId);
  } else {
    const user = await getAuthenticatedUser(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    finalUserId = user.id;
  }
  
  // ... rest of poll submission logic
}
```

---

## ✅ Benefits

### Code Quality
- **Reduced Duplication:** 300-400 lines of duplicated code eliminated
- **Consistency:** Standardized patterns across all routes
- **Maintainability:** Single source of truth for client creation
- **Type Safety:** Proper TypeScript types throughout

### Developer Experience
- **Simpler Code:** Routes become more readable
- **Less Boilerplate:** Focus on business logic, not setup
- **Easier Testing:** Utility tested independently
- **Better Documentation:** Clear patterns and examples

### Production Safety
- **Gradual Migration:** One route at a time
- **Easy Rollback:** Per-route rollback capability
- **Thorough Testing:** 26 unit tests ensure correctness
- **Zero Risk:** Prepared but not integrated yet

---

## 🔗 Related Files

- **Utility:** `src/lib/supabase-auth.ts`
- **Tests:** `src/lib/supabase-auth.test.ts`
- **Client Utility:** `src/lib/supabase/client.ts` (browser client)

---

**Status:** ✅ Ready for future integration (Week 9-12)


# Local Engine Routing Plan — Draft v3.1.1

**Date:** 2026-02-19
**Status:** DRAFT v3.1.1 — All Codex findings resolved
**Scope:** Three-part plan covering (1) immediate local/remote gating, (2) future architecture options, and (3) cost analysis for full cloud deployment of the evaluation pipeline.

**Change log:**
- v1.0: Initial draft
- v2.0: Added Part 2 (future options) and Part 3 (cost analysis)
- v3.0: Incorporated Codex review — fixed route coverage gaps, env var naming, API auth, build risk, async patterns, pricing, audit controls
- v3.1: Updated Part 3 for Supabase Pro + Vercel Pro baseline; replaced Haiku with fast model + thinking model architecture per testing results
- v3.1.1: Fixed 4 remaining inconsistencies from Codex v3.1 review — Option C "free tier" wording, handler counts (11 engine-gated / 22 total across 16 files), requireAdmin() import (uses createServerClient from @supabase/ssr, not non-existent server.ts)

---

## Part 1: Immediate Next Steps — Environment Variable Gating

### 1.1 Problem Statement

The regulatory-review page depends on local services that cannot run on Vercel:

| Dependency | Why It's Local-Only |
|---|---|
| Python subprocess (`run-engine`) | Spawns `python engine/scripts/...` on local filesystem |
| Docling file extraction | Requires local Python + docling library |
| File uploads to disk | Writes to local `1_Active_Reviews/` folder structure |
| `better-sqlite3` | Native C++ module — won't compile on Vercel serverless |
| File-based IPC (`ralph_semantic/`) | Polls local request/response directories |

When deployed to Vercel, these features will crash. We need graceful degradation.

### 1.2 Approach

**Environment-variable gating** with an "under construction" fallback UI plus **server-side auth enforcement** on all API routes.

- **Two env vars** (split server/client for correctness):
  - `LOCAL_ENGINE_ENABLED=true` — server-only, used in API route guards
  - `NEXT_PUBLIC_LOCAL_ENGINE=true` — client-accessible, used in UI conditional rendering
- Set in local `.env.local` (not committed)
- Absent on Vercel → defaults to `false` → engine features show "under construction"
- Page access restricted to admin-authenticated users only (Supabase role check)
- **All API routes** get server-side Supabase auth checks (not just layout/middleware)

### 1.3 Detection Mechanism

**Environment Variables:**

```
# .env.local (local dev only — NOT committed, NOT on Vercel)
LOCAL_ENGINE_ENABLED=true
NEXT_PUBLIC_LOCAL_ENGINE=true
```

> **Why two variables?** (Codex finding #6) `NEXT_PUBLIC_` vars are inlined into the client bundle at build time. Using a `NEXT_PUBLIC_` var for server-side API route guards means the value is baked in at build and cannot be changed at runtime. Server-only `LOCAL_ENGINE_ENABLED` is read from the runtime environment, giving proper server-side control. The `NEXT_PUBLIC_` variant drives client-side UI gating where build-time inlining is appropriate.

**Feature Flag Utility — New file:** `src/lib/feature-flags.ts`

```ts
/**
 * Server-side: is the local engine available?
 * Uses LOCAL_ENGINE_ENABLED (not NEXT_PUBLIC_) for runtime flexibility.
 * Use in API routes and server components.
 */
export function isLocalEngineServer(): boolean {
  return process.env.LOCAL_ENGINE_ENABLED === 'true'
}

/**
 * Client-side: is the local engine available?
 * Uses NEXT_PUBLIC_LOCAL_ENGINE (build-time inlined).
 * Use in client components for conditional UI rendering.
 */
export function isLocalEngineClient(): boolean {
  return process.env.NEXT_PUBLIC_LOCAL_ENGINE === 'true'
}
```

### 1.4 Feature Matrix

| Feature | Local (engine enabled) | Remote (Vercel) |
|---|---|---|
| View existing assessments | Full access | Full access |
| Submit/edit judgments | Full access | Full access |
| Search/filter assessments | Full access | Full access |
| Executive summary view | Full access | Full access |
| Export/memo generation | Full access | Full access |
| **Create new review project** | **Full access** | **Under construction** |
| **Upload files** | **Full access** | **Under construction** |
| **Run docling extraction** | **Full access** | **Under construction** |
| **Run evaluation engine** | **Full access** | **Under construction** |
| **Edit/delete projects** | **Full access** | **Under construction** |
| **Manage project files** | **Full access** | **Under construction** |

### 1.5 UI Components to Gate (Client-Side)

These components render engine-dependent features and need conditional rendering using `isLocalEngineClient()`:

| Component | File Path | What to Gate |
|---|---|---|
| `ReviewWizard` | `src/app/(dashboard)/regulatory-review/components/wizard/ReviewWizard.tsx` | Entire wizard flow (creates projects, uploads files) |
| `RunEngineButton` | `src/app/(dashboard)/regulatory-review/components/RunEngineButton.tsx` | Engine execution trigger |
| `FileManagementModal` | `src/app/(dashboard)/regulatory-review/components/modals/FileManagementModal.tsx` | File upload/management |
| `ProcessLauncher` | `src/app/(dashboard)/regulatory-review/components/wizard/ProcessLauncher.tsx` | Extraction/evaluation launch |
| `FileUploader` | `src/app/(dashboard)/regulatory-review/components/wizard/FileUploader.tsx` | File upload step |
| `ActiveReviewsGrid` | `src/app/(dashboard)/regulatory-review/components/ActiveReviewsGrid.tsx` | "New Project" button/card |
| `LandingPageClient` | `src/app/(dashboard)/regulatory-review/components/LandingPageClient.tsx` | New project creation entry point |

### 1.6 API Routes to Protect (Server-Side)

> **Codex finding #1 (Critical):** API routes currently have NO server-side auth checks. The layout/middleware admin gate only protects page rendering, not direct API calls. All regulatory-review API routes must add server-side Supabase user + role verification.
>
> **Codex finding #2 (Critical):** The v2.0 plan missed several routes. The `projects/[id]` route has GET, PATCH, and DELETE handlers that all touch local filesystem/SQLite.
>
> **Codex finding #3 (High):** The v2.0 plan listed `GET /projects/[id]/files/[fileId]` but the actual handler is DELETE only.

#### API Auth Guard (All Routes)

**New addition — `src/lib/api-guards.ts`:**

> **Note:** This repo has no `src/lib/supabase/server.ts`. Server-side Supabase access uses `createServerClient` from `@supabase/ssr` with cookie-based auth (see `src/lib/supabase/middleware.ts` for the existing pattern). The guard below follows that pattern for API routes.

```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Verify the request comes from an authenticated admin user.
 * Call at the top of every regulatory-review API route handler.
 *
 * Uses createServerClient from @supabase/ssr with Next.js cookies()
 * (same pattern as src/lib/supabase/middleware.ts).
 */
export async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isAdmin = user.app_metadata?.role === 'admin'
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null // proceed
}

/**
 * Verify the local engine is available (server-side).
 * Call after requireAdmin() in engine-dependent routes.
 */
export function requireLocalEngine() {
  if (process.env.LOCAL_ENGINE_ENABLED !== 'true') {
    return NextResponse.json(
      { error: 'This feature requires the local evaluation engine.' },
      { status: 503 }
    )
  }
  return null // proceed
}
```

#### Routes: Local Engine Guard + Admin Auth

These routes depend on local filesystem/Python and must return 503 when engine is not available. All also get `requireAdmin()`.

| API Route | Method(s) | File Path | Guards |
|---|---|---|---|
| `/run-engine` | POST | `src/app/api/regulatory-review/run-engine/route.ts` | admin + local engine |
| `/projects` | POST | `src/app/api/regulatory-review/projects/route.ts` | admin + local engine |
| `/projects/[id]` | GET, PATCH, DELETE | `src/app/api/regulatory-review/projects/[id]/route.ts` | admin + local engine |
| `/projects/[id]/extract` | POST | `src/app/api/regulatory-review/projects/[id]/extract/route.ts` | admin + local engine |
| `/projects/[id]/extract-status` | GET | `src/app/api/regulatory-review/projects/[id]/extract-status/route.ts` | admin + local engine |
| `/projects/[id]/files` | GET, POST | `src/app/api/regulatory-review/projects/[id]/files/route.ts` | admin + local engine |
| `/projects/[id]/files/[fileId]` | DELETE | `src/app/api/regulatory-review/projects/[id]/files/[fileId]/route.ts` | admin + local engine |

**Total: 7 route files, 11 handlers**

#### Routes: Admin Auth Only (No Engine Guard)

These routes read/write to SQLite (currently) but don't depend on local filesystem or Python. They get `requireAdmin()` but stay functional when engine is off.

| API Route | Method(s) | File Path | Guards |
|---|---|---|---|
| `/assessments` | GET | `src/app/api/regulatory-review/assessments/route.ts` | admin |
| `/assessments/[csapId]` | GET, PATCH | `src/app/api/regulatory-review/assessments/[csapId]/route.ts` | admin |
| `/judgments` | POST | `src/app/api/regulatory-review/judgments/route.ts` | admin |
| `/progress` | GET | `src/app/api/regulatory-review/progress/route.ts` | admin |
| `/search` | GET | `src/app/api/regulatory-review/search/route.ts` | admin |
| `/submissions` | GET | `src/app/api/regulatory-review/submissions/route.ts` | admin |
| `/submission-search` | GET | `src/app/api/regulatory-review/submission-search/route.ts` | admin |
| `/validation-stats` | GET | `src/app/api/regulatory-review/validation-stats/route.ts` | admin |
| `/matching-detail` | GET, POST | `src/app/api/regulatory-review/matching-detail/route.ts` | admin |

**Note:** These routes currently use `better-sqlite3` which won't work on Vercel. See Section 1.11 for build risk mitigation.

### 1.7 Under Construction Component

**New file:** `src/components/ui/UnderConstruction.tsx`

A reusable component that displays when an engine-dependent feature is accessed remotely.

**Design requirements:**
- Clean, informational (not an error page)
- Explains the feature exists but requires local engine access
- Consistent with existing dashboard styling (Tailwind, existing UI patterns)
- Accepts a `feature` prop for contextual messaging (e.g., "File Extraction", "Evaluation Engine")
- Optional `description` prop for additional context

**Suggested content:**
```
[Construction icon]
{feature} — Under Construction

This feature requires the local evaluation engine and is not yet
available in the cloud deployment. It is actively being developed.

[Back button]
```

### 1.8 Admin Access Gate

**Current auth state:**
- Supabase auth is already configured
- Middleware at `src/middleware.ts` protects dashboard routes
- No role-based access control currently exists

> **Codex finding #4 (High):** Middleware matcher at `src/middleware.ts:123` only matches `/dashboard/:path*`, `/twg/:path*`, `/survey-results/:path*`, `/cew-2025/:path*`. The regulatory-review pages at `/(dashboard)/regulatory-review/*` are NOT matched. Must add `/regulatory-review/:path*` to the matcher array.

**Option A — Supabase `app_metadata` (Recommended):**

Set admin role via Supabase dashboard or SQL:
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
WHERE email = 'your-email@example.com';
```

Check in server component or middleware:
```ts
const { data: { user } } = await supabase.auth.getUser()
const isAdmin = user?.app_metadata?.role === 'admin'
```

**Option B — Allowlist by email:**

```
ADMIN_EMAILS=your-email@example.com
```

Simpler but less scalable.

**Where to enforce (defense-in-depth, 3 layers):**

1. **Middleware** (`src/middleware.ts`) — Add `/regulatory-review/:path*` to matcher; check admin role
2. **Layout** (`src/app/(dashboard)/regulatory-review/layout.tsx`) — Server-side admin check, redirect non-admins
3. **API routes** — Each handler calls `requireAdmin()` (see Section 1.6)

### 1.9 Server Component Safety

> **Codex finding #5 (High):** `src/app/(dashboard)/regulatory-review/[submissionId]/page.tsx:323` calls `getReviewProjectById` outside try/catch. In non-local environments, SQLite will throw and crash the page rather than degrading gracefully.

**Mitigation:** Wrap all SQLite calls in the detail page server component with try/catch, and render a controlled fallback when SQLite is unavailable. Alternatively, gate the entire page early using `isLocalEngineServer()` when `better-sqlite3` is not available.

**Pattern:**
```ts
// In server component
try {
  const submission = getSubmissionById(submissionId)
  // ... render
} catch (e) {
  // SQLite not available (Vercel) — render fallback
  return <UnderConstruction feature="Submission Review" />
}
```

### 1.10 Implementation Steps

#### Phase 1: Foundation (minimal, non-breaking)

1. **Create `src/lib/feature-flags.ts`** with `isLocalEngineServer()` and `isLocalEngineClient()` helpers
2. **Create `src/components/ui/UnderConstruction.tsx`** component
3. **Add both env vars** to local `.env.local`:
   ```
   LOCAL_ENGINE_ENABLED=true
   NEXT_PUBLIC_LOCAL_ENGINE=true
   ```
4. **Create `.env.example`** documenting both variables

#### Phase 2: API Auth + Route Protection

5. **Create `src/lib/api-guards.ts`** with `requireAdmin()` and `requireLocalEngine()`
6. **Add `requireAdmin()` to all 22 regulatory-review API route handlers across 16 route files** (both engine-gated and open routes)
7. **Add `requireLocalEngine()` to 7 engine-dependent route files** (11 handlers) listed in Section 1.6
8. **Wrap detail page server component** (`[submissionId]/page.tsx`) SQLite calls in try/catch with fallback

#### Phase 3: UI Gating

9. **Gate `LandingPageClient.tsx`** — conditionally show/hide "New Project" entry point
10. **Gate `ReviewWizard.tsx`** — show `UnderConstruction` when `!isLocalEngineClient()`
11. **Gate `RunEngineButton.tsx`** — show `UnderConstruction` or disabled state
12. **Gate `FileManagementModal.tsx`** — show `UnderConstruction` for upload
13. **Gate `ProcessLauncher.tsx`** — show `UnderConstruction` for extraction launch

#### Phase 4: Admin Lock

14. **Add admin role** to your Supabase user (one-time, via Supabase dashboard)
15. **Update `middleware.ts`** — add `/regulatory-review/:path*` to matcher array and apply admin role gate
16. **Update `layout.tsx`** to check admin role and redirect non-admins

#### Phase 5: Build Risk Mitigation

> **Codex finding #7 (Medium):** Webpack `externals` in `next.config.ts` prevents bundling `better-sqlite3`, but the package still needs to be installed (native compilation) during `npm install` on Vercel. This may fail even if the code is never executed.

17. **Evaluate build strategy** — choose one:
   - **Option A (simplest):** Move `better-sqlite3` to `optionalDependencies` in `package.json`. Install failures become warnings, not errors.
   - **Option B:** Use dynamic `require()` (already partially implemented in `src/lib/sqlite/client.ts` with try/catch). Ensure no top-level imports of `better-sqlite3` exist outside the lazy-load pattern.
   - **Option C:** Separate deploy targets — exclude the regulatory-review page entirely from the Vercel build using `next.config.ts` route rewrites until Supabase migration is complete.
   - **Verify:** Run a test deploy to Vercel to confirm `better-sqlite3` does not block the build.

#### Phase 6: Bug Fix (Pre-existing)

> **Codex finding #8 (Medium):** `EditProjectModal.tsx:47` sends snake_case fields but `projects/[id]/route.ts:76` expects camelCase. This is an existing bug, not introduced by this plan, but should be fixed during this work.

18. **Align `EditProjectModal` payload** with API expected shape (camelCase)

#### Phase 7: Verification

19. **Local test** — confirm all features work with both env vars set to `true`
20. **Simulate remote** — unset both env vars, confirm:
    - Under-construction pages appear for engine features
    - API routes return 503 for engine-dependent calls
    - API routes return 401/403 for unauthenticated/non-admin calls
    - Detail page degrades gracefully (no unhandled SQLite crash)
21. **Simulate non-admin** — test with a non-admin Supabase user, confirm redirect at middleware, layout, and API levels
22. **Vercel test deploy** — confirm build succeeds with `better-sqlite3` mitigation

### 1.11 Files Changed Summary

**New Files (4):**

| File | Purpose |
|---|---|
| `src/lib/feature-flags.ts` | `isLocalEngineServer()` + `isLocalEngineClient()` |
| `src/lib/api-guards.ts` | `requireAdmin()` + `requireLocalEngine()` |
| `src/components/ui/UnderConstruction.tsx` | Under construction fallback component |
| `.env.example` | Documents `LOCAL_ENGINE_ENABLED` and `NEXT_PUBLIC_LOCAL_ENGINE` |

**Modified Files (~19):**

| File | Change |
|---|---|
| `.env.local` | Add `LOCAL_ENGINE_ENABLED=true` + `NEXT_PUBLIC_LOCAL_ENGINE=true` |
| `src/middleware.ts` | Add `/regulatory-review/:path*` to matcher; admin role gate |
| `src/app/(dashboard)/regulatory-review/layout.tsx` | Admin role check |
| `src/app/(dashboard)/regulatory-review/[submissionId]/page.tsx` | Wrap SQLite calls in try/catch |
| `src/app/api/regulatory-review/run-engine/route.ts` | Add admin + local engine guards |
| `src/app/api/regulatory-review/projects/route.ts` | Add admin + local engine guards (POST) |
| `src/app/api/regulatory-review/projects/[id]/route.ts` | Add admin + local engine guards (GET/PATCH/DELETE) |
| `src/app/api/regulatory-review/projects/[id]/extract/route.ts` | Add admin + local engine guards |
| `src/app/api/regulatory-review/projects/[id]/extract-status/route.ts` | Add admin + local engine guards |
| `src/app/api/regulatory-review/projects/[id]/files/route.ts` | Add admin + local engine guards |
| `src/app/api/regulatory-review/projects/[id]/files/[fileId]/route.ts` | Add admin + local engine guards (DELETE) |
| `src/app/api/regulatory-review/assessments/route.ts` | Add admin guard |
| `src/app/api/regulatory-review/judgments/route.ts` | Add admin guard |
| `src/app/api/regulatory-review/submissions/route.ts` | Add admin guard |
| `src/app/api/regulatory-review/search/route.ts` | Add admin guard |
| `src/app/(dashboard)/regulatory-review/components/LandingPageClient.tsx` | Conditional new-project UI |
| `src/app/(dashboard)/regulatory-review/components/wizard/ReviewWizard.tsx` | Under construction gate |
| `src/app/(dashboard)/regulatory-review/components/RunEngineButton.tsx` | Under construction gate |
| `src/app/(dashboard)/regulatory-review/components/modals/FileManagementModal.tsx` | Under construction gate |
| `src/app/(dashboard)/regulatory-review/components/modals/EditProjectModal.tsx` | Fix snake_case → camelCase payload |

### 1.12 Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Forgetting to set env vars locally | `.env.example` documents both; features degrade gracefully (under construction, not crashes) |
| Direct API call bypasses UI | API routes enforce both `requireAdmin()` and `requireLocalEngine()` independently of UI state |
| `better-sqlite3` fails Vercel build | Move to `optionalDependencies` or verify lazy-load pattern prevents build failure (Phase 5) |
| Admin role not set correctly | Defense-in-depth: middleware + layout + API route checks (3 layers) |
| Detail page crashes on Vercel | try/catch wrapper on SQLite calls with controlled fallback (Phase 2, step 8) |
| Future developer adds engine feature without gating | `feature-flags.ts` and `api-guards.ts` establish a clear pattern to follow |
| Env var naming confusion | Clear documentation: `LOCAL_ENGINE_ENABLED` = server, `NEXT_PUBLIC_LOCAL_ENGINE` = client |

---

## Part 2: Future Architecture Options

When the regulatory-review page is ready for external users beyond the admin, the architecture needs to evolve. These are the options evaluated, with trade-offs.

### Option A: Supabase PostgreSQL Migration (Review UI Only)

**What it solves:** Lets remote users view assessments, submit judgments, and search — without `better-sqlite3`.

**How it works:**
- Migrate the 5 SQLite migrations to Supabase Postgres tables
- Replace `src/lib/sqlite/` query functions with Supabase client calls (already in deps: `@supabase/ssr`)
- Update sync scripts in the regulatory-review repo to push results to Supabase instead of local SQLite
- Add Row-Level Security (RLS) policies for proper data isolation
- Engine execution remains local or requires a separate solution

**Effort:** Medium-High.

> **Codex correction:** v2.0 estimated ~10 query functions. Actual exported query surface is larger — `queries/index.ts`, `queries/review-projects.ts`, `queries/validation.ts` plus inline queries in API routes. True count is likely 20-30 functions.

**Migration risks to address** (Codex findings):

| Risk | Detail | Mitigation |
|---|---|---|
| **Multi-tenant authorization** | Current schema has no org/user ownership columns. RLS needs something to filter on. | Add `owner_id` or `organization_id` to submissions and projects tables before migration |
| **SQLite JSON text → Postgres jsonb** | `evidence_found`, `keywords_matched`, `linked_policies` stored as TEXT in SQLite, should be `jsonb` in Postgres | Schema migration converts types; query functions switch from `JSON.parse()` to native jsonb operators |
| **SQLite integer booleans → Postgres boolean** | `include_in_final`, `follow_up_needed`, `processed` use 0/1 integers | Schema migration converts to proper `boolean` type |
| **Full-text search** | Search endpoints may rely on SQLite-specific FTS | Need Postgres full-text search plan (`tsvector` + `ts_query` or Supabase pg_trgm extension) |

**Cost:** Covered by existing Supabase Pro plan (data is small: ~6K assessment rows, ~500 submission rows — well within Pro's 8GB database limit).

**What it doesn't solve:** File upload, extraction, and engine execution still need local services or a cloud compute backend.

**Best for:** The natural next step after the env-var gating is stable. Unlocks remote assessment review while keeping engine execution local.

### Option B: Docker Self-Hosted (Full Stack)

**What it solves:** Everything — packages the full system (Next.js + Python + SQLite + embeddings) into a container.

**How it works:**
- Multi-stage Dockerfile: Node.js for Next.js + Python 3.11 for engine
- SQLite database mounted as a volume
- `ralph_semantic/` IPC directories inside the container
- Users run `docker compose up` and access the full system locally
- Supabase auth can be swapped for local auth if needed

**Effort:** Medium-High — Dockerfile creation, volume management, testing across platforms.

**Cost:** Zero ongoing cloud cost. Users need Docker installed.

**What it doesn't solve:** Not a cloud deployment — each user runs their own instance. No shared state between users unless a shared database is added.

**Best for:** Distributing the complete system to technical users who need the full engine on their own hardware. Good for consultants or reviewers who need offline access.

### Option C: Hybrid — Cloud Dashboard + Local/Containerized Engine (Recommended Future Path)

**What it solves:** Splits the system into two deployment targets matched to their actual requirements.

| Component | Deployment | Tech |
|---|---|---|
| **Review Dashboard** | Vercel + Supabase | Next.js + Supabase Postgres |
| **Evaluation Engine** | Local machine, Docker, or Cloud Run | Python + SQLite + embeddings + AI APIs |

**How it works:**
- Dashboard deploys to Vercel — anyone with auth can review assessments and submit judgments
- Engine runs locally (or in Docker, or on Cloud Run) where Python evaluation happens
- Sync scripts push results TO Supabase instead of local SQLite
- `run-engine` API route either disabled in cloud mode, or calls a separate backend API endpoint
- File upload and extraction handled by the engine backend (local or cloud), not Vercel

**Effort:** Medium — Supabase migration (same as Option A) + optional engine API wrapper.

**Cost:** Covered by existing Supabase Pro plan for dashboard data. Engine compute costs depend on where it runs (see Part 3).

**Why this is recommended:** It matches the actual workflow — evaluations are run by the admin/operator, results are reviewed by multiple stakeholders in the dashboard. The two concerns have fundamentally different hosting requirements.

### Option D: Static Export (Limited Use Case)

**What it solves:** Read-only access to assessment results with zero backend.

**How it works:**
- Pre-render assessment data at Next.js build time (`output: 'export'`)
- Deploy as static HTML/CSS/JS to any hosting (Vercel, GitHub Pages, S3)
- No API routes, no database at runtime
- Data is baked into the build

**Effort:** Low-Medium — but requires rearchitecting data fetching from runtime queries to build-time generation.

**Cost:** Essentially free hosting.

**What it doesn't solve:** No interactive judgments. No real-time updates. No search against live data. Rebuild required for new data.

**Best for:** Generating a point-in-time snapshot report that stakeholders can browse. Could complement the main dashboard rather than replace it.

### Option E: Queue-Driven Async Engine Orchestration

> **Codex addition:** This was implicit under Option C but should be explicit, as evaluation engine invocations will likely exceed typical HTTP request lifetimes.

**What it solves:** Decouples the dashboard from synchronous engine execution. Users submit a job; the engine processes asynchronously; results appear when ready.

**How it works:**
- Dashboard submits an evaluation request to a **job queue** (Cloud Tasks, Pub/Sub, SQS, or Supabase Realtime + Edge Functions)
- A **worker** (Cloud Run Job, Fargate task, or persistent VM) picks up the job
- Worker runs the multi-stage evaluation pipeline
- Worker writes results to Supabase Postgres
- Dashboard polls or subscribes (Supabase Realtime) for completion
- User sees results when ready (minutes later, not inline with the request)

**Architecture:**
```
Dashboard                    Queue                     Worker
   │                          │                          │
   ├── POST /evaluate ──────→ │ (Cloud Tasks / Pub/Sub)  │
   │                          ├────────────────────────→ │
   │                          │                          ├── Docling extract
   │   (user sees "processing")                          ├── DB load
   │                          │                          ├── Keyword match
   │                          │                          ├── Embedding match
   │                          │                          ├── AI reasoning
   │                          │                          ├── Write results to DB
   │   ←── Realtime notify ←──┤←─── job complete ────────┤
   │                          │                          │
   ├── GET /results           │                          │
   │   (shows completed)      │                          │
```

**Effort:** Medium-High — requires queue infrastructure, worker deployment, status tracking.

**Cost:** Queue services are cheap (~$0.40/million messages). Worker cost same as Cloud Run/Fargate.

**Best for:** Production deployment where evaluations take 5-60+ minutes and cannot block an HTTP request.

### Options Comparison

| Criterion | A: Supabase | B: Docker | C: Hybrid | D: Static | E: Async Queue |
|---|---|---|---|---|---|
| Remote assessment viewing | Yes | Per-instance | Yes | Yes (read-only) | Yes |
| Remote judgment submission | Yes | Per-instance | Yes | No | Yes |
| Remote engine execution | No | Per-instance | Future | No | Yes |
| Shared state across users | Yes | No | Yes | No (snapshot) | Yes |
| Handles long-running jobs | N/A | N/A | Partial | N/A | Yes |
| Cloud deployment | Vercel | No | Vercel + backend | Any static host | Vercel + queue + worker |
| Effort | Medium-High | Medium-High | Medium | Low-Medium | Medium-High |
| Ongoing cost | Free-Low | Zero | Free-Low + compute | Free | Free-Low + compute |

### Recommended Progression

```
NOW:        Part 1 (env-var gating + admin lock + API auth)
                ↓
NEXT:       Option A (Supabase Postgres migration for assessment data)
                ↓
FUTURE:     Option C + E (hybrid: cloud dashboard + async engine backend)
```

This progression avoids premature decisions about the engine hosting while immediately unblocking the dashboard for remote review access. Option E (async queue) becomes part of Option C when the engine is ready for cloud deployment.

---

## Part 3: Cloud Pipeline Cost Analysis

This section analyzes the **incremental** cost of adding the evaluation pipeline to the cloud, on top of the existing Supabase Pro + Vercel Pro subscriptions.

> **Baseline:** Supabase Pro ($25/month) and Vercel Pro ($20/month) are already paid for the SSTAC Dashboard. All costs below are **incremental** — what you'd pay on top of existing subscriptions.
>
> **Codex note:** Pricing checked against provider pages as of February 2026. Costs may change — verify before implementation.

### 3.1 Pipeline Overview

The full cloud pipeline has 6 stages, with an **async job pattern** (not synchronous HTTP):

```
Stage 1: FILE UPLOAD
User uploads PDF(s) to cloud storage (ephemeral)
    ↓
Stage 2: JOB SUBMISSION
Dashboard enqueues an evaluation job (Cloud Tasks / Pub/Sub / SQS)
    ↓
Stage 3: EXTRACTION (Docling) — async worker
PDF → structured JSON (verbatim text blocks with page/section refs)
    ↓
Stage 4: DATABASE LOAD (Raw Submission) — async worker
Extracted JSON → Supabase Postgres (raw submission content — KEPT permanently)
    ↓
Stage 5: EVALUATION ENGINE — async worker
Multi-stage processing against policy knowledge base (~5,860 active policies):
  5a. Applicability filtering (deterministic/programmatic)
  5b. Keyword matching (deterministic/programmatic)
  5c. Embedding similarity (local model in container)
  5d. AI reasoning/synthesis (API-based — multi-AI in series)
    ↓
Stage 6: RESULTS STORAGE + CLEANUP
Engine outputs → Supabase Postgres (KEPT permanently)
Ephemeral files (PDF, JSON) deleted
    ↓
Stage 7: FRONTEND DISPLAY
Dashboard notified (Supabase Realtime or polling); user views results
```

> **Codex recommendation:** Prefer async job pattern (Cloud Run Jobs or queue + worker) over synchronous frontend-triggered long requests. Engine evaluations can take 5-60+ minutes and will exceed typical HTTP timeouts.

### 3.2 Ephemeral vs Persistent Storage

**Can intermediate files (uploaded PDFs, extracted JSON) be temporary, deleted after the final output is in the database?**

**Yes — and this is the recommended approach.** Here's what stays and what goes:

| Data | Lifecycle | Storage | Rationale |
|---|---|---|---|
| Uploaded PDF(s) | **Ephemeral** — delete after extraction completes | Cloud object storage (temp bucket, 24h auto-expire) | Not needed after text is extracted; user retains originals |
| Extracted JSON (verbatim blocks) | **Ephemeral** — delete after DB load | Cloud object storage or in-memory | Intermediate format; content is loaded to DB |
| Raw submission content (in DB) | **Permanent** | Supabase Postgres | Source of truth for what was submitted; needed for re-evaluation, audit trail |
| Evaluation engine outputs | **Permanent** | Supabase Postgres | Evidence, analytics, synthesis — what users view in the dashboard |
| Engine working files (IPC, temp) | **Ephemeral** — delete after engine completes | Container filesystem or `/tmp` | Internal processing artifacts |

**Pipeline with ephemeral storage:**

```
PDF uploaded → temp bucket (auto-expire 24h)
    ↓
Docling extracts → JSON in memory or temp storage
    ↓
JSON loaded to DB → raw submission rows (PERMANENT)
    ↓
temp bucket cleaned up (PDF + JSON deleted)
    ↓
Engine reads from DB → processes → writes results to DB (PERMANENT)
    ↓
User views results in dashboard
```

#### Audit & Reproducibility Controls

> **Codex addition:** Ephemeral storage is good for cost/privacy, but requires audit controls to ensure reproducibility.

| Control | What to Persist | Where | Purpose |
|---|---|---|---|
| **File integrity** | SHA-256 hash of original PDF | Submission record in DB | Verify re-uploaded file matches original |
| **Extraction provenance** | Docling version, extraction timestamp, config params | Submission metadata in DB | Reproduce extraction if needed |
| **Engine versioning** | Engine version, model IDs, prompt versions | Evaluation result metadata in DB | Know exactly what produced the results |
| **Legal hold** | Optional: retain source PDFs in long-term storage bucket | Separate cold storage bucket (S3 Glacier / GCS Nearline) | When regulatory or legal requirements mandate source file retention |

**Legal hold pattern:**
- Default: ephemeral (delete after extraction)
- Flag per submission: `retain_source = true` → move PDF to cold storage instead of deleting
- Cold storage cost: ~$0.004/GB/month (S3 Glacier Instant Retrieval)
- Decision on retention policy is a business/legal question, not a technical one

### 3.3 Cost Breakdown by Stage

#### Stage 1: File Upload — Cloud Object Storage

| Provider | Service | Incremental Cost | Notes |
|---|---|---|---|
| Supabase | Storage (S3-backed) | $0 incremental (Pro includes 100GB storage) | PDFs are ephemeral — auto-delete after extraction |
| Vercel | Blob Storage | $0 incremental (Pro includes blob storage) | Alternative to Supabase storage |
| AWS S3 | Direct | ~$0.023/GB/month | If using separate AWS backend |

**Typical submission:** 5-20 PDFs, 1-50MB each. Since files are ephemeral (deleted within 24h), **actual stored volume stays near zero**.

**Estimated cost: ~$0/month**

#### Stage 2: Extraction (Docling) — Compute

Docling requires Python + potentially GPU for complex PDFs.

| Option | Service | Cost | Latency | Notes |
|---|---|---|---|---|
| **Serverless function** | AWS Lambda | ~$0.0000133/GB-s | Minutes | 15 min max timeout. May work for smaller PDFs. |
| **Cloud container** | Google Cloud Run / AWS Fargate | ~$0.024/vCPU-hr + $0.003/GB-hr (Cloud Run) | Minutes | Spin up on demand, shut down after. Best fit. |
| **Cloud Run Job** | Google Cloud Run Jobs | Same as Cloud Run | Minutes | Better for async — no HTTP timeout concern |
| **Dedicated VM** | AWS EC2 / GCP Compute | ~$30-70/month (e2-medium) | Seconds | Always-on. Only justified at high volume. |
| **Managed extraction** | AWS Textract | ~$1.50/1000 pages (forms), ~$15/1000 pages (tables) | Seconds | Not docling — different quality. May not preserve verbatim fidelity. |

> **Codex recommendation:** Prefer Cloud Run Jobs (async) over Cloud Run services (synchronous HTTP) for extraction workloads. No HTTP timeout concern, cleaner lifecycle management.

**Estimated cost per submission (20 pages):** ~$0.01-0.05 (Cloud Run, ~1-2 min compute)

#### Stage 3: Database Load — Supabase Postgres

| Item | Cost |
|---|---|
| Row inserts | Negligible (included in Supabase Pro) |
| Storage per submission | ~50KB-200KB (text content, not files) |
| 100 submissions | ~5-20MB total |

**Estimated incremental cost: $0** (well within Supabase Pro's 8GB database limit)

#### Stage 4: Evaluation Engine — Compute + AI APIs

**4a. Applicability Filtering + 4b. Keyword Matching (Deterministic)**

Negligible cost — pure Python logic, in-memory.

**4c. Embedding Similarity**

| Option | Service | Cost per Submission | Notes |
|---|---|---|---|
| **Local model** (in container) | sentence-transformers (all-MiniLM-L6-v2) | ~$0.01-0.05 compute | Runs in same container. No API cost. Container needs ~500MB extra RAM. |
| **API-based** | OpenAI text-embedding-3-small | ~$0.01-0.02 per submission | $0.00002/1K tokens (current pricing, Feb 2026). ~500 policies x ~200 tokens. |
| **API-based** | Voyage AI / Cohere | Similar range | Alternative providers |

**Recommended:** Local model in the same container as docling. Free after compute cost.

**4d. AI Reasoning/Synthesis (Multi-AI in Series)**

> **Important finding from testing:** Haiku has been tested and **fails badly** for this work — it cannot handle the regulatory complexity, evidence grounding, or cross-policy synthesis required. It is explicitly excluded from the recommended architecture.

The engine requires a **two-model architecture** with distinct roles:

| Role | Purpose | Model Class | Examples |
|---|---|---|---|
| **Fast Model** | High-throughput deterministic support: normalization, classification, structured extraction, applicability pre-screening | Fast/efficient tier | Sonnet 4.6, GPT-4o-mini, Gemini Flash, local Mistral-nemo |
| **Thinking Model** | Complex policy reasoning, cross-evidence synthesis, final narrative/judgment output | Extended thinking tier | Opus 4.6 (extended thinking), o3, Gemini 2.5 Pro |

**Fast model handles (high volume, low cost per call):**
- Policy applicability classification (applicable / not applicable / ambiguous)
- Evidence text normalization and structuring
- Keyword/entity extraction from submission text
- Initial evidence-policy matching and scoring
- Confidence-gated escalation: if confidence < threshold → escalate to thinking model

**Thinking model handles (selective, high cost per call):**
- Complex policy interpretation requiring multi-step reasoning
- Cross-evidence synthesis across multiple submission sections
- Final adequacy assessment with regulatory grounding
- Cases where fast model confidence is low or ambiguous
- Narrative generation for reviewer consumption

**Escalation pattern:**
```
All ~500 applicable policies
    ↓
Fast model: classify + score (all 500)
    ├── High confidence (>threshold): fast model result is final
    ├── Low confidence / ambiguous: escalate to thinking model
    └── Complex policy type (TIER_2, cross-ref): always escalate
    ↓
Thinking model: deep analysis (~100-200 escalated policies)
    ↓
Results merged → DB
```

> **Pricing basis (Feb 2026 — verify at anthropic.com/pricing, openai.com/api/pricing):**
> - Claude Sonnet 4.6: $3/$15 per MTok (input/output)
> - Claude Opus 4.6: $15/$75 per MTok (input/output)
> - GPT-4o-mini: $0.15/$0.60 per MTok
> - Gemini 2.5 Flash: ~$0.15/$0.60 per MTok
> - Gemini 2.5 Pro: ~$1.25/$10 per MTok

| Scenario | Fast Model | Thinking Model | Est. Escalation Rate | Cost per Submission |
|---|---|---|---|---|
| **Efficient** | Sonnet 4.6 (all 500) | Opus 4.6 (~100 escalated) | ~20% | $3-8 |
| **Cost-optimized** | GPT-4o-mini or Gemini Flash (all 500) | Sonnet 4.6 (~150 escalated) | ~30% | $2-5 |
| **Premium** | Sonnet 4.6 (all 500) | Opus 4.6 (~200 escalated) | ~40% | $8-18 |
| **Full thinking** | Skip fast model | Opus 4.6 (all 500) | 100% | $20-40 |
| **Current local** | Ollama Mistral-nemo 12B | N/A (local GPU) | N/A | ~$0 |

**Key cost factors:**
- **Escalation rate** is the primary cost lever. Aggressive fast-model filtering (20% escalation) vs conservative (40%) changes cost 2-3x.
- **Number of applicable policies:** Currently ~500-1,500 after deterministic filtering. More filtering = lower cost.
- **Token volume per policy:** ~500-2,000 tokens input + ~200-500 tokens output per policy.
- **Thinking model selection:** Sonnet as "thinker" ($3-5/submission) vs Opus ($8-18) vs o3 (varies).

#### Acceptance Gates (Quality Guardrails)

The fast model pre-screen must meet quality thresholds. If it doesn't, auto-escalate to thinking model:

| Gate | Metric | Threshold | Action if Fails |
|---|---|---|---|
| **Policy applicability recall** | % of truly-applicable policies correctly identified by fast model | ≥95% | Escalate all to thinking model |
| **Evidence grounding score** | % of cited evidence that exists verbatim in submission | ≥90% | Reject fast model output; re-process with thinking model |
| **Synthesis quality score** | Coherence + completeness of final narrative (measured on sample) | ≥80% (TBD) | Flag for human review |
| **Confidence calibration** | Fast model's stated confidence vs actual accuracy | Within 10% | Retune confidence thresholds |

#### Recall Guardrails

> **Codex addition:** The fast model pre-screen needs measured recall guardrails to ensure it doesn't silently drop policies that the thinking model would have flagged.

| Guardrail | Method | Frequency |
|---|---|---|
| **Periodic full-model sampling** | Run every Nth submission (e.g., every 10th) through thinking model without pre-screening | Ongoing |
| **Recall measurement** | Compare fast-model-filtered results vs full thinking model results; calculate false negative rate | Per sampling batch |
| **Threshold alarm** | If false negative rate exceeds 5%, disable fast model pre-screening | Automated |
| **Fast model tuning** | Adjust prompt/threshold based on recall measurements | Quarterly |
| **Fallback rule** | If fast model confidence < threshold on ANY policy, auto-escalate to thinking model | Per-policy |

#### Stage 5: Results Storage — Supabase Postgres

| Item | Cost |
|---|---|
| Evidence records per submission | ~500-2,000 rows |
| Storage per submission | ~200KB-1MB (evidence text, analytics JSON) |
| 100 submissions | ~20-100MB |

**Estimated incremental cost: $0** (well within Supabase Pro's 8GB database limit)

#### Stage 6: Frontend Display — Vercel

| Item | Included in Pro |
|---|---|
| Vercel Pro bandwidth | 1TB/month |
| Serverless function invocations | Unlimited (within compute budget) |
| Serverless function compute | 1000 GB-hours/month |

**Estimated incremental cost: $0** — regulatory review page adds negligible load to existing Pro plan.

### 3.4 Total Cost Summary

**Existing monthly baseline (already paid):**

| Component | Monthly Cost | Status |
|---|---|---|
| Vercel Pro | $20/month | Already paid |
| Supabase Pro | $25/month | Already paid |
| **Baseline** | **$45/month** | **Sunk cost — no incremental charge** |

**Incremental per-submission cost (cloud pipeline):**

| Component | Cost-Optimized | Standard | Premium |
|---|---|---|---|
| File upload + storage | $0 | $0 | $0 |
| Docling extraction (Cloud Run) | $0.02 | $0.05 | $0.05 |
| DB load | $0 | $0 | $0 |
| Deterministic (keywords + embeddings) | $0.02 | $0.05 | $0.05 |
| Fast model (all ~500 policies) | $0.15 (Flash/4o-mini) | $1.50 (Sonnet) | $1.50 (Sonnet) |
| Thinking model (escalated subset) | $1.50 (Sonnet, ~150) | $5.00 (Opus, ~100) | $10.00 (Opus, ~200) |
| Results storage | $0 | $0 | $0 |
| **Total per submission** | **~$1.69** | **~$6.60** | **~$11.60** |

**Incremental monthly infrastructure:**

| Component | Cost | Notes |
|---|---|---|
| Cloud Run Jobs (engine compute, idle) | $0 | Scales to zero |
| Cloud Run Jobs (active processing) | ~$0.02-0.05/submission | Included in per-submission above |
| Container registry (GitHub) | $0 | Free |
| Queue service (Cloud Tasks / Pub/Sub) | ~$0 | Free tier: 1M messages/month |
| **Total incremental fixed** | **~$0/month** | All variable costs are per-submission |

**Monthly cost at volume (incremental only, on top of $45 baseline):**

| Submissions/month | Cost-Optimized | Standard | Premium |
|---|---|---|---|
| 5 | $8 | $33 | $58 |
| 10 | $17 | $66 | $116 |
| 25 | $42 | $165 | $290 |
| 50 | $85 | $330 | $580 |
| 100 | $169 | $660 | $1,160 |

**Key insight:** AI inference tokens are the dominant cost (~90%+ of per-submission cost). The escalation rate between fast model and thinking model is the primary cost lever. Everything else (storage, compute, hosting) is either covered by Pro plans or negligible.

### 3.5 Cost Optimization Strategies

| Strategy | Impact | Trade-off |
|---|---|---|
| **Aggressive applicability filtering** | Reduces policies from ~1,500 to ~300-500 before AI | May miss edge cases |
| **Fast model confidence gating** | Only escalate ~20-30% to thinking model instead of ~40% | Lower escalation = slightly higher false negative risk |
| **Recall guardrails** | Periodic full thinking-model runs to validate fast model accuracy | ~10% overhead cost on sampled submissions |
| **Cache policy evaluations** | Same policy + same evidence = cached result | Stale cache if policies update |
| **Batch submissions** | Process multiple submissions in one container spin-up | Slight delay for individual submissions |
| **Local model for embeddings** | $0 vs API cost | Container needs ~500MB more memory |
| **Ephemeral storage + audit hashes** | No accumulated file storage costs | Users must re-upload if re-extraction needed |
| **Rate limiting** | Cap submissions per user per day | Limits abuse, not cost per legitimate use |
| **Use cheaper fast model** | GPT-4o-mini/Flash at ~$0.15/MTok vs Sonnet at $3/MTok | Lower quality pre-screening; may increase escalation rate |

### 3.6 Architecture Decision: Where to Run the Engine

This decision can be deferred until the engine architecture stabilizes (your current local testing/development phase). The options:

| Option | Fixed Cost | Per-Submission Compute | Async Support | Best For |
|---|---|---|---|---|
| **Cloud Run Jobs (recommended)** | $0 (idle) | ~$0.02-0.05 | Native | On-demand async, Docker-based, auto-scale |
| **Cloud Run Service** | $0 (idle) | ~$0.02-0.05 | Via queue | If HTTP trigger needed |
| **AWS Lambda** | $0 (idle) | ~$0.01-0.03 | Via SQS | Simple functions, 15 min timeout limit |
| **Dedicated VM** | $30-70/month | $0 (already paid) | Any | High volume (>50 submissions/month) |
| **User's local machine** | $0 | $0 | N/A | Current approach; doesn't scale to external users |

> **Codex recommendation:** Prefer Cloud Run Jobs over Cloud Run services for this workload. Jobs have no HTTP timeout concern, cleaner lifecycle, and are designed for batch/async processing.

---

## Appendix A: Codex Review Findings Tracker

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | API routes have no server-side auth — admin UI gate doesn't secure backend | **Addressed** — Section 1.6, `requireAdmin()` on all routes |
| 2 | Critical | Route coverage incomplete — `projects/[id]` GET/PATCH/DELETE missing | **Addressed** — Section 1.6, full route table |
| 3 | High | Route/method mismatch — `files/[fileId]` is DELETE, not GET | **Addressed** — Section 1.6, corrected to DELETE |
| 4 | High | Middleware doesn't match `/regulatory-review/*` | **Addressed** — Section 1.8, add to matcher |
| 5 | High | Detail page SQLite call outside try/catch crashes on Vercel | **Addressed** — Section 1.9 |
| 6 | High | `NEXT_PUBLIC_` used for server enforcement; naming inconsistent | **Addressed** — Section 1.2/1.3, split into two vars |
| 7 | Medium | `better-sqlite3` build risk on Vercel not fully mitigated | **Addressed** — Section 1.10, Phase 5 |
| 8 | Medium | `EditProjectModal` snake_case vs API camelCase mismatch | **Addressed** — Section 1.10, Phase 6 |
| P2-1 | Medium | Missing async queue option in future architecture | **Addressed** — Option E added |
| P2-2 | Medium | Migration effort underestimated (~10 vs actual 20-30 functions) | **Addressed** — Option A effort corrected |
| P2-3 | Medium | Supabase migration risks not covered (multi-tenant, jsonb, FTS) | **Addressed** — Option A risk table |
| P3-1 | Low | Pricing may be stale | **Addressed** — Updated with Feb 2026 pricing, verification note added |
| P3-2 | Medium | Ephemeral storage needs audit/reproducibility controls | **Addressed** — Section 3.2 audit table |
| P3-3 | Medium | Prefer async job pattern over synchronous | **Addressed** — Section 3.1 pipeline, Section 3.6 |
| P3-4 | Medium | Haiku pre-screen needs recall guardrails | **Addressed** — Section 3.3, recall guardrails table |
| v3.1-1 | High | Haiku tested and fails for this work — remove from recommended path | **Addressed** — Section 3.3, replaced with fast model + thinking model |
| v3.1-2 | Medium | Cost framing assumed free tier; actual baseline is Supabase Pro + Vercel Pro | **Addressed** — Section 3.3/3.4, incremental cost framing |
| v3.1-3 | Medium | Need acceptance gates for fast model quality | **Addressed** — Section 3.3, acceptance gates table |

## Appendix B: Assumptions to Validate

> From Codex review — these should be confirmed before implementation.

| # | Assumption | Status | Notes |
|---|---|---|---|
| 1 | `/regulatory-review/*` is intended to be reachable in production URL space | **To confirm** | If not, could exclude entirely from Vercel build |
| 2 | External users will need tenant isolation (not just single-admin internal use) | **To confirm** | Affects whether multi-tenant schema work (RLS, ownership columns) is needed for Option A |
| 3 | Legal/audit policy permits deleting source PDFs after extraction for all submission types | **To confirm** | If not, need legal-hold retention option (Section 3.2) |
| 4 | Engine invocations are asynchronous and may exceed typical HTTP request lifetimes | **Likely yes** | Current local runs take 5-70 minutes; async pattern (Option E) is appropriate |

## Appendix C: File Reference

### New Files (Part 1 Implementation)

| File | Purpose |
|---|---|
| `src/lib/feature-flags.ts` | `isLocalEngineServer()` + `isLocalEngineClient()` |
| `src/lib/api-guards.ts` | `requireAdmin()` + `requireLocalEngine()` |
| `src/components/ui/UnderConstruction.tsx` | Under construction fallback component |
| `.env.example` | Documents `LOCAL_ENGINE_ENABLED` and `NEXT_PUBLIC_LOCAL_ENGINE` |

### Key Existing Files

| File | Relevance |
|---|---|
| `next.config.ts` | Build config, `better-sqlite3` externalization |
| `src/middleware.ts` | Auth/security middleware — needs `/regulatory-review` matcher + admin gate |
| `src/lib/supabase/middleware.ts` | Supabase auth helper |
| `src/lib/sqlite/client.ts` | SQLite connection — lazy-load pattern, future Supabase swap target |
| `src/lib/sqlite/queries/index.ts` | Query functions — future Supabase swap target |
| `src/lib/sqlite/queries/review-projects.ts` | Project queries — future Supabase swap target |
| `src/lib/sqlite/queries/validation.ts` | Validation queries — future Supabase swap target |
| `src/app/(dashboard)/regulatory-review/layout.tsx` | Section layout — admin gate location |
| `src/app/(dashboard)/regulatory-review/page.tsx` | Landing page server component |
| `src/app/(dashboard)/regulatory-review/[submissionId]/page.tsx` | Detail view — needs SQLite try/catch |
| `src/app/(dashboard)/regulatory-review/components/modals/EditProjectModal.tsx` | Pre-existing snake_case bug |

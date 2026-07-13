# Security/RBAC Re-Verification: HITL Packets + Prioritization Matrix (2026-07-13)

Analysis only. No code changed. Re-verifies two suspected gaps against the current
code in worktree top50-2026-07-13.

## Summary

- GAP 1 (HITL packets, no role gate): REAL. Confidence: HIGH.
- GAP 2 (prioritization-matrix authenticated user_id leak): REAL, and appears to be
  an intentional design tradeoff from PR #608, not an oversight. Confidence: HIGH.

Both fixes are OWNER-GATED: neither has a role/UX answer that can be inferred from
the code alone (no "reviewer" role exists yet; the survey-results scatter tooltip
was deliberately built on raw user_id for all logged-in users).

---

## GAP 1: /api/hitl-packets/* has no reviewer/admin role gate

### Current behavior (quoted)

All four routes under `src/app/api/hitl-packets/` perform the identical check and
nothing more:

`src/app/api/hitl-packets/route.ts:15-19`
```
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
```

The same three lines (any-logged-in-user only, no role check) appear at:
- `src/app/api/hitl-packets/[sessionId]/route.ts:21-25`
- `src/app/api/hitl-packets/[sessionId]/csv/route.ts:20-22`
- `src/app/api/hitl-packets/[sessionId]/md/route.ts:20-22`

The dashboard page that lists sessions has the same gap:
`src/app/(dashboard)/hitl-packets/page.tsx:46-49`
```
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect('/login?redirect=/hitl-packets');
  }
```
No role/claim check anywhere in that file either.

There is no `user_roles` lookup, no `ADMIN_ROLES` array, no claim check in any of
these five files. `grep`-ing `src/lib/supabase-auth.ts` for role-related helpers
(`role|isAdmin|isReviewer|requireRole|checkRole`) returns zero matches -- the
project's role-check helper does not exist at that layer; role checks elsewhere in
the codebase (e.g. `src/app/api/matrix-map/admin/publish/route.ts:46-52`) are done
ad hoc per-route via a direct `user_roles` table query. That pattern was not applied
here.

### Data source and sensitivity

`discoverPacketSessions` / `loadPacketBySessionId` / `getArtifactPath`
(`src/lib/hitl-packets/discovery.ts`) read HITL packet JSON/CSV/MD files directly
off the **filesystem** (env `HITL_PACKET_DIR`, default
`<cwd>/../Regulatory-Review/1_Active_Reviews/Teck_Trail-WARP/2_Evaluation_Output`).
This is not a Supabase table query at all -- **there is no RLS layer backing this
route**, so "does RLS protect it anyway" does not apply here the way it would for a
DB-backed route. Whatever protection exists is exactly what the route code
implements, which today is "any authenticated user."

The content is HITL (human-in-the-loop) evaluation packets: per the page copy
("Review evaluation packets produced by the RRAA engine") and the API doc-comment
("Return full packet JSON + validation result for a session"), this is reviewer
judgment/evaluation material -- the class of content the SSTAC-Dashboard CLAUDE.md
explicitly treats as HITL-only elsewhere (verdicts, judgments). It is reasonable to
treat it as reviewer-only, not general-member-readable.

### Verdict

REAL. Confidence: HIGH on the code fact (no role check exists, verified by direct
read of all 5 files); MEDIUM on real-world exploitability, which depends on whether
`HITL_PACKET_DIR` is populated with real WARP/HHRA packet data in an environment
that has other authenticated non-reviewer users signed up (e.g. any general
member/CEW-2025 account holder who also happens to have a full authenticated
Supabase session, not the anonymous CEW poll flow). If that directory is empty or
unset in the deployed environment, the route degrades to `sessions: []` / 404s and
the gap is latent rather than actively exploited today -- but the code itself is
the same either way and should be fixed regardless of current data population.

### Proposed minimal fix (not applied)

Add a `user_roles` gate mirroring the existing pattern in
`src/app/api/matrix-map/admin/publish/route.ts:46-63`: after
`getAuthenticatedUser`, query `user_roles` for the caller's `user_id`, `.in('role',
ALLOWED_ROLES)`, return 403 if no matching row. Apply the same check to all four API
routes and to the page-level check in `hitl-packets/page.tsx` (page-level alone is
not sufficient -- the API routes are directly callable regardless of page gating,
per the same reasoning already documented in the prioritization-matrix route's own
2026-07-11 security comment).

**Open question for the owner (blocks a concrete PR):** what `ALLOWED_ROLES` value
is correct. The codebase has no "reviewer" role today -- existing role arrays are
`['admin', 'matrix_admin']` only (`src/lib/admin-utils.ts:14`,
`src/app/api/matrix-map/export/route.ts:10`, `.../admin/publish/route.ts:10`,
`.../admin/audit-history/route.ts:34`). Reusing `admin`/`matrix_admin` is the
zero-new-schema option; adding a dedicated `hitl_reviewer` role is more correct
long-term but requires a new migration plus backfilling role assignments for the
actual reviewer set.

### Blast radius

Any current legitimate user of `/hitl-packets` who does not hold `admin` /
`matrix_admin` (or a to-be-created reviewer role) would lose access once gated.
Cannot determine from code alone who those users are today (no session/analytics
data available to this analysis) -- owner should confirm the current HITL-packet
reviewer population maps onto `admin`/`matrix_admin` before shipping, or the fix
will lock out real reviewers.

---

## GAP 2: /api/graphs/prioritization-matrix GET, authenticated non-admin user_id leak

### Current behavior (quoted)

`src/app/api/graphs/prioritization-matrix/route.ts:99-125` establishes only two
tiers, both determined by `getAuthenticatedUser`, with no admin/role distinction:

```
  const authClient = await createAuthenticatedClient();
  const requester = await getAuthenticatedUser(authClient);
  const isAuthenticated = !!requester;
  const cacheTier = isAuthenticated ? 'auth' : 'public';
```

The route's own inline security comment (lines 103-118) states the design
explicitly and confirms this is intentional, not an oversight:

```
  //   - "auth" tier (any logged-in caller): unchanged pre-fix behavior --
  //     individual vote rows for BOTH cew and authenticated users, including
  //     raw authenticated user_id (needed for the survey-results scatter
  //     tooltip; matches existing non-admin-authenticated consumer needs).
```

The response-shaping branch that actually applies the tier
(`route.ts:566-578`) confirms the same two-way split -- authenticated vs not,
never admin vs not:

```
    const responseData: EnhancedMatrixData[] = isAuthenticated
      ? matrixData
      : matrixData.map(entry => ({
          ...entry,
          individualPairs: entry.individualPairs.filter(pair => pair.userType !== 'authenticated'),
        }));
```

`matrixData` (built at lines 411-450 from the `poll_votes` table, queried via
`createAnonymousClient()` at line 101/152/317/328 -- note the *data query* client is
the anon client regardless of caller identity; only the tier decision uses the
authenticated client) includes, for every `userType === 'authenticated'` vote pair,
the raw Supabase `auth.users.id` UUID as `userId` (assigned at
`src/app/api/polls/submit/route.ts:22,51,77` via `finalUserId = user.id`).

`filter=cew` vs `filter=survey-results/twg` only changes which `poll_votes` rows are
included (CEW-prefixed vs authenticated), per lines 173-179 and 481-486; it does not
change the authenticated/admin distinction -- an authenticated caller gets raw
`user_id` on `filter=all` or `filter=twg`, admin or not.

**Confirmed consumer, not just a theoretical exposure:** the value is rendered in
the UI, truncated but real, to any logged-in visitor of the survey-results pages:

`src/components/graphs/PrioritizationMatrixGraph.tsx:395-396`
```
                          ? `${clusterSize} users at this location | User: ${pair.userId.substring(0, 8)}... | Importance: ${pair.importance}, Feasibility: ${pair.feasibility}`
                          : `User: ${pair.userId.substring(0, 8)}... | Importance: ${pair.importance}, Feasibility: ${pair.feasibility}`
```

That component is reached from `SurveyMatrixGraph.tsx:49` (`fetch('/api/graphs/
prioritization-matrix?filter=all')`), which is rendered on
`/survey-results/prioritization` and `/survey-results/holistic-protection`
(`src/app/(dashboard)/survey-results/prioritization/PrioritizationClient.tsx`,
`.../holistic-protection/HolisticProtectionClient.tsx`). Access to `/survey-results/
:path*` is gated by `src/middleware.ts:146-148,158` to "any authenticated user"
only (`if (!user) { return redirectToLogin(...) }` -- no role check in middleware
at all, matcher includes `/survey-results/:path*`).

### Verdict

REAL leak remains for authenticated non-admin callers. Confidence: HIGH -- confirmed
by direct code read across the route, the submit route (confirming `userId` = real
`auth.users.id`), the rendering component (confirming it is displayed, not just
passed through unused), and the middleware (confirming the consuming page requires
only "logged in," not "admin"/"TWG"). The exact condition: any request to
`GET /api/graphs/prioritization-matrix` (any `filter` value that includes
non-CEW rows) from a session where `getAuthenticatedUser` returns a user receives
full `individualPairs` for `userType: 'authenticated'` rows, including the other
users' raw `user_id`, regardless of that caller's own role.

Distinct from the PR #608 fix, which correctly closed the **anonymous/unauthenticated**
leak (`isAuthenticated` false branch at line 574-578) -- that fix is sound and not
in question here. The open gap is authenticated-but-non-admin, which line 106's own
comment shows was a deliberate scope decision at the time, not missed.

### Proposed minimal fix (not applied)

Two independent design choices, either or both:
1. **Gate the raw user_id, not just "authenticated," to an admin/TWG-only role** --
   add the same `user_roles` lookup pattern used in `matrix-map/admin/publish/
   route.ts:46-63`, and split the response into three tiers: public (current
   anonymous behavior), authenticated-non-admin (new: keep aggregate stats +
   individualPairs but drop/redact `userId`, matching the "strip the whole
   sensitive field, not silently corrupt the row" approach already used for the
   public tier), and admin (current authenticated behavior, unchanged).
2. **Pseudonymize `userId` for the authenticated-non-admin tier** instead of
   dropping it outright, if the scatter plot's per-point identity is only used for
   React-key/clustering purposes and not meant to be human-readable -- would need a
   check of whether `PrioritizationMatrixGraph.tsx` needs a *stable* identifier
   (e.g. for the clustering count logic around line 395) as opposed to a
   *meaningful* one. Cannot fully rule this in or out without reading the full
   clustering logic in that file, which was out of scope for this analysis (only
   the tooltip line was inspected).

### Blast radius

Changes the data returned to every currently-logged-in non-admin user viewing
`/survey-results/prioritization` or `/survey-results/holistic-protection` (the
scatter plot tooltip would no longer show a `User: xxxxxxxx...` fragment for other
respondents' points, only for admins). This is the exact behavior the route's own
2026-07-11 comment says was preserved "to match existing non-admin-authenticated
consumer needs" -- i.e., a prior session already considered and accepted this
tradeoff once. Revisiting it is a legitimate follow-up but is a UX regression for
the survey-results scatter view unless the pseudonymization (option 2) preserves
enough for the existing UI to keep working. Admin-only consumer
(`src/app/(dashboard)/admin/poll-results/PollResultsClient.tsx` via
`useMatrixDataCache.ts`) is unaffected either way since it would fall in the
unchanged admin tier.

---

## Recommendation

Both gaps are real by direct code inspection; neither has a safe default fix that
does not require an owner decision (GAP 1: which role should gate HITL packets;
GAP 2: drop vs pseudonymize `userId` for the authenticated-non-admin tier, and
confirm the clustering logic in `PrioritizationMatrixGraph.tsx` does not require the
raw value). Recommend owner picks one gap to fix first; GAP 2 has a clearer, more
contained blast radius (one route, one already-precedented `user_roles` pattern) and
is the more sensitive of the two (renders another real person's UUID fragment in a
UI any logged-in member can reach) -- suggest GAP 2 first if forced to sequence.

# API Guard Role-Model Audit (T39)

Date: 2026-07-11
Branch: fix/mo-auth-hardening-2026-07-11
Scope: every `src/app/api/**/route.ts` handler (72 route files), auditing HOW admin
authorization is enforced and whether the role tier is consistent.

Trigger: `src/lib/api-guards.ts` `requireAdmin()` checks `role = 'admin'` (single role),
while the matrix-map routes check `role IN ('admin','matrix_admin')`. This document
records the intended role model, catalogs every route's guard, fixes any CLEAR tier
mismatch, and FLAGS ambiguous ones for orchestrator/owner decision rather than
changing shared semantics.

---

## 1. Intended role model

There are two legitimate admin tiers in this app, and the split is BY DESIGN per
feature domain (not a bug):

- `admin` -- the global superuser role. Required for the operational/analyst lanes:
  regulatory-review, engine-v2, agentic-os, and the site-content admin surfaces
  (announcements, tags, milestones, documents mutations).
- `matrix_admin` -- a narrower, delegated role that grants matrix-map curation /
  publication rights WITHOUT granting global admin. Matrix-map admin routes therefore
  accept EITHER `admin` OR `matrix_admin` (`ADMIN_ROLES = ['admin','matrix_admin']`).

Rule of thumb for "which tier is correct":

- Matrix-map curation/publish/export -> `admin` OR `matrix_admin` (broad set), because
  the matrix_admin delegate is expected to operate that lane.
- Everything else that is admin-gated -> `admin` ONLY. A matrix_admin must NOT gain
  regulatory-review / engine-v2 / agentic-os / site-content powers. So the single-role
  `requireAdmin()` / `requireAdminForApi()` check in those lanes is CORRECT, not a
  drift from the matrix-map pattern.

Corollary: the apparent "inconsistency" between `requireAdmin` (single role) and
`requireMatrixMapAdmin` (two roles) is intentional -- they guard different domains with
different intended tiers. The two should NOT be unified into one helper, because doing
so would either (a) leak matrix_admin into the admin-only lanes, or (b) lock
matrix_admin out of matrix-map. Neither is desired.

### Guard implementations in the codebase

| Helper | Location | Role check | Domain |
|---|---|---|---|
| `requireAdmin()` | `src/lib/api-guards.ts` | `.eq('role','admin')` (single) | regulatory-review |
| `requireAdminForApi()` | `src/lib/engine-v2/admin_guards.ts` | `.eq('role','admin')` (single) | engine-v2, agentic-os |
| `requireMatrixMapAdmin()` | inline (duplicated) in `matrix-map/admin/publish/route.ts` + `matrix-map/export/route.ts` | `.in('role', ['admin','matrix_admin'])` | matrix-map writes |
| `getAuthAndRateLimit(request, tier)` | `src/app/api/_helpers/rate-limit-wrapper.ts` | NO role check -- auth + rate-limit bucket only; role enforced in the called server action | announcements, discussions, milestones |
| inline `.eq('role','admin')` | per-route | single | documents mutations |
| `getAuthenticatedUser()` only | per-route | none (any authed user) | discussions, hitl-packets, review, polls |

Note: `requireAdmin()` and `requireAdminForApi()` are two independently-maintained
implementations of the IDENTICAL single-`admin` check. Functionally equivalent today;
a future admin-tier change would have to be edited in both. Consolidation is a
possible future cleanup but is OUT OF SCOPE here (shared-helper change; would touch
many routes).

---

## 2. Full route -> guard -> tier table

Tier legend: `admin` = admin only; `admin|matrix_admin` = either; `authed` = any
logged-in user; `owner` = resource-owner check; `public` = no auth; `n/a` = stub/deprecated.

### agentic-os (guard: `requireAdminForApi()`, tier: admin)

| Route | Methods | Tier |
|---|---|---|
| `/api/agentic-os/launch` | POST | admin |
| `/api/agentic-os/pty-token` | POST | admin |
| `/api/agentic-os/stream/[runId]` | GET | admin |

### engine-v2 (guard: `requireAdminForApi()`, tier: admin)

| Route | Methods | Tier |
|---|---|---|
| `/api/engine-v2/projects` | POST | admin |
| `/api/engine-v2/projects/propose-policies` | POST | admin |
| `/api/engine-v2/projects/[id]/evaluate` | POST | admin |
| `/api/engine-v2/projects/[id]/evaluation-status` | POST | admin |
| `/api/engine-v2/projects/[id]/evaluation/[evalId]/export` | POST | admin |
| `/api/engine-v2/projects/[id]/evaluation/[evalId]/memo` | GET, POST | admin |
| `/api/engine-v2/projects/[id]/extract` | POST | admin |
| `/api/engine-v2/projects/[id]/extract-status` | POST | admin |
| `/api/engine-v2/evaluations/[evalId]/chat` | POST | admin |
| `/api/engine-v2/evaluations/[evalId]/chat/models` | GET | admin |
| `/api/engine-v2/evaluations/[evalId]/indexing-status` | GET | admin |
| `/api/engine-v2/evaluations/[evalId]/reindex` | POST | admin |
| `/api/engine-v2/evaluations/[evalId]/submission/search` | GET | admin |
| `/api/engine-v2/evaluations/[evalId]/submission/chunk/[evidenceItemId]` | GET | admin |
| `/api/engine-v2/files/[id]` | DELETE | admin |
| `/api/engine-v2/files/complete` | POST | admin |
| `/api/engine-v2/files/exists` | GET | admin |
| `/api/engine-v2/files/orphan` | POST | admin |
| `/api/engine-v2/per-policy/[id]/judgment` | POST | admin |
| `/api/engine-v2/policies/search` | GET | admin |

### regulatory-review (guard: `requireAdmin()` +/- `requireLocalEngine()`, tier: admin)

| Route | Methods | Tier |
|---|---|---|
| `/api/regulatory-review/assessments` | GET | admin |
| `/api/regulatory-review/assessments/[csapId]` | GET, PATCH | admin |
| `/api/regulatory-review/assistant/chat` | POST | admin (+ local-engine env gate) |
| `/api/regulatory-review/assistant/models` | GET | admin (+ local-engine env gate) |
| `/api/regulatory-review/judgments` | POST | admin |
| `/api/regulatory-review/matching-detail` | GET, POST | admin |
| `/api/regulatory-review/progress` | GET | admin |
| `/api/regulatory-review/projects` | GET, POST | admin (+ local-engine env gate) |
| `/api/regulatory-review/projects/[id]` | GET, PATCH, DELETE | admin (+ local-engine env gate) |
| `/api/regulatory-review/projects/[id]/evaluate` | POST | admin (+ local-engine env gate) |
| `/api/regulatory-review/projects/[id]/evaluate-status` | GET | admin (+ local-engine env gate) |
| `/api/regulatory-review/projects/[id]/extract` | POST | admin (+ local-engine env gate) |
| `/api/regulatory-review/projects/[id]/extract-status` | GET | admin (+ local-engine env gate) |
| `/api/regulatory-review/projects/[id]/files` | GET, POST | admin (+ local-engine env gate) |
| `/api/regulatory-review/projects/[id]/files/[fileId]` | DELETE | admin (+ local-engine env gate) |
| `/api/regulatory-review/run-engine` | POST | n/a (deprecated stub; returns 501) |
| `/api/regulatory-review/search` | GET | admin |
| `/api/regulatory-review/submission-search` | GET | admin |
| `/api/regulatory-review/submissions` | GET | admin |
| `/api/regulatory-review/validation-stats` | GET | admin |

`requireLocalEngine()` gates on the `LOCAL_ENGINE_ENABLED` env var; it is an
environment/capability gate, NOT a role tier.

### matrix-map

| Route | Methods | Guard | Tier |
|---|---|---|---|
| `/api/matrix-map/admin/publish` | POST | `requireMatrixMapAdmin()` | admin\|matrix_admin (EXCLUDED from edits -- other branch) |
| `/api/matrix-map/export` | POST | `requireMatrixMapAdmin()` | admin\|matrix_admin |
| `/api/matrix-map/samples` | GET | inline `auth.getUser()` only | authed (RPC is the real access-control authority; documented in-file) |

### matrix-options

| Route | Methods | Guard | Tier |
|---|---|---|---|
| `/api/matrix-options/ssd/chemicals` | GET | none | public (external Ecotox mirror proxy) |
| `/api/matrix-options/ssd/records` | GET, POST | none | public (external Ecotox mirror proxy) |

### site content / admin-adjacent

| Route | Methods | Guard | Tier |
|---|---|---|---|
| `/api/announcements` | GET | inline `auth.getUser()` only | authed |
| `/api/announcements` | POST, PUT, DELETE | `getAuthAndRateLimit('admin')` + role check in action | admin |
| `/api/tags` | POST, PUT, DELETE | inline rate-limit + role check in action | admin |
| `/api/milestones` | GET | `getAuthAndRateLimit('default')` (T38 -- this branch) | authed |
| `/api/milestones` | POST, PUT, DELETE | `getAuthAndRateLimit('admin')` + role check in action | admin |
| `/api/documents/[id]` | GET | none (hardcoded stub JSON) | public/stub |
| `/api/documents/[id]` | PUT, DELETE | inline `.eq('role','admin')` | admin |

### other authed / owner / public

| Route | Methods | Guard | Tier |
|---|---|---|---|
| `/api/discussions` | GET, POST | `getAuthAndRateLimit('discussion')` | authed |
| `/api/discussions/[id]` | GET | `getAuthenticatedUser()` | authed |
| `/api/discussions/[id]` | PUT, DELETE | auth + ownership | owner |
| `/api/discussions/[id]/replies` | GET, POST | `getAuthenticatedUser()` | authed |
| `/api/hitl-packets` | GET | auth + `user_roles` role in (admin, matrix_admin) | admin\|matrix_admin |
| `/api/hitl-packets/[sessionId]` | GET | auth + `user_roles` role in (admin, matrix_admin) | admin\|matrix_admin |
| `/api/hitl-packets/[sessionId]/csv` | GET | auth + `user_roles` role in (admin, matrix_admin) | admin\|matrix_admin |
| `/api/hitl-packets/[sessionId]/md` | GET | auth + `user_roles` role in (admin, matrix_admin) | admin\|matrix_admin |
| `/api/review/save` | POST | `getAuthenticatedUser()` | authed |
| `/api/review/submit` | POST | `getAuthenticatedUser()` | authed |
| `/api/review/upload` | POST | auth + ownership | owner |
| `/api/polls/results` | GET | optional auth | public/anon |
| `/api/polls/submit` | POST | conditional (CEW anon / authed) | authed or anon |
| `/api/ranking-polls/results` | GET | conditional | authed or anon |
| `/api/ranking-polls/submit` | POST | conditional | authed or anon |
| `/api/wordcloud-polls/results` | GET | optional auth | public/anon |
| `/api/wordcloud-polls/submit` | POST | conditional | authed or anon |
| `/api/bn-rrm/wfs-identify` | GET | none | public (BC gov open-data proxy) |
| `/api/bn-rrm/wms-identify` | GET | none | public (BC gov open-data proxy) |
| `/api/graphs/prioritization-matrix` | GET | anonymous client (EXCLUDED -- other branch) | public/aggregate |
| `/api/auth/callback` | GET | none | public (OAuth/magic-link exchange; by design) |

---

## 3. Clear tier mismatches FIXED in this pass

NONE.

After auditing all 72 routes, there is NO route that uses the wrong admin/matrix_admin
tier. Specifically:

- No admin-only lane (regulatory-review / engine-v2 / agentic-os / site-content)
  incorrectly accepts `matrix_admin`.
- No matrix-map write route incorrectly restricts to `admin` only (both use the
  broad `admin|matrix_admin` set, consistent with each other).

The `requireAdmin` (single) vs `requireMatrixMapAdmin` (dual) difference is the
intended two-tier model (section 1), not a mismatch. Therefore no per-route tier fix
and NO change to the shared `requireAdmin` helper was warranted. The T38 change (adding
an auth gate to `milestones` GET) is the only code change on this branch; it is an
auth-tier hardening (authed-user gate), not a role-tier change, and is consistent with
the sibling `announcements` GET (also authed-only).

---

## 4. Ambiguous items FLAGGED for orchestrator / owner (NOT changed)

These are potential under-protection or inconsistency findings surfaced by the audit.
They are NOT admin-vs-matrix_admin tier mismatches, and fixing them would change route
SEMANTICS (potentially breaking a consuming UI), so per the T39 mandate they are
flagged, not changed.

1. **RESOLVED (2026-07-13, commit `14cf048`): `/api/hitl-packets/*` (4 routes) now
   admin/matrix_admin role-gated.** Previously authed-only. All 4 routes now check
   `user_roles.role in ('admin','matrix_admin')` and fail closed (`roleError || !role`
   -> 403); see `src/app/api/hitl-packets/route.ts` and the 3 `[sessionId]` sub-routes.
   Role-gate test coverage: top-level route in `hitl-packets/__tests__/route.test.ts`;
   the 3 sub-routes covered by `test/hitl-subroutes-and-sodium-2026-07-14` (merged
   2026-07-14). No further action; retained here as an audit-trail record only.

2. **`/api/announcements` GET is authed-only while POST/PUT/DELETE are admin.**
   This asymmetry is most likely intentional (all authenticated dashboard users should
   read announcements; only admins mutate them) -- it matches the milestones model from
   T38. Flagged only for explicit confirmation; no change recommended.

3. **`/api/documents/[id]` GET returns a hardcoded stub** ("API route working") and does
   not query Supabase at all, while PUT/DELETE on the same resource are admin-gated.
   Looks like leftover scaffold rather than an intentional public read. DECISION NEEDED:
   is GET meant to actually fetch+return a document (and if so, under what tier)? Not a
   tier bug today because it returns no real data.

4. **`/api/matrix-options/ssd/chemicals` and `/ssd/records` are fully public** (no auth,
   no rate limit) and proxy an external Ecotox data mirror. If that mirror is a
   licensed/rate-limited data source, an authed gate and/or rate limit may be warranted.
   Compare `/api/bn-rrm/*`, also public proxies but to BC gov open data. DECISION NEEDED:
   is unauthenticated access to the Ecotox proxy acceptable?

5. **`requireAdmin()` vs `requireAdminForApi()` are duplicated single-`admin` checks**
   (`src/lib/api-guards.ts` vs `src/lib/engine-v2/admin_guards.ts`). Functionally
   equivalent; a future admin-tier change must be applied in both. Consolidation is a
   possible future refactor but is a broad shared-helper change -- deliberately NOT done
   here.

6. **Three slightly different rate-limit + role-check patterns for the same intent**
   across `tags` (inline `checkRateLimit` + role in action), `announcements` (mixed
   `getAuthenticatedUser` for GET + `getAuthAndRateLimit` for writes), and `milestones`
   (`getAuthAndRateLimit` throughout). All three ultimately enforce `admin` on writes;
   the divergence is stylistic, not a tier bug. Candidate for a future consistency
   cleanup.

---

## 5. Verification note

- Discussions PUT/DELETE and review/upload enforce OWNERSHIP (`user_id === user.id`),
  not a role -- correct for user-owned resources.
- `/api/auth/callback` public is correct (it is the OAuth/magic-link code exchange).
- Poll submit/results conditional CEW-anonymous vs authed paths are an existing,
  intentional design (CEW engagement events allow anonymous auth-code submissions).

End of audit.

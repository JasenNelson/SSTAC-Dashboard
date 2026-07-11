# DRA PUBLICATION PATH DESIGN

DESIGN packet (NOT a build) for an audited DRA-publication path; building is OWNER-GATED and requires a strategic /codex-review + owner approval before any code.

## THE RPC
The exact `flip_dra_public(p_dra_id uuid, p_new_value boolean, p_actor_id uuid, p_reason text)` signature, SECDEF, owner matrix_map_owner, EXECUTE-to-authenticated-only, and its internal checks:
- actor==caller (actor_id must match caller jwt sub)
- admin/matrix_admin role required
- non-empty reason required
- atomic UPDATE+audit
- no-op on unchanged

## PROPOSED FLOW
- New admin/matrix-map/publish page + POST `/api/matrix-map/admin/publish` route.
- Reusing `requireMatrixMapAdmin` + `checkCsrf` (from export/route.ts) -- NOT the generic `requireAdmin()` (which only recognizes 'admin').
- Critical wiring: call the RPC on the user's OWN authenticated client (the RPC rejects a NULL JWT sub), never service-role.

## ORCHESTRATOR v1-SCOPE RECOMMENDATION
Single-DRA publish/unpublish ONLY (NO bulk-publish-all in v1, given the mass-publish blast radius -- one flip cascades RLS across all of a DRA's samples/events/measurements). A confirm step per DRA. Reversible unpublish, also audited.

## SECURITY RISK REGISTER
- **R1 - Mass-publish blast radius:** Single flip cascades visibility. No bulk-publish-all in v1.
- **R2 - RPC-vs-direct-UPDATE gap:** The `dras_admin_all` RLS policy still permits a direct `UPDATE dras SET public=true` that bypasses flip_dra_public and leaves ZERO audit trail.
- **R3 - Privilege escalation via role-check duplication:** Drift between route's check and RPC's check.
- **R4 - Audit completeness for FAILED attempts:** Failed attempts raise before audit insert.
- **R5 - CSRF + session fixation:** Reuse checkCsrf strictly.
- **R6 - RLS interaction:** Stale visibility caches UX note.
- **R7 - Over-exposure of member data:** Publishing exposes to all ~55 members, not a subset.
- **R8 - matrix_admin role:** Currently has 0 rows; requires manual step for TWG delegates.

**OWNER DECISION on the RLS-bypass gap (R2):**
Frame the owner choice: (a) tighten now (a follow-up migration to constrain the direct-UPDATE path or add a trigger-based audit so every visibility flip is audited regardless of path), vs (b) accept the documented gap for v1. Recommend (a) tighten, because the whole point of the flow is an auditable publication trail.

## STRATEGIC-CODEX REVIEW POINTS
The design must pass before build: privilege escalation, mass-publish blast radius, audit completeness incl. the RLS-bypass gap, RLS interaction, member-data over-exposure.

## WHAT IS BLOCKED
Until owner approves the build, the map stays empty for the ~55 members; only 3 'admin' rows can use any of it until a `matrix_admin` `user_roles` row is inserted.

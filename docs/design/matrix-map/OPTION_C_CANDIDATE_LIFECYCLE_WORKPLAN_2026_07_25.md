# Option C Candidate Lifecycle Workplan

## 1. Overview
Technical design for the creation and refresh of Matrix Map site aggregate candidates within Option C Phase 2, resolving previous strategic reviews.

## 2. Core RPC: `matrix_map.upsert_site_aggregate_candidate`
`SECURITY DEFINER` RPC to safely provision a new candidate or refresh an unpublished one.

**Execution Flow:**
1. Enforce `read committed` transaction isolation.
2. Authorize `p_actor_id`, admin roles, and JWT email.
3. Lock candidate row: If the row exists for `(source_dra_id, coordinate_cluster_id)`, `SELECT FOR UPDATE`.
4. Validate: If row exists and `is_published = true`, raise `UE409`.
5. Lock sources: call `matrix_map.lock_site_aggregate_publication_sources()` in SHARE MODE.
6. Snapshot: fetch current site aggregate via `matrix_map.current_site_aggregate_snapshot(...)`. Fail if empty or < 1 medium-tier sample.
7. Persist:
   - Set `matrix_map.audited_site_aggregate_candidate = '1'`.
   - `INSERT ... ON CONFLICT DO UPDATE`.
   - Insert into `matrix_map.site_aggregate_candidate_audit` ('create' or 'refresh', with prior and new snapshots).
   - Clear the config variable.

## 3. Database Modifications (Draft SQL)
- Add `matrix_map.site_aggregate_candidate_audit` table (fields: id, publication_id, source_dra_id, coordinate_cluster_id, action, prior_snapshot, new_snapshot, reason, changed_by, changed_by_email, changed_at) + RLS/policies.
- Grant `INSERT` on `site_aggregate_publications` to `matrix_map_owner`.
- Modify `matrix_map.enforce_site_aggregate_publication_via_rpc` to explicitly reject changes to publication columns if `matrix_map.audited_site_aggregate_candidate = '1'`.
- Add `upsert_site_aggregate_candidate` and `fetch_site_aggregate_candidate_audit`.

## 4. API Layer
- **Candidate Route:** `src/app/api/matrix-map/admin/site-aggregates/candidate/route.ts` (POST).
  - CSRF check, invokes RPC.
  - **Readback verification**: Immediately calls `fetch_admin_site_aggregate_publications` post-RPC to verify persistence and return it to the client.
- **Audit Route:** Incorporate candidate audit history.

## 5. UI Layer
- Server Component (`page.tsx`) remains read-only to satisfy contract tests. It merges live aggregates with candidates for display.
- Client Component manages the interactive modal and API fetches for Create/Refresh actions. Displays drift indicators if the live hash doesn't match the candidate hash.

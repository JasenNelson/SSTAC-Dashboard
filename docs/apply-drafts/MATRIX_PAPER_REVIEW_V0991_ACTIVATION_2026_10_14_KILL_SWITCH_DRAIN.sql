-- =====================================================================
-- KILL SWITCH DRAIN CHECK for MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14_KILL_SWITCH.sql
-- DRAFT -- NOT RUN. READ-ONLY (SELECT only). Run AFTER the kill switch commits.
-- The kill switch revokes EXECUTE, but a write RPC that already passed its EXECUTE check
-- (for example one queued on the per-user advisory lock) is not cancelled and can still
-- commit. Row 0 must be ok=true (current_user can see all backends and locks); a false
-- row 0 = STOP, the drain cannot be certified. Procedure (see NOTES section 4): run this
-- every 5 s for up to 60 s until rows 1 and 2 are 0; then record rows 3/4 twice, 10 s apart; equal = writes stopped.
-- If row 1 or 2 is still > 0 at 60 s: report and STOP (pg_cancel_backend, if any, is a
-- separately approved owner decision). Reads no user text, only counts and ids.
-- =====================================================================
-- Advisory-lock scope: both RPCs take pg_advisory_xact_lock(hashtext('matrix_paper_review_write'),
-- hashtext(<user id>)), the two-int4 form: pg_locks.classid = first key (as unsigned oid),
-- objid = second key (per-user, so not statically matchable), objsubid = 2. Rows below match
-- classid + objsubid = 2 (every user), so unrelated advisory locks are ignored.
-- Query text match is case-insensitive and tolerant of PostgREST's quoted, schema-qualified
-- call shape ("public"."matrix_paper_review_save_draft"(...)).
SELECT * FROM (
  SELECT 0 AS ord, 'visibility: current_user is superuser or member of pg_read_all_stats (false = STOP, cannot certify)' AS check_name, 'true' AS expected,
         (coalesce((SELECT r.rolsuper FROM pg_roles r WHERE r.rolname = current_user), false)
          OR pg_has_role(current_user, 'pg_read_all_stats', 'member'))::text AS actual,
         (coalesce((SELECT r.rolsuper FROM pg_roles r WHERE r.rolname = current_user), false)
          OR pg_has_role(current_user, 'pg_read_all_stats', 'member')) AS ok
  UNION ALL
  SELECT 1, 'a: non-idle backends (not this one) running a review write RPC', '0',
         (SELECT count(*) FROM pg_stat_activity a
           WHERE a.pid <> pg_backend_pid() AND a.state <> 'idle'
             AND (a.query ~* 'matrix_paper_review_save_draft' OR a.query ~* 'matrix_paper_review_submit'))::text,
         (SELECT count(*) FROM pg_stat_activity a
           WHERE a.pid <> pg_backend_pid() AND a.state <> 'idle'
             AND (a.query ~* 'matrix_paper_review_save_draft' OR a.query ~* 'matrix_paper_review_submit')) = 0
  UNION ALL
  SELECT 2, 'a: backends waiting (not granted) on the review RPCs advisory lock key (classid = hashtext(prefix), objsubid = 2)', '0',
         (SELECT count(*) FROM pg_locks l
           WHERE l.locktype = 'advisory' AND NOT l.granted AND l.objsubid = 2
             AND l.classid::bigint = (hashtext('matrix_paper_review_write')::bigint & 4294967295))::text,
         (SELECT count(*) FROM pg_locks l
           WHERE l.locktype = 'advisory' AND NOT l.granted AND l.objsubid = 2
             AND l.classid::bigint = (hashtext('matrix_paper_review_write')::bigint & 4294967295)) = 0
  UNION ALL
  SELECT 3, 'b: info: max(id) of matrix_paper_review_response_events (record twice, 10 s apart; must be equal)', 'n/a',
         coalesce((SELECT max(e.id) FROM public.matrix_paper_review_response_events e)::text, '<none>'), true
  UNION ALL
  SELECT 4, 'b: info: count of matrix_paper_review_response_events (record twice, 10 s apart; must be equal)', 'n/a',
         (SELECT count(*) FROM public.matrix_paper_review_response_events)::text, true
) r
ORDER BY ord, check_name;

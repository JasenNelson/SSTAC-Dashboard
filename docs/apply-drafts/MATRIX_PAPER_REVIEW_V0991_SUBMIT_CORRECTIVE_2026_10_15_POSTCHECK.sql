-- =====================================================================
-- POSTCHECK (read-only) after MATRIX_PAPER_REVIEW_V0991_SUBMIT_CORRECTIVE_2026_10_15.sql
-- (corrective file sha256 584bf5122056a74f5f3068bb252143fc1e7794ba548a1aa1f88d554050b8646a)
-- =====================================================================
-- SELECT-only; returns counts and hashes, never user text. Run after the
-- corrective COMMIT and after the activation VERIFY (expected 131/131).
-- Every ok must be true.
-- Row 1: the live submit body is the approved bytes.
-- Row 2 (two rows): this session can see other backends' queries: it holds
--   the privileges of pg_read_all_stats (superuser, or pg_has_role USAGE),
--   and no other non-idle backend shows '<insufficient privilege>'. Any
--   false = row 3 cannot be certified, STOP.
-- Row 3 (two rows): no other backend is still executing a submit call (any
--   such call may still be running the pre-correction body): no non-idle
--   backend's query names it, AND no backend holds or waits for the review
--   RPCs' per-user advisory lock key (both RPCs take it first and keep it
--   until COMMIT, so a call already in COMMIT, whose query text is just
--   COMMIT, is still seen; save_draft calls also count, conservatively).
--   Re-run every 5 s up to 60 s until both are 0; still > 0 at 60 s: report
--   and STOP.
-- Row 4: the approved blank pattern, rebuilt server-side with chr(92), has
--   the sha256 of the activation file's pattern (proves this file's pattern).
-- Row 5: no submitted response is blank under the approved pattern, i.e. no
--   blank submission (including one made of U+001C..U+001F or U+0085) was
--   accepted by the pre-correction body. Row 5 is certified ONLY from a run
--   that STARTS after a completed run in which both row-3 checks were 0 (one
--   statement snapshots the table before it reads pg_stat_activity).
--   > 0: report and STOP (owner decides; nothing is changed automatically).
-- This file contains no backslash.
-- =====================================================================
WITH pat AS (
  SELECT ('^[[:space:]' || pg_catalog.chr(92) || 'u00a0' || pg_catalog.chr(92) || 'u1680' || pg_catalog.chr(92) || 'u2000-' || pg_catalog.chr(92) || 'u200a' || pg_catalog.chr(92) || 'u2028' || pg_catalog.chr(92) || 'u2029' || pg_catalog.chr(92) || 'u202f' || pg_catalog.chr(92) || 'u205f' || pg_catalog.chr(92) || 'u3000' || pg_catalog.chr(92) || 'ufeff]*$') AS p
)
SELECT * FROM (
  SELECT 1 AS ord, 'submit prosrc sha256 = approved activation bytes' AS check_name, 'c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad' AS expected,
         coalesce((SELECT pg_catalog.string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
            FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_submit'), 'missing') AS actual,
         coalesce((SELECT pg_catalog.string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
            FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_submit'), 'missing') = 'c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad' AS ok
  UNION ALL
  SELECT 2, 'visibility: current_user can read other backends (superuser or pg_read_all_stats)', 'true',
         coalesce((SELECT r.rolsuper OR pg_catalog.pg_has_role(current_user, 'pg_read_all_stats', 'USAGE')
            FROM pg_catalog.pg_roles r WHERE r.rolname = current_user)::text, 'missing'), coalesce((SELECT r.rolsuper OR pg_catalog.pg_has_role(current_user, 'pg_read_all_stats', 'USAGE')
            FROM pg_catalog.pg_roles r WHERE r.rolname = current_user), false)
  UNION ALL
  SELECT 2, 'visibility proof: other non-idle backends whose query text is hidden from this session', '0',
         (SELECT pg_catalog.count(*) FROM pg_catalog.pg_stat_activity a
           WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.state IS DISTINCT FROM 'idle'
             AND a.query = '<insufficient privilege>')::text, (SELECT pg_catalog.count(*) FROM pg_catalog.pg_stat_activity a
           WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.state IS DISTINCT FROM 'idle'
             AND a.query = '<insufficient privilege>') = 0
  UNION ALL
  SELECT 3, 'no other non-idle backend is executing matrix_paper_review_submit', '0',
         (SELECT pg_catalog.count(*) FROM pg_catalog.pg_stat_activity a
           WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.state IS DISTINCT FROM 'idle'
             AND a.query ~* 'matrix_paper_review_submit')::text, (SELECT pg_catalog.count(*) FROM pg_catalog.pg_stat_activity a
           WHERE a.pid <> pg_catalog.pg_backend_pid() AND a.state IS DISTINCT FROM 'idle'
             AND a.query ~* 'matrix_paper_review_submit') = 0
  UNION ALL
  SELECT 3, 'no backend holds or waits for the review RPCs advisory lock key (classid = hashtext(prefix), objsubid = 2)', '0',
         (SELECT pg_catalog.count(*) FROM pg_catalog.pg_locks l
           WHERE l.locktype = 'advisory' AND l.objsubid = 2 AND l.pid IS DISTINCT FROM pg_catalog.pg_backend_pid()
             AND l.classid::bigint = (pg_catalog.hashtext('matrix_paper_review_write')::bigint & 4294967295))::text, (SELECT pg_catalog.count(*) FROM pg_catalog.pg_locks l
           WHERE l.locktype = 'advisory' AND l.objsubid = 2 AND l.pid IS DISTINCT FROM pg_catalog.pg_backend_pid()
             AND l.classid::bigint = (pg_catalog.hashtext('matrix_paper_review_write')::bigint & 4294967295)) = 0
  UNION ALL
  SELECT 4, 'approved blank pattern rebuilt server-side matches the activation file', 'ad7d3e153c103530546c34282f4c3ffc0ea9d4e92e6092e0488b59e033757c32',
         (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p, 'UTF8')), 'hex') FROM pat),
         (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p, 'UTF8')), 'hex') FROM pat) = 'ad7d3e153c103530546c34282f4c3ffc0ea9d4e92e6092e0488b59e033757c32'
  UNION ALL
  SELECT 5, 'submitted responses that are blank under the approved pattern (count only)', '0',
         (SELECT pg_catalog.count(*) FROM public.matrix_paper_review_responses r, pat
           WHERE r.submitted_text IS NOT NULL AND r.submitted_text ~ pat.p)::text, (SELECT pg_catalog.count(*) FROM public.matrix_paper_review_responses r, pat
           WHERE r.submitted_text IS NOT NULL AND r.submitted_text ~ pat.p) = 0
  UNION ALL
  SELECT 6, 'info: response / event rows, all releases (aggregate only)', 'n/a',
         (SELECT pg_catalog.count(*) FROM public.matrix_paper_review_responses)::text || ' / ' ||
         (SELECT pg_catalog.count(*) FROM public.matrix_paper_review_response_events)::text, true
) r
ORDER BY ord;

-- =============================================================================
-- DRAFT -- NOT APPLIED. Owner must review + apply via the audited path with a
-- separate exact-operation approval. This file executes NOTHING by itself.
-- =============================================================================
--
-- Row #18 copper oral RfD -- Stage 1 Ruling 9 (STAGE1_DECISION_LOG_2026_07_15.md, row 9 / base #18):
--   "PROMOTE HC 0.426 to current_default for copper + dispose/reject the P28 0.09 /
--   P28-water 0.141 rows + the unsupportable 0.04 needs_review starter."
--   Exact write authorized (packet section 9): "PRODUCTION-WRITE: promote pv-hc-copper-* to
--   current_default (0.426) + dispose/reject P28 0.09/0.141 + the needs_review 0.04 starter.
--   SEPARATE exact-operation approval required."
--
-- TEMPLATE SOURCE (as instructed): mirrors the T32 waterbody_type id-keyed fail-closed DO block
-- in docs/MATRIX_OPTIONS_T32_WATERBODY_OWNER_PACKET_2026_07_12.md ("OPERATION AS APPLIED
-- 2026-07-13" section) -- id-keyed target arrays, GET DIAGNOSTICS row-count assertion against
-- the approved scope, a full postcondition assertion, RAISE EXCEPTION abort-with-no-change on
-- any mismatch, and a companion rollback block. Structure mirrored exactly; see MECHANISM NOTE
-- below for why this SQL cannot be run as-is against Supabase.
--
-- =============================================================================
-- MECHANISM NOTE (surfaced, not silently corrected -- same discipline as the T32 doc's own
-- "FLAG (doc arithmetic inconsistency)" section)
-- =============================================================================
-- T32 mutated a LIVE Supabase table (matrix_map.samples, UUID-keyed). The copper catalog rows
-- targeted by this ruling do NOT live in a Supabase table. They live in two version-controlled
-- JSON files read directly by the app / provenance layer:
--   matrix_research/reference_catalog/human_health_trv_values.json   (pv-hc-copper-*, pv-p28-copper-*)
--   matrix_research/reference_catalog/parameter_values.json          (pv-copper-hh-direct/food-rfd, the
--                                                                      generic "scaffold" rows)
-- (Confirmed: no `parameter_value_id`-keyed production table exists. The only Supabase tables in
-- this area are `promoted_parameter_values` (localStorage migration target, currently unused) and
-- `catalog_extraction_staging` (AI-proposal HITL queue) -- neither mirrors this catalog live.)
--
-- The codebase's ACTUAL apply mechanism for this class of operation is an owner-run Node script
-- that mutates the JSON files in place with the same fail-closed discipline (id-keyed allowlist,
-- exact pre-state identity check, idempotent, --apply required to write), e.g.
-- scripts/matrix-options/promote-hc-trv-v4-2025.mjs. The correct real apply artifact is a NEW
-- script in that family (suggested name: scripts/matrix-options/promote-copper-hc0426.mjs),
-- NOT a psql/Supabase-MCP execute_sql call.
--
-- This .sql file is therefore a STRUCTURAL / DECISION-SUPPORT MIRROR of the requested fail-closed
-- template, written against a CONCEPTUAL table (matrix_options.catalog_parameter_values) so the
-- owner can review the exact id-keyed scope, pre-state, and post-state before a real Node-script
-- apply artifact is authored and gated through codex review. Do not execute this SQL against
-- Supabase -- there is no such table.
--
-- =============================================================================
-- VERIFIED CURRENT STATE (read from the live worktree copy of the two JSON files, 2026-07-15;
-- this SUPERSEDES a stale claim in the packet -- see CORRECTION note below)
-- =============================================================================
--
-- human_health_trv_values.json:
--   pv-hc-copper-hh-direct-rfd-tdi              value=0.426  default_status=current_default  qa_status=approved
--   pv-hc-copper-hh-food-rfd-tdi                value=0.426  default_status=current_default  qa_status=approved
--   pv-p28-copper-hh-direct-rfd                 value=0.09   default_status=available_option  qa_status=needs_review
--   pv-p28-copper-hh-food-rfd                   value=0.09   default_status=available_option  qa_status=needs_review
--   pv-p28-copper-hh-direct-rfd-copper-rfd-water value=0.141 default_status=available_option  qa_status=needs_review
--   pv-p28-copper-hh-food-rfd-copper-rfd-water   value=0.141 default_status=available_option  qa_status=needs_review
--
-- parameter_values.json:
--   pv-copper-hh-direct-rfd   value=0.426  default_status=available_option  qa_status=needs_review  (evidence_support_status=current_calculator_scaffold, source_ids=[src-current-calculator-design-v1])
--   pv-copper-hh-food-rfd     value=0.426  default_status=available_option  qa_status=needs_review  (same)
--
-- CORRECTION (surfaced, not silently resolved):
-- 1) The HC promote half of Ruling 9 APPEARS ALREADY DONE. Commit 27a5d72
--    "feat(matrix-options): wire benzo_a_pyrene oral RfD (HC 0.0003) + move copper current_default
--    to HC" (2026-07-13 18:54, owner-approved batch 2026-07-13d) already flipped
--    pv-hc-copper-hh-direct/food-rfd-tdi to current_default AND demoted the generic scaffold rows
--    (pv-copper-hh-direct/food-rfd) to available_option. The packet's "Current state" line
--    ("HC 0.426 row is only available_option ... the library presently WIRES 0.04") is STALE --
--    it describes the pre-commit-27a5d72 state, not the current worktree. Section A below is
--    therefore an IDEMPOTENT CONFIRM (no-op expected), not a live promotion.
-- 2) The "unsupportable 0.04 starter" is, in the current file, value 0.426 (NOT 0.04) --
--    commit 27a5d72's diff shows the value was already 0.426 before that commit too. The scaffold
--    rows (pv-copper-hh-direct-rfd / pv-copper-hh-food-rfd, source src-current-calculator-design-v1)
--    are still qa_status=needs_review and are what remains to dispose; treat the "0.04" figure in
--    the ruling text as referring to these scaffold rows by role, not by a literal current value.
-- 3) qa_status ENUM CORRECTION: the packet's exact-write text says "qa_status needs_review ->
--    rejected" (also used verbatim for the row #17 IRIS disposition). `'rejected'` is NOT a valid
--    CatalogQaStatus (src/lib/matrix-options/provenance/types.ts:54-57 defines exactly
--    'needs_review' | 'approved' | 'superseded'). The functionally-correct disposal value is
--    'superseded' -- confirmed at src/lib/matrix-options/frameDefaults.ts:731-739
--    ("cited record is superseded; does not seed"). This draft uses 'superseded' throughout.
--
-- REMAINING WORK under this ruling (what the DO block below actually needs to change):
--   dispose (qa_status needs_review -> superseded), default_status UNCHANGED (already
--   available_option, never current_default, so no calculator-facing default risk):
--     pv-p28-copper-hh-direct-rfd, pv-p28-copper-hh-food-rfd,
--     pv-p28-copper-hh-direct-rfd-copper-rfd-water, pv-p28-copper-hh-food-rfd-copper-rfd-water,
--     pv-copper-hh-direct-rfd, pv-copper-hh-food-rfd
--   confirm (assert already at target; promote only if somehow drifted back):
--     pv-hc-copper-hh-direct-rfd-tdi, pv-hc-copper-hh-food-rfd-tdi
--
-- =============================================================================
-- PREFLIGHT (read-only verification -- run and review BEFORE any apply)
-- =============================================================================
-- Conceptual preflight (see MECHANISM NOTE); the real preflight is:
--   node -e "const d=require('./matrix_research/reference_catalog/human_health_trv_values.json');
--     ['pv-hc-copper-hh-direct-rfd-tdi','pv-hc-copper-hh-food-rfd-tdi','pv-p28-copper-hh-direct-rfd',
--      'pv-p28-copper-hh-food-rfd','pv-p28-copper-hh-direct-rfd-copper-rfd-water',
--      'pv-p28-copper-hh-food-rfd-copper-rfd-water'].forEach(id=>{
--        const r=d.find(x=>x.parameter_value_id===id);
--        console.log(id, r.value, r.default_status, r.qa_status);});"
-- and the same pattern against parameter_values.json for pv-copper-hh-direct-rfd / -food-rfd.
--
-- SQL-mirror form (CONCEPTUAL TABLE -- do not run against Supabase):
SELECT parameter_value_id, value, unit, default_status, qa_status
  FROM matrix_options.catalog_parameter_values
 WHERE parameter_value_id IN (
   'pv-hc-copper-hh-direct-rfd-tdi','pv-hc-copper-hh-food-rfd-tdi',
   'pv-p28-copper-hh-direct-rfd','pv-p28-copper-hh-food-rfd',
   'pv-p28-copper-hh-direct-rfd-copper-rfd-water','pv-p28-copper-hh-food-rfd-copper-rfd-water',
   'pv-copper-hh-direct-rfd','pv-copper-hh-food-rfd'
 )
 ORDER BY parameter_value_id;
-- EXPECT (per VERIFIED CURRENT STATE above): 8 rows, values/statuses exactly as listed. If any
-- row is missing or its default_status/qa_status differs from the table above, STOP -- do not
-- proceed to the DO block; the pre-state has drifted and the id-keyed assertions below would
-- either abort (safe) or, worse, silently no-op on the wrong rows.
--
-- =============================================================================
-- OPERATION (fail-closed, id-keyed, mirrors the T32 DO-block structure exactly)
-- =============================================================================
DO $$
DECLARE
  n_hc_confirmed int;
  n_p28_disposed int;
  n_scaffold_disposed int;
  final_hc_current_default int;
  final_p28_superseded int;
  final_scaffold_superseded int;
  hc_ids text[] := ARRAY[
    'pv-hc-copper-hh-direct-rfd-tdi',
    'pv-hc-copper-hh-food-rfd-tdi'
  ];
  p28_ids text[] := ARRAY[
    'pv-p28-copper-hh-direct-rfd',
    'pv-p28-copper-hh-food-rfd',
    'pv-p28-copper-hh-direct-rfd-copper-rfd-water',
    'pv-p28-copper-hh-food-rfd-copper-rfd-water'
  ];
  scaffold_ids text[] := ARRAY[
    'pv-copper-hh-direct-rfd',
    'pv-copper-hh-food-rfd'
  ];
BEGIN
  SET LOCAL lock_timeout = '3s';  -- fail fast on a busy table instead of queueing app writes
  LOCK TABLE matrix_options.catalog_parameter_values IN SHARE ROW EXCLUSIVE MODE;

  -- STEP 1: PROMOTE (idempotent confirm) -- pv-hc-copper-* current_default. Expected 0 rows changed
  -- (already current_default per commit 27a5d72); the WHERE clause only touches rows that are NOT
  -- already at target, so a re-run after a real promotion is a safe no-op.
  UPDATE matrix_options.catalog_parameter_values
     SET default_status = 'current_default', updated_at = now()
   WHERE parameter_value_id = ANY(hc_ids)
     AND default_status <> 'current_default';
  GET DIAGNOSTICS n_hc_confirmed = ROW_COUNT;
  IF n_hc_confirmed NOT IN (0, 2) THEN
    RAISE EXCEPTION 'COPPER-18 scope: HC rows changed=% (exp 0 [already promoted] or 2 [fresh promote]). Aborted, no change.', n_hc_confirmed;
  END IF;

  -- STEP 2: DISPOSE -- the 4 P28 route-split rows (0.09 / 0.141), qa_status needs_review -> superseded.
  -- default_status is intentionally NOT touched (already available_option, never current_default).
  UPDATE matrix_options.catalog_parameter_values
     SET qa_status = 'superseded', updated_at = now()
   WHERE parameter_value_id = ANY(p28_ids)
     AND qa_status = 'needs_review';
  GET DIAGNOSTICS n_p28_disposed = ROW_COUNT;
  IF n_p28_disposed <> 4 THEN
    RAISE EXCEPTION 'COPPER-18 scope: P28 rows disposed=% (exp 4). Aborted, no change.', n_p28_disposed;
  END IF;

  -- STEP 3: DISPOSE -- the 2 generic "current_calculator_scaffold" rows (the needs_review starter
  -- referenced in the ruling), qa_status needs_review -> superseded. default_status untouched.
  UPDATE matrix_options.catalog_parameter_values
     SET qa_status = 'superseded', updated_at = now()
   WHERE parameter_value_id = ANY(scaffold_ids)
     AND qa_status = 'needs_review';
  GET DIAGNOSTICS n_scaffold_disposed = ROW_COUNT;
  IF n_scaffold_disposed <> 2 THEN
    RAISE EXCEPTION 'COPPER-18 scope: scaffold rows disposed=% (exp 2). Aborted, no change.', n_scaffold_disposed;
  END IF;

  -- POSTCONDITION (full reviewed distribution asserted, not just the touched rows, so a concurrent
  -- change since the read-only preflight cannot pass while the reviewed end-state is no longer true)
  SELECT count(*) FILTER (WHERE parameter_value_id = ANY(hc_ids) AND default_status = 'current_default'),
         count(*) FILTER (WHERE parameter_value_id = ANY(p28_ids) AND qa_status = 'superseded'),
         count(*) FILTER (WHERE parameter_value_id = ANY(scaffold_ids) AND qa_status = 'superseded')
    INTO final_hc_current_default, final_p28_superseded, final_scaffold_superseded
    FROM matrix_options.catalog_parameter_values
   WHERE parameter_value_id = ANY(hc_ids || p28_ids || scaffold_ids);

  IF final_hc_current_default <> 2 OR final_p28_superseded <> 4 OR final_scaffold_superseded <> 2 THEN
    RAISE EXCEPTION 'COPPER-18 postcondition: HC current_default=% (exp 2), P28 superseded=% (exp 4), scaffold superseded=% (exp 2). Aborted, no change.',
      final_hc_current_default, final_p28_superseded, final_scaffold_superseded;
  END IF;

  RAISE NOTICE 'COPPER-18 OK: HC confirmed (2/2 current_default), P28 disposed (4/4 superseded), scaffold disposed (2/2 superseded).';
END $$;

-- =============================================================================
-- ROLLBACK (exact, id-keyed -- reverts precisely the disposed rows; HC rows are left alone since
-- they were already current_default BEFORE this operation ran per the CORRECTION note above)
-- =============================================================================
-- DO $$
-- DECLARE
--   n_p28_restored int; n_scaffold_restored int;
--   p28_ids text[] := ARRAY[
--     'pv-p28-copper-hh-direct-rfd','pv-p28-copper-hh-food-rfd',
--     'pv-p28-copper-hh-direct-rfd-copper-rfd-water','pv-p28-copper-hh-food-rfd-copper-rfd-water'];
--   scaffold_ids text[] := ARRAY['pv-copper-hh-direct-rfd','pv-copper-hh-food-rfd'];
-- BEGIN
--   SET LOCAL lock_timeout = '3s';
--   LOCK TABLE matrix_options.catalog_parameter_values IN SHARE ROW EXCLUSIVE MODE;
--   UPDATE matrix_options.catalog_parameter_values SET qa_status = 'needs_review', updated_at = now()
--     WHERE parameter_value_id = ANY(p28_ids) AND qa_status = 'superseded';
--   GET DIAGNOSTICS n_p28_restored = ROW_COUNT;
--   UPDATE matrix_options.catalog_parameter_values SET qa_status = 'needs_review', updated_at = now()
--     WHERE parameter_value_id = ANY(scaffold_ids) AND qa_status = 'superseded';
--   GET DIAGNOSTICS n_scaffold_restored = ROW_COUNT;
--   IF n_p28_restored <> 4 OR n_scaffold_restored <> 2 THEN
--     RAISE EXCEPTION 'COPPER-18 rollback scope: P28 restored=% (exp 4), scaffold restored=% (exp 2). Aborted, no change.',
--       n_p28_restored, n_scaffold_restored;
--   END IF;
--   RAISE NOTICE 'COPPER-18 ROLLBACK OK: % P28 + % scaffold rows restored to needs_review.', n_p28_restored, n_scaffold_restored;
-- END $$;
--
-- If the operation was actually applied via the real Node-script mechanism (JSON file edit,
-- committed to git), the true rollback is `git revert` of that commit, not a database rollback --
-- there is no live table to roll back. This SQL rollback block is retained only as the structural
-- mirror the T32 template calls for.
--
-- =============================================================================
-- owner --apply required: YES (production-write per Ruling 9; separate exact-operation approval)
-- =============================================================================
-- Before any real apply: (1) resolve the MECHANISM NOTE above -- author
-- scripts/matrix-options/promote-copper-hc0426.mjs mirroring promote-hc-trv-v4-2025.mjs's
-- fail-closed identity-check + idempotency pattern, operating on the two JSON files directly;
-- (2) codex-review the script to GREEN; (3) owner runs it with --apply plus --reviewer/--date
-- (AI never runs --apply); (4) after --apply: npx tsc --noEmit; npm run lint; npm run test:ci
-- (promoting/disposing rows shifts the audit-count guards in
-- src/lib/matrix-options/provenance/__tests__/library.test.ts and catalog.test.ts, same as
-- promote-hc-trv-v4-2025.mjs's REQUIRED-before-test:ci note).

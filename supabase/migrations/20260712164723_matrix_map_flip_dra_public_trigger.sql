-- Documents migration 20260712164723 (matrix_map_flip_dra_public_trigger), applied to
-- production 2026-07-12 via the project-scoped Supabase MCP under explicit owner
-- authorization (design: docs/design/matrix-map/RLS_FLIP_DRA_PUBLIC_TRIGGER_DESIGN_2026_07_11.md,
-- #615 T7). Append-only file added after the fact so repo history matches applied DB state.

-- ---------------------------------------------------------------------
-- SECTION 0 -- TRANSIENT GRANT CREATE for owner-transfer dance.
-- ---------------------------------------------------------------------
-- Mirrors the established 20260520000004 SECTION 0 pattern: ALTER FUNCTION
-- ... OWNER TO matrix_map_owner requires the target owner to hold CREATE on
-- the containing schema. REVOKEd again at the bottom of this migration.
-- ---------------------------------------------------------------------
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

-- ---------------------------------------------------------------------
-- SECTION 1 -- Trigger function: enforce flip_dra_public-only writes
-- ---------------------------------------------------------------------
-- INTENTIONALLY SECURITY INVOKER (the plpgsql default -- no "SECURITY DEFINER"
-- clause). Load-bearing: SECURITY DEFINER would make current_user inside the
-- function ALWAYS resolve to matrix_map_owner regardless of who issued the
-- UPDATE, silently defeating the current_user guard below.
CREATE OR REPLACE FUNCTION matrix_map.enforce_dras_public_via_flip()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = matrix_map, pg_temp
AS $$
BEGIN
  IF NEW.public IS DISTINCT FROM OLD.public THEN
    -- Condition (a): only matrix_map_owner (the only role granted UPDATE on
    -- matrix_map.dras today, and flip_dra_public's SECURITY DEFINER identity)
    -- may ever change .public. Unforgeable by authenticated/app roles.
    IF current_user IS DISTINCT FROM 'matrix_map_owner' THEN
      RAISE EXCEPTION
        'matrix_map.dras.public may only be changed via matrix_map.flip_dra_public(...) '
        '(audited RPC); direct UPDATE on dras.public is blocked. If you need to change '
        'a DRA''s visibility, call flip_dra_public(p_dra_id, p_new_value, p_actor_id, p_reason).'
        USING ERRCODE = '42501';
    END IF;

    -- Condition (b): within the already-trusted matrix_map_owner tier, require
    -- the transaction-local marker that only flip_dra_public's own guarded
    -- UPDATE sets (defense-in-depth).
    IF current_setting('matrix_map.audited_flip', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION
        'matrix_map.dras.public UPDATE seen outside matrix_map.flip_dra_public''s '
        'own guarded write path (audited_flip marker not set). This should be '
        'unreachable for the current flip_dra_public implementation -- if you '
        'added a new matrix_map_owner-owned write path to dras.public, route it '
        'through flip_dra_public or update this guard deliberately.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION matrix_map.enforce_dras_public_via_flip() OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.enforce_dras_public_via_flip()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION matrix_map.enforce_dras_public_via_flip() IS
  'BEFORE UPDATE trigger guard for matrix_map.dras. SECURITY INVOKER '
  '(intentionally, NOT DEFINER) so current_user reflects the ACTUAL role '
  'that issued the UPDATE. Requires BOTH current_user = matrix_map_owner '
  '(unforgeable by authenticated/app roles) AND the transaction-local flag '
  'matrix_map.audited_flip = 1 which only matrix_map.flip_dra_public sets. '
  'Does NOT defend against a caller who already operates as matrix_map_owner '
  'directly (SQL Editor / superuser SET ROLE) -- see design doc T7 '
  '2026-07-11 section 6 for that documented residual limit. Closes the '
  'documented RPC-vs-direct-UPDATE audit gap (grants v2.1 codex B-1).';

-- ---------------------------------------------------------------------
-- SECTION 2 -- Trigger
-- ---------------------------------------------------------------------
-- ENABLE ALWAYS: fires even if session_replication_role = 'replica'.
DROP TRIGGER IF EXISTS trg_dras_public_flip_only ON matrix_map.dras;
CREATE TRIGGER trg_dras_public_flip_only
  BEFORE UPDATE ON matrix_map.dras
  FOR EACH ROW
  EXECUTE FUNCTION matrix_map.enforce_dras_public_via_flip();
ALTER TABLE matrix_map.dras ENABLE ALWAYS TRIGGER trg_dras_public_flip_only;

COMMENT ON TRIGGER trg_dras_public_flip_only ON matrix_map.dras IS
  'Enforces that dras.public changes only happen via flip_dra_public. '
  'See matrix_map.enforce_dras_public_via_flip() for the guard logic.';

-- ---------------------------------------------------------------------
-- SECTION 3 -- REFACTOR: matrix_map.flip_dra_public(...) -- add the
-- audited_flip marker around its own guarded UPDATE (T7 2026-07-11).
-- All authorization checks below (actor-match, admin/matrix_admin role,
-- non-empty reason, JWT email resolution, no-op-on-unchanged, atomic
-- audit insert) are copied verbatim from 20260520000004...sql lines
-- 344-428; only the two PERFORM set_config(...) lines and the COMMENT
-- text are new. This full re-issue was live-verified (2026-07-12) to be
-- byte-identical to the current live prosrc except for those two lines.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION matrix_map.flip_dra_public(
  p_dra_id    uuid,
  p_new_value boolean,
  p_actor_id  uuid,
  p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid           uuid;
  v_claims        jsonb;
  v_prior         boolean;
  v_actor_email   text;
  v_is_authorized boolean;
BEGIN
  v_uid    := matrix_map.current_user_id();
  v_claims := matrix_map.jwt_claims();

  -- (1) Must be called from an authenticated user-JWT context.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'flip_dra_public must be called from an authenticated user context (jwt sub is null); service_role cannot call this RPC'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Caller cannot impersonate a different actor.
  IF v_uid <> p_actor_id THEN
    RAISE EXCEPTION 'flip_dra_public actor_id (%) must match caller jwt sub (%)', p_actor_id, v_uid
      USING ERRCODE = '42501';
  END IF;

  -- (3) Caller must hold admin OR matrix_admin role.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'flip_dra_public requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  -- (4) Reason required (grants v2 section 2.3).
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'flip_dra_public requires a non-empty reason';
  END IF;

  v_actor_email := (v_claims ->> 'email')::text;
  IF v_actor_email IS NULL OR length(trim(v_actor_email)) = 0 THEN
    RAISE EXCEPTION 'flip_dra_public could not resolve actor email from JWT for sub %', v_uid;
  END IF;

  -- Lock + read prior value.
  SELECT public INTO v_prior
  FROM matrix_map.dras
  WHERE id = p_dra_id
    AND is_deleted = false
  FOR UPDATE;

  IF v_prior IS NULL THEN
    RAISE EXCEPTION 'dra % not found or is soft-deleted', p_dra_id;
  END IF;

  -- No-op if value unchanged (avoids gratuitous audit rows).
  IF v_prior IS DISTINCT FROM p_new_value THEN
    PERFORM set_config('matrix_map.audited_flip', '1', true);      -- NEW (is_local=true: transaction-scoped)

    UPDATE matrix_map.dras
       SET public = p_new_value
     WHERE id = p_dra_id
       AND is_deleted = false;

    PERFORM set_config('matrix_map.audited_flip', '0', true);      -- NEW: clear immediately

    INSERT INTO matrix_map.dra_visibility_audit
      (dra_id, prior_value, new_value, changed_at, changed_by, changed_by_email, reason)
    VALUES
      (p_dra_id, v_prior, p_new_value, now(), v_uid, v_actor_email, p_reason);
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text) IS
  '2026-07-11 T7 refactor: added transaction-local matrix_map.audited_flip '
  'marker (set immediately before, cleared immediately after, the guarded '
  'UPDATE) so matrix_map.enforce_dras_public_via_flip can distinguish this '
  'function''s own guarded write from any other matrix_map_owner-owned '
  'write path. All prior authorization checks preserved verbatim from the '
  '2026-05-20 JWT refactor (20260520000004).';

-- ---------------------------------------------------------------------
-- SECTION 4 -- REVOKE the transient CREATE grant (steady-state posture).
-- ---------------------------------------------------------------------
REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

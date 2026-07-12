# RLS-Bypass Hardening: flip_dra_public-Only Trigger Design (T7, owner-gated)

Status: DESIGN ONLY. No migration file created, no SQL applied, no DB write performed.
This document is the design packet for owner review per AGENTS.md gate discipline.
Design approval alone is NOT authorization to write to the database: per section 7, TWO
SEPARATE explicit owner authorizations are required before any DB write -- (1) design
approval, and (2) a later, separate go-ahead naming the exact final SQL AND explicitly
authorizing the specific `apply_migration` tool call. Only after BOTH does Claude author the
migration file, apply that exact SQL via the project-scoped `/supabase` MCP path (or the
owner-pastes-into-SQL-Editor path), post-verify, and keep the rollback ready. See section 7
for the full gate.

This closes gap R2 flagged in `docs/design/matrix-map/DRA_PUBLICATION_PATH_DESIGN_2026_07_11.md`
("RPC-vs-direct-UPDATE gap") -- the owner-recommended tighten option (a).

**Codex reviewer instructions (read this before reviewing the diff):** the SQL below is a
`BEFORE UPDATE` trigger intended to make `matrix_map.dras.public` changeable ONLY through
`matrix_map.flip_dra_public(...)`. Please verify (1) correctness of the trigger logic itself
(does `set_config(..., true)` correctly scope to a single statement without leaking to later
statements in the same transaction/session, given PgBouncer transaction-mode pooling), and
(2) bypass-completeness -- enumerate every way `matrix_map.dras.public` could still be changed
without going through `flip_dra_public` after this trigger lands (superuser DDL, `ALTER TABLE
... DISABLE TRIGGER`, `pg_dump`/restore, logical replication apply, `COPY`, session_replication_role
tricks, RLS `FORCE` interaction, or anything else). Findings get folded into section 6 below.

---

## 1. Problem statement

`matrix_map.dras` has RLS enabled and forced. The admin write policy, as currently applied
(`supabase/migrations/20260519000002_matrix_map_rls.sql` lines 525-549):

```sql
DROP POLICY IF EXISTS dras_admin_all ON matrix_map.dras;
CREATE POLICY dras_admin_all
  ON matrix_map.dras
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY dras_admin_all ON matrix_map.dras IS
  'admin / matrix_admin full CRUD on dras. Direct UPDATE on dras.public '
  'is policy-allowed but the admin UI must route through '
  'matrix_map.flip_dra_public RPC for atomic audit (documented contract '
  'per grants v2.1 codex B-1; not enforced by trigger).';
```

The policy's own COMMENT documents the gap explicitly: an admin/matrix_admin session is
**RLS-row-permitted** to run `UPDATE matrix_map.dras SET public = ... WHERE id = ...` directly,
and that direct path writes NO row into `matrix_map.dra_visibility_audit`. Only the SECDEF RPC
writes the audit row (`supabase/migrations/20260520000004_matrix_map_jwt_via_current_setting.sql`
lines 344-428, the current authoritative `flip_dra_public` body after the JWT-refactor):

```sql
  -- Lock + read prior value.
  SELECT public INTO v_prior
  FROM matrix_map.dras
  WHERE id = p_dra_id
    AND is_deleted = false
  FOR UPDATE;
  ...
  -- No-op if value unchanged (avoids gratuitous audit rows).
  IF v_prior IS DISTINCT FROM p_new_value THEN
    UPDATE matrix_map.dras
       SET public = p_new_value
     WHERE id = p_dra_id
       AND is_deleted = false;

    INSERT INTO matrix_map.dra_visibility_audit
      (dra_id, prior_value, new_value, changed_at, changed_by, changed_by_email, reason)
    VALUES
      (p_dra_id, v_prior, p_new_value, now(), v_uid, v_actor_email, p_reason);
  END IF;
```

The table's own DDL comment on `dra_visibility_audit` (schema migration, line ~588) says the
same thing from the audit table's side: "direct UPDATE on dras.public does NOT auto-create an
audit row (documented contract per grants v2.1 codex finding; admin UI always routes through
the RPC)." Today the guarantee is a **documentation-only contract**, not a DB-enforced one.

**Grant-level nuance found while grounding this doc (relevant to bypass-completeness, section 6):**
the table-level grants in the same migration (line 904) give `authenticated` only `GRANT SELECT
ON matrix_map.dras` -- `matrix_map_owner` is the only role explicitly granted `UPDATE` (line 235:
`GRANT SELECT, UPDATE ON matrix_map.dras TO matrix_map_owner`). That means a plain `authenticated`
Postgres role (i.e. a normal admin session going through PostgREST/supabase-js with `.from('dras').update(...)`)
would currently be blocked at the GRANT level before RLS is even evaluated -- `permission denied
for table dras`. The realistic bypass paths are therefore: (a) any future migration that adds
`GRANT UPDATE ... TO authenticated` (a policy/grant drift that would silently reopen this), (b) the
Supabase Studio SQL Editor, which per this repo's Supabase protocol
(`cross_project_supabase_mcp_dead_skip_to_sql_editor.md`) is how the owner currently applies all
migrations and ad hoc SQL -- SQL Editor sessions run with elevated/superuser-class privileges that
bypass both RLS and table GRANTs, and (c) any script using the `service_role` key. A trigger-based
fix is the right general shape because `BEFORE UPDATE` triggers fire regardless of RLS bypass or
role grants -- but the corrected design in section 2 only fully closes (a) (any `authenticated`-role
caller, today or after a future broadened grant). For (b) and (c) -- callers who already reach the
DB as `matrix_map_owner` or superuser (SQL Editor, `service_role` with sufficient membership) -- no
trigger-based control can fully close the gap, because such a caller can forge the trigger's own
marker or disable/redefine the trigger itself; section 2's "Honest residual limit" and section 6
document this explicitly rather than overclaiming coverage of (b)/(c).

**Confirmed clean today:** grepping `src/` and `scripts/` found no code path that does a direct
`UPDATE` on `matrix_map.dras` (or `.from('dras').update(...)`). The two admin-surface files that
touch `dras` --
`src/app/(dashboard)/admin/matrix-map/health/page.tsx` and
`src/app/(dashboard)/admin/matrix-map/publish/page.tsx` -- only ever `.select()` from it. The
write path (`src/app/api/matrix-map/admin/publish/route.ts`, line 137) calls
`.rpc('flip_dra_public', ...)` exclusively. See section 6 for the full blast-radius note. So the
gap is currently a *documented latent* risk (SQL Editor / future grant drift / service_role
scripts), not an actively-exploited one in application code -- but the point of this hardening is
to make the RPC-only contract true regardless of what future code, migrations, or ad hoc SQL do.

---

## 2. Proposed fix

**REVISED after codex round 1 P1 finding (see section 6 changelog): a transaction-local marker
ALONE is not a valid guard.** `set_config('matrix_map.audited_flip', '1', true)` is a plain SQL
built-in callable by any role with no special privilege -- a caller in exactly the elevated/direct
paths this design exists to close (SQL Editor session, `service_role` script, or a future migration
that grants `authenticated` broader `UPDATE`) could simply prepend `SELECT
set_config('matrix_map.audited_flip', '1', true);` to their own raw `UPDATE` and defeat the guard
completely, with zero audit row written -- i.e. the original draft did not actually close the gap
it was designed to close. Codex is correct; the corrected design below requires the marker to be
combined with a role check that ordinary callers cannot forge.

**Chosen approach: `BEFORE UPDATE` trigger requiring BOTH (a) `current_user = 'matrix_map_owner'`
AND (b) a transaction-local marker set only by `flip_dra_public` immediately around its own guarded
`UPDATE`.** `matrix_map.dras` currently grants `UPDATE` to `matrix_map_owner` only (section 1) --
`authenticated` (the role every admin/matrix_admin app session runs as) has no path to become
`current_user = 'matrix_map_owner'` without an explicit role-membership grant it does not hold, so
condition (a) alone already closes the two threats actually named in the RLS policy's own gap
comment: (i) today's RLS-permitted-but-undocumented-as-blocked direct `UPDATE` from an
admin/matrix_admin `authenticated` session, and (ii) any *future* migration that grants
`authenticated` (or any other non-`matrix_map_owner` role) `UPDATE` on `dras` -- such a caller
still cannot satisfy `current_user = 'matrix_map_owner'` no matter what GUCs it sets. Condition (b)
is then defense-in-depth *within* the already-trusted `matrix_map_owner` privilege tier: it
distinguishes `flip_dra_public`'s own guarded `UPDATE` from some other current-or-future
`matrix_map_owner`-owned function/script that touches `dras.public` without routing through the
audited RPC (there is none today per section 1's grep, but this guards against that drifting in
later). **Honest residual limit (see section 6):** an actor who already operates as
`current_user = 'matrix_map_owner'` directly (Supabase Studio SQL Editor connected with
elevated/superuser credentials that can `SET ROLE matrix_map_owner`, or `matrix_map_owner`
holding `LOGIN` and being used directly) *can* still forge the marker and bypass the audit --
no trigger-based control can close that; this is the same "an actor with the object owner's own
privilege can always defeat the object owner's own defenses" ceiling already noted for the
REVOKE-column alternative in section 2.3. This is called out explicitly, not hidden, because
codex's finding was exactly about not overclaiming what the guard closes.

### 2.1 Trigger function + trigger (exact SQL for the migration)

```sql
-- ---------------------------------------------------------------------
-- SECTION 0 -- TRANSIENT GRANT CREATE for owner-transfer dance.
-- ---------------------------------------------------------------------
-- Codex round 4 P2 finding: prior migrations (20260520000004 SECTION 6, and
-- PR-MAP-1/PR-MAP-3a before it) REVOKE CREATE on schema matrix_map from
-- matrix_map_owner at the end of their bodies. ALTER FUNCTION ... OWNER TO
-- matrix_map_owner requires the target owner to hold CREATE on the containing
-- schema, so the ALTER FUNCTION OWNER statements below (for
-- enforce_dras_public_via_flip and the flip_dra_public reissue in section
-- 2.2) would error without this transient grant. Mirrors the established
-- 20260520000004 SECTION 0 pattern exactly. REVOKEd again at the bottom of
-- this migration (after section 2.2's ALTER FUNCTION OWNER) so the
-- post-migration state matches the existing REVOKEd steady-state posture.
-- ---------------------------------------------------------------------

GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;


-- ---------------------------------------------------------------------
-- SECTION 1 -- Trigger function: enforce flip_dra_public-only writes
-- ---------------------------------------------------------------------
-- INTENTIONALLY SECURITY INVOKER (the plpgsql default -- no "SECURITY DEFINER" clause here).
-- This is load-bearing, not an oversight: SECURITY DEFINER would make current_user inside the
-- function ALWAYS resolve to the function's owner (matrix_map_owner), regardless of which role
-- actually issued the UPDATE -- silently defeating the current_user guard below for every caller,
-- including the exact future-authenticated-grant threat this design exists to close (codex round 2
-- P1 finding). SECURITY INVOKER requires no elevated privilege here: reading a custom GUC via
-- current_setting() and RAISE EXCEPTION both require zero privilege for any role.
CREATE OR REPLACE FUNCTION matrix_map.enforce_dras_public_via_flip()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = matrix_map, pg_temp
AS $$
BEGIN
  IF NEW.public IS DISTINCT FROM OLD.public THEN
    -- Condition (a): only matrix_map_owner (the only role granted UPDATE on
    -- matrix_map.dras today, and flip_dra_public's SECURITY DEFINER identity)
    -- may ever change .public. Ordinary authenticated/admin app sessions have
    -- no role-membership path to become current_user = matrix_map_owner, so
    -- this cannot be forged by the caller regardless of what GUCs it sets.
    IF current_user IS DISTINCT FROM 'matrix_map_owner' THEN
      RAISE EXCEPTION
        'matrix_map.dras.public may only be changed via matrix_map.flip_dra_public(...) '
        '(audited RPC); direct UPDATE on dras.public is blocked. If you need to change '
        'a DRA''s visibility, call flip_dra_public(p_dra_id, p_new_value, p_actor_id, p_reason).'
        USING ERRCODE = '42501';
    END IF;

    -- Condition (b): within the already-trusted matrix_map_owner tier, require
    -- the transaction-local marker that only flip_dra_public's own guarded
    -- UPDATE sets, so a future matrix_map_owner-owned function/script that
    -- touches .public without routing through flip_dra_public is also caught.
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
-- No explicit GRANT needed regardless: Postgres fires trigger functions as
-- part of statement execution, not via an ordinary EXECUTE call, so the
-- EXECUTE grant/revoke on this function does not gate whether the trigger
-- fires (this REVOKE only prevents someone from directly SELECTing/calling
-- it outside trigger context, which is not otherwise meaningful for a
-- RETURNS trigger function, but is kept for hygiene/consistency with this
-- repo's revoke-then-grant-explicitly pattern).

COMMENT ON FUNCTION matrix_map.enforce_dras_public_via_flip() IS
  'BEFORE UPDATE trigger guard for matrix_map.dras. SECURITY INVOKER '
  '(intentionally, NOT DEFINER -- see inline comment above the CREATE '
  'FUNCTION) so current_user reflects the ACTUAL role that issued the '
  'UPDATE (or, when invoked from within flip_dra_public''s own SECURITY '
  'DEFINER context, the ambient matrix_map_owner identity flip_dra_public '
  'already elevated to). Requires BOTH current_user = matrix_map_owner '
  '(unforgeable by authenticated/app roles -- closes the RLS-policy- '
  'documented direct-UPDATE gap and any future authenticated UPDATE '
  'grant) AND the transaction-local flag matrix_map.audited_flip = 1 '
  'which only matrix_map.flip_dra_public sets (defense-in-depth within '
  'the matrix_map_owner tier). Does NOT defend against a caller who '
  'already operates as matrix_map_owner directly (SQL Editor / superuser '
  'SET ROLE) -- see design doc T7 2026-07-11 section 6 for that '
  'documented residual limit. Closes the documented RPC-vs-direct-UPDATE '
  'audit gap (grants v2.1 codex B-1).';

-- ---------------------------------------------------------------------
-- SECTION 2 -- Trigger
-- ---------------------------------------------------------------------
-- ENABLE ALWAYS (not the plain default): fires even if session_replication_role
-- is set to 'replica' (e.g. during logical-replication apply or a maintenance
-- session) -- setting session_replication_role itself requires superuser, so
-- this is defense-in-depth against a narrower non-superuser mistake, not a
-- claim that it defeats a superuser (see section 6).
DROP TRIGGER IF EXISTS trg_dras_public_flip_only ON matrix_map.dras;
CREATE TRIGGER trg_dras_public_flip_only
  BEFORE UPDATE ON matrix_map.dras
  FOR EACH ROW
  EXECUTE FUNCTION matrix_map.enforce_dras_public_via_flip();
ALTER TABLE matrix_map.dras ENABLE ALWAYS TRIGGER trg_dras_public_flip_only;

COMMENT ON TRIGGER trg_dras_public_flip_only ON matrix_map.dras IS
  'Enforces that dras.public changes only happen via flip_dra_public. '
  'See matrix_map.enforce_dras_public_via_flip() for the guard logic.';
```

### 2.2 Required edit to `flip_dra_public` (set + clear the marker around its own UPDATE)

**Codex round 5 P2 finding: the previous draft of this section only showed a body-diff snippet
and referred to "the full existing function body" by line number instead of including it.** A
future agent copying "the exact SQL from sections 2.1-2.2" per section 7 would have installed the
trigger without actually updating `flip_dra_public` -- breaking the sanctioned publish RPC (it
would hit the trigger's 42501 marker error on its own guarded `UPDATE`). Fixed: the full
`CREATE OR REPLACE FUNCTION` block below is the complete, exact re-issue (signature through
`COMMENT ON FUNCTION`), copied verbatim from `20260520000004...sql` lines 344-443, with ONLY the
two `PERFORM set_config(...)` lines and an updated `COMMENT` added -- no other line changed:

```sql
-- ---------------------------------------------------------------------
-- SECTION 2 -- REFACTOR: matrix_map.flip_dra_public(...) -- add the
-- audited_flip marker around its own guarded UPDATE (T7 2026-07-11).
-- All authorization checks below (actor-match, admin/matrix_admin role,
-- non-empty reason, JWT email resolution, no-op-on-unchanged, atomic
-- audit insert) are copied verbatim from 20260520000004...sql lines
-- 344-428; only the two PERFORM set_config(...) lines are new.
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

  -- Resolve actor email from the JWT claims (bypasses auth.users read
  -- which would fail under matrix_map_owner SECDEF -- no USAGE on auth
  -- schema). The Supabase GoTrue issuer always includes the email claim
  -- for password / OAuth sessions.
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

    PERFORM set_config('matrix_map.audited_flip', '0', true);      -- NEW: clear immediately, do not leave it
                                                                     --      "hot" for the rest of the transaction
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
  'write path. All prior authorization checks (actor-match, admin/'
  'matrix_admin role, non-empty reason, JWT email resolution, no-op-on-'
  'unchanged, atomic audit insert) preserved verbatim from the 2026-05-20 '
  'JWT refactor (20260520000004).';
```

Because this re-issue includes an `ALTER FUNCTION ... OWNER TO matrix_map_owner`, it needs the
same transient `GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner` from section 2.1's SECTION
0 (already in effect by the time this statement runs, since it is granted once at the top of the
migration and used for every `ALTER FUNCTION ... OWNER` statement in the file, per the established
`20260520000004` pattern).

```sql
-- ---------------------------------------------------------------------
-- SECTION 3 -- REVOKE the transient CREATE grant (steady-state posture).
-- ---------------------------------------------------------------------
-- Mirrors 20260520000004 SECTION 6: after every ALTER FUNCTION ... OWNER TO
-- matrix_map_owner statement in this migration has run (SECTION 1's
-- enforce_dras_public_via_flip and this section's flip_dra_public reissue),
-- revoke CREATE back off so matrix_map_owner does not retain schema-CREATE
-- in steady state.
-- ---------------------------------------------------------------------
REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;
```

**Why `is_local=true` and an explicit clear, not `is_local=false` or relying on
transaction-end auto-reset alone:** `is_local=true` scopes the setting to the current transaction
and auto-resets at COMMIT/ROLLBACK, which is required because PgBouncer/Supavisor transaction-mode
pooling reuses physical connections across unrelated sessions -- a session-scoped (`is_local=false`)
setting would leak into a completely different caller's later transaction on the same pooled
connection. But `flip_dra_public` typically runs as PostgREST's single-statement-equals-single-
transaction RPC call, so transaction-end auto-reset alone would already be safe in that specific
call pattern. The *explicit* clear immediately after the guarded `UPDATE` is the extra hardening
for the case codex should double check in section 6: a caller who wraps `SELECT
flip_dra_public(...)` inside a larger multi-statement transaction (e.g. a raw psql/SQL-Editor
script) alongside a second, unaudited `UPDATE matrix_map.dras SET public = ...` on a *different*
row later in the *same* transaction. Explicit-clear closes that window down to the single guarded
`UPDATE` statement instead of leaving the flag "hot" for the rest of the transaction.

### 2.3 Alternatives considered

| Alternative | How it would work | Trade-offs |
|---|---|---|
| **REVOKE UPDATE on the `public` column from `authenticated`** (column-level privilege via `REVOKE UPDATE (public) ON matrix_map.dras FROM authenticated`, keep `UPDATE` on other columns) | Postgres supports column-level GRANT/REVOKE for UPDATE. Blocks `authenticated`-role clients from touching `public` at all, RLS or not. | Does **not** close the gap for `matrix_map_owner` (which needs `UPDATE` for the RPC's own internal write, and a raw SQL session connected as `matrix_map_owner` would be unaffected), nor for SQL Editor / superuser / service_role sessions -- those roles are typically granted broadly or bypass grants. Also brittle: any future `GRANT UPDATE ON matrix_map.dras TO authenticated` (a whole-table grant, easy to write by accident) silently re-opens the column-level revoke unless it is table-vs-column-scoped correctly every time. Weaker than the trigger; does not by itself guarantee an audit row is written even when it does block the naive path. |
| **RULE instead of TRIGGER** (`CREATE RULE ... ON UPDATE TO matrix_map.dras WHERE ... DO INSTEAD NOTHING`, or a `DO ALSO` rule that redirects into an audit insert) | Postgres query rewrite rules can intercept UPDATE at parse time. | Rules are widely considered a legacy/discouraged Postgres feature (subtle interaction with RLS policies applied per-statement, harder to reason about with `FOR EACH ROW` semantics, documented footguns with multi-row updates and `RETURNING`). A "silently do nothing" rule would also swallow the caller's write with no error, which is worse UX than the trigger's explicit `RAISE EXCEPTION` (a silent no-op update looks like success to the caller). Not recommended. |
| **Move `public` into a separate 1-row-per-dra side table, RPC-only writable** | Split `dras.public` out to `matrix_map.dra_visibility(dra_id pk, public boolean)`, grant `authenticated` no privileges on it at all, only `matrix_map_owner`/the RPC can write it. | Correct in principle (privilege-only enforcement, no trigger needed) but a much bigger blast-radius change: every read of `dras.public` (RLS policies on `samples`/`sample_events`/`measurements` that key off DRA visibility, `fetch_samples_with_hidden_summary`, the health/publish page selects) would need a join rewrite. Out of proportion for closing an audit-completeness gap; deferred unless the trigger approach is found insufficient. |
| **Chosen (revised after codex round 1): BEFORE UPDATE trigger requiring `current_user = 'matrix_map_owner'` AND a transaction-local `set_config` marker set only by `flip_dra_public`** | See 2.1/2.2. | Closes the gap for the realistic threat actually named in the RLS policy comment: any `authenticated`-role admin/matrix_admin session doing a direct `UPDATE` (today or after any future broadened grant), because such a session has no role-membership path to `current_user = 'matrix_map_owner'` and cannot forge that condition by setting a GUC. The marker adds defense-in-depth within the already-trusted `matrix_map_owner` tier. **Does NOT** close a bypass by an actor who already operates directly as `current_user = 'matrix_map_owner'` (Studio SQL Editor with `SET ROLE` capability, or direct `matrix_map_owner` login) -- that actor can forge the marker (a plain `set_config` needs no privilege) or simply `ALTER TABLE ... DISABLE TRIGGER` / `DROP` the trigger / redefine the function, since it already holds the same privilege tier as the trigger's own owner. This is the same "an actor with the object owner's privilege can always defeat the object owner's own defenses" ceiling as the REVOKE-column alternative above -- no DB-level control removes it. First draft of this row overclaimed "closes the gap for every caller regardless of role" using a GUC-only marker; codex correctly flagged that as forgeable (see section 6 changelog). |

---

## 3. Idempotency + safety (new migration, NOT created tonight)

**Intended filename (owner-approval-gated; not created in this PR):**
`supabase/migrations/20260711000002_matrix_map_flip_dra_public_trigger.sql`

Naming convention observed in this repo's `supabase/migrations/`: `YYYYMMDDNNNNNN_description.sql`,
where `NNNNNN` is a zero-padded same-day sequence number (e.g. today's tree already has
`20260711000001_matrix_map_fetch_samples_pagination.sql`). If this migration is actually applied
on a later date, the timestamp prefix should be bumped to that day's `YYYYMMDD000001` (or the next
free same-day sequence number if other migrations land first) rather than reusing `20260711`.

**Idempotency of the migration file itself:**
- `CREATE OR REPLACE FUNCTION` for both `enforce_dras_public_via_flip()` and the reissued
  `flip_dra_public(...)` -- safe to re-run.
- `DROP TRIGGER IF EXISTS trg_dras_public_flip_only ON matrix_map.dras;` before `CREATE TRIGGER`
  -- safe to re-run (matches this repo's existing `DROP POLICY IF EXISTS` / re-`CREATE` pattern
  used throughout `20260519000002_matrix_map_rls.sql`).
- No data migration, no backfill, no new table, no new column -- pure function/trigger DDL. No
  existing row in `matrix_map.dras` needs to change; the trigger only gates *future* `UPDATE`
  statements.

**Safety / blast-radius of applying it:**
- The trigger only fires when `NEW.public IS DISTINCT FROM OLD.public` -- any `UPDATE` that
  touches other `dras` columns (title, agency, year, `is_deleted`, etc.) without changing `public`
  is completely unaffected.
- `flip_dra_public` itself is re-issued as the *same* function with two added `PERFORM
  set_config(...)` lines -- no signature change, no grant change, no behavior change to its
  authorization checks (actor-match, admin/matrix_admin role, non-empty reason, no-op-on-unchanged,
  `dra_visibility_audit` insert). Existing callers (`src/app/api/matrix-map/admin/publish/route.ts`)
  need no code change.
- Because `matrix_map.dras` currently only grants `UPDATE` to `matrix_map_owner` (see section 1),
  and `flip_dra_public` runs `SECURITY DEFINER` owned by `matrix_map_owner`, the RPC's own guarded
  `UPDATE` already executes as `matrix_map_owner` -- the trigger does not need any special-case
  logic for "who is running this update," only for "was the marker set right before it."

---

## 4. Pre/post verification SQL

**Correction after codex round 1 P2 finding:** this section originally labeled itself "read-only"
as a whole, but steps 5-7 below perform a real `UPDATE` and a real `flip_dra_public` call --
actual DML against `matrix_map.dras` and `matrix_map.dra_visibility_audit`. Labeling that
"read-only" would let a future agent run it under this repo's "read-only exploratory SQL is
always fine" allowance (`cross_project_supabase_protocol_explore_before_assume.md`) without the
write-gate this repo requires for any DML. The section is now split explicitly:

- **4a (SELECT-only, no gate needed, safe to run anytime, before or after this design is
  approved):** steps 1-4. Pure `SELECT` against `pg_trigger` / `pg_policy` / `pg_proc`.
- **4b (write-gated, requires the SAME explicit owner authorization as applying the migration
  itself -- do NOT run under the read-only-SQL allowance):** steps 5-7. These mutate real data
  (flip a real DRA's `public` flag, insert an audit row) and must only run after the owner has
  approved both the migration SQL (section 2) AND this specific verification pass, ideally against
  a disposable/test DRA row, not a DRA currently relied on by a real grant.

**4a -- Pre-apply (SELECT-only; confirm current state matches this design's assumptions):**

```sql
-- 1. Confirm the trigger does not yet exist.
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgrelid = 'matrix_map.dras'::regclass
  AND tgname = 'trg_dras_public_flip_only';
-- Expect: 0 rows.

-- 2. Confirm current dras_admin_all policy + its documented-gap COMMENT (grounding check).
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'matrix_map.dras'::regclass
  AND polname = 'dras_admin_all';

-- 3. Confirm flip_dra_public's current signature (should NOT yet reference audited_flip).
SELECT prosrc
FROM pg_proc
WHERE proname = 'flip_dra_public'
  AND pronamespace = 'matrix_map'::regnamespace;
-- Expect: prosrc does NOT contain 'audited_flip'.
```

**4a continued -- Post-apply structural check (SELECT-only):**

```sql
-- 4. Trigger exists, is enabled, and is ENABLE ALWAYS ('A' = always-fires, including under
--    session_replication_role = replica; plain 'O' would NOT survive that mode).
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'matrix_map.dras'::regclass
  AND tgname = 'trg_dras_public_flip_only';
-- Expect: 1 row, tgenabled = 'A'.
```

**4b -- Post-apply mutation verification (WRITE-GATED -- see the correction note above; requires
explicit owner authorization, run against a disposable/test DRA):**

```sql
-- 5. Direct UPDATE on the test DRA's public flag is REJECTED.
--    Pick a disposable/test dra id first (NOT one with a live private grant depended on):
--      SELECT id, public FROM matrix_map.dras WHERE is_deleted = false LIMIT 1;
--    then, run as whichever role the SQL Editor session actually is:
UPDATE matrix_map.dras
   SET public = NOT public
 WHERE id = '<paste-a-real-dra-id>';
-- Expect: ERROR 42501. Message text depends on WHICH guard condition tripped -- both are
-- correct outcomes, either confirms the fix:
--   - "...may only be changed via matrix_map.flip_dra_public(...)..." if current_user in the
--     Editor session is not matrix_map_owner (the common case), OR
--   - "...audited_flip marker not set..." if the Editor session's current_user IS
--     matrix_map_owner (e.g. via SET ROLE) but did not call flip_dra_public.
-- Either way: confirm via psql \errverbose or the Studio error panel that no row changed --
-- re-SELECT the same id's public value and confirm it is unchanged from step 5's SELECT.

-- 6. flip_dra_public still works AND still writes an audit row (run as an authenticated admin
--    session, i.e. via the app / a JWT-bearing session, NOT the SQL Editor's service/owner
--    connection, since the RPC requires a non-null JWT sub matching p_actor_id):
--    (owner: use the existing /admin/matrix-map/publish UI to flip one test DRA, or call the RPC
--    from an authenticated supabase-js session)
--    Then confirm:
SELECT dra_id, prior_value, new_value, changed_at, changed_by_email, reason
FROM matrix_map.dra_visibility_audit
ORDER BY changed_at DESC
LIMIT 1;
-- Expect: a fresh row matching the DRA + flip just performed, changed_at within the last minute.

-- 7. Confirm the DRA's public value on the dras row itself matches the audit row's new_value
--    (i.e. flip_dra_public's own internal UPDATE was NOT itself blocked by the new trigger).
SELECT id, public FROM matrix_map.dras WHERE id = '<dra-id-from-step-6>';
```

---

## 5. Rollback (exact SQL)

```sql
-- Step 1: remove the trigger (dras.public reverts to RLS-policy-only enforcement,
-- i.e. back to today's documented-gap state).
DROP TRIGGER IF EXISTS trg_dras_public_flip_only ON matrix_map.dras;

-- Step 2: drop the guard function.
DROP FUNCTION IF EXISTS matrix_map.enforce_dras_public_via_flip();

-- Step 3: restore flip_dra_public to the pre-T7 body (remove the two set_config lines) by
-- re-running the CREATE OR REPLACE FUNCTION block exactly as it stands today in
-- supabase/migrations/20260520000004_matrix_map_jwt_via_current_setting.sql lines 344-428
-- (verbatim, no set_config calls). This is a straight CREATE OR REPLACE re-issue of the
-- currently-committed function body; no data changes, no audit-table changes -- rollback is
-- purely functions/triggers, matching the forward migration's blast radius.
```

No `dra_visibility_audit` rows or `dras` data rows need to be touched by rollback -- the audit
rows written while the trigger was active remain valid history (they were legitimately written by
`flip_dra_public`, same as before this change).

---

## 6. Blast-radius note

**Sanctioned UI path confirmed clean.** Per section 1's grep, the current admin publish flow
(`PR #605`/`#612`) is `src/app/(dashboard)/admin/matrix-map/publish/page.tsx` (renders DRAs via
`.select()` only) -> `src/app/api/matrix-map/admin/publish/route.ts` line 137, which calls
`.rpc('flip_dra_public', {...})`. This is the only write path in the route. The trigger will not
break it: `flip_dra_public`'s own guarded `UPDATE` sets the `audited_flip` marker immediately
before running, per section 2.2.

**Other `matrix_map.dras` touch points found (all read-only, none are UPDATE):**
- `src/app/(dashboard)/admin/matrix-map/health/page.tsx` lines ~285 and ~430 -- both
  `.schema('matrix_map').from('dras').select(...)`, used for the visibility/health dashboard
  counts. No write.
- `src/app/(dashboard)/admin/matrix-map/publish/page.tsx` line 55 -- `.select('id, title, agency,
  year, public')` for the initial page render. No write.
- No hits for `.update(` combined with `dras` anywhere in `src/` or `scripts/`. No hits for a raw
  `UPDATE ... dras` / `dras SET` string in `scripts/matrix-map/*.py` (the bulk-load / ETL scripts
  for this table only `INSERT`, never touch `public` post-insert).

### Codex review changelog

**Round 1 (2026-07-11, `codex review --base origin/main`):** found a P1 -- the original trigger
design used `current_setting('matrix_map.audited_flip', true)` as its SOLE guard, which is
forgeable by any caller (no privilege required to call `set_config`), so the design did not
actually close the SQL-Editor/`service_role`/future-grant bypass paths it claimed to close. Fixed
in section 2.1/2.3 by requiring `current_user = 'matrix_map_owner'` (unforgeable by non-member
roles) as the primary gate, with the marker retained only as defense-in-depth within that already-
trusted tier. Also found two P2s: section 4 mislabeled write-gated mutation tests as "read-only"
(fixed: split into 4a SELECT-only / 4b write-gated), and section 7 implied generic MCP scope
approval was sufficient authorization to apply an unreviewed final migration SQL (fixed below).

**Round 2 (2026-07-11, re-run after round-1 fixes):** found a P1 -- round 1's fix declared the
trigger function `SECURITY DEFINER`, which makes `current_user` inside it resolve to the
function's OWNER (`matrix_map_owner`) for every invocation, regardless of who actually issued the
`UPDATE` -- silently defeating the just-added `current_user` guard for the exact
future-authenticated-grant threat it exists to close. Fixed in section 2.1 by making the trigger
function `SECURITY INVOKER` (the plpgsql default -- the `SECURITY DEFINER` clause is now
explicitly and intentionally omitted, with an inline comment explaining why removing it is
load-bearing, not an oversight). Also found a P2: section 7's "apply authorization" named the SQL
text but did not separately, explicitly authorize the `apply_migration` tool call itself; fixed by
splitting authorization 2 into 2(i) SQL-text naming and 2(ii) explicit tool-call authorization.

**Round 3 (2026-07-11, re-run after round-2 fixes):** no P1s -- the SECURITY INVOKER fix and the
two-step apply-authorization split both held. Found two P2 wording-consistency nits (stale phrasing
left over from earlier drafts, not new security holes): the opening status block (top of this
document) still described a single owner-approval step instead of mirroring section 7's two-step
gate (fixed), and section 1's "a trigger-based fix ... closes (b) and (c)" line overclaimed coverage
of the SQL-Editor/service_role threats that section 2's own "Honest residual limit" and section 6
already correctly scope as NOT closed (fixed -- narrowed to accurately state the trigger only fully
closes threat (a)).

**Round 4 (2026-07-11, re-run after round-3 fixes, before push):** no P1s. Found one P2: the exact
SQL in section 2.1 omitted the transient `GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner`
that this repo's established owner-transfer pattern (`20260520000004` SECTION 0/6, itself born from
a prior codex P1) requires before any `ALTER FUNCTION ... OWNER TO matrix_map_owner` -- without it,
the `ALTER FUNCTION` statements for both `enforce_dras_public_via_flip` (section 2.1) and the
`flip_dra_public` reissue (section 2.2) would error on the documented SQL-Editor/postgres apply
path. Fixed by adding the matching transient `GRANT`/`REVOKE` bracket (section 2.1's new SECTION 0,
section 2.2's new SECTION 3), mirroring `20260520000004` exactly.

**Round 5 (2026-07-11, re-run after round-4 fix, immediately pre-push):** no P1s. Found one P2:
section 2.2 still only showed a body-diff snippet and referred to "the full existing function
body" by line number rather than including it, so a future agent literally copying "the exact SQL
from sections 2.1-2.2" (per section 7) would install the trigger without actually updating
`flip_dra_public` -- breaking the sanctioned publish RPC on its own first call. Fixed by replacing
section 2.2 with the complete, exact `CREATE OR REPLACE FUNCTION matrix_map.flip_dra_public(...)`
block (full signature, full body, `ALTER FUNCTION OWNER`, `REVOKE`/`GRANT EXECUTE`, `COMMENT`),
copied verbatim from `20260520000004...sql` lines 344-443 with only the two `PERFORM
set_config(...)` lines and the `COMMENT` text changed.

**Honest, explicit statement of what the corrected design does and does not close (this replaces
the original open questions to codex, which are now answered by the redesign):**
- **Closes:** the RLS-policy-documented gap -- any `authenticated`-role admin/matrix_admin session
  (today's actual grant state, and any future migration that broadens the `UPDATE` grant on
  `matrix_map.dras` to `authenticated` or another non-owner role) attempting a direct `UPDATE` on
  `.public` is rejected at the `current_user` check, which it cannot forge.
- **Does NOT close, and cannot be closed by any trigger-based control:** a caller who already
  operates as `current_user = 'matrix_map_owner'` directly (Supabase Studio SQL Editor with a
  connection that can `SET ROLE matrix_map_owner` or a superuser session, or `matrix_map_owner`
  used as a direct login) can forge the `audited_flip` marker (plain `set_config`, no privilege
  needed) or simply `ALTER TABLE ... DISABLE TRIGGER` / `DROP TRIGGER` / redefine the guard
  function -- it already holds the same privilege tier as the trigger's own owner. `ENABLE ALWAYS`
  (section 2.1) additionally closes the narrower, non-superuser `session_replication_role =
  replica` path, but setting that GUC itself requires superuser, so it does not change the
  superuser ceiling above.
- **`pg_dump`/`pg_restore` and logical replication:** out of scope for this design -- those are
  operational/backup paths the owner controls directly (not an application- or SQL-Editor-reachable
  bypass), and Supabase-managed backups are not something this repo's migrations can gate. Flagged
  here for owner awareness, not treated as a gap this trigger needs to close.
- **Multi-statement-transaction window:** section 2.2's explicit `set_config(..., '0', true)` clear
  immediately after the guarded `UPDATE` narrows this to the single statement; combined with the
  `current_user` gate, a non-`matrix_map_owner` caller cannot exploit this window at all, and a
  caller who is already `matrix_map_owner` is back to the residual "same privilege tier" ceiling
  above regardless of window size.
- **No other `src`/`scripts` write path found** beyond what section 6 above already lists (grep
  confirmed clean for `.update(` + `dras` and raw `UPDATE ... dras` strings).

---

## 7. Gate: OWNER-GATED

This is a design document only. **No migration file exists yet; no SQL has been run against the
database.** Two SEPARATE, EXPLICIT owner authorizations are required before any DB write happens
-- generic MCP write scope for `matrix_map` (per `dashboard_supabase_project_scoped_mcp_live.md`)
is necessary but NOT sufficient on its own; it does not pre-authorize this specific operation
(codex round-1 P2 finding: do not let a future agent treat design approval or generic scope
approval as blanket permission to run an unreviewed DB write):

1. **Design approval:** the owner explicitly approves this document (including any redesign from
   a future codex finding on the exact SQL in sections 2.1-2.2).
2. **Apply authorization:** a SEPARATE, explicit owner go-ahead that (i) names the exact final
   migration SQL text to run (post any codex round-2+ changes) AND (ii) explicitly authorizes the
   specific `apply_migration` tool invocation against this project (codex round-2 P2 finding:
   naming the SQL text alone is not sufficient -- the tool call itself needs its own named
   authorization, matching this repo's Supabase-write-gate protocol; document approval is never a
   substitute for that separate tool-call authorization). Approval of the design (step 1) is not
   itself either part of this authorization.

On BOTH authorizations being given, Claude will:
1. Author `supabase/migrations/<approved-timestamp>_matrix_map_flip_dra_public_trigger.sql` with
   the exact, final-reviewed SQL from sections 2.1-2.2.
2. Apply that exact SQL ONLY after authorization 2(ii) explicitly names the `apply_migration` tool
   call, via the project-scoped `/supabase` MCP path (`mcp__supabase-project-scoped__apply_migration`)
   or the owner-pastes-into-SQL-Editor path per this repo's Supabase protocol, using ONLY the
   specific SQL named in authorization 2(i) above -- not a re-derived or re-typed version.
3. Run section 4a's SELECT-only checks immediately, then section 4b's write-gated mutation checks
   ONLY under the same authorization 2 (against a disposable/test DRA, per section 4's note), and
   paste all results back to the owner.
4. Keep the section 5 rollback SQL ready in case of any regression.

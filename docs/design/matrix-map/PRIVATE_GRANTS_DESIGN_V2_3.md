# Private data grants -- design v2 (all 14 codex findings applied)

**Status:** DRAFT v2; codex review of v1 returned YELLOW with 14
findings (3 schema + 4 RLS + 3 audit + 2 UX + 2 missing + 1 sequencing).
ALL 14 disposed per mutual-agreement methodology. Ready for codex
confirmation round before fold into plan v3.

**Supersedes:** `.tmp_private_grants_design_v1.md` (codex YELLOW verdict
preserved at `.tmp_codex_grants_review_response.md` for audit).

## 1. Granularity choice (UNCHANGED from v1)

Per-user per-DRA. Codex CLEARED this in v1 review.

## 2. Schema (codex A-1, A-2, A-3, B-1, C-2, C-3, E-1 applied)

```sql
-- 2.1 GRANTS TABLE
create table matrix_map.private_data_grants (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  user_email       text not null,                 -- denormalized for audit; v1 codex A-3 confirms
  dra_id           uuid not null references matrix_map.dras(id) on delete restrict,
                                                  -- codex A-2 FIX: was 'cascade'; cascade would
                                                  -- destroy audit log if a DRA ever deleted
  granted_by       uuid not null,
  granted_by_email text not null,
  granted_at       timestamptz not null default now(),
  rationale        text not null,
  expires_at       timestamptz,                   -- nullable; null = indefinite
  revoked_at       timestamptz,                   -- soft revoke
  revoked_by       uuid,
  revoke_reason    text
  -- DUA columns DEPRECATED 2026-05-19 per owner decision: "we're not
  -- using DUA in this project". Codex v1 finding E-1 (data use
  -- agreement acceptance pattern) is owner-OVERRIDDEN. The grants
  -- audit trail relies on (granted_by, granted_at, rationale, expires_at)
  -- alone; access policy is governed by matrix_admin discretion not
  -- by a separate data-use-agreement acknowledgement.
);

-- Unique active grant per (user, DRA). codex A-1 NOTE: 'active' means
-- 'not revoked'; expired grants remain by this index but are functionally
-- inactive via the helper's expires_at clause. Re-grant UI updates the
-- prior row (renew) rather than inserting a duplicate -- see admin UI
-- spec section 4 for the "renew vs new" semantics.
create unique index private_grants_active_unique
  on matrix_map.private_data_grants (user_id, dra_id)
  where revoked_at is null;
create index private_grants_user_active
  on matrix_map.private_data_grants (user_id)
  where revoked_at is null;
create index private_grants_dra_active
  on matrix_map.private_data_grants (dra_id)
  where revoked_at is null;

-- 2.2 DRA soft-delete flag (codex A-2 companion)
alter table matrix_map.dras add column is_deleted boolean not null default false;
alter table matrix_map.dras add column deleted_at timestamptz;
alter table matrix_map.dras add column deleted_by uuid;
-- DRA deletion is forbidden by application policy; the soft-delete flag
-- handles the rare retract-from-registry case without breaking FKs.

-- 2.3 DRA visibility audit (codex C-3)
create table matrix_map.dra_visibility_audit (
  id              uuid primary key default gen_random_uuid(),
  dra_id          uuid not null references matrix_map.dras(id) on delete restrict,
  prior_value     boolean not null,
  new_value       boolean not null,
  changed_at      timestamptz not null default now(),
  changed_by      uuid not null,
  changed_by_email text not null,
  reason          text not null
);
create index dra_visibility_audit_dra on matrix_map.dra_visibility_audit (dra_id);

-- Codex v2-round B-1 + B-2 FIX (corrected v2.2 per codex v2.1 finding):
-- trigger pattern removed in favor of an explicit audited RPC. The
-- trigger pattern fails under service-role execution (auth.uid()
-- returns NULL; NOT NULL columns violate) AND depends on session-local
-- GUCs that pooling/serverless cannot guarantee. The RPC takes actor +
-- reason as explicit args and performs the UPDATE + audit INSERT
-- atomically. The RPC body REJECTS service-role contexts (the
-- auth.uid() null check below) -- this is authenticated-user-JWT-only
-- + matrix_admin role-only. ETL pathways that need to flip DRA
-- visibility from service_role would use a separate internal helper
-- with its own audit pattern (not in v1 scope). Direct UPDATE of
-- dras.public is forbidden by RLS (only matrix_admin can UPDATE dras,
-- and the admin UI always calls the RPC).

create or replace function matrix_map.flip_dra_public(
  p_dra_id      uuid,
  p_new_value   boolean,
  p_actor_id    uuid,
  p_actor_email text,
  p_reason      text
)
returns void
language plpgsql
security definer
set search_path = matrix_map, pg_catalog
as $$
declare
  v_prior boolean;
  v_caller_role text;
begin
  -- Codex v2.1-round finding 1 FIX: explicit privilege boundary. SECURITY
  -- DEFINER + EXECUTE to `authenticated` without these checks would let
  -- ANY authenticated user flip any DRA's public flag (privilege
  -- escalation). The three checks below enforce the actual contract:
  -- (1) call must come from a user-JWT context (auth.uid() set), not
  --     service_role; service_role pathways are forbidden from this
  --     function -- ETL has its own internal helpers.
  -- (2) the caller's auth.uid() must match the asserted p_actor_id (no
  --     spoofing a different actor in the audit row).
  -- (3) the caller must hold the matrix_admin role in raw_app_meta_data.
  if auth.uid() is null then
    raise exception 'flip_dra_public must be called from an authenticated user context (auth.uid() is null)';
  end if;
  if auth.uid() <> p_actor_id then
    raise exception 'flip_dra_public actor_id (%) must match caller auth.uid() (%)', p_actor_id, auth.uid();
  end if;
  select coalesce(raw_app_meta_data->>'role', '') into v_caller_role
    from auth.users where id = auth.uid();
  if v_caller_role <> 'matrix_admin' then
    raise exception 'flip_dra_public requires matrix_admin role; caller has %', v_caller_role;
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'flip_dra_public requires a non-empty reason';
  end if;
  if p_actor_email is null then
    raise exception 'flip_dra_public requires actor_email';
  end if;

  select public into v_prior from matrix_map.dras where id = p_dra_id for update;
  if v_prior is null then
    raise exception 'dra % not found', p_dra_id;
  end if;

  if v_prior is distinct from p_new_value then
    update matrix_map.dras set public = p_new_value where id = p_dra_id;
    insert into matrix_map.dra_visibility_audit
      (dra_id, prior_value, new_value, changed_by, changed_by_email, reason)
    values
      (p_dra_id, v_prior, p_new_value, p_actor_id, p_actor_email, p_reason);
  end if;
end;
$$;

alter function matrix_map.flip_dra_public(uuid, boolean, uuid, text, text) owner to matrix_map_owner;
revoke all on function matrix_map.flip_dra_public(uuid, boolean, uuid, text, text) from public;
-- EXECUTE granted to authenticated, but the function body above
-- enforces matrix_admin role + auth.uid() == p_actor_id; non-admin
-- callers fail with explicit exception. Service_role cannot call
-- because auth.uid() is null for service_role connections.
grant execute on function matrix_map.flip_dra_public(uuid, boolean, uuid, text, text) to authenticated;

-- Direct UPDATE on dras.public is forbidden for non-admin via RLS;
-- matrix_admin UPDATEs are policy-allowed but the admin UI always
-- routes through the RPC for atomic audit (DOCUMENTED contract; not
-- enforced by trigger).

-- 2.4 Service-role audit (codex C-2)
create table matrix_map.service_role_audit (
  id              uuid primary key default gen_random_uuid(),
  rpc_name        text not null,
  invoked_at      timestamptz not null default now(),
  invoked_by_role text not null,
  args_summary    jsonb,
  affected_rows   int,
  client_ip       inet,
  notes           text
);
-- Application policy: service_role is NEVER exposed to the frontend;
-- only used in server-side Next.js API routes (ETL, daily-budget cron,
-- export RPCs). Every server-side service_role-keyed call writes a row
-- to this table via a wrapper helper. No direct table access from
-- service_role outside the approved RPC set.
```

## 3. RLS policies (codex B-1, B-3, B-4 applied)

```sql
-- 3.1 SECURITY-DEFINER HELPER (codex B-1 hardening applied)
-- Owned by a non-login schema-owner role; tightened search_path;
-- narrow EXECUTE grant; returns boolean only.
create or replace function matrix_map.has_private_grant(p_dra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = matrix_map, pg_catalog
as $$
  select exists (
    select 1
    from matrix_map.private_data_grants g
    where g.dra_id = p_dra_id
      and g.user_id = auth.uid()
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now())
  );
$$;

-- Ownership + grant policy (run by migration as superuser/owner role):
alter function matrix_map.has_private_grant(uuid) owner to matrix_map_owner;
revoke all on function matrix_map.has_private_grant(uuid) from public;
grant execute on function matrix_map.has_private_grant(uuid) to authenticated;

-- 3.2 SAMPLES RLS (codex B-3: explicit, not auto-cascading)
create policy samples_authenticated_select on matrix_map.samples
for select to authenticated
using (
  matrix_map.is_email_allowlisted(auth.jwt())
  and exists (
    select 1 from matrix_map.dras d
    where d.id = samples.source_dra_id
      and d.is_deleted = false
      and (d.public = true or matrix_map.has_private_grant(d.id))
  )
);

-- 3.3 SAMPLE_EVENTS RLS (codex B-3 explicit cascade)
create policy sample_events_authenticated_select on matrix_map.sample_events
for select to authenticated
using (
  matrix_map.is_email_allowlisted(auth.jwt())
  and exists (
    select 1
    from matrix_map.samples s
    join matrix_map.dras d on d.id = s.source_dra_id
    where s.id = sample_events.sample_id
      and d.is_deleted = false
      and (d.public = true or matrix_map.has_private_grant(d.id))
  )
);

-- 3.4 MEASUREMENTS RLS (codex B-3 explicit cascade)
create policy measurements_authenticated_select on matrix_map.measurements
for select to authenticated
using (
  matrix_map.is_email_allowlisted(auth.jwt())
  and exists (
    select 1
    from matrix_map.sample_events e
    join matrix_map.samples s on s.id = e.sample_id
    join matrix_map.dras d on d.id = s.source_dra_id
    where e.id = measurements.sample_event_id
      and d.is_deleted = false
      and (d.public = true or matrix_map.has_private_grant(d.id))
  )
);

-- 3.5 DRAS RLS (so the DRA row itself is visible to grant holders)
create policy dras_authenticated_select on matrix_map.dras
for select to authenticated
using (
  matrix_map.is_email_allowlisted(auth.jwt())
  and dras.is_deleted = false
  and (dras.public = true or matrix_map.has_private_grant(dras.id))
);

-- 3.6 PRIVATE_DATA_GRANTS RLS (a user can see their own grants;
-- matrix_admin sees all)
create policy grants_self_select on matrix_map.private_data_grants
for select to authenticated
using (user_id = auth.uid());

create policy grants_admin_all on matrix_map.private_data_grants
for all to authenticated
using (
  exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.raw_app_meta_data->>'role' = 'matrix_admin'
  )
);

-- codex B-4 (DOCUMENT): revoke cannot cancel an in-flight query under
-- PostgreSQL MVCC. The design only guarantees subsequent statements
-- see revocation. Operational note: long-running export RPCs should
-- recheck grant status at chunk boundaries; revoke_at + dra_visibility
-- audit timestamps suffice for after-the-fact reconstruction.
```

## 4. Admin UI -- PR-MAP-7 (codex A-3, D-1, D-2, E-1 applied)

Route: `/admin/matrix-map/grants`. matrix_admin role only.

### 4.1 Active grants view (UNCHANGED structure)

Server-side rendered table; filter chips for user/site/DRA/expiry/granted_by.
Per-row actions: revoke (modal with revoke_reason) + extend (date picker).

### 4.2 Grant access form (codex A-1 + A-3 + E-1 applied)

```
Grant private data access

User:        [email autocomplete -- fetched via SERVER-SIDE API route using
              service_role to query auth.users; client NEVER queries
              auth.users directly. Codex A-3 hardening.]

DRAs:        [multi-select from matrix_map.dras WHERE public=false AND is_deleted=false]
             [+] Select all private DRAs for site: [site picker]

Mode:        ( ) Grant new access     ( ) Renew expired/prior grant
             [Auto-detected: this user already has a prior grant for N of
              the selected DRAs. Renew updates the existing row; new
              issues a fresh grant. Codex A-1 fix.]

Rationale:   [required text -- free-form admin note describing why this
              user is being granted access (e.g., "Reviewer assigned to
              Site 8859 quarterly review"). No DUA-acknowledgement
              requirement -- owner override 2026-05-19.]

Expires:     [optional date picker; default = none]

[Grant access]  (creates/renews 1+ rows in one transaction; logs to
                 matrix_map.service_role_audit per codex C-2 pattern)
```

Behavior on submit (codex v2-round B-3 FIX: atomic INSERT ON CONFLICT to
eliminate TOCTOU race when two admins act simultaneously):

```sql
insert into matrix_map.private_data_grants
  (user_id, user_email, dra_id, granted_by, granted_by_email,
   rationale, expires_at)
values (...)
on conflict (user_id, dra_id) where revoked_at is null
do update set
  granted_at = now(),
  granted_by = excluded.granted_by,
  granted_by_email = excluded.granted_by_email,
  rationale = excluded.rationale,
  expires_at = excluded.expires_at;
```

The UPSERT semantics mean:
- New grant: INSERT proceeds.
- Renew of expired-or-active grant: UPDATE in-place (atomic; no race).
- Concurrent admins: PostgreSQL serializes per the unique active-grants
  index; one transaction wins the row lock; second sees its updates.

Admin UI displays mode hint after detect-prior pre-check (cosmetic
"Renew" vs "Grant new" label) but the SQL is the same UPSERT either way.

### 4.3 Revoked history tab + per-user view + per-DRA view (UNCHANGED)

### 4.4 DRA-flip review modal (codex D-2 fix)

When matrix_admin flips a DRA from public=true to public=false, present a
modal showing prior grants for that DRA + asking per-grant: "Re-grant
this user? [yes/no]" + fresh rationale field per yes. NOT one-click bulk
re-grant. Codex D-2: one-click was risky; modal forces deliberate
restoration.

### 4.5 Reviewer-side partial-visibility banner (codex D-1 fix)

NEW: reviewer-facing UX, lands in PR-MAP-3 (codex v2-round C-2 nit:
samples first render in PR-MAP-3 with API contracts; PR-MAP-4 layers
selection on top without changing the banner spec). NOT PR-MAP-7 admin UI.

When a reviewer selects a site or bbox region on the map, the API
returns BOTH visible-sample-count + hidden-sample-count + hidden-DRA-list
(IDs only, no titles for private). A panel banner displays:

```
Site 8859 -- IOCO Shoreline
Visible: 6 samples (3 reference, 3 impacted)
Hidden: 4 samples in 1 private DRA you don't have access to.
[Contact admin to request access] [Learn about DRA confidentiality]
```

The hidden-DRA-list lets the reviewer know access exists to request
without leaking the DRA contents. Banner suppresses if hidden = 0.

## 5. Audit trail (codex C-1 + C-2 + C-3 applied)

### 5.1 `bridge_audit.grants_used` -- IMMUTABLE SNAPSHOT (codex C-1)

When the Calculator bridge fires and the selection includes samples
from granted-private DRAs, the `grants_used` JSONB field captures a
full snapshot per grant:

```json
[
  {
    "grant_id": "uuid",
    "user_id": "uuid",
    "user_email": "twg.reviewer@example.com",
    "dra_id": "uuid",
    "dra_title": "HHERA 17098 (2018)",
    "dra_citation": "Title author year volume...",
    "granted_by": "uuid",
    "granted_by_email": "jasen.nelson@gmail.com",
    "granted_at": "2026-05-19T14:32:00Z",
    "rationale": "TWG reviewer assigned to Site 8859 quarterly review.",
    "expires_at": null,
    "checked_at": "2026-05-19T15:47:12Z"
  },
  ...
]
```

Snapshot is immutable from the bridge token's perspective: even if a
grant is later modified, revoked, or its DRA title changes, the
historical token retains the data as-checked-at the moment of computation.

### 5.2 Service-role audit (codex C-2)

Every server-side API route invoking service_role to access matrix_map
data writes to `matrix_map.service_role_audit` (table 2.4). Approved
RPCs (initial set): ETL migration; daily-budget cron; admin CSV export;
admin user-list fetch (for grant form). Direct table access via
service_role outside these RPCs is forbidden by application policy.

### 5.3 DRA visibility audit (codex C-3)

Trigger on `dras.public` UPDATE writes to
`matrix_map.dra_visibility_audit` (table 2.3) so "who had access on
date X" is always answerable via the join: grants (active during X) +
dra visibility (state during X) + bridge_audit (computations during X).

## 6. Resolved open questions (Q-G1 through Q-G6)

| # | Question | Decision (locked) |
| --- | --- | --- |
| Q-G1 | Default expiry policy | No expiry (admin manually revokes); optional per-grant |
| Q-G2 | Notify user/admin on expiry | Silent v1; email notifications v1.x |
| Q-G3 | Delegation allowed | NO; matrix_admin only |
| Q-G4 | DRA flips false->true | Existing grants stay as audit rows; functionally moot since public=true wins |
| Q-G5 | DRA flips true->false | Codex D-2: review modal (NOT bulk re-grant); per-grant rationale |
| Q-G6 | User deleted from auth.users | Trigger soft-revokes their grants (`revoke_reason='user deleted'`); preserves audit |

## 7. PR sequencing (codex F-1 applied)

| PR | Change vs grants v1 |
| --- | --- |
| PR-MAP-1 | + `private_data_grants` + `dra_visibility_audit` + `service_role_audit` tables + `dras.is_deleted` columns + **`flip_dra_public` RPC** (security definer; matrix_admin-checked internally; atomic UPDATE + audit INSERT; replaces the trigger-based pattern per codex grants-v2.1 finding B-1) + `has_private_grant` helper (security definer hardened) + explicit RLS policies on samples/sample_events/measurements/dras/private_data_grants + **`supabase/seed/matrix_map/grants.yaml` seed-script template for matrix_admin to grant via direct SQL during PR-MAP-1..PR-MAP-7 gap** (codex F-1 fix; matches v3 R-14 scripts-only data-steward pattern) |
| PR-MAP-3 / PR-MAP-4 | + reviewer-side partial-visibility banner (codex D-1; affects sample-fetch API contract: returns both visible-count + hidden-count + hidden-DRA-IDs) |
| PR-MAP-6 | + Calculator bridge token `grants_used` JSONB shape per codex C-1 immutable snapshot |
| **PR-MAP-7 (NEW)** | Admin UI `/admin/matrix-map/grants` with active grants table + grant form (renew-vs-new mode per codex A-1; service-role autocomplete per A-3) + revoked history + per-user view + per-DRA view + **DRA-flip review modal (codex D-2)** + auth.users delete trigger. NOTE: DUA acceptance flow (codex E-1) owner-overridden 2026-05-19 -- not in scope. |

PR-MAP-7 does not gate PR-MAP-2..6. Between PR-MAP-1 and PR-MAP-7, grants
managed via the seed-script + manual SQL by matrix_admin.

## 8. Effort delta vs v3-no-grants

| Phase | v3 hours | v3 + grants v2 hours |
| --- | --- | --- |
| PR-MAP-1 | 8-12 | 10-14 (+2h grants schema + RLS + helper + `flip_dra_public` RPC + service_role_audit + seed-script template) |
| PR-MAP-3 / PR-MAP-4 | unchanged | +1h (partial-visibility banner + API contract update) |
| PR-MAP-6 | 5-7 | 6-8 (+1h grants_used immutable snapshot in bridge_audit) |
| PR-MAP-7 (new) | -- | 5-7 (UI + DRA-flip modal + renew semantics) |
| Owner review (additional) | -- | +1 |
| **Total delta vs v3** | | **+9-11h orchestrator + +1h owner** |

## 9. Regulatory anchor (codex E-2)

Methodology appendix (plan v3 section 5) gets a new item:

> 8. **DRA confidentiality posture anchored in BC EMA s.43.** BC Site
>    Registry is public under EMA s.43; private DRA / NDA material is
>    a separate confidentiality posture. matrix-map defaults all
>    migrated samples to `public=false`; matrix_admin flips per-DRA
>    after explicit review of the source DRA's public-record status.
>    Per-user grants (private_data_grants) allow controlled sharing of
>    private DRA data with TWG reviewers without elevating them to
>    matrix_admin globally.
>    
>    Sources:
>    - https://www2.gov.bc.ca/gov/content/environment/air-land-water/site-remediation/legislation-and-protocols
>    - https://www2.gov.bc.ca/gov/content/environment/air-land-water/site-remediation/site-information
>    - https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/375_96_05

## 10. Test plan additions (codex B-1, B-3, C-1, C-2, C-3 applied)

- Unit: `has_private_grant` security_definer correctness (returns boolean only; cannot leak rows; cannot be called by anonymous role; search_path locked).
- Unit: explicit cascade RLS policies on sample_events + measurements (not auto-cascading).
- Unit: insert-on-conflict semantics (unique active grant constraint).
- Integration: anonymous user blocked from private DRAs.
- Integration: authenticated user without grant blocked from private DRAs.
- Integration: authenticated user WITH grant sees private DRA + cascading samples/events/measurements.
- Integration: revoked grant immediately blocks new statements (MVCC race documented).
- Integration: expired grant immediately blocks (expires_at clause).
- Integration: DRA public flip from false->true makes all users see the DRA regardless of grant.
- Integration: `flip_dra_public` RPC writes `dra_visibility_audit` row atomically with the UPDATE; direct UPDATE on `dras.public` (bypassing the RPC) does NOT auto-create an audit row (this is documented contract behavior, not enforced by trigger per codex grants-v2.1 finding).
- Integration: DRA flip true->false surfaces review modal with prior grants.
- Integration: re-grant of an expired prior grant updates the prior row (not duplicate insert).
- Integration: bridge_audit token captures immutable grants_used snapshot.
- Integration: service_role API routes all log to service_role_audit.
- (DUA test removed -- owner override 2026-05-19; DUA not in project scope.)
- Integration: partial-visibility banner returns correct visible/hidden counts.
- E2E: admin grants access in UI -> non-admin user sees DRA on map within 1 page refresh.
- E2E: admin revokes -> non-admin loses access on next page refresh.
- E2E: admin flips DRA private -> review modal appears -> per-grant rationale.

## 11. Risk update (codex hardening reflected)

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Privilege escalation via `has_private_grant` misconfig | MED | security definer hardening (codex B-1); explicit tests; non-login owner |
| Stale grants accumulating | LOW | Admin UI surfaces all active; v1.x optional expiry default |
| Race on DRA public flip | MED | DRA-flip review modal (codex D-2); `dra_visibility_audit` populated atomically by `flip_dra_public` RPC (codex grants-v2.1 finding) |
| Audit-token stale data after grant mutation | LOW | Immutable snapshot per codex C-1 |
| Service-role direct table access bypasses RLS | MED | Application policy: service_role only via audited RPCs; `service_role_audit` table |
| MVCC race on revoke | LOW | Documented; long-running RPCs recheck at chunk boundaries |
| Reviewer-side surprise at hidden samples | LOW | Partial-visibility banner per codex D-1 |
(DUA risk row removed -- owner override 2026-05-19; DUA not in project scope.)

---

End of grants design v2. Ready for codex confirmation round.

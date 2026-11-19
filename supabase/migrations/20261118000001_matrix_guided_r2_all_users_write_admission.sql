-- Candidate only. No live apply, activation, or Vercel flag change.
-- Expected R3 base plus optional owner-approved all-users admission RPC.
-- Applied migration 20261117003834 remains untouched. PostgreSQL owns the
-- migration transaction; do not add BEGIN or COMMIT to this file.
do $guard$
declare
  v_save text;
  v_complete text;
  v_admission text;
  v_enabled boolean;
begin
  if current_user <> 'postgres' then
    raise exception 'guided R2 write admission requires postgres';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations
    where version = '20261117003834'
      and name = 'matrix_guided_r2_inactive_20261116') <> 1 then
    raise exception 'guided R2 base migration mismatch';
  end if;
  if to_regclass('public.matrix_guided_r2_reviewer_allowlist') is not null then
    raise exception 'guided R2 allowlist policy unexpectedly installed';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.is_matrix_options_paper_admin()')
      and p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
      -- Both hashes are the same reviewed legacy body with LF or CRLF source.
      and md5(p.prosrc) in ('93b33dd6870def48c4e34007c7f6b97f',
        'c4f76e9be72d5de458781bb261edb4f2'))
     or not pg_catalog.has_function_privilege('authenticated',
       'public.is_matrix_options_paper_admin()','EXECUTE')
     or pg_catalog.has_function_privilege('anon',
       'public.is_matrix_options_paper_admin()','EXECUTE')
     or pg_catalog.has_function_privilege('service_role',
       'public.is_matrix_options_paper_admin()','EXECUTE') then
    raise exception 'legacy paper admin helper shape mismatch';
  end if;
  if (select count(*) from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and ((p.tablename = 'matrix_guided_r2_entries'
        and p.policyname = 'matrix_guided_r2_entries_own_read')
        or (p.tablename = 'matrix_guided_r2_completion'
        and p.policyname = 'matrix_guided_r2_completion_own_read'))
      and p.cmd = 'SELECT' and p.permissive = 'PERMISSIVE'
      and p.roles = array['authenticated'::name]
      and p.qual = $qual$((( SELECT auth.uid() AS uid) = user_id) AND (COALESCE(((( SELECT auth.jwt() AS jwt) ->> 'is_anonymous'::text))::boolean, true) = false))$qual$
      and p.with_check is null) <> 2
     or (select count(*) from pg_catalog.pg_policies p
       where p.schemaname = 'public'
         and p.tablename in ('matrix_guided_r2_activation','matrix_guided_r2_targets',
           'matrix_guided_r2_entries','matrix_guided_r2_completion',
           'matrix_guided_r2_events')) <> 2 then
    raise exception 'guided R2 own-read policy shape mismatch';
  end if;
  if (select count(*) from pg_catalog.pg_class c
    where c.oid in (to_regclass('public.matrix_guided_r2_activation'),
      to_regclass('public.matrix_guided_r2_targets'),
      to_regclass('public.matrix_guided_r2_entries'),
      to_regclass('public.matrix_guided_r2_completion'),
      to_regclass('public.matrix_guided_r2_events'))
      and c.relkind = 'r' and c.relrowsecurity) <> 5 then
    raise exception 'guided R2 RLS is not enabled on every table';
  end if;
  if exists (select 1 from pg_catalog.pg_class c
    cross join pg_catalog.pg_roles r
    where c.oid in (to_regclass('public.matrix_guided_r2_activation'),
      to_regclass('public.matrix_guided_r2_targets'),
      to_regclass('public.matrix_guided_r2_entries'),
      to_regclass('public.matrix_guided_r2_completion'),
      to_regclass('public.matrix_guided_r2_events'))
      and r.rolname in ('anon','authenticated','service_role')
      and (pg_catalog.has_any_column_privilege(r.rolname,c.oid,'INSERT')
        or pg_catalog.has_any_column_privilege(r.rolname,c.oid,'UPDATE')
        or pg_catalog.has_table_privilege(r.rolname,c.oid,'DELETE')
        or pg_catalog.has_table_privilege(r.rolname,c.oid,'TRUNCATE')))
     or not pg_catalog.has_table_privilege('authenticated','public.matrix_guided_r2_entries','SELECT')
     or not pg_catalog.has_table_privilege('authenticated','public.matrix_guided_r2_completion','SELECT')
     or pg_catalog.has_any_column_privilege('anon','public.matrix_guided_r2_entries','SELECT')
     or pg_catalog.has_any_column_privilege('anon','public.matrix_guided_r2_completion','SELECT')
     or pg_catalog.has_any_column_privilege('service_role','public.matrix_guided_r2_entries','SELECT')
     or pg_catalog.has_any_column_privilege('service_role','public.matrix_guided_r2_completion','SELECT')
     or exists (select 1 from pg_catalog.pg_class c
       cross join pg_catalog.pg_roles r
       where c.oid in (to_regclass('public.matrix_guided_r2_activation'),
         to_regclass('public.matrix_guided_r2_targets'),
         to_regclass('public.matrix_guided_r2_events'))
         and r.rolname in ('anon','authenticated','service_role')
         and pg_catalog.has_any_column_privilege(r.rolname,c.oid,'SELECT')) then
    raise exception 'guided R2 table ACL mismatch';
  end if;
  if not exists (select 1 from pg_catalog.pg_attribute
    where attrelid = to_regclass('auth.users') and attname = 'deleted_at'
      and not attisdropped) then
    raise exception 'auth.users live-user marker missing';
  end if;
  select enabled into strict v_enabled from public.matrix_guided_r2_activation
    where document_version = 'phase2-review-2026-11-fa356b89'
      and guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576'
      and review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e'
    for share;
  if v_enabled is distinct from false then
    raise exception 'guided R2 activation not exactly disabled';
  end if;
  select md5(p.prosrc) into v_save from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)')
      and p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres';
  select md5(p.prosrc) into v_complete from pg_catalog.pg_proc p
    where p.oid = to_regprocedure('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)')
      and p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres';
  if v_save is null or v_complete is null
     or v_save not in ('0c2e65fb4dbc72f1a98151faad8d1c87','8912fed3fde21f16eca1f5bdbd702105')
     or v_complete not in ('6e660ad6c702e4c1e71dd5a0afe9e4dc','ccf9ac1dbe1ece61d1e4f9af5ec187cd') then
    raise exception 'guided R2 write RPC source differs from reviewed R3 baseline';
  end if;
  if to_regprocedure('public.matrix_guided_r2_reviewer_allowed(text,text,text)') is not null then
    select md5(p.prosrc) into v_admission from pg_catalog.pg_proc p
      where p.oid = to_regprocedure('public.matrix_guided_r2_reviewer_allowed(text,text,text)')
        and p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres';
    if v_admission is null
       or v_admission not in ('99b1fdde9f4e20e9ddb7f20baa98db2f','fefd94f2c4ff96ea55b98ec321a51255') then
      raise exception 'guided R2 admission RPC differs from approved all-users body';
    end if;
  end if;
  if exists (select 1 from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
    where p.oid in (
      to_regprocedure('public.matrix_guided_r2_reviewer_allowed(text,text,text)'),
      to_regprocedure('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)'),
      to_regprocedure('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)'))
      and a.privilege_type = 'EXECUTE'
      and (a.grantee not in (p.proowner,'authenticated'::regrole)
        or (a.grantee = 'authenticated'::regrole and a.is_grantable))) then
    raise exception 'guided R2 function ACL drift';
  end if;
end;
$guard$;

-- Add only authenticated administrator reads to the two review-state tables.
-- The existing own-read policies and all table grants remain unchanged.
create policy matrix_guided_r2_entries_admin_read on public.matrix_guided_r2_entries
  for select to authenticated
  using (coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false
    and (select public.is_matrix_options_paper_admin()));
create policy matrix_guided_r2_completion_admin_read on public.matrix_guided_r2_completion
  for select to authenticated
  using (coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false
    and (select public.is_matrix_options_paper_admin()));

create or replace function public.matrix_guided_r2_reviewer_allowed(
  p_document_version text, p_guided_manifest_sha256 text,
  p_review_manifest_sha256 text
) returns boolean
language plpgsql stable security definer
set search_path = pg_catalog
as $function$
declare
  v_user uuid;
  v_claims jsonb;
begin
  if p_document_version is distinct from 'phase2-review-2026-11-fa356b89'
     or p_guided_manifest_sha256 is distinct from '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576'
     or p_review_manifest_sha256 is distinct from 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e' then
    return false;
  end if;

  -- auth.uid() can throw on a malformed UUID claim; auth.jwt() can throw on
  -- malformed JSON. Other failures propagate to the caller.
  begin
    v_user := auth.uid();
    v_claims := auth.jwt();
  exception when invalid_text_representation then
    return false;
  end;
  if v_user is null or v_claims is null
     or pg_catalog.jsonb_typeof(v_claims) <> 'object'
     or v_claims -> 'is_anonymous' is distinct from 'false'::jsonb
     or v_claims ->> 'sub' is distinct from v_user::text then
    return false;
  end if;

  return exists (
    select 1 from auth.users u
    where u.id = v_user and u.deleted_at is null
  ) and exists (
    select 1 from public.matrix_guided_r2_activation a
    where a.document_version = p_document_version
      and a.guided_manifest_sha256 = p_guided_manifest_sha256
      and a.review_manifest_sha256 = p_review_manifest_sha256
  );
end;
$function$;
revoke all on function public.matrix_guided_r2_reviewer_allowed(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.matrix_guided_r2_reviewer_allowed(text,text,text)
  to authenticated;

-- The direct table read path must enforce the same live-user admission as the
-- app route. Ownership alone does not revoke an unexpired deleted-user JWT.
alter policy matrix_guided_r2_entries_own_read on public.matrix_guided_r2_entries
  using ((select auth.uid()) = user_id
    and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false
    and (select public.matrix_guided_r2_reviewer_allowed(
      document_version,guided_manifest_sha256,review_manifest_sha256)));
alter policy matrix_guided_r2_completion_own_read on public.matrix_guided_r2_completion
  using ((select auth.uid()) = user_id
    and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false
    and (select public.matrix_guided_r2_reviewer_allowed(
      document_version,guided_manifest_sha256,review_manifest_sha256)));

create or replace function public.matrix_guided_r2_save(
  p_document_version text,p_guided_manifest_sha256 text,p_review_manifest_sha256 text,
  p_target_kind text,p_target_id text,p_choice_id text,p_rationale text,p_text text,
  p_expected_revision bigint,p_expected_user_id uuid
) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public, auth, extensions as $$
declare v_active boolean;
declare v_user uuid;
declare v_options text[];
declare v_entry public.matrix_guided_r2_entries%rowtype;
declare v_choice text;
declare v_rationale text;
declare v_text text;
declare v_units integer;
declare v_digest text;
begin
  -- First operation: the DB barrier precedes auth, locks, rate checks and all writes.
  select enabled into v_active from public.matrix_guided_r2_activation
  where document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256;
  if v_active is distinct from true then return jsonb_build_object('outcome','release_read_only'); end if;
  -- A true row is locked and rechecked so a kill-switch UPDATE cannot finish
  -- before an already admitted write commits. The disabled path takes no lock.
  select enabled into v_active from public.matrix_guided_r2_activation
  where document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256 for share;
  if v_active is distinct from true then return jsonb_build_object('outcome','release_read_only'); end if;

  v_user := auth.uid();
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then return jsonb_build_object('outcome','unauthenticated'); end if;
  if public.matrix_guided_r2_reviewer_allowed(
    p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256) is distinct from true then
    return jsonb_build_object('outcome','reviewer_not_allowed');
  end if;
  -- Hold the live user row through the write transaction. A concurrent
  -- delete or deleted_at update must finish before admission or wait for it.
  perform 1 from auth.users u where u.id = v_user and u.deleted_at is null for share of u;
  if not found then return jsonb_build_object('outcome','reviewer_not_allowed'); end if;
  if p_expected_user_id is distinct from v_user then return jsonb_build_object('outcome','identity_changed'); end if;
  if p_expected_revision is null or p_expected_revision < 0 then return jsonb_build_object('outcome','invalid_payload'); end if;
  select option_ids into v_options from public.matrix_guided_r2_targets
  where document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256 and target_kind = p_target_kind and target_id = p_target_id;
  if not found then return jsonb_build_object('outcome','unknown_target'); end if;
  if (p_target_kind = 'choice-prompt' and (p_text is not null or (p_choice_id is not null and not p_choice_id = any(v_options))))
    or (p_target_kind <> 'choice-prompt' and (p_choice_id is not null or p_rationale is not null)) then
    return jsonb_build_object('outcome','invalid_choice');
  end if;
  v_units := coalesce(public.matrix_guided_r2_utf16_units(p_rationale),0) + coalesce(public.matrix_guided_r2_utf16_units(p_text),0);
  if coalesce(public.matrix_guided_r2_utf16_units(p_rationale),0) > 20000 or coalesce(public.matrix_guided_r2_utf16_units(p_text),0) > 20000 then
    return jsonb_build_object('outcome','too_large');
  end if;
  v_choice := p_choice_id;
  v_rationale := case when p_rationale is null or btrim(p_rationale) = '' then null else p_rationale end;
  v_text := case when p_text is null or btrim(p_text) = '' then null else p_text end;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text || ':' || p_document_version));
  if (select count(*) from public.matrix_guided_r2_events
      where user_id = v_user and occurred_at >= clock_timestamp() - interval '1 minute') >= 24 then
    return jsonb_build_object('outcome','rate_limited');
  end if;
  select * into v_entry from public.matrix_guided_r2_entries
  where user_id = v_user and document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256 and target_kind = p_target_kind and target_id = p_target_id for update;
  if found then
    if v_entry.revision <> p_expected_revision then return jsonb_build_object('outcome','stale_revision'); end if;
    update public.matrix_guided_r2_entries set revision = revision + 1,
      draft_choice_id = v_choice,draft_rationale = v_rationale,draft_text = v_text,updated_at = clock_timestamp()
    where user_id = v_user and document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
      and review_manifest_sha256 = p_review_manifest_sha256 and target_kind = p_target_kind and target_id = p_target_id
    returning * into v_entry;
  else
    if p_expected_revision <> 0 then return jsonb_build_object('outcome','stale_revision'); end if;
    insert into public.matrix_guided_r2_entries
      (user_id,document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id,revision,draft_choice_id,draft_rationale,draft_text)
    values (v_user,p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256,p_target_kind,p_target_id,1,v_choice,v_rationale,v_text)
    returning * into v_entry;
  end if;
  v_digest := encode(extensions.digest(convert_to(
    public.matrix_guided_r2_field_hash(v_choice) || ':' || public.matrix_guided_r2_field_hash(v_rationale) || ':' || public.matrix_guided_r2_field_hash(v_text),
    'UTF8'),'sha256'),'hex');
  insert into public.matrix_guided_r2_events
    (user_id,document_version,guided_manifest_sha256,review_manifest_sha256,event_kind,target_kind,target_id,revision,payload_digest,payload_utf16_units)
  values (v_user,p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256,'save',p_target_kind,p_target_id,v_entry.revision,v_digest,v_units);
  return jsonb_build_object('outcome','ok','row',to_jsonb(v_entry));
end;
$$;

create or replace function public.matrix_guided_r2_complete(
  p_document_version text,p_guided_manifest_sha256 text,p_review_manifest_sha256 text,
  p_expected_user_id uuid,p_expected_completion_revision bigint,p_draft_set_digest text
) returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public, auth, extensions as $$
declare v_active boolean;
declare v_user uuid;
declare v_current_digest text;
declare v_completion public.matrix_guided_r2_completion%rowtype;
declare v_entries jsonb;
declare v_revision bigint;
begin
  -- First operation: disabled activation exits without a lock, rate check or write.
  select enabled into v_active from public.matrix_guided_r2_activation
  where document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256;
  if v_active is distinct from true then return jsonb_build_object('outcome','release_read_only'); end if;
  -- Serialize admitted completion with the exact kill-switch row update.
  select enabled into v_active from public.matrix_guided_r2_activation
  where document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256 for share;
  if v_active is distinct from true then return jsonb_build_object('outcome','release_read_only'); end if;

  v_user := auth.uid();
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then return jsonb_build_object('outcome','unauthenticated'); end if;
  if public.matrix_guided_r2_reviewer_allowed(
    p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256) is distinct from true then
    return jsonb_build_object('outcome','reviewer_not_allowed');
  end if;
  -- Hold the live user row through the write transaction. A concurrent
  -- delete or deleted_at update must finish before admission or wait for it.
  perform 1 from auth.users u where u.id = v_user and u.deleted_at is null for share of u;
  if not found then return jsonb_build_object('outcome','reviewer_not_allowed'); end if;
  if p_expected_user_id is distinct from v_user then return jsonb_build_object('outcome','identity_changed'); end if;
  if p_expected_completion_revision is null or p_expected_completion_revision < 0 or p_draft_set_digest is null or p_draft_set_digest !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('outcome','invalid_payload');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_user::text || ':' || p_document_version));
  if (select count(*) from public.matrix_guided_r2_events
      where user_id = v_user and occurred_at >= clock_timestamp() - interval '1 minute') >= 24 then
    return jsonb_build_object('outcome','rate_limited');
  end if;
  -- The shared advisory lock serializes both RPCs for this user and release.
  perform 1 from public.matrix_guided_r2_entries where user_id = v_user and document_version = p_document_version
    and guided_manifest_sha256 = p_guided_manifest_sha256 and review_manifest_sha256 = p_review_manifest_sha256 for update;
  v_current_digest := public.matrix_guided_r2_draft_set_digest(v_user,p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256);
  if v_current_digest <> p_draft_set_digest then return jsonb_build_object('outcome','draft_set_changed'); end if;
  select * into v_completion from public.matrix_guided_r2_completion
  where user_id = v_user and document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256 for update;
  if found and v_completion.submitted_set_digest = v_current_digest then
    select coalesce(jsonb_agg(to_jsonb(e) order by e.target_kind,e.target_id),'[]'::jsonb) into v_entries
    from public.matrix_guided_r2_entries e where e.user_id = v_user and e.document_version = p_document_version
      and e.guided_manifest_sha256 = p_guided_manifest_sha256 and e.review_manifest_sha256 = p_review_manifest_sha256;
    return jsonb_build_object('outcome','noop_already_completed','completion',to_jsonb(v_completion),'entries',v_entries);
  end if;
  if (found and v_completion.revision <> p_expected_completion_revision) or (not found and p_expected_completion_revision <> 0) then
    return jsonb_build_object('outcome','stale_revision');
  end if;
  update public.matrix_guided_r2_entries set
    submitted_choice_id = case when draft_choice_id is not null or draft_rationale is not null or draft_text is not null then draft_choice_id else null end,
    submitted_rationale = case when draft_choice_id is not null or draft_rationale is not null or draft_text is not null then draft_rationale else null end,
    submitted_text = case when draft_choice_id is not null or draft_rationale is not null or draft_text is not null then draft_text else null end,
    submitted_revision = case when draft_choice_id is not null or draft_rationale is not null or draft_text is not null then revision else null end,
    submitted_at = case when draft_choice_id is not null or draft_rationale is not null or draft_text is not null then clock_timestamp() else null end
  where user_id = v_user and document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256;
  v_revision := coalesce(v_completion.revision,0) + 1;
  insert into public.matrix_guided_r2_completion
    (user_id,document_version,guided_manifest_sha256,review_manifest_sha256,revision,submitted_set_digest,submitted_at)
  values (v_user,p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256,v_revision,v_current_digest,clock_timestamp())
  on conflict (user_id,document_version,guided_manifest_sha256,review_manifest_sha256)
  do update set revision = excluded.revision,submitted_set_digest = excluded.submitted_set_digest,submitted_at = excluded.submitted_at
  returning * into v_completion;
  insert into public.matrix_guided_r2_events
    (user_id,document_version,guided_manifest_sha256,review_manifest_sha256,event_kind,revision,payload_digest,payload_utf16_units)
  values (v_user,p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256,'complete',v_revision,v_current_digest,0);
  select coalesce(jsonb_agg(to_jsonb(e) order by e.target_kind,e.target_id),'[]'::jsonb) into v_entries
  from public.matrix_guided_r2_entries e where e.user_id = v_user and e.document_version = p_document_version
    and e.guided_manifest_sha256 = p_guided_manifest_sha256 and e.review_manifest_sha256 = p_review_manifest_sha256;
  return jsonb_build_object('outcome','ok','completion',to_jsonb(v_completion),'entries',v_entries);
end;
$$;

revoke all on function public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid),
  public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)
  from public, anon, authenticated, service_role;
grant execute on function public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid),
  public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text) to authenticated;

do $assert$
begin
  if (select count(*) from public.matrix_guided_r2_activation
    where document_version = 'phase2-review-2026-11-fa356b89'
      and guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576'
      and review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e'
      and enabled = false) <> 1
     or (select count(*) from pg_catalog.pg_class c
       where c.oid in (to_regclass('public.matrix_guided_r2_activation'),
         to_regclass('public.matrix_guided_r2_targets'),
         to_regclass('public.matrix_guided_r2_entries'),
         to_regclass('public.matrix_guided_r2_completion'),
         to_regclass('public.matrix_guided_r2_events'))
         and c.relkind = 'r' and c.relrowsecurity) <> 5
     or (select count(*) from pg_catalog.pg_policies p
       where p.schemaname = 'public'
         and p.tablename in ('matrix_guided_r2_activation','matrix_guided_r2_targets',
           'matrix_guided_r2_entries','matrix_guided_r2_completion',
           'matrix_guided_r2_events')) <> 4
     or (select count(*) from pg_catalog.pg_policies p
       where p.schemaname = 'public'
         and ((p.tablename = 'matrix_guided_r2_entries'
           and p.policyname = 'matrix_guided_r2_entries_admin_read')
           or (p.tablename = 'matrix_guided_r2_completion'
           and p.policyname = 'matrix_guided_r2_completion_admin_read'))
         and p.cmd = 'SELECT' and p.permissive = 'PERMISSIVE'
         and p.roles = array['authenticated'::name]
         and p.qual like '%is_matrix_options_paper_admin()%') <> 2
     or not exists (select 1 from pg_catalog.pg_proc p
       where p.oid = to_regprocedure('public.is_matrix_options_paper_admin()')
         and p.prosecdef and pg_catalog.pg_get_userbyid(p.proowner) = 'postgres'
         and md5(p.prosrc) in ('93b33dd6870def48c4e34007c7f6b97f',
           'c4f76e9be72d5de458781bb261edb4f2'))
     or not has_function_privilege('authenticated','public.matrix_guided_r2_reviewer_allowed(text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE')
     or has_function_privilege('anon','public.matrix_guided_r2_reviewer_allowed(text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE')
     or has_function_privilege('anon','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE')
     or has_function_privilege('public','public.matrix_guided_r2_reviewer_allowed(text,text,text)','EXECUTE')
     or has_function_privilege('public','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE')
     or has_function_privilege('public','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE')
     or has_function_privilege('service_role','public.matrix_guided_r2_reviewer_allowed(text,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE')
     or exists (select 1 from pg_catalog.pg_proc p
       cross join lateral pg_catalog.aclexplode(
         coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
       where p.oid in (
         to_regprocedure('public.matrix_guided_r2_reviewer_allowed(text,text,text)'),
         to_regprocedure('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)'),
         to_regprocedure('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)'))
         and a.privilege_type = 'EXECUTE'
         and (a.grantee not in (p.proowner,'authenticated'::regrole)
           or (a.grantee = 'authenticated'::regrole and a.is_grantable))) then
    raise exception 'guided R2 write admission postcondition failed';
  end if;
end;
$assert$;

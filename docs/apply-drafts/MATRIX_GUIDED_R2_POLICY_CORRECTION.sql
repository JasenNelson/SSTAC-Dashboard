-- Candidate only: no provider call without exact review and owner approval.
-- Additive correction for installed matrix_guided_r2_inactive_20261116.
-- Project qyrhsieynzfgyuqzznap. No roster seed or activation change.
-- apply_migration owns the transaction; no outer BEGIN or COMMIT.

do $$
begin
  if current_user <> 'postgres' then raise exception 'guided R2 policy correction requires postgres'; end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'deleted_at') then
    raise exception 'auth.users deleted_at marker unavailable';
  end if;
  if (select count(*) from public.matrix_guided_r2_activation
      where document_version = 'phase2-review-2026-11-fa356b89'
        and guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576'
        and review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e'
        and enabled = false) <> 1 then
    raise exception 'guided R2 activation identity is not exactly disabled';
  end if;
  if to_regclass('public.matrix_guided_r2_reviewer_allowlist') is not null
    or to_regprocedure('public.matrix_guided_r2_reviewer_allowed(text,text,text)') is not null then
    raise exception 'guided R2 policy correction already present';
  end if;
  if exists (select 1 from public.matrix_guided_r2_entries e
    left join auth.users u on u.id = e.user_id where u.id is null)
    or exists (select 1 from public.matrix_guided_r2_completion c
      left join auth.users u on u.id = c.user_id where u.id is null)
    or exists (select 1 from public.matrix_guided_r2_events v
      left join auth.users u on u.id = v.user_id where u.id is null) then
    raise exception 'orphan guided user row';
  end if;
end $$;

create table public.matrix_guided_r2_reviewer_allowlist (
  document_version text not null,
  guided_manifest_sha256 text not null,
  review_manifest_sha256 text not null,
  user_id uuid not null,
  granted_at timestamptz not null default clock_timestamp(),
  approval_receipt_sha256 text not null check (approval_receipt_sha256 ~ '^[a-f0-9]{64}$'),
  primary key (document_version,guided_manifest_sha256,review_manifest_sha256,user_id),
  constraint matrix_guided_r2_reviewer_allowlist_release_fk
    foreign key (document_version,guided_manifest_sha256,review_manifest_sha256)
    references public.matrix_guided_r2_activation (document_version,guided_manifest_sha256,review_manifest_sha256),
  constraint matrix_guided_r2_reviewer_allowlist_user_fk
    foreign key (user_id) references auth.users(id) on delete cascade
);
alter table public.matrix_guided_r2_reviewer_allowlist enable row level security;
revoke all on table public.matrix_guided_r2_reviewer_allowlist from public, anon, authenticated, service_role;

alter table public.matrix_guided_r2_entries
  add constraint matrix_guided_r2_entries_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.matrix_guided_r2_completion
  add constraint matrix_guided_r2_completion_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.matrix_guided_r2_events
  add constraint matrix_guided_r2_events_user_fk
  foreign key (user_id) references auth.users(id) on delete cascade not valid;
alter table public.matrix_guided_r2_entries validate constraint matrix_guided_r2_entries_user_fk;
alter table public.matrix_guided_r2_completion validate constraint matrix_guided_r2_completion_user_fk;
alter table public.matrix_guided_r2_events validate constraint matrix_guided_r2_events_user_fk;

create function public.matrix_guided_r2_reviewer_allowed(
  p_document_version text,p_guided_manifest_sha256 text,p_review_manifest_sha256 text
) returns boolean
language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
declare v_user uuid;
begin
  v_user := auth.uid();
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then return false; end if;
  return exists (
    select 1 from public.matrix_guided_r2_reviewer_allowlist a
    join auth.users u on u.id = a.user_id
    where a.user_id = v_user and u.deleted_at is null
      and a.document_version = p_document_version
      and a.guided_manifest_sha256 = p_guided_manifest_sha256
      and a.review_manifest_sha256 = p_review_manifest_sha256
  );
end;
$$;
revoke all on function public.matrix_guided_r2_reviewer_allowed(text,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.matrix_guided_r2_reviewer_allowed(text,text,text) to authenticated;

-- Cascaded DELETE must be allowed; ordinary UPDATE remains immutable.
drop trigger matrix_guided_r2_events_append_only_trigger on public.matrix_guided_r2_events;
create trigger matrix_guided_r2_events_append_only_trigger before update on public.matrix_guided_r2_events
for each row execute function public.matrix_guided_r2_events_append_only();

alter policy matrix_guided_r2_entries_own_read on public.matrix_guided_r2_entries
  using ((select auth.uid()) = user_id
    and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false
    and (select public.matrix_guided_r2_reviewer_allowed(document_version,guided_manifest_sha256,review_manifest_sha256)));
alter policy matrix_guided_r2_completion_own_read on public.matrix_guided_r2_completion
  using ((select auth.uid()) = user_id
    and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false
    and (select public.matrix_guided_r2_reviewer_allowed(document_version,guided_manifest_sha256,review_manifest_sha256)));

-- The following two CREATE OR REPLACE definitions are copied from the installed
-- R3 SQL, with only the release-specific, live-user admission block added.
-- Both retain the activation=false early return before auth or any write.
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
  perform 1 from public.matrix_guided_r2_reviewer_allowlist a
  join auth.users u on u.id = a.user_id
  where a.user_id = v_user and u.deleted_at is null
    and a.document_version = p_document_version
    and a.guided_manifest_sha256 = p_guided_manifest_sha256
    and a.review_manifest_sha256 = p_review_manifest_sha256
  for share of a,u;
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
  perform 1 from public.matrix_guided_r2_reviewer_allowlist a
  join auth.users u on u.id = a.user_id
  where a.user_id = v_user and u.deleted_at is null
    and a.document_version = p_document_version
    and a.guided_manifest_sha256 = p_guided_manifest_sha256
    and a.review_manifest_sha256 = p_review_manifest_sha256
  for share of a,u;
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

-- Explicitly retain no runtime direct DELETE grants on guided user data.
revoke delete on public.matrix_guided_r2_entries, public.matrix_guided_r2_completion,
  public.matrix_guided_r2_events from public, anon, authenticated, service_role;

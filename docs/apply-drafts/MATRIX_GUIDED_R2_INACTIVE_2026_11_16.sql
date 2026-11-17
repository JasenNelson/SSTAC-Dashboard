-- Candidate only. Do not apply without the separate exact SQL and route approval.
-- R2 release: phase2-review-2026-11-fa356b89
-- Paper SHA-256: fa356b89f2a80d783a39ef70b8f99b79794c5c5377e3b80567a1b23c624edda2
-- Legacy R2 review SHA-256: da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e
-- Guided SHA-256: 25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576
-- Requires pgcrypto in extensions; preflight verifies this catalog fact.

do $$ begin
  if current_user <> 'postgres' then raise exception 'guided R2 migration requires postgres'; end if;
  if to_regprocedure('extensions.digest(bytea,text)') is null then raise exception 'pgcrypto digest is unavailable in extensions'; end if;
  if to_regclass('public.matrix_guided_r2_targets') is not null
    or to_regclass('public.matrix_guided_r2_activation') is not null
    or to_regclass('public.matrix_guided_r2_entries') is not null
    or to_regclass('public.matrix_guided_r2_completion') is not null
    or to_regclass('public.matrix_guided_r2_events') is not null then
    raise exception 'guided R2 schema already exists';
  end if;
end $$;

create table public.matrix_guided_r2_targets (
  document_version text not null,
  guided_manifest_sha256 text not null,
  review_manifest_sha256 text not null,
  target_kind text not null check (target_kind in ('choice-prompt','text-prompt','section-comment','whole-paper-comment')),
  target_id text not null,
  option_ids text[] not null default '{}',
  primary key (document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id),
  check (guided_manifest_sha256 ~ '^[a-f0-9]{64}$' and review_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  check ((target_kind = 'choice-prompt' and cardinality(option_ids) > 0) or (target_kind <> 'choice-prompt' and cardinality(option_ids) = 0))
);

create table public.matrix_guided_r2_activation (
  document_version text not null,
  guided_manifest_sha256 text not null,
  review_manifest_sha256 text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (document_version,guided_manifest_sha256,review_manifest_sha256),
  check (guided_manifest_sha256 ~ '^[a-f0-9]{64}$' and review_manifest_sha256 ~ '^[a-f0-9]{64}$')
);

create table public.matrix_guided_r2_entries (
  user_id uuid not null,
  document_version text not null,
  guided_manifest_sha256 text not null,
  review_manifest_sha256 text not null,
  target_kind text not null,
  target_id text not null,
  revision bigint not null default 0 check (revision >= 0),
  draft_choice_id text,
  draft_rationale text,
  draft_text text,
  submitted_choice_id text,
  submitted_rationale text,
  submitted_text text,
  submitted_revision bigint check (submitted_revision >= 0),
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id),
  foreign key (document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id)
    references public.matrix_guided_r2_targets (document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id),
  check (target_kind = 'choice-prompt' or (draft_choice_id is null and draft_rationale is null and submitted_choice_id is null and submitted_rationale is null)),
  check (target_kind <> 'choice-prompt' or (draft_text is null and submitted_text is null)),
  check ((submitted_revision is null and submitted_at is null) or (submitted_revision is not null and submitted_at is not null))
);

create table public.matrix_guided_r2_completion (
  user_id uuid not null,
  document_version text not null,
  guided_manifest_sha256 text not null,
  review_manifest_sha256 text not null,
  revision bigint not null check (revision > 0),
  submitted_set_digest text not null check (submitted_set_digest ~ '^[a-f0-9]{64}$'),
  submitted_at timestamptz not null,
  primary key (user_id,document_version,guided_manifest_sha256,review_manifest_sha256),
  foreign key (document_version,guided_manifest_sha256,review_manifest_sha256)
    references public.matrix_guided_r2_activation (document_version,guided_manifest_sha256,review_manifest_sha256)
);

create table public.matrix_guided_r2_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  document_version text not null,
  guided_manifest_sha256 text not null,
  review_manifest_sha256 text not null,
  event_kind text not null check (event_kind in ('save','complete')),
  target_kind text,
  target_id text,
  revision bigint not null check (revision > 0),
  payload_digest text not null check (payload_digest ~ '^[a-f0-9]{64}$'),
  payload_utf16_units integer not null check (payload_utf16_units >= 0),
  occurred_at timestamptz not null default clock_timestamp(),
  foreign key (document_version,guided_manifest_sha256,review_manifest_sha256)
    references public.matrix_guided_r2_activation (document_version,guided_manifest_sha256,review_manifest_sha256),
  check ((event_kind = 'save' and target_kind is not null and target_id is not null) or
         (event_kind = 'complete' and target_kind is null and target_id is null))
);

create index matrix_guided_r2_events_user_time_idx on public.matrix_guided_r2_events (user_id,occurred_at);
create index matrix_guided_r2_events_release_idx on public.matrix_guided_r2_events (document_version,guided_manifest_sha256,review_manifest_sha256);
create index matrix_guided_r2_entries_target_fk_idx on public.matrix_guided_r2_entries (document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id);
create index matrix_guided_r2_completion_activation_fk_idx on public.matrix_guided_r2_completion (document_version,guided_manifest_sha256,review_manifest_sha256);

alter table public.matrix_guided_r2_targets enable row level security;
alter table public.matrix_guided_r2_activation enable row level security;
alter table public.matrix_guided_r2_entries enable row level security;
alter table public.matrix_guided_r2_completion enable row level security;
alter table public.matrix_guided_r2_events enable row level security;

create policy matrix_guided_r2_entries_own_read on public.matrix_guided_r2_entries for select to authenticated
  using ((select auth.uid()) = user_id and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false);
create policy matrix_guided_r2_completion_own_read on public.matrix_guided_r2_completion for select to authenticated
  using ((select auth.uid()) = user_id and coalesce(((select auth.jwt())->>'is_anonymous')::boolean,true) = false);

revoke all on table public.matrix_guided_r2_targets, public.matrix_guided_r2_activation,
  public.matrix_guided_r2_entries, public.matrix_guided_r2_completion, public.matrix_guided_r2_events
  from public, anon, authenticated, service_role;
grant select on public.matrix_guided_r2_entries, public.matrix_guided_r2_completion to authenticated;

insert into public.matrix_guided_r2_targets (document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id,option_ids)
values
  ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e','choice-prompt','structure-approach',array['sound','refine','unsure']),
  ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e','text-prompt','site-assignment','{}'),
  ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e','choice-prompt','human-approach',array['sound','refine','unsure']),
  ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e','text-prompt','ecological-approach','{}'),
  ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e','choice-prompt','common-rules',array['yes','refine','unsure']),
  ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e','text-prompt','work-sequence','{}');

insert into public.matrix_guided_r2_targets (document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id,option_ids)
select 'phase2-review-2026-11-fa356b89', '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576',
  'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e', 'section-comment', anchor, '{}'
from unnest(array[
  'sec-phase2-about-this-paper','sec-phase2-acknowledgements','sec-phase2-1','sec-phase2-2',
  'sec-phase2-3','sec-phase2-4','sec-phase2-5','sec-phase2-6','sec-phase2-6-1',
  'sec-phase2-6-2','sec-phase2-6-3','sec-phase2-6-4','sec-phase2-7','sec-phase2-8',
  'sec-phase2-9','sec-phase2-references'
]) as anchor;

insert into public.matrix_guided_r2_targets (document_version,guided_manifest_sha256,review_manifest_sha256,target_kind,target_id,option_ids)
values ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e','whole-paper-comment','whole-paper','{}');

insert into public.matrix_guided_r2_activation (document_version,guided_manifest_sha256,review_manifest_sha256,enabled)
values ('phase2-review-2026-11-fa356b89','25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576','da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e',false);

create function public.matrix_guided_r2_utf16_units(p_value text) returns integer
language sql immutable strict set search_path = pg_catalog as $$
  select pg_catalog.char_length(p_value)
       + pg_catalog.regexp_count(p_value, E'[\\U00010000-\\U0010FFFF]');
$$;

do $$ begin
  if public.matrix_guided_r2_utf16_units(null::text) is not null
    or public.matrix_guided_r2_utf16_units('') <> 0
    or public.matrix_guided_r2_utf16_units('A') <> 1
    or public.matrix_guided_r2_utf16_units('ABC') <> 3
    or public.matrix_guided_r2_utf16_units(U&'\00E9') <> 1
    or public.matrix_guided_r2_utf16_units(U&'\+01F600') <> 2
    or public.matrix_guided_r2_utf16_units('A' || U&'\00E9' || U&'\+01F600') <> 4 then
    raise exception 'guided R2 UTF-16 helper failed its self-test';
  end if;
end $$;

create function public.matrix_guided_r2_events_append_only() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'guided R2 events are append-only' using errcode = '55000';
end;
$$;
create trigger matrix_guided_r2_events_append_only_trigger before update or delete on public.matrix_guided_r2_events
for each row execute function public.matrix_guided_r2_events_append_only();

create function public.matrix_guided_r2_validate_entry() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_options text[];
begin
  select option_ids into v_options from public.matrix_guided_r2_targets
  where document_version = new.document_version and guided_manifest_sha256 = new.guided_manifest_sha256
    and review_manifest_sha256 = new.review_manifest_sha256 and target_kind = new.target_kind and target_id = new.target_id;
  if not found then raise exception 'unknown guided target' using errcode = '23503'; end if;
  if (new.draft_choice_id is not null and not new.draft_choice_id = any(v_options))
    or (new.submitted_choice_id is not null and not new.submitted_choice_id = any(v_options)) then
    raise exception 'invalid guided choice' using errcode = '23514';
  end if;
  if coalesce(public.matrix_guided_r2_utf16_units(new.draft_rationale),0) > 20000
    or coalesce(public.matrix_guided_r2_utf16_units(new.draft_text),0) > 20000
    or coalesce(public.matrix_guided_r2_utf16_units(new.submitted_rationale),0) > 20000
    or coalesce(public.matrix_guided_r2_utf16_units(new.submitted_text),0) > 20000 then
    raise exception 'guided text too large' using errcode = '22001';
  end if;
  return new;
end;
$$;
create trigger matrix_guided_r2_validate_entry_trigger before insert or update on public.matrix_guided_r2_entries
for each row execute function public.matrix_guided_r2_validate_entry();

create function public.matrix_guided_r2_field_hash(p_value text) returns text
language sql immutable set search_path = pg_catalog, extensions as $$
  select case when p_value is null then '-' else encode(extensions.digest(convert_to(p_value,'UTF8'),'sha256'),'hex') end;
$$;

create function public.matrix_guided_r2_draft_set_digest(p_user_id uuid,p_document_version text,p_guided_manifest_sha256 text,p_review_manifest_sha256 text) returns text
language sql stable set search_path = pg_catalog, public, extensions as $$
  select encode(extensions.digest(convert_to(coalesce(string_agg(
    e.target_kind || ':' || e.target_id || ':' || e.revision::text || ':' ||
    public.matrix_guided_r2_field_hash(e.draft_choice_id) || ':' ||
    public.matrix_guided_r2_field_hash(e.draft_rationale) || ':' ||
    public.matrix_guided_r2_field_hash(e.draft_text), E'\n'
    order by e.target_kind collate "C", e.target_id collate "C"),''),'UTF8'),'sha256'),'hex')
  from public.matrix_guided_r2_entries e
  where e.user_id = p_user_id and e.document_version = p_document_version
    and e.guided_manifest_sha256 = p_guided_manifest_sha256 and e.review_manifest_sha256 = p_review_manifest_sha256
    and (e.draft_choice_id is not null or e.draft_rationale is not null or e.draft_text is not null);
$$;

create function public.matrix_guided_r2_activation_status(p_document_version text,p_guided_manifest_sha256 text,p_review_manifest_sha256 text) returns boolean
language plpgsql stable security definer set search_path = pg_catalog, public, auth as $$
declare v_user uuid;
declare v_active boolean;
begin
  v_user := auth.uid();
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'unauthenticated' using errcode = '28000'; end if;
  select enabled into v_active from public.matrix_guided_r2_activation
  where document_version = p_document_version and guided_manifest_sha256 = p_guided_manifest_sha256
    and review_manifest_sha256 = p_review_manifest_sha256;
  if v_active is null then raise exception 'unknown guided release identity' using errcode = '22023'; end if;
  return v_active;
end;
$$;

revoke all on function public.matrix_guided_r2_utf16_units(text), public.matrix_guided_r2_field_hash(text),
  public.matrix_guided_r2_draft_set_digest(uuid,text,text,text), public.matrix_guided_r2_activation_status(text,text,text),
  public.matrix_guided_r2_validate_entry(), public.matrix_guided_r2_events_append_only()
  from public, anon, authenticated, service_role;
grant execute on function public.matrix_guided_r2_activation_status(text,text,text) to authenticated;

create function public.matrix_guided_r2_save(
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

create function public.matrix_guided_r2_complete(
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
  public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text) from public, anon, authenticated, service_role;
grant execute on function public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid),
  public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text) to authenticated;


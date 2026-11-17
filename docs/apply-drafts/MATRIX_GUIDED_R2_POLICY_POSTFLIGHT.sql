-- Read-only candidate postflight. Retain all rows and compare exact definitions.
select version,name from supabase_migrations.schema_migrations
where version = '20261117003834' or name like 'matrix_guided_r2_policy_%' order by version;
select document_version,guided_manifest_sha256,review_manifest_sha256,enabled
from public.matrix_guided_r2_activation where document_version = 'phase2-review-2026-11-fa356b89';
select 'targets' as relation,count(*) as rows from public.matrix_guided_r2_targets
union all select 'entries',count(*) from public.matrix_guided_r2_entries
union all select 'completion',count(*) from public.matrix_guided_r2_completion
union all select 'events',count(*) from public.matrix_guided_r2_events
union all select 'allowlist',count(*) from public.matrix_guided_r2_reviewer_allowlist;
select conname,convalidated,confdeltype,pg_get_constraintdef(oid) as definition
from pg_constraint where conname in ('matrix_guided_r2_entries_user_fk',
  'matrix_guided_r2_completion_user_fk','matrix_guided_r2_events_user_fk',
  'matrix_guided_r2_reviewer_allowlist_user_fk','matrix_guided_r2_reviewer_allowlist_release_fk')
order by conname;
select t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
from pg_trigger t where t.tgrelid = 'public.matrix_guided_r2_events'::regclass
  and not t.tgisinternal;
select p.oid::regprocedure::text as signature,pg_get_userbyid(p.proowner) as owner,
  p.prosecdef,p.provolatile,p.proconfig,md5(pg_get_functiondef(p.oid)) as definition_md5,
  pg_get_functiondef(p.oid) as definition
from pg_proc p where p.pronamespace='public'::regnamespace
  and p.proname in ('matrix_guided_r2_reviewer_allowed','matrix_guided_r2_save','matrix_guided_r2_complete')
order by p.proname;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and tablename in ('matrix_guided_r2_entries',
  'matrix_guided_r2_completion','matrix_guided_r2_reviewer_allowlist') order by tablename,policyname;
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c
where c.oid in ('public.matrix_guided_r2_entries'::regclass,
  'public.matrix_guided_r2_completion'::regclass,'public.matrix_guided_r2_reviewer_allowlist'::regclass);
select has_function_privilege('authenticated','public.matrix_guided_r2_reviewer_allowed(text,text,text)','EXECUTE') as self_check_granted,
  has_function_privilege('anon','public.matrix_guided_r2_reviewer_allowed(text,text,text)','EXECUTE') as anon_self_check_granted,
  has_function_privilege('authenticated','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE') as save_granted,
  has_function_privilege('authenticated','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE') as complete_granted;
select c.relname,r.rolname,has_table_privilege(r.rolname,c.oid,'DELETE') as can_delete
from pg_class c cross join pg_roles r
where c.oid in ('public.matrix_guided_r2_entries'::regclass,
  'public.matrix_guided_r2_completion'::regclass,'public.matrix_guided_r2_events'::regclass,
  'public.matrix_guided_r2_reviewer_allowlist'::regclass)
  and r.rolname in ('anon','authenticated','service_role') order by c.relname,r.rolname;

-- Correction-specific assertions; every result must be true, not merely present.
select c.oid = 'public.matrix_guided_r2_reviewer_allowlist'::regclass as exact_allowlist_table,
  c.relrowsecurity as allowlist_rls_enabled,
  (select count(*) = 0 from pg_policies p where p.schemaname = 'public'
    and p.tablename = 'matrix_guided_r2_reviewer_allowlist') as zero_allowlist_policies,
  (select count(*) = 0 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) acl
    where acl.grantee = 0) as public_has_zero_allowlist_grants
from pg_class c where c.oid = 'public.matrix_guided_r2_reviewer_allowlist'::regclass;
with privileges(privilege) as (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
  ('TRUNCATE'),('REFERENCES'),('TRIGGER'))
select r.rolname,p.privilege,
  not has_table_privilege(r.rolname,'public.matrix_guided_r2_reviewer_allowlist',p.privilege)
    as allowlist_privilege_denied
from pg_roles r cross join privileges p
where r.rolname in ('anon','authenticated','service_role')
order by r.rolname,p.privilege;
with expected(signature,role_name,expected_execute) as (values
  ('public.matrix_guided_r2_reviewer_allowed(text,text,text)','PUBLIC',false),
  ('public.matrix_guided_r2_reviewer_allowed(text,text,text)','anon',false),
  ('public.matrix_guided_r2_reviewer_allowed(text,text,text)','authenticated',true),
  ('public.matrix_guided_r2_reviewer_allowed(text,text,text)','service_role',false),
  ('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','PUBLIC',false),
  ('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','anon',false),
  ('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','authenticated',true),
  ('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','service_role',false),
  ('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','PUBLIC',false),
  ('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','anon',false),
  ('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','authenticated',true),
  ('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','service_role',false)
), actual as (
  select e.*,p.oid as function_oid,
    case when e.role_name = 'PUBLIC' then exists (
      select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ) else has_function_privilege(e.role_name,p.oid,'EXECUTE') end as actual_execute
  from expected e left join pg_proc p on p.oid = to_regprocedure(e.signature)
)
select signature,role_name,function_oid is not null as function_present,
  expected_execute,actual_execute,
  function_oid is not null and actual_execute is not distinct from expected_execute
    as exact_execute_grant
from actual order by signature,role_name;
with expected(name,source_relation) as (values
  ('matrix_guided_r2_entries_user_fk','public.matrix_guided_r2_entries'),
  ('matrix_guided_r2_completion_user_fk','public.matrix_guided_r2_completion'),
  ('matrix_guided_r2_events_user_fk','public.matrix_guided_r2_events'),
  ('matrix_guided_r2_reviewer_allowlist_user_fk','public.matrix_guided_r2_reviewer_allowlist')
)
select e.name,count(c.oid) = 1 as exactly_one_fk,
  bool_and(c.contype = 'f' and c.convalidated and c.conrelid = e.source_relation::regclass
    and c.confrelid = 'auth.users'::regclass and c.confdeltype = 'c'
    and c.conkey = array[(select a.attnum from pg_attribute a
      where a.attrelid = e.source_relation::regclass and a.attname = 'user_id')]::smallint[]
    and c.confkey = array[(select a.attnum from pg_attribute a
      where a.attrelid = 'auth.users'::regclass and a.attname = 'id')]::smallint[])
    as exact_cascading_user_fk,
  array_agg(pg_get_constraintdef(c.oid)) as definitions
from expected e left join pg_constraint c on c.conname = e.name
group by e.name order by e.name;
select 'responses' as legacy_source,document_version,manifest_sha256,count(*) as legacy_count
from public.matrix_paper_review_responses group by document_version,manifest_sha256
union all select 'response_events',document_version,manifest_sha256,count(*)
from public.matrix_paper_review_response_events group by document_version,manifest_sha256
order by legacy_source,document_version,manifest_sha256;

-- Preserved R3 postflight assertions and query plans follow.
-- Read-only candidate postflight. Every boolean and expected count must match.
select
  count(*) filter (where c.relname in ('matrix_guided_r2_targets','matrix_guided_r2_activation',
    'matrix_guided_r2_entries','matrix_guided_r2_completion','matrix_guided_r2_events')) = 5 as five_tables_present,
  count(*) filter (where c.relname in ('matrix_guided_r2_targets','matrix_guided_r2_activation',
    'matrix_guided_r2_entries','matrix_guided_r2_completion','matrix_guided_r2_events') and c.relrowsecurity) = 5 as all_tables_rls_enabled
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public';

select
  (select count(*) from public.matrix_guided_r2_targets) = 23 as exact_target_count,
  (select count(*) from public.matrix_guided_r2_activation where
    document_version = 'phase2-review-2026-11-fa356b89' and
    guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576' and
    review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e' and enabled = false) = 1 as exact_activation_disabled,
  (select count(*) from public.matrix_guided_r2_entries) = 0 as entries_empty,
  (select count(*) from public.matrix_guided_r2_completion) = 0 as completion_empty,
  (select count(*) from public.matrix_guided_r2_events) = 0 as events_empty;

with expected(target_kind,target_id,option_ids) as (values
  ('choice-prompt','structure-approach',array['sound','refine','unsure']::text[]),
  ('text-prompt','site-assignment','{}'::text[]),
  ('choice-prompt','human-approach',array['sound','refine','unsure']::text[]),
  ('text-prompt','ecological-approach','{}'::text[]),
  ('choice-prompt','common-rules',array['yes','refine','unsure']::text[]),
  ('text-prompt','work-sequence','{}'::text[]),
  ('section-comment','sec-phase2-about-this-paper','{}'::text[]),
  ('section-comment','sec-phase2-acknowledgements','{}'::text[]),
  ('section-comment','sec-phase2-1','{}'::text[]),
  ('section-comment','sec-phase2-2','{}'::text[]),
  ('section-comment','sec-phase2-3','{}'::text[]),
  ('section-comment','sec-phase2-4','{}'::text[]),
  ('section-comment','sec-phase2-5','{}'::text[]),
  ('section-comment','sec-phase2-6','{}'::text[]),
  ('section-comment','sec-phase2-6-1','{}'::text[]),
  ('section-comment','sec-phase2-6-2','{}'::text[]),
  ('section-comment','sec-phase2-6-3','{}'::text[]),
  ('section-comment','sec-phase2-6-4','{}'::text[]),
  ('section-comment','sec-phase2-7','{}'::text[]),
  ('section-comment','sec-phase2-8','{}'::text[]),
  ('section-comment','sec-phase2-9','{}'::text[]),
  ('section-comment','sec-phase2-references','{}'::text[]),
  ('whole-paper-comment','whole-paper','{}'::text[])
), actual as (
  select target_kind,target_id,option_ids from public.matrix_guided_r2_targets where
    document_version = 'phase2-review-2026-11-fa356b89' and
    guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576' and
    review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e'
), mismatch as (
  (select * from expected except select * from actual)
  union all
  (select * from actual except select * from expected)
) select count(*) = 0 as exact_seed_set_matches from mismatch;

select
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'matrix_guided_r2_entries' and policyname = 'matrix_guided_r2_entries_own_read') = 1 as entries_own_policy,
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'matrix_guided_r2_completion' and policyname = 'matrix_guided_r2_completion_own_read') = 1 as completion_own_policy,
  (select count(*) from pg_catalog.pg_policies where schemaname = 'public' and tablename in ('matrix_guided_r2_targets','matrix_guided_r2_activation','matrix_guided_r2_events')) = 0 as no_other_read_policies,
  (select coalesce(array_agg(tablename || ':' || policyname order by tablename,policyname),array[]::text[])
    from pg_catalog.pg_policies where schemaname = 'public' and tablename in
      ('matrix_guided_r2_targets','matrix_guided_r2_activation','matrix_guided_r2_entries',
       'matrix_guided_r2_completion','matrix_guided_r2_events')) = array[
      'matrix_guided_r2_completion:matrix_guided_r2_completion_own_read',
      'matrix_guided_r2_entries:matrix_guided_r2_entries_own_read']::text[] as exact_guided_policy_set,
  has_table_privilege('authenticated','public.matrix_guided_r2_entries','SELECT') as authenticated_entries_select,
  has_table_privilege('authenticated','public.matrix_guided_r2_completion','SELECT') as authenticated_completion_select,
  not has_table_privilege('authenticated','public.matrix_guided_r2_targets','SELECT') as targets_not_directly_readable,
  not has_table_privilege('authenticated','public.matrix_guided_r2_activation','SELECT') as activation_not_directly_readable,
  not has_table_privilege('authenticated','public.matrix_guided_r2_events','SELECT') as events_not_directly_readable,
  not has_table_privilege('service_role','public.matrix_guided_r2_entries','INSERT') and
    not has_table_privilege('service_role','public.matrix_guided_r2_entries','UPDATE') and
    not has_table_privilege('service_role','public.matrix_guided_r2_entries','DELETE') and
    not has_table_privilege('service_role','public.matrix_guided_r2_entries','TRUNCATE') as service_role_no_entries_dml,
  not has_table_privilege('anon','public.matrix_guided_r2_entries','SELECT') and
    not has_table_privilege('anon','public.matrix_guided_r2_entries','INSERT') and
    not has_table_privilege('anon','public.matrix_guided_r2_entries','UPDATE') and
    not has_table_privilege('anon','public.matrix_guided_r2_entries','DELETE') as anon_no_entries_privileges;

select tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_catalog.pg_policies where schemaname = 'public' and tablename in
  ('matrix_guided_r2_targets','matrix_guided_r2_activation','matrix_guided_r2_entries',
   'matrix_guided_r2_completion','matrix_guided_r2_events')
order by tablename,policyname;

select
  has_function_privilege('authenticated','public.matrix_guided_r2_activation_status(text,text,text)','EXECUTE') as status_read_grant,
  has_function_privilege('authenticated','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE') as save_invoke_only_grant,
  has_function_privilege('authenticated','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE') as complete_invoke_only_grant,
  not has_function_privilege('anon','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE') as anon_cannot_invoke_save,
  not has_function_privilege('service_role','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE') as service_role_cannot_invoke_save;

with new_tables(name,select_for_authenticated) as (values
  ('matrix_guided_r2_targets',false),('matrix_guided_r2_activation',false),
  ('matrix_guided_r2_entries',true),('matrix_guided_r2_completion',true),('matrix_guided_r2_events',false)
) select
  bool_and(has_table_privilege('authenticated','public.' || name,'SELECT') = select_for_authenticated) as exact_authenticated_select,
  bool_and(not has_table_privilege('service_role','public.' || name,'SELECT')) as no_service_role_select,
  bool_and(not has_table_privilege('authenticated','public.' || name,'INSERT') and
    not has_table_privilege('authenticated','public.' || name,'UPDATE') and
    not has_table_privilege('authenticated','public.' || name,'DELETE') and
    not has_table_privilege('authenticated','public.' || name,'TRUNCATE')) as no_authenticated_direct_writes,
  bool_and(not has_table_privilege('service_role','public.' || name,'INSERT') and
    not has_table_privilege('service_role','public.' || name,'UPDATE') and
    not has_table_privilege('service_role','public.' || name,'DELETE') and
    not has_table_privilege('service_role','public.' || name,'TRUNCATE')) as no_service_role_direct_writes,
  bool_and(not has_table_privilege('anon','public.' || name,'SELECT') and
    not has_table_privilege('anon','public.' || name,'INSERT') and
    not has_table_privilege('anon','public.' || name,'UPDATE') and
    not has_table_privilege('anon','public.' || name,'DELETE')) as no_anon_access
from new_tables;

select count(*) = 4 as four_required_indexes from pg_catalog.pg_indexes
where schemaname = 'public' and indexname in (
  'matrix_guided_r2_events_user_time_idx','matrix_guided_r2_events_release_idx',
  'matrix_guided_r2_entries_target_fk_idx','matrix_guided_r2_completion_activation_fk_idx');

select count(*) = 2 as validation_and_append_only_triggers_present from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid = t.tgrelid join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal and t.tgname in
  ('matrix_guided_r2_validate_entry_trigger','matrix_guided_r2_events_append_only_trigger');

select public.matrix_guided_r2_utf16_units(null::text) is null and
  public.matrix_guided_r2_utf16_units('') = 0 and
  public.matrix_guided_r2_utf16_units('A') = 1 and
  public.matrix_guided_r2_utf16_units('ABC') = 3 and
  public.matrix_guided_r2_utf16_units(U&'\00E9') = 1 and
  public.matrix_guided_r2_utf16_units(U&'\+01F600') = 2 and
  public.matrix_guided_r2_utf16_units('A' || U&'\00E9' || U&'\+01F600') = 4 as utf16_self_test;

select count(*) = 1 as one_applied_migration_entry from supabase_migrations.schema_migrations
where name = 'matrix_guided_r2_inactive_20261116';
select version,name from supabase_migrations.schema_migrations
where name = 'matrix_guided_r2_inactive_20261116' order by version;

select 'responses' as legacy_source, document_version, manifest_sha256, count(*) as legacy_count
from public.matrix_paper_review_responses group by document_version,manifest_sha256
union all
select 'response_events' as legacy_source, document_version, manifest_sha256, count(*) as legacy_count
from public.matrix_paper_review_response_events group by document_version,manifest_sha256
order by legacy_source,document_version,manifest_sha256;
-- Compare this complete result set exactly with preflight MCP_CALL_3; no historical count may change.

-- Capture scoped read-only query plans. Confirm index-backed own-row and rate paths;
-- an empty new table may still choose a seq scan, so retain the JSON plan as evidence
-- and repeat after representative fixture rows in an authorized nonproduction database.
explain (format json) select target_id from public.matrix_guided_r2_entries
where user_id = '11111111-1111-4111-8111-111111111111'::uuid
  and document_version = 'phase2-review-2026-11-fa356b89'
  and guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576';
explain (format json) select count(*) from public.matrix_guided_r2_events
where user_id = '11111111-1111-4111-8111-111111111111'::uuid
  and occurred_at >= clock_timestamp() - interval '1 minute';
explain (format json) select option_ids from public.matrix_guided_r2_targets
where document_version = 'phase2-review-2026-11-fa356b89'
  and guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576'
  and review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e'
  and target_kind = 'choice-prompt' and target_id = 'structure-approach';


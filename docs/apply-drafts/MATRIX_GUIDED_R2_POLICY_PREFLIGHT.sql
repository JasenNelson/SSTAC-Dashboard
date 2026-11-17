-- Read-only candidate preflight. Run in project qyrhsieynzfgyuqzznap before any correction.
-- Retain each complete result. Compare exact catalog definitions with reviewed baseline.
select current_user as executor_role, current_setting('server_version') as pg_version,
  current_database() as database_name;
select version, name from supabase_migrations.schema_migrations
where version = '20261117003834';
select document_version,guided_manifest_sha256,review_manifest_sha256,enabled,updated_at
from public.matrix_guided_r2_activation
where document_version = 'phase2-review-2026-11-fa356b89';
select 'activation' as relation,count(*) as rows from public.matrix_guided_r2_activation
union all select 'targets',count(*) from public.matrix_guided_r2_targets
union all select 'entries',count(*) from public.matrix_guided_r2_entries
union all select 'completion',count(*) from public.matrix_guided_r2_completion
union all select 'events',count(*) from public.matrix_guided_r2_events;
select c.oid::regclass::text as relation,c.relrowsecurity,c.relforcerowsecurity
from pg_class c where c.oid in ('public.matrix_guided_r2_activation'::regclass,
  'public.matrix_guided_r2_targets'::regclass,'public.matrix_guided_r2_entries'::regclass,
  'public.matrix_guided_r2_completion'::regclass,'public.matrix_guided_r2_events'::regclass);
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname = 'public' and tablename like 'matrix_guided_r2_%' order by tablename,policyname;
select n.nspname,c.relname,r.rolname,privilege_type,is_grantable
from information_schema.role_table_grants g
join pg_class c on c.relname = g.table_name
join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
join pg_roles r on r.rolname = g.grantee
where n.nspname = 'public' and c.relname like 'matrix_guided_r2_%'
order by c.relname,r.rolname,privilege_type;
select t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid = t.tgrelid
where c.relnamespace = 'public'::regnamespace and c.relname like 'matrix_guided_r2_%'
  and not t.tgisinternal order by c.relname,t.tgname;
select p.oid::regprocedure::text as signature,pg_get_userbyid(p.proowner) as owner,
  p.prosecdef,p.provolatile,p.proconfig,md5(pg_get_functiondef(p.oid)) as definition_md5,
  pg_get_functiondef(p.oid) as definition
from pg_proc p where p.pronamespace = 'public'::regnamespace
  and p.proname in ('matrix_guided_r2_save','matrix_guided_r2_complete',
    'matrix_guided_r2_activation_status','matrix_guided_r2_events_append_only')
order by p.proname;
select conname,conrelid::regclass::text as relation,contype,convalidated,
  pg_get_constraintdef(oid) as definition from pg_constraint
where conrelid in ('auth.users'::regclass,'public.matrix_guided_r2_entries'::regclass,
  'public.matrix_guided_r2_completion'::regclass,'public.matrix_guided_r2_events'::regclass)
  and (contype = 'p' or conname like 'matrix_guided_r2_%') order by relation,conname;
select column_name,data_type,is_nullable from information_schema.columns
where table_schema = 'auth' and table_name = 'users' and column_name in ('id','deleted_at');
select 'entries' as relation,count(*) as orphan_rows from public.matrix_guided_r2_entries e
  left join auth.users u on u.id=e.user_id where u.id is null
union all select 'completion',count(*) from public.matrix_guided_r2_completion c
  left join auth.users u on u.id=c.user_id where u.id is null
union all select 'events',count(*) from public.matrix_guided_r2_events v
  left join auth.users u on u.id=v.user_id where u.id is null;
select to_regclass('public.matrix_guided_r2_reviewer_allowlist') as candidate_table,
  to_regprocedure('public.matrix_guided_r2_reviewer_allowed(text,text,text)') as candidate_function;
select version,name from supabase_migrations.schema_migrations
where name like 'matrix_guided_r2_policy_%' order by version;
-- Compare legacy response and telemetry baselines to sealed R3 preflight receipt.
select 'responses' as legacy_source,document_version,manifest_sha256,count(*) as legacy_count
from public.matrix_paper_review_responses group by document_version,manifest_sha256
union all select 'response_events',document_version,manifest_sha256,count(*)
from public.matrix_paper_review_response_events group by document_version,manifest_sha256
order by legacy_source,document_version,manifest_sha256;

-- Read-only candidate preflight. Each marked block is one separate MCP execute_sql call.
-- Capture all three result sets on each of two independent observations.
-- Every boolean in call 1 and migration_name_unused in call 2 must be true.
-- All guided-prefix collision counts must be zero. Compare call 3 exactly after application.

-- BEGIN MCP_CALL_1
select
  clock_timestamp() as observed_at_utc,
  current_user as observed_current_user,
  session_user as observed_session_user,
  current_user = 'postgres' as expected_role,
  to_regprocedure('extensions.digest(bytea,text)') is not null as pgcrypto_digest_ready,
  to_regprocedure('auth.uid()') is not null and to_regprocedure('auth.jwt()') is not null as auth_helpers_ready,
  to_regclass('public.matrix_paper_review_responses') is not null as legacy_responses_present,
  to_regclass('public.matrix_paper_review_response_events') is not null as legacy_events_present,
  to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_present,
  to_regclass('public.matrix_guided_r2_targets') is null and
    to_regclass('public.matrix_guided_r2_activation') is null and
    to_regclass('public.matrix_guided_r2_entries') is null and
    to_regclass('public.matrix_guided_r2_completion') is null and
    to_regclass('public.matrix_guided_r2_events') is null as five_tables_absent,
  to_regprocedure('public.matrix_guided_r2_utf16_units(text)') is null and
    to_regprocedure('public.matrix_guided_r2_events_append_only()') is null and
    to_regprocedure('public.matrix_guided_r2_validate_entry()') is null and
    to_regprocedure('public.matrix_guided_r2_field_hash(text)') is null and
    to_regprocedure('public.matrix_guided_r2_draft_set_digest(uuid,text,text,text)') is null and
    to_regprocedure('public.matrix_guided_r2_activation_status(text,text,text)') is null and
    to_regprocedure('public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)') is null and
    to_regprocedure('public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)') is null as eight_functions_absent,
  to_regclass('public.matrix_guided_r2_events_user_time_idx') is null and
    to_regclass('public.matrix_guided_r2_events_release_idx') is null and
    to_regclass('public.matrix_guided_r2_entries_target_fk_idx') is null and
    to_regclass('public.matrix_guided_r2_completion_activation_fk_idx') is null as four_index_names_absent,
  not exists (select 1 from pg_catalog.pg_trigger
    where tgname in ('matrix_guided_r2_events_append_only_trigger','matrix_guided_r2_validate_entry_trigger')) as two_trigger_names_absent,
  not exists (select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and policyname in ('matrix_guided_r2_entries_own_read','matrix_guided_r2_completion_own_read')) as two_policy_names_absent,
  not exists (select 1 from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname in
      ('matrix_guided_r2_targets','matrix_guided_r2_activation','matrix_guided_r2_entries',
       'matrix_guided_r2_completion','matrix_guided_r2_events')) as five_table_type_names_absent,
  (select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname like 'matrix_guided_r2%') as guided_relation_name_collisions,
  (select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'matrix_guided_r2%') as guided_function_name_collisions,
  (select count(*) from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and t.tgname like 'matrix_guided_r2%') as guided_trigger_name_collisions,
  (select count(*) from pg_catalog.pg_policies
    where schemaname = 'public' and policyname like 'matrix_guided_r2%') as guided_policy_name_collisions,
  (select count(*) from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname like 'matrix_guided_r2%') as guided_type_name_collisions;
-- END MCP_CALL_1

-- BEGIN MCP_CALL_2
select
  clock_timestamp() as observed_at_utc,
  count(*) = 0 as migration_name_unused,
  count(*) as migration_history_rows_for_name,
  coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name) order by version),'[]'::jsonb) as migration_history_entries
from supabase_migrations.schema_migrations
where name = 'matrix_guided_r2_inactive_20261116';
-- END MCP_CALL_2

-- BEGIN MCP_CALL_3
select 'responses' as legacy_source, document_version, manifest_sha256, count(*) as legacy_count
from public.matrix_paper_review_responses group by document_version,manifest_sha256
union all
select 'response_events' as legacy_source, document_version, manifest_sha256, count(*) as legacy_count
from public.matrix_paper_review_response_events group by document_version,manifest_sha256
order by legacy_source,document_version,manifest_sha256;
-- END MCP_CALL_3

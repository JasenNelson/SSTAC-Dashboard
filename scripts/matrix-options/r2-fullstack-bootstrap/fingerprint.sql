-- Matrix R2 full-stack preview: parity fingerprint (READ-ONLY).
--
-- Runs unchanged against production (read-only MCP execute_sql) and against the
-- local Supabase stack. Each row is one required object and an md5 of its
-- normalized definition. The bootstrap fails closed unless every local row
-- equals the pinned production row in captured/provider-fingerprint.json.
--
-- Normalization rules (deliberate, reviewed):
--   N1 CRLF -> LF in function bodies, policy and constraint text.
--   N2 ACLs compare grantee + privilege + grantable only (grantor ignored);
--      a NULL ACL is expanded to the object type's default.
--   N3 Rows for user data tables are never read; only seeded reference data
--      (guided targets, legacy questions) and the activation identity (without
--      its enabled flag, which the local preview turns on) are fingerprinted.
--   N4 Migration ledger versions are not compared (production records the
--      admission migration as 20261120060356; the repo file is 20261118000001).
--   N5 Seeded question rows are compared without created_at (insert time differs by
--      environment); every other column is compared.
-- No backslash escapes appear in this file (MCP transport lesson, LESSONS 2026-10-15).
with
lf as (select chr(13) || chr(10) as crlf, chr(10) as nl),
tbl as (
  select c.oid, c.relname from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind = 'r'
    and (c.relname like 'matrix_paper_review%' or c.relname like 'matrix_guided_r2%' or c.relname = 'user_roles')
),
fn as (
  select p.oid, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public'
    and (p.proname like 'matrix_paper_review%' or p.proname like 'matrix_guided_r2%'
      or p.proname in ('is_matrix_options_paper_admin', 'is_admin', 'update_updated_at_column'))
),
acl_text as (
  select 'fn' as k, f.oid,
    coalesce((select string_agg(coalesce(r.rolname, 'PUBLIC') || ':' || a.privilege_type || ':' || a.is_grantable::text, ',' order by coalesce(r.rolname, 'PUBLIC'), a.privilege_type)
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a left join pg_roles r on r.oid = a.grantee), '') as acl
  from fn f join pg_proc p on p.oid = f.oid
  union all
  select 'tbl', t.oid,
    coalesce((select string_agg(coalesce(r.rolname, 'PUBLIC') || ':' || a.privilege_type || ':' || a.is_grantable::text, ',' order by coalesce(r.rolname, 'PUBLIC'), a.privilege_type)
      from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a left join pg_roles r on r.oid = a.grantee), '')
  from tbl t join pg_class c on c.oid = t.oid
),
rows as (
  select 'function' as kind, f.sig as name, md5(concat_ws('|',
    replace(p.prosrc, (select crlf from lf), (select nl from lf)), p.prosecdef::text, p.provolatile::text,
    pg_get_userbyid(p.proowner), coalesce(p.proconfig::text, ''), pg_get_function_result(p.oid),
    (select acl from acl_text a where a.k = 'fn' and a.oid = f.oid))) as fp
  from fn f join pg_proc p on p.oid = f.oid
  union all
  select 'table', t.relname, md5(concat_ws('|',
    c.relrowsecurity::text, c.relforcerowsecurity::text, pg_get_userbyid(c.relowner),
    (select acl from acl_text a where a.k = 'tbl' and a.oid = t.oid),
    (select string_agg(concat_ws(':', a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull::text,
        coalesce(pg_get_expr(d.adbin, d.adrelid), ''), coalesce(a.attacl::text, '')), ',' order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped)))
  from tbl t join pg_class c on c.oid = t.oid
  union all
  select 'constraint', t.relname || '.' || k.conname, md5(concat_ws('|', k.contype::text, k.convalidated::text,
    replace(pg_get_constraintdef(k.oid), (select crlf from lf), (select nl from lf))))
  from tbl t join pg_constraint k on k.conrelid = t.oid
  union all
  select 'index', t.relname || '.' || i.relname, md5(pg_get_indexdef(i.oid))
  from tbl t join pg_index x on x.indrelid = t.oid join pg_class i on i.oid = x.indexrelid
  union all
  select 'trigger', t.relname || '.' || g.tgname, md5(concat_ws('|', g.tgtype::text, g.tgenabled::text, pg_get_triggerdef(g.oid)))
  from tbl t join pg_trigger g on g.tgrelid = t.oid and not g.tgisinternal
  union all
  select 'policy', p.schemaname || '.' || p.tablename || '.' || p.policyname, md5(concat_ws('|', p.permissive, p.cmd,
    (select string_agg(r, ',' order by r) from unnest(p.roles) r),
    coalesce(replace(p.qual, (select crlf from lf), (select nl from lf)), ''),
    coalesce(replace(p.with_check, (select crlf from lf), (select nl from lf)), '')))
  from pg_policies p
  where (p.schemaname = 'public' and p.tablename in (select relname from tbl))
     or (p.schemaname = 'storage' and p.policyname = 'matrix_paper_r2_select_authenticated_exact')
  union all
  select 'role', r.rolname, md5(concat_ws('|', r.rolcanlogin::text, r.rolinherit::text, r.rolsuper::text, r.rolcreaterole::text,
    r.rolcreatedb::text, r.rolreplication::text, r.rolbypassrls::text))
  from pg_roles r where r.rolname = 'matrix_map_owner'
  union all
  select 'bucket', b.id, md5(concat_ws('|', b.name, b.public::text, coalesce(b.file_size_limit::text, ''), coalesce(b.allowed_mime_types::text, '')))
  from storage.buckets b where b.id = 'matrix-paper-review-assets'
  union all
  select 'data', 'matrix_guided_r2_targets', md5(coalesce((select string_agg(to_jsonb(x)::text, chr(10) order by x.target_kind, x.target_id) from public.matrix_guided_r2_targets x), ''))
  union all
  select 'data', 'matrix_guided_r2_activation.identity', md5(coalesce((select string_agg(concat_ws('|', x.document_version, x.guided_manifest_sha256, x.review_manifest_sha256), chr(10) order by x.document_version) from public.matrix_guided_r2_activation x), ''))
  union all
  select 'data', 'matrix_paper_review_questions', md5(coalesce((select string_agg((to_jsonb(x) - 'created_at')::text, chr(10) order by (to_jsonb(x) - 'created_at')::text) from public.matrix_paper_review_questions x), ''))
)
select kind, name, fp from rows order by kind, name;

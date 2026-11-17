-- Read-only check, separate from kill-switch apply_migration transaction.
select document_version,guided_manifest_sha256,review_manifest_sha256,enabled
from public.matrix_guided_r2_activation
where document_version = 'phase2-review-2026-11-fa356b89'
  and guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576'
  and review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e';
select not has_function_privilege('authenticated','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE') as save_grant_revoked,
  not has_function_privilege('authenticated','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE') as completion_grant_revoked;
select 'entries' as relation,count(*) as rows from public.matrix_guided_r2_entries
union all select 'completion',count(*) from public.matrix_guided_r2_completion
union all select 'events',count(*) from public.matrix_guided_r2_events
union all select 'allowlist',count(*) from public.matrix_guided_r2_reviewer_allowlist;

-- Matrix R2 full-stack preview: provider-only storage objects (LOCAL PREVIEW FIXTURE, never for
-- production). Applied after supabase start, once storage-api has completed its own schema.
--
-- Provenance: rendered from read-only catalog reads of project qyrhsieynzfgyuqzznap on
-- 2026-11-20 (MCP execute_sql: storage.buckets, pg_policies). The private bucket and its single
-- read policy were applied outside tracked migrations. Nothing here is inferred; the bootstrap's
-- fingerprint comparison fails closed on any difference.
-- No backslash escapes appear in this file.

-- Private R2 bucket (production storage.buckets row).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('matrix-paper-review-assets', 'matrix-paper-review-assets', false, 1048576, array['text/markdown', 'image/png'])
on conflict (id) do update set name = excluded.name, public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The bucket's single read policy (production pg_policies qual, verbatim).
drop policy if exists matrix_paper_r2_select_authenticated_exact on storage.objects;
create policy matrix_paper_r2_select_authenticated_exact on storage.objects
  as permissive for select to authenticated
  using (((bucket_id = 'matrix-paper-review-assets'::text) AND (name = ANY (ARRAY['phase2-review-2026-11-fa356b89/presentation.md'::text, 'phase2-review-2026-11-fa356b89/figures/fig1_framework.png'::text, 'phase2-review-2026-11-fa356b89/figures/fig2_routing.png'::text, 'phase2-review-2026-11-fa356b89/figures/fig3_food_pathway.png'::text, 'phase2-review-2026-11-fa356b89/figures/fig4_final_setting.png'::text])) AND (auth.uid() IS NOT NULL) AND COALESCE(((auth.jwt() -> 'is_anonymous'::text) = to_jsonb(false)), false) AND storage.allow_any_operation(ARRAY['object.get_authenticated'::text, 'object.get_authenticated_info'::text])));

do $assert$
begin
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'matrix_paper%') <> 1 then
    raise exception 'preview fixture: R2 storage policy count differs from production';
  end if;
end
$assert$;

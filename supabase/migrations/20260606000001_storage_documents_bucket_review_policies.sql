-- Migration: storage bucket 'documents' + TWG review-file RLS policies
-- (repo capture of changes applied LIVE via the project-scoped MCP on
-- 2026-06-05 -- see FRESH_SESSION_PLAN_MATRIX_MAP_STATS_2026_06_05.md
-- "LIVE SUPABASE CHANGES"; this file makes the repo the source of truth).
--
-- ALREADY APPLIED to the production project (qyrhsieynzfgyuqzznap): every
-- statement below is IDEMPOTENT so re-running it there is a no-op, while a
-- fresh environment converges to the live state. Definitions were read back
-- verbatim from the live database (storage.buckets + pg_policies) on
-- 2026-06-06 before authoring.
--
-- Object layout: review files upload to 'review-files/<auth.uid()>/...'
-- inside the PRIVATE 'documents' bucket. Owners manage their own files.
--
-- SCOPE NOTE (deliberate, matches the live policy): the admin SELECT policy
-- below is BUCKET-WIDE -- admin / matrix_admin (public.user_roles) can read
-- EVERY object in the 'documents' bucket, NOT just 'review-files/' paths.
-- Any future object class added to this bucket inherits admin readability;
-- if that is ever unwanted, the admin policy must gain a prefix restriction.

-- 1) Private bucket.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 2) RLS policies on storage.objects (drop-and-recreate for idempotence;
--    storage.objects already has RLS enabled by Supabase).

drop policy if exists documents_review_insert on storage.objects;
create policy documents_review_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'review-files'
    and split_part(name, '/', 2) = (auth.uid())::text
  );

drop policy if exists documents_review_select_own on storage.objects;
create policy documents_review_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'review-files'
    and split_part(name, '/', 2) = (auth.uid())::text
  );

drop policy if exists documents_review_update_own on storage.objects;
create policy documents_review_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'review-files'
    and split_part(name, '/', 2) = (auth.uid())::text
  )
  with check (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'review-files'
    and split_part(name, '/', 2) = (auth.uid())::text
  );

drop policy if exists documents_review_delete_own on storage.objects;
create policy documents_review_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1) = 'review-files'
    and split_part(name, '/', 2) = (auth.uid())::text
  );

drop policy if exists documents_review_select_admin on storage.objects;
create policy documents_review_select_admin
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and exists (
      select 1
      from user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = any (array['admin'::text, 'matrix_admin'::text])
    )
  );

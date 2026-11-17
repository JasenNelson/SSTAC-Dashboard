-- Data-preserving containment candidate. No schema, row, or history removal.
-- Separately review and approve exact bytes before provider use.
do $$
declare v_rows integer;
begin
  update public.matrix_guided_r2_activation set enabled = false,updated_at = clock_timestamp()
  where document_version = 'phase2-review-2026-11-fa356b89'
    and guided_manifest_sha256 = '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576'
    and review_manifest_sha256 = 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'guided R2 reversal identity mismatch'; end if;
end $$;
revoke execute on function public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid),
  public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text) from authenticated;
do $$ begin
  if has_function_privilege('authenticated','public.matrix_guided_r2_save(text,text,text,text,text,text,text,text,bigint,uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.matrix_guided_r2_complete(text,text,text,uuid,bigint,text)','EXECUTE') then
    raise exception 'guided R2 reversal grants remain';
  end if;
end $$;

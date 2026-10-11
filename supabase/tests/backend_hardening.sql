begin;
set local plpgsql.check_asserts=on;
do $$
begin
  assert not has_function_privilege('anon','public.handle_new_user()','EXECUTE'), 'Trigger must not be exposed to anonymous REST callers';
  assert not has_function_privilege('authenticated','public.handle_new_user()','EXECUTE'), 'Trigger must not be exposed to authenticated REST callers';
  assert not has_function_privilege('anon','public.couponly_guard_student_account_state()','EXECUTE'), 'Account guard must remain trigger-only';
  assert not has_function_privilege('authenticated','public.couponly_guard_student_account_state()','EXECUTE'), 'Account guard must remain trigger-only';
  assert has_function_privilege('authenticated','public.kouponly_account_benefits()','EXECUTE'), 'Mobile benefits RPC must remain available';
  assert exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='couponly_vendors'), 'Catalogue realtime must publish base tables';
  assert not exists (
    select 1 from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where c.contype='f' and n.nspname='public'
      and not exists (select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid and i.indpred is null
        and (select array_agg(a.attnum::smallint order by a.ordinality) from unnest(i.indkey) with ordinality a(attnum,ordinality) where a.ordinality<=cardinality(c.conkey)) @> c.conkey)
  ), 'Public foreign keys must have a usable leading index';
end $$;
rollback;

-- Keep the current kouponly_* API objects available when older couponly_* tables exist.
do $$
declare
  item record;
  legacy_name text;
begin
  -- Mobile uses ON CONFLICT upserts here, which PostgreSQL views do not support.
  if to_regclass('public.kouponly_student_saved_items') is null
     and to_regclass('public.couponly_student_saved_items') is not null then
    alter table public.couponly_student_saved_items rename to kouponly_student_saved_items;
    create view public.couponly_student_saved_items with (security_invoker = true)
      as select * from public.kouponly_student_saved_items;
    grant select, insert, update, delete on public.couponly_student_saved_items to anon, authenticated, service_role;
  end if;

  for item in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname like 'couponly!_%' escape '!'
      and c.relkind in ('r', 'p')
  loop
    legacy_name := replace(item.relname, 'couponly_', 'kouponly_');
    if to_regclass(format('public.%I', legacy_name)) is null then
      execute format(
        'create view public.%I with (security_invoker = true) as select * from public.%I',
        legacy_name,
        item.relname
      );
      execute format(
        'grant select, insert, update, delete on public.%I to anon, authenticated, service_role',
        legacy_name
      );
    end if;
  end loop;

  if (select c.relkind from pg_class c where c.oid = 'public.kouponly_student_saved_items'::regclass) <> 'r' then
    raise exception 'kouponly_student_saved_items must remain a table for mobile upserts';
  end if;
  if to_regclass('public.kouponly_vendors') is null or to_regclass('public.kouponly_students') is null then
    raise exception 'Kouponly API objects were not created';
  end if;
end $$;

notify pgrst, 'reload schema';

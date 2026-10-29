do $$
declare
  old_prefix constant text := 'rea' || 'lx_';
  new_prefix constant text := 'kouponly_';
  old_bucket constant text := 'rea' || 'lx-public-media';
  new_bucket constant text := 'kouponly-public-media';
  item record;
  renamed text;
  function_sql text;
  columns_sql text;
  select_sql text;
  using_sql text;
  check_sql text;
begin
  for item in
    select n.nspname, c.relname, c.relkind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and left(c.relname, length(old_prefix)) = old_prefix
      and c.relkind in ('r','p','v','m','S','f')
  loop
    renamed := new_prefix || substr(item.relname, length(old_prefix) + 1);
    if to_regclass(format('%I.%I', item.nspname, renamed)) is not null then
      if item.relkind = 'v' then
        execute format('drop view %I.%I', item.nspname, item.relname);
      else
        raise exception 'Cannot rename %.%: %.% already exists', item.nspname, item.relname, item.nspname, renamed;
      end if;
      continue;
    end if;
    if item.relkind = 'S' then
      execute format('alter sequence %I.%I rename to %I', item.nspname, item.relname, renamed);
    elsif item.relkind = 'v' then
      execute format('alter view %I.%I rename to %I', item.nspname, item.relname, renamed);
    elsif item.relkind = 'm' then
      execute format('alter materialized view %I.%I rename to %I', item.nspname, item.relname, renamed);
    elsif item.relkind = 'f' then
      execute format('alter foreign table %I.%I rename to %I', item.nspname, item.relname, renamed);
    else
      execute format('alter table %I.%I rename to %I', item.nspname, item.relname, renamed);
    end if;
  end loop;

  for item in
    select n.nspname, c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('i','I')
      and left(c.relname, length(old_prefix)) = old_prefix
      and not exists (select 1 from pg_constraint con where con.conindid = c.oid)
  loop
    renamed := new_prefix || substr(item.relname, length(old_prefix) + 1);
    if to_regclass(format('%I.%I', item.nspname, renamed)) is null then
      execute format('alter index %I.%I rename to %I', item.nspname, item.relname, renamed);
    end if;
  end loop;

  for item in
    select ns.nspname, tbl.relname as table_name, con.conname
    from pg_constraint con join pg_class tbl on tbl.oid = con.conrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    where ns.nspname = 'public' and left(con.conname, length(old_prefix)) = old_prefix
  loop
    renamed := new_prefix || substr(item.conname, length(old_prefix) + 1);
    if not exists (select 1 from pg_constraint where conrelid = format('%I.%I', item.nspname, item.table_name)::regclass and conname = renamed) then
      execute format('alter table %I.%I rename constraint %I to %I', item.nspname, item.table_name, item.conname, renamed);
    end if;
  end loop;

  for item in
    select ns.nspname, tbl.relname as table_name, pol.polname
    from pg_policy pol join pg_class tbl on tbl.oid = pol.polrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    where ns.nspname = 'public' and left(pol.polname, length(old_prefix)) = old_prefix
  loop
    renamed := new_prefix || substr(item.polname, length(old_prefix) + 1);
    if not exists (select 1 from pg_policy where polrelid = format('%I.%I', item.nspname, item.table_name)::regclass and polname = renamed) then
      execute format('alter policy %I on %I.%I rename to %I', item.polname, item.nspname, item.table_name, renamed);
    end if;
  end loop;

  for item in
    select ns.nspname, tbl.relname as table_name, trg.tgname
    from pg_trigger trg join pg_class tbl on tbl.oid = trg.tgrelid
    join pg_namespace ns on ns.oid = tbl.relnamespace
    where ns.nspname = 'public' and not trg.tgisinternal
      and left(trg.tgname, length(old_prefix)) = old_prefix
  loop
    renamed := new_prefix || substr(item.tgname, length(old_prefix) + 1);
    if not exists (select 1 from pg_trigger where tgrelid = format('%I.%I', item.nspname, item.table_name)::regclass and tgname = renamed) then
      execute format('alter trigger %I on %I.%I rename to %I', item.tgname, item.nspname, item.table_name, renamed);
    end if;
  end loop;

  for item in
    select p.oid, n.nspname, p.proname, p.prokind, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f','p')
      and left(p.proname, length(old_prefix)) = old_prefix
  loop
    renamed := new_prefix || substr(item.proname, length(old_prefix) + 1);
    if exists (select 1 from pg_proc p2 where p2.pronamespace = item.nspname::regnamespace and p2.proname = renamed and pg_get_function_identity_arguments(p2.oid) = item.args) then
      raise exception 'Cannot rename function %: target % already exists', item.proname, renamed;
    end if;
    if item.prokind = 'p' then
      execute format('alter procedure %I.%I(%s) rename to %I', item.nspname, item.proname, item.args, renamed);
    else
      execute format('alter function %I.%I(%s) rename to %I', item.nspname, item.proname, item.args, renamed);
    end if;
  end loop;

  for item in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and position(old_prefix in case when p.prokind in ('f','p') then pg_get_functiondef(p.oid) else '' end) > 0
  loop
    function_sql := replace(pg_get_functiondef(item.oid), old_prefix, new_prefix);
    execute function_sql;
  end loop;

  if to_regclass('storage.buckets') is not null and exists (select 1 from storage.buckets where id = old_bucket) then
    select string_agg(format('%I', column_name), ', ' order by ordinal_position),
           string_agg(format('%I', column_name), ', ' order by ordinal_position)
      into columns_sql, select_sql
    from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets'
      and column_name <> 'id' and is_generated = 'NEVER' and is_identity = 'NO';
    execute format('insert into storage.buckets (id, %s) select %L, %s from storage.buckets where id = %L on conflict (id) do nothing', columns_sql, new_bucket, select_sql, old_bucket);

    for item in
      select p.polname, t.relname as table_name, pg_get_expr(p.polqual, p.polrelid) as using_expr,
             pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
      from pg_policy p join pg_class t on t.oid = p.polrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'storage'
        and (position(old_bucket in coalesce(pg_get_expr(p.polqual, p.polrelid), '')) > 0
          or position(old_bucket in coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')) > 0)
    loop
      using_sql := replace(item.using_expr, old_bucket, new_bucket);
      check_sql := replace(item.check_expr, old_bucket, new_bucket);
      if item.using_expr is not null then
        execute format('alter policy %I on storage.%I using (%s)', item.polname, item.table_name, using_sql);
      end if;
      if item.check_expr is not null then
        execute format('alter policy %I on storage.%I with check (%s)', item.polname, item.table_name, check_sql);
      end if;
    end loop;

    update storage.objects set bucket_id = new_bucket where bucket_id = old_bucket;
    delete from storage.buckets where id = old_bucket;
  end if;

  for item in
    select cols.table_schema, cols.table_name, cols.column_name, cols.data_type
    from information_schema.columns cols
    where cols.table_schema = 'public'
      and exists (
        select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = cols.table_schema and c.relname = cols.table_name and c.relkind in ('r','p')
      )
      and (cols.data_type = 'jsonb' or cols.data_type in ('text', 'character varying'))
  loop
    if item.data_type = 'jsonb' then
      execute format('update %I.%I set %I = replace(%I::text, %L, %L)::jsonb where position(%L in %I::text) > 0',
        item.table_schema, item.table_name, item.column_name, item.column_name, old_bucket, new_bucket, old_bucket, item.column_name);
    else
      execute format('update %I.%I set %I = replace(%I::text, %L, %L) where position(%L in %I::text) > 0',
        item.table_schema, item.table_name, item.column_name, item.column_name, old_bucket, new_bucket, old_bucket, item.column_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

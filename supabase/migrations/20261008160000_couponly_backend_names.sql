-- Rename the legacy Supabase API objects in place; rows, grants, policies and dependencies stay attached.
do $$
declare
  item record;
  renamed text;
  function_sql text;
begin
  for item in
    select n.nspname, c.relname, c.relkind
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname like 'realx!_%' escape '!'
      and c.relkind in ('r','p','v','m','S','f')
    order by c.relkind, c.relname
  loop
    renamed := left(replace(item.relname,'realx_','couponly_'),63);
    if item.relkind='S' then
      execute format('alter sequence %I.%I rename to %I',item.nspname,item.relname,renamed);
    elsif item.relkind='v' then
      execute format('alter view %I.%I rename to %I',item.nspname,item.relname,renamed);
    elsif item.relkind='m' then
      execute format('alter materialized view %I.%I rename to %I',item.nspname,item.relname,renamed);
    elsif item.relkind='f' then
      execute format('alter foreign table %I.%I rename to %I',item.nspname,item.relname,renamed);
    else
      execute format('alter table %I.%I rename to %I',item.nspname,item.relname,renamed);
    end if;
  end loop;

  for item in
    select n.nspname, c.relname
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('i','I') and c.relname like 'realx!_%' escape '!'
      and not exists (select 1 from pg_constraint con where con.conindid=c.oid)
  loop
    execute format('alter index %I.%I rename to %I',item.nspname,item.relname,left(replace(item.relname,'realx_','couponly_'),63));
  end loop;

  for item in
    select ns.nspname, tbl.relname as table_name, con.conname
    from pg_constraint con
    join pg_class tbl on tbl.oid=con.conrelid
    join pg_namespace ns on ns.oid=tbl.relnamespace
    where ns.nspname='public' and con.conname like 'realx!_%' escape '!'
  loop
    execute format('alter table %I.%I rename constraint %I to %I',item.nspname,item.table_name,item.conname,left(replace(item.conname,'realx_','couponly_'),63));
  end loop;

  for item in
    select ns.nspname, tbl.relname as table_name, pol.polname
    from pg_policy pol
    join pg_class tbl on tbl.oid=pol.polrelid
    join pg_namespace ns on ns.oid=tbl.relnamespace
    where ns.nspname='public' and pol.polname like 'realx!_%' escape '!'
  loop
    execute format('alter policy %I on %I.%I rename to %I',item.polname,item.nspname,item.table_name,left(replace(item.polname,'realx_','couponly_'),63));
  end loop;

  for item in
    select ns.nspname, tbl.relname as table_name, trg.tgname
    from pg_trigger trg
    join pg_class tbl on tbl.oid=trg.tgrelid
    join pg_namespace ns on ns.oid=tbl.relnamespace
    where ns.nspname='public' and not trg.tgisinternal and trg.tgname like 'realx!_%' escape '!'
  loop
    execute format('alter trigger %I on %I.%I rename to %I',item.tgname,item.nspname,item.table_name,left(replace(item.tgname,'realx_','couponly_'),63));
  end loop;

  for item in
    select p.oid, n.nspname, p.proname, p.prokind, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'realx!_%' escape '!' and p.prokind in ('f','p')
  loop
    renamed := left(replace(item.proname,'realx_','couponly_'),63);
    if item.prokind='p' then
      execute format('alter procedure %I.%I(%s) rename to %I',item.nspname,item.proname,item.args,renamed);
    else
      execute format('alter function %I.%I(%s) rename to %I',item.nspname,item.proname,item.args,renamed);
    end if;
    function_sql := replace(pg_get_functiondef(item.oid),'realx_','couponly_');
    function_sql := replace(function_sql,'realx-','couponly-');
    execute function_sql;
  end loop;

  -- Dashboard RPCs can be deployed before this compatibility rename migration.
  for item in
    select p.oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'couponly_vendor_dashboard_stats','couponly_vendor_dashboard_chart','couponly_admin_dashboard'
    )
  loop
    function_sql := replace(pg_get_functiondef(item.oid),'realx_','couponly_');
    execute function_sql;
  end loop;

end $$;

notify pgrst, 'reload schema';

-- Replace the old scheduled Edge Function URL after the function callers switch names.
do $$
declare
  scheduled record;
  project_url text;
  service_key text;
begin
  if to_regclass('cron.job') is null or to_regclass('vault.decrypted_secrets') is null then return; end if;
  for scheduled in select jobid from cron.job where jobname in ('coop-daily-maintenance','coop-notification-receipts','couponly-daily-maintenance','couponly-notification-receipts') loop
    perform cron.unschedule(scheduled.jobid);
  end loop;
  select coalesce(max(decrypted_secret) filter(where name='couponly_project_url'),max(decrypted_secret) filter(where name='coop_project_url')),
         coalesce(max(decrypted_secret) filter(where name='couponly_service_role_key'),max(decrypted_secret) filter(where name='coop_service_role_key'))
    into project_url,service_key from vault.decrypted_secrets
    where name in ('couponly_project_url','couponly_service_role_key','coop_project_url','coop_service_role_key');
  if coalesce(project_url,'')='' or coalesce(service_key,'')='' then return; end if;
  perform cron.schedule('couponly-daily-maintenance','0 23 * * *',format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
    project_url || '/functions/v1/couponly-maintenance',
    jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key)::text,
    '{"action":"dailyMaintenance"}'));
  perform cron.schedule('couponly-notification-receipts','*/15 * * * *',format(
    'select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
    project_url || '/functions/v1/couponly-maintenance',
    jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||service_key)::text,
    '{"action":"processNotificationReceipts"}'));
end $$;

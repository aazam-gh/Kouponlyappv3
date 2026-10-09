do $$
declare
  scheduled record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for scheduled in
    select jobid, jobname
    from cron.job
    where jobname in (
      'coop-daily-maintenance',
      'coop-notification-receipts',
      'couponly-daily-maintenance',
      'couponly-notification-receipts',
      'kouponly-daily-maintenance',
      'kouponly-notification-receipts'
    )
  loop
    perform cron.unschedule(scheduled.jobid);
  end loop;

  if to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;

  perform cron.schedule('kouponly-daily-maintenance', '0 23 * * *', $job$
    select net.http_post(
      url := secrets.project_url || '/functions/v1/kouponly-maintenance',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secrets.service_role_key),
      body := '{"action":"dailyMaintenance"}'::jsonb
    )
    from (
      select
        coalesce(max(decrypted_secret) filter(where name='kouponly_project_url'), max(decrypted_secret) filter(where name='couponly_project_url'), max(decrypted_secret) filter(where name='coop_project_url')) as project_url,
        coalesce(max(decrypted_secret) filter(where name='kouponly_service_role_key'), max(decrypted_secret) filter(where name='couponly_service_role_key'), max(decrypted_secret) filter(where name='coop_service_role_key')) as service_role_key
      from vault.decrypted_secrets
      where name in ('kouponly_project_url','kouponly_service_role_key','couponly_project_url','couponly_service_role_key','coop_project_url','coop_service_role_key')
    ) secrets
    where coalesce(secrets.project_url,'')<>'' and coalesce(secrets.service_role_key,'')<>'';
  $job$);

  perform cron.schedule('kouponly-notification-receipts', '*/15 * * * *', $job$
    select net.http_post(
      url := secrets.project_url || '/functions/v1/kouponly-maintenance',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secrets.service_role_key),
      body := '{"action":"processNotificationReceipts"}'::jsonb
    )
    from (
      select
        coalesce(max(decrypted_secret) filter(where name='kouponly_project_url'), max(decrypted_secret) filter(where name='couponly_project_url'), max(decrypted_secret) filter(where name='coop_project_url')) as project_url,
        coalesce(max(decrypted_secret) filter(where name='kouponly_service_role_key'), max(decrypted_secret) filter(where name='couponly_service_role_key'), max(decrypted_secret) filter(where name='coop_service_role_key')) as service_role_key
      from vault.decrypted_secrets
      where name in ('kouponly_project_url','kouponly_service_role_key','couponly_project_url','couponly_service_role_key','coop_project_url','coop_service_role_key')
    ) secrets
    where coalesce(secrets.project_url,'')<>'' and coalesce(secrets.service_role_key,'')<>'';
  $job$);
end $$;

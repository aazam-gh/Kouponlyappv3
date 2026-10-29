do $$
declare
  scheduled record;
begin
  if to_regclass('cron.job') is null then
    return;
  end if;

  for scheduled in
    select jobid
    from cron.job
    where jobname in (
      'kouponly-daily-maintenance',
      'kouponly-notification-receipts',
      'coop-daily-maintenance',
      'coop-notification-receipts'
    )
  loop
    perform cron.unschedule(scheduled.jobid);
  end loop;

  if to_regclass('vault.decrypted_secrets') is null then
    return;
  end if;

  execute $schedule$
    select cron.schedule('coop-daily-maintenance', '0 23 * * *',
      $job$
        select net.http_post(
          url := secrets.project_url || '/functions/v1/coop-maintenance',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secrets.service_role_key),
          body := '{"action":"dailyMaintenance"}'::jsonb
        )
        from (
          select
            max(decrypted_secret) filter(where name='coop_project_url') as project_url,
            max(decrypted_secret) filter(where name='coop_service_role_key') as service_role_key
          from vault.decrypted_secrets
          where name in ('coop_project_url','coop_service_role_key')
        ) secrets
        where coalesce(secrets.project_url,'')<>'' and coalesce(secrets.service_role_key,'')<>'';
      $job$
    )
  $schedule$;

  execute $schedule$
    select cron.schedule('coop-notification-receipts', '*/15 * * * *',
      $job$
        select net.http_post(
          url := secrets.project_url || '/functions/v1/coop-maintenance',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || secrets.service_role_key),
          body := '{"action":"processNotificationReceipts"}'::jsonb
        )
        from (
          select
            max(decrypted_secret) filter(where name='coop_project_url') as project_url,
            max(decrypted_secret) filter(where name='coop_service_role_key') as service_role_key
          from vault.decrypted_secrets
          where name in ('coop_project_url','coop_service_role_key')
        ) secrets
        where coalesce(secrets.project_url,'')<>'' and coalesce(secrets.service_role_key,'')<>'';
      $job$
    )
  $schedule$;
end $$;

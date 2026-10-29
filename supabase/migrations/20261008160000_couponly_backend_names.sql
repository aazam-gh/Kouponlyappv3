-- API object names are created as kouponly_* in the current schema migrations.
-- Keep this historical migration as a no-op so fresh databases do not rename them back.
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

notify pgrst, 'reload schema';

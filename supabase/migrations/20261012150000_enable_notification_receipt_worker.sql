-- Only the push worker uses these Vault secrets; configure them through the deployment CLI.
select cron.schedule('kouponly-notification-receipts', '*/15 * * * *', $job$
  select net.http_post(
    url := secrets.project_url || '/functions/v1/kouponly-maintenance',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secrets.service_role_key),
    body := '{"action":"processNotificationReceipts"}'::jsonb
  )
  from (
    select
      max(decrypted_secret) filter (where name='kouponly_push_project_url') as project_url,
      max(decrypted_secret) filter (where name='kouponly_push_service_role_key') as service_role_key
    from vault.decrypted_secrets
    where name in ('kouponly_push_project_url', 'kouponly_push_service_role_key')
  ) secrets
  where coalesce(secrets.project_url, '') <> '' and coalesce(secrets.service_role_key, '') <> '';
$job$);

-- Earlier sends to zero devices were labelled sent and incorrectly consumed quota.
with repaired as (
  update public.couponly_notifications
  set status='failed', data=data || '{"errors":["No registered devices when this campaign was sent"]}'::jsonb
  where status='sent' and total_registered=0 and sent_count=0 and failed_count=0
  returning date_key
), refunded as (
  select date_key, count(*) as count from repaired where date_key is not null group by date_key
)
update public.couponly_notification_daily_limits limits
set count=greatest(0, limits.count-refunded.count), updated_at=now()
from refunded where limits.date_key=refunded.date_key;

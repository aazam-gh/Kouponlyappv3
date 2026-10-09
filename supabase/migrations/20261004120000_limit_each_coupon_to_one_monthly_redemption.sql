-- A coupon can be redeemed once per user in each calendar month.

update public.offer_usage set use_count=1 where use_count>1;

alter table public.offer_usage drop constraint if exists offer_usage_use_count_check;
alter table public.offer_usage add constraint offer_usage_use_count_check check (use_count between 0 and 1);

create or replace function public.record_redemption_usage(p_user_id uuid, p_redemption_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  deal_key text := substring(p_redemption_id from '^deal-([0-9]+)');
  offer_key text := substring(p_redemption_id from '^deal-[0-9]+-([0-9]+)');
  month_start date := date_trunc('month', now())::date;
begin
  if deal_key is null then return; end if;
  insert into public.used_deals(user_id, deal_id) values (p_user_id, deal_key::integer)
    on conflict (user_id, deal_id) do nothing;
  if offer_key is not null then
    insert into public.offer_usage(user_id, offer_id, use_count, period_start)
    values (p_user_id, deal_key || '-' || offer_key, 1, month_start)
    on conflict (user_id, offer_id) do update set
      use_count = 1,
      period_start = month_start,
      updated_at = now();
  end if;
end;
$$;
revoke all on function public.record_redemption_usage(uuid,text) from public, anon, authenticated;

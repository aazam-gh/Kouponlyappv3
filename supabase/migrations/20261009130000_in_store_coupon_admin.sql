-- Normalize compatibility payloads before the existing catalogue synchronization trigger.
create function public.kouponly_in_store_vendor() returns trigger language plpgsql set search_path='' as $$
begin
  if jsonb_typeof(new.payload->'offers')='array' then
    new.payload:=jsonb_set(new.payload,'{offers}',coalesce((select jsonb_agg(value || jsonb_build_object('redemptionMode','inStore') order by ordinality) from jsonb_array_elements(new.payload->'offers') with ordinality),'[]'::jsonb));
  end if;
  return new;
end $$;
create trigger aa_kouponly_in_store_vendor before insert or update on public.couponly_vendors for each row execute function public.kouponly_in_store_vendor();
update public.couponly_vendors set payload=payload where jsonb_typeof(payload->'offers')='array';
update public.couponly_offers set redemption_mode='inStore',payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object('redemptionMode','inStore');
alter table public.couponly_offers add constraint kouponly_in_store_only check(redemption_mode='inStore');
create index if not exists kouponly_coupon_admin_consumed_idx on public.redemptions(consumed_at desc,redemption_id) where round_id is not null;
create or replace function public.kouponly_admin_coupons(p_vendor_id text default null,p_user_id uuid default null,p_search text default '',p_offset integer default 0,p_limit integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
 if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or length(p_search)>200 then raise exception 'Invalid pagination or search' using errcode='22023'; end if;
 with receipts as (
 select r.redemption_id as id,r.user_id as "userId",r.vendor_id as "vendorId",r.offer_id as "offerId",r.code,r.consumed_at as "consumedAt",r.status,r.round_id as "roundId",r.period_id as "periodId",u.email,
 coalesce(r.offer_snapshot->>'vendorName',v.name,r.vendor_id) as vendor,coalesce(r.offer_snapshot->>'title',r.offer_id) as offer
 from public.redemptions r left join auth.users u on u.id=r.user_id left join public.couponly_vendors v on v.id=r.vendor_id
 where r.round_id is not null and r.consumed_at is not null and (p_vendor_id is null or r.vendor_id=p_vendor_id) and (p_user_id is null or r.user_id=p_user_id)
 ), filtered as (select * from receipts where coalesce(p_search,'')='' or concat_ws(' ',vendor,offer,email,code,id) ilike '%'||p_search||'%')
 select jsonb_build_object('total',(select count(*) from filtered),'allTime',(select count(*) from receipts),
 'thisMonth',(select count(*) from receipts where "consumedAt">=month_start),'uniqueUsers',(select count(distinct "userId") from receipts),
 'receipts',coalesce((select jsonb_agg(x order by "consumedAt" desc,id) from (select * from filtered order by "consumedAt" desc,id offset p_offset limit p_limit)x),'[]'::jsonb),
 'vendors',coalesce((select jsonb_agg(x order by count desc,vendor) from (select "vendorId",max(vendor) as vendor,count(*),count(*) filter(where "consumedAt">=month_start) as "thisMonth",count(distinct "userId") as "uniqueUsers" from receipts group by "vendorId" order by count(*) desc,max(vendor) limit 20)x),'[]'::jsonb),
 'daily',coalesce((select jsonb_agg(x order by day) from (select ("consumedAt" at time zone 'Asia/Kolkata')::date as day,count(*) from receipts where "consumedAt">=month_start group by 1)x),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.kouponly_admin_coupons(text,uuid,text,integer,integer) from public,anon;
grant execute on function public.kouponly_admin_coupons(text,uuid,text,integer,integer) to authenticated;
revoke all on function public.kouponly_in_store_vendor() from public,anon,authenticated;
notify pgrst,'reload schema';

create or replace function public.kouponly_admin_mvp_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return jsonb_build_object('eligibleUsers',(select count(*) from auth.users where public.kouponly_school_email(email) and email_confirmed_at is not null and not coalesce(is_anonymous,false)),
    'redemptionsThisMonth',(select count(*) from public.redemptions where consumed_at>=month_start and round_id is not null),
    'referralRefreshes',(select count(*) from public.kouponly_reward_grants where source_type='referral'),
    'recentRedemptions',coalesce((select jsonb_agg(item order by consumed_at desc) from
      (select r.redemption_id as id,r.code,r.consumed_at,u.email,r.offer_snapshot->>'vendorName' as vendor,r.offer_snapshot->>'title' as offer
       from public.redemptions r join auth.users u on u.id=r.user_id where r.consumed_at is not null and r.round_id is not null order by r.consumed_at desc limit 50) item),'[]'::jsonb));
end $$;

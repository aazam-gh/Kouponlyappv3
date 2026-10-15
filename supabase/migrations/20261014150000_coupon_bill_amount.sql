-- The pre-discount bill total belongs to the student/vendor/offer redemption.
-- Historical receipts keep NULL because their bill totals were never collected.
alter table public.redemptions add column bill_amount numeric(12,2)
  check (bill_amount>0 and bill_amount<=9999999999.99);
comment on column public.redemptions.bill_amount is 'Order total before coupon discount, in offer_snapshot.currency.';

CREATE OR REPLACE FUNCTION public.kouponly_redeem_coupon(p_offer_id text, p_round_id uuid, p_mutation_id uuid, p_bill_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid:=auth.uid();
  p public.kouponly_subscription_periods%rowtype;
  r public.kouponly_coupon_rounds%rowtype;
  o record;
  prior public.mutation_receipts%rowtype;
  fp text;
  result jsonb;
  receipt text;
  receipt_code text;
  collision_constraint text;
  code_bytes bytea;
  savings_amount numeric(12,2):=0;
  attempts integer:=0;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if p_mutation_id is null or p_round_id is null or p_offer_id is null then raise exception 'Invalid redemption request'; end if;
  if p_bill_amount is not null and not (p_bill_amount>0 and p_bill_amount<=9999999999.99 and p_bill_amount=round(p_bill_amount,2)) then
    raise exception 'INVALID_BILL_AMOUNT' using errcode='22023';
  end if;
  fp:=encode(extensions.digest('redeem:'||p_offer_id||':'||p_round_id::text
    ||case when p_bill_amount is null then '' else ':'||p_bill_amount::numeric(12,2)::text end,'sha256'),'hex');
  perform public.kouponly_ensure_free_month(uid);
  select * into prior from public.mutation_receipts where user_id=uid and mutation_id=p_mutation_id;
  if found then
    if prior.operation<>'kouponly-redeem-coupon' or prior.request_fingerprint is distinct from fp then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return prior.result;
  end if;
  if p_bill_amount is null then raise exception 'BILL_AMOUNT_REQUIRED' using errcode='22023'; end if;
  select periods.* into p
  from public.kouponly_subscription_periods periods
  join public.kouponly_subscriptions s on s.id=periods.subscription_id
  where periods.user_id=uid and s.provider='free_mvp' and revoked_at is null and starts_at<=now() and ends_at>now();
  if p.id is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  select * into r from public.kouponly_coupon_rounds where period_id=p.id and closed_at is null;
  if r.id is distinct from p_round_id then raise exception 'ROUND_CHANGED'; end if;
  select offers.*,vendors.name as vendor_name into o
  from public.kouponly_entitlement_offers offers
  join public.kouponly_entitlement_vendors vendors on vendors.id=offers.vendor_id
  where offers.id=p_offer_id and offers.active and vendors.status='Active'
    and (offers.starts_at is null or offers.starts_at<=now())
    and (offers.ends_at is null or offers.ends_at>now());
  if not found then raise exception 'OFFER_UNAVAILABLE'; end if;
  if o.redemption_mode<>'inStore' then raise exception 'Online coupon redemption is not available'; end if;
  if exists(
    select 1 from public.redemptions
    where user_id=uid
      and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at
        and period_id in (select id from public.kouponly_subscription_periods where subscription_id in
          (select id from public.kouponly_subscriptions where provider<>'free_mvp'))))
      and offer_id=o.id and consumed_at is not null
  ) then raise exception 'OFFER_ALREADY_USED'; end if;

  savings_amount:=greatest(coalesce(o.offer_value,0),0)::numeric(12,2);
  receipt:='coupon-'||gen_random_uuid()::text;
  loop
    attempts:=attempts+1;
    if attempts>100 then raise exception 'Unable to allocate a confirmation code. Try again.'; end if;
    code_bytes:=extensions.gen_random_bytes(5);
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',1+(get_byte(code_bytes,n)%32),1),'')
      into receipt_code from generate_series(0,4) n;
    begin
      insert into public.redemptions(
        user_id,redemption_id,mode,status,code,completed_at,consumed_at,
        period_id,round_id,vendor_id,offer_id,bill_amount,offer_snapshot
      ) values(
        uid,receipt,'inStore','success',receipt_code,now(),now(),p.id,r.id,o.vendor_id,o.id,p_bill_amount,
        jsonb_build_object('title',o.title,'vendorName',o.vendor_name,
          'estimatedSavings',savings_amount,'currency',o.currency,'billAmount',p_bill_amount)
      );
      exit;
    exception when unique_violation then
      get stacked diagnostics collision_constraint=constraint_name;
      if collision_constraint<>'kouponly_short_receipt_code_unique' then raise; end if;
    end;
  end loop;
  result:=jsonb_build_object('id',receipt,'code',receipt_code,'status','success',
    'consumedAt',extract(epoch from now())*1000,'vendorName',o.vendor_name,
    'offerTitle',o.title,'estimatedSavings',savings_amount,'currency',o.currency,'billAmount',p_bill_amount,
    'benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint)
    values(uid,p_mutation_id,'kouponly-redeem-coupon',result,fp);
  return result;
end $function$
;

-- Older clients may recover existing receipts, but cannot consume a new coupon without a bill.
create or replace function public.kouponly_redeem_coupon(p_offer_id text,p_round_id uuid,p_mutation_id uuid)
returns jsonb language sql security definer set search_path='' as $$
  select public.kouponly_redeem_coupon(p_offer_id,p_round_id,p_mutation_id,null::numeric);
$$;
revoke all on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric) from public,anon;
grant execute on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric) to authenticated;
revoke all on function public.kouponly_redeem_coupon(text,uuid,uuid) from public,anon;
grant execute on function public.kouponly_redeem_coupon(text,uuid,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.kouponly_admin_coupons(p_vendor_id text DEFAULT NULL::text, p_user_id uuid DEFAULT NULL::uuid, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 25)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb; month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
 if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or length(p_search)>200 then raise exception 'Invalid pagination or search' using errcode='22023'; end if;
 with receipts as (
 select r.redemption_id as id,r.user_id as "userId",r.vendor_id as "vendorId",r.offer_id as "offerId",r.bill_amount as "billAmount",r.offer_snapshot->>'currency' as currency,r.code,r.consumed_at as "consumedAt",r.status,r.round_id as "roundId",r.period_id as "periodId",u.email,
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
end $function$
;
notify pgrst,'reload schema';

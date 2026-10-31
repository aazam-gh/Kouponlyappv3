-- NULL branch IDs are historical redemptions with unknown branch: preserve their used status.
alter table public.redemptions add column branch_id text;
drop index if exists public.kouponly_offer_redemption_once_idx;
create unique index kouponly_offer_branch_redemption_once_idx
  on public.redemptions(user_id,round_id,offer_id,coalesce(branch_id,''))
  where round_id is not null and consumed_at is not null;

create or replace function public.kouponly_account_benefits()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid();
  p public.kouponly_subscription_periods%rowtype;
  r public.kouponly_coupon_rounds%rowtype;
  code text;
  referral jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if not public.kouponly_is_benefits_admin() or public.kouponly_has_verified_email(uid) then
    perform public.kouponly_ensure_free_month(uid);
  end if;
  code:=public.kouponly_allocate_invite(uid);
  select periods.* into p
  from public.kouponly_subscription_periods periods
  join public.kouponly_subscriptions s on s.id=periods.subscription_id
  where periods.user_id=uid and s.provider='free_mvp' and revoked_at is null and starts_at<=now() and ends_at>now();
  if p.id is not null then
    select * into r from public.kouponly_coupon_rounds where period_id=p.id and closed_at is null;
  end if;
  select jsonb_build_object('status',status,'reason',reason) into referral
  from public.referral_uses where referred_user_id=uid;
  return jsonb_build_object(
    'inviteCode',code,
    'serverTime',now(),
    'referral',referral,
    'referralCount',(select count(*) from public.referral_uses where inviter_user_id=uid),
    'rewardedReferrals',(select count(*) from public.kouponly_reward_grants where user_id=uid and source_type='referral'),
    'referralLimit',(select max_rewards_per_period from public.kouponly_referral_policy where id),
    'subscription',case when p.id is null then null else jsonb_build_object(
      'periodId',p.id,'startsAt',p.starts_at,'endsAt',p.ends_at,'roundId',r.id,'roundNumber',r.round_number,
      'planName',(select pl.name from public.kouponly_subscriptions s join public.kouponly_subscription_plans pl on pl.id=s.plan_id where s.id=p.subscription_id),
      'cancelAtPeriodEnd',(select cancel_at_period_end from public.kouponly_subscriptions where id=p.subscription_id)
    ) end,
    -- Retain the old property during rollout for clients that still read it.
    'usedVendorIds',coalesce((select jsonb_agg(distinct vendor_id) from public.redemptions
      where user_id=uid and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at
        and period_id in (select id from public.kouponly_subscription_periods where subscription_id in
          (select id from public.kouponly_subscriptions where provider<>'free_mvp')))) and consumed_at is not null),'[]'::jsonb),
    'usedOfferIds',coalesce((select jsonb_agg(distinct offer_id) from public.redemptions
      where user_id=uid and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at
        and period_id in (select id from public.kouponly_subscription_periods where subscription_id in
          (select id from public.kouponly_subscriptions where provider<>'free_mvp')))) and consumed_at is not null),'[]'::jsonb),
    'usedOfferBranches',coalesce((select jsonb_agg(distinct jsonb_build_object('offerId',offer_id,'branchId',branch_id)) from public.redemptions
      where user_id=uid and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at
        and period_id in (select id from public.kouponly_subscription_periods where subscription_id in
          (select id from public.kouponly_subscriptions where provider<>'free_mvp')))) and consumed_at is not null),'[]'::jsonb)
  );
end $$;

CREATE OR REPLACE FUNCTION public.kouponly_redeem_coupon(p_offer_id text, p_round_id uuid, p_mutation_id uuid, p_bill_amount numeric, p_free_item_amount numeric, p_branch_id text)
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
  savings_amount numeric(12,2):=0; payable_amount numeric(12,2);
  attempts integer:=0;
  branch_key text; branch_name text; locations jsonb; scope jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if p_mutation_id is null or p_round_id is null or p_offer_id is null then raise exception 'Invalid redemption request'; end if;
  if p_bill_amount is not null and not (p_bill_amount>0 and p_bill_amount<=9999999999.99 and p_bill_amount=round(p_bill_amount,2)) then
    raise exception 'INVALID_BILL_AMOUNT' using errcode='22023';
  end if;
  fp:=encode(extensions.digest('redeem:'||p_offer_id||':'||p_round_id::text
    ||case when p_bill_amount is null then '' else ':'||p_bill_amount::numeric(12,2)::text end
    ||case when p_free_item_amount is null then '' else ':free:'||p_free_item_amount::numeric(12,2)::text end
    ||case when p_branch_id is null then '' else ':branch:'||p_branch_id end,'sha256'),'hex');
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
  select v.locations, f.payload->'branchIds' into locations, scope
    from public.couponly_vendors v join public.couponly_offers f on f.vendor_id=v.id where f.id=p_offer_id;
  locations:=coalesce(locations,'[]'::jsonb);
  if jsonb_array_length(locations)=0 then
    if coalesce(p_branch_id,'')<>'' then raise exception 'BRANCH_UNAVAILABLE'; end if;
    branch_key:='';
  else
    if p_branch_id is null and jsonb_array_length(locations)>1 then raise exception 'BRANCH_REQUIRED'; end if;
    branch_key:=coalesce(p_branch_id,locations->0->>'id');
    select coalesce(x->>'name',x->>'address') into branch_name from jsonb_array_elements(locations) x where x->>'id'=branch_key;
    if not found then raise exception 'BRANCH_UNAVAILABLE'; end if;
    if coalesce(jsonb_array_length(scope),0)>0 and not scope ? branch_key then raise exception 'OFFER_UNAVAILABLE_AT_BRANCH'; end if;
  end if;

  if exists(
    select 1 from public.redemptions
    where user_id=uid
      and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at
        and period_id in (select id from public.kouponly_subscription_periods where subscription_id in
          (select id from public.kouponly_subscriptions where provider<>'free_mvp'))))
      and offer_id=o.id and (branch_id is null or branch_id=branch_key) and consumed_at is not null
  ) then raise exception 'OFFER_ALREADY_USED'; end if;

  case o.discount_type
    when 'percentage' then
      if o.discount_value is null or o.discount_value not between 0 and 100 then raise exception 'Invalid offer percentage'; end if;
      savings_amount:=round(p_bill_amount*o.discount_value/100,2);
    when 'amount' then
      if o.discount_value is null or o.discount_value<0 then raise exception 'Invalid offer discount'; end if;
      savings_amount:=least(p_bill_amount,round(o.discount_value,2));
    when 'free' then savings_amount:=p_bill_amount;
    when 'buy1get1' then
      if p_free_item_amount is null or not (p_free_item_amount>0 and p_free_item_amount<=p_bill_amount/2 and p_free_item_amount=round(p_free_item_amount,2)) then raise exception 'Enter the cheaper item price for Buy 1 Get 1'; end if;
      savings_amount:=p_free_item_amount;
    when 'combo', 'fixed_price' then
      if o.discount_value is null or not (o.discount_value>=0 and o.discount_value<=p_bill_amount) then raise exception 'Bill must cover the exclusive price'; end if;
      savings_amount:=p_bill_amount-round(o.discount_value,2);
    else raise exception 'This offer needs a supported discount type before redemption';
  end case;
  payable_amount:=p_bill_amount-savings_amount;
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
        period_id,round_id,vendor_id,offer_id,bill_amount,branch_id,offer_snapshot
      ) values(
        uid,receipt,'inStore','success',receipt_code,now(),now(),p.id,r.id,o.vendor_id,o.id,p_bill_amount,branch_key,
        jsonb_build_object('title',o.title,'vendorName',o.vendor_name,
          'branchId',branch_key,'branchName',branch_name,'estimatedSavings',savings_amount,'payableAmount',payable_amount,'currency',o.currency,'billAmount',p_bill_amount)
      );
      exit;
    exception when unique_violation then
      get stacked diagnostics collision_constraint=constraint_name;
      if collision_constraint<>'kouponly_short_receipt_code_unique' then raise; end if;
    end;
  end loop;
  result:=jsonb_build_object('id',receipt,'code',receipt_code,'status','success',
    'consumedAt',extract(epoch from now())*1000,'vendorName',o.vendor_name,
    'offerTitle',o.title,'branchId',branch_key,'branchName',branch_name,'estimatedSavings',savings_amount,'payableAmount',payable_amount,'currency',o.currency,'billAmount',p_bill_amount,
    'benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint)
    values(uid,p_mutation_id,'kouponly-redeem-coupon',result,fp);
  return result;
end $function$
;



-- Existing clients may recover receipts; fresh multi-branch redemptions require branch selection.
create or replace function public.kouponly_redeem_coupon(p_offer_id text,p_round_id uuid,p_mutation_id uuid,p_bill_amount numeric,p_free_item_amount numeric)
returns jsonb language sql security definer set search_path='' as $$
 select public.kouponly_redeem_coupon(p_offer_id,p_round_id,p_mutation_id,p_bill_amount,p_free_item_amount,null::text);
$$;
revoke all on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric,text) from public,anon;
grant execute on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric,text) to authenticated;
revoke all on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric) to authenticated;
notify pgrst,'reload schema';

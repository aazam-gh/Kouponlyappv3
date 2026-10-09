-- Qualify before taking a single-account mutation lock; terminal referrals need no second account lock.
create or replace function public.kouponly_qualify_referral(p_referred uuid) returns text language plpgsql security definer set search_path='' as $$
declare inviter uuid; r public.referral_uses%rowtype; period uuid; reward uuid; cap integer; begin
  select * into r from public.referral_uses where referred_user_id=p_referred;
  if r.inviter_user_id is null then return null; end if;
  if r.status<>'attached' then return r.status; end if;
  if not exists(select 1 from auth.users where id=p_referred and not coalesce(is_anonymous,false) and (email_confirmed_at is not null or phone_confirmed_at is not null)) then return 'attached'; end if;
  inviter:=r.inviter_user_id;
  -- Every path locks both accounts in UUID order, avoiding attribution/qualification deadlocks.
  perform public.kouponly_lock_account(least(p_referred,inviter)); perform public.kouponly_lock_account(greatest(p_referred,inviter));
  select * into r from public.referral_uses where referred_user_id=p_referred for update;
  if r.status<>'attached' then return r.status; end if;
  if not exists(select 1 from auth.users where id=p_referred and not coalesce(is_anonymous,false) and (email_confirmed_at is not null or phone_confirmed_at is not null)) then return 'attached'; end if;
  select id into period from public.kouponly_subscription_periods where user_id=inviter and revoked_at is null and starts_at<=now() and ends_at>now();
  select max_rewards_per_period into cap from public.kouponly_referral_policy where id;
  if period is null then
    update public.referral_uses set status='ineligible',qualified_at=now(),reason='NO_ACTIVE_SUBSCRIPTION' where referred_user_id=p_referred; return 'ineligible';
  end if;
  if (select count(*) from public.kouponly_reward_grants where user_id=inviter and period_id=period and source_type='referral')>=cap then
    update public.referral_uses set status='ineligible',qualified_at=now(),reason='REFERRAL_LIMIT_REACHED' where referred_user_id=p_referred; return 'ineligible';
  end if;
  reward:=public.kouponly_open_reward_round(inviter,period,'referral',p_referred::text);
  update public.referral_uses set status='rewarded',qualified_at=now(),reward_grant_id=reward where referred_user_id=p_referred;
  return 'rewarded';
end $$;

create or replace function public.kouponly_claim_code_inner(p_code text,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); code text:=upper(trim(p_code)); inviter uuid; existing uuid; v public.kouponly_vouchers%rowtype; period uuid; claim uuid; result jsonb; prior public.mutation_receipts%rowtype; fp text; status text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if p_mutation_id is null or code is null or length(code) not between 5 and 40 then raise exception 'INVALID_CODE'; end if;
  fp:=encode(extensions.digest('claim:'||code,'sha256'),'hex');
  if length(code)=5 then select user_id into inviter from public.kouponly_invite_codes where kouponly_invite_codes.code=code; end if;
  if inviter is not null then
    perform public.kouponly_lock_account(least(uid,inviter)); perform public.kouponly_lock_account(greatest(uid,inviter));
  else perform public.kouponly_lock_account(uid); end if;
  select * into prior from public.mutation_receipts where user_id=uid and mutation_id=p_mutation_id;
  if found then
    if prior.operation<>'claim-code' or prior.request_fingerprint is distinct from fp then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return prior.result;
  end if;
  if length(code)=5 then
    if inviter is null then raise exception 'INVALID_CODE'; end if;
    if inviter=uid then raise exception 'SELF_REFERRAL'; end if;
    select inviter_user_id into existing from public.referral_uses where referred_user_id=uid;
    if existing is not null and existing<>inviter then raise exception 'INVITE_ALREADY_ATTACHED'; end if;
    if existing is null then
      if not exists(select 1 from auth.users u where u.id=uid and not coalesce(is_anonymous,false) and u.created_at>=now()-(select signup_window_days from public.kouponly_referral_policy where id)*interval '1 day') then raise exception 'INVITE_WINDOW_CLOSED'; end if;
      insert into public.referral_uses(referred_user_id,inviter_user_id,status) values(uid,inviter,'attached');
    end if;
    status:=public.kouponly_qualify_referral(uid);
    result:=jsonb_build_object('kind','invite','status',status,'rewardRecipient','inviter');
  else
    if code !~ '^KPN-[A-Z0-9-]{4,36}$' then raise exception 'INVALID_CODE'; end if;
    select id into period from public.kouponly_subscription_periods where user_id=uid and revoked_at is null and starts_at<=now() and ends_at>now();
    if period is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
    select * into v from public.kouponly_vouchers where code_digest=encode(extensions.digest(code,'sha256'),'hex') for update;
    if v.id is null then raise exception 'INVALID_CODE'; end if;
    if not v.active or v.starts_at>now() or v.ends_at<=now() then raise exception 'VOUCHER_EXPIRED'; end if;
    if exists(select 1 from public.kouponly_voucher_claims where user_id=uid and voucher_id=v.id) then raise exception 'VOUCHER_ALREADY_USED'; end if;
    if v.claimed_count>=v.max_claims then raise exception 'VOUCHER_EXHAUSTED'; end if;
    insert into public.kouponly_voucher_claims(voucher_id,user_id,period_id) values(v.id,uid,period) returning id into claim;
    update public.kouponly_vouchers set claimed_count=claimed_count+1 where id=v.id;
    perform public.kouponly_open_reward_round(uid,period,'voucher',claim::text);
    result:=jsonb_build_object('kind','voucher','status','rewarded','rewardRecipient','self');
  end if;
  result:=result||jsonb_build_object('benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint) values(uid,p_mutation_id,'claim-code',result,fp);
  return result;
end $$;

create or replace function public.kouponly_redeem_coupon(p_offer_id text,p_round_id uuid,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.kouponly_subscription_periods%rowtype; r public.kouponly_coupon_rounds%rowtype;
  o record; prior public.mutation_receipts%rowtype; fp text; result jsonb; receipt text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if p_mutation_id is null or p_round_id is null or p_offer_id is null then raise exception 'Invalid redemption request'; end if;
  fp:=encode(extensions.digest('redeem:'||p_offer_id||':'||p_round_id::text,'sha256'),'hex');
  perform public.kouponly_lock_account(uid);
  select * into prior from public.mutation_receipts where user_id=uid and mutation_id=p_mutation_id;
  if found then
    if prior.operation<>'kouponly-redeem-coupon' or prior.request_fingerprint is distinct from fp then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return prior.result;
  end if;
  select * into p from public.kouponly_subscription_periods where user_id=uid and revoked_at is null and starts_at<=now() and ends_at>now();
  if p.id is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  select * into r from public.kouponly_coupon_rounds where period_id=p.id and closed_at is null;
  if r.id is distinct from p_round_id then raise exception 'ROUND_CHANGED'; end if;
  select offers.*,vendors.name as vendor_name into o from public.kouponly_entitlement_offers offers join public.kouponly_entitlement_vendors vendors on vendors.id=offers.vendor_id
    where offers.id=p_offer_id and offers.active and vendors.status='Active' and (offers.starts_at is null or offers.starts_at<=now()) and (offers.ends_at is null or offers.ends_at>now());
  if not found then raise exception 'OFFER_UNAVAILABLE'; end if;
  if o.redemption_mode<>'inStore' then raise exception 'Online coupon redemption is not available'; end if;
  if exists(select 1 from public.redemptions where user_id=uid and round_id=r.id and vendor_id=o.vendor_id and consumed_at is not null) then raise exception 'VENDOR_ALREADY_USED'; end if;
  receipt:='coupon-'||gen_random_uuid()::text;
  insert into public.redemptions(user_id,redemption_id,mode,status,completed_at,consumed_at,period_id,round_id,vendor_id,offer_id,offer_snapshot)
  values(uid,receipt,'inStore','success',now(),now(),p.id,r.id,o.vendor_id,o.id,jsonb_build_object('title',o.title,'vendorName',o.vendor_name));
  result:=jsonb_build_object('id',receipt,'status','success','consumedAt',extract(epoch from now())*1000,'vendorName',o.vendor_name,'offerTitle',o.title,'benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint) values(uid,p_mutation_id,'kouponly-redeem-coupon',result,fp);
  return result;
end $$;
notify pgrst,'reload schema';

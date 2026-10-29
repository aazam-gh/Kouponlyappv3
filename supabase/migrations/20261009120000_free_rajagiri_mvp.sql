-- Free Rajagiri MVP. Keep paid periods and historical receipts for audit.
update public.kouponly_referral_policy set max_rewards_per_period=3 where id;
insert into public.kouponly_subscription_plans(id,name) values('free_mvp','Free Rajagiri membership') on conflict(id) do update set name=excluded.name;

create function public.kouponly_school_email(p_email text) returns boolean language sql immutable set search_path='' as $$
  select coalesce(lower(trim(p_email)) ~ '^[^@[:space:]]+@rajagiri[.]edu[.]in$',false);
$$;
create function public.kouponly_guard_signup_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.email is distinct from old.email then
    if coalesce(new.is_anonymous,false) or not public.kouponly_school_email(new.email) then
      raise exception 'Signup requires an @rajagiri.edu.in email address' using errcode='42501';
    end if;
  end if;
  return new;
end $$;
create trigger kouponly_guard_signup_email before insert or update of email on auth.users for each row execute function public.kouponly_guard_signup_email();

create function public.kouponly_ensure_free_month(p_uid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare sub uuid; period uuid;
  month_start timestamptz := date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  month_end timestamptz := (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month') at time zone 'Asia/Kolkata';
begin
  if not exists(select 1 from auth.users where id=p_uid and not coalesce(is_anonymous,false) and public.kouponly_school_email(email) and email_confirmed_at is not null) then
    raise exception 'Verified @rajagiri.edu.in email required' using errcode='42501';
  end if;
  perform public.kouponly_lock_account(p_uid);
  insert into public.kouponly_subscriptions(user_id,plan_id,provider,provider_subscription_id)
    values(p_uid,'free_mvp','free_mvp',p_uid::text) on conflict(provider,provider_subscription_id) do nothing;
  select id into sub from public.kouponly_subscriptions where user_id=p_uid and provider='free_mvp';
  insert into public.kouponly_subscription_periods(user_id,subscription_id,provider_period_key,starts_at,ends_at)
    values(p_uid,sub,to_char(month_start at time zone 'Asia/Kolkata','YYYY-MM'),month_start,month_end)
    on conflict(subscription_id,provider_period_key) do nothing;
  select id into period from public.kouponly_subscription_periods where subscription_id=sub and starts_at=month_start and revoked_at is null;
  if period is null then raise exception 'Account access unavailable'; end if;
  insert into public.kouponly_coupon_rounds(user_id,period_id,round_number) values(p_uid,period,0) on conflict(period_id,round_number) do nothing;
  return period;
end $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,'')) on conflict(user_id) do nothing;
  perform public.kouponly_allocate_invite(new.id);
  -- Untrusted signup metadata only records attribution; qualification happens after verification.
  insert into public.referral_uses(referred_user_id,inviter_user_id,status)
  select new.id,c.user_id,'attached' from public.kouponly_invite_codes c
  where c.code=upper(trim(new.raw_user_meta_data->>'referral_code')) and c.user_id is not null and c.user_id<>new.id
  on conflict(referred_user_id) do nothing;
  -- Qualification waits for a benefits read or verification update to acquire ordered locks.
  return new;
end $$;

-- Preserve each deployed signup contract and its existing profile validation.
do $$ declare f record; begin
  for f in select proname from pg_proc where pronamespace='public'::regnamespace and proname in ('kouponly_complete_signup','couponly_complete_signup','kouponly_complete_signup') loop
    execute format('alter function public.%I(jsonb) rename to %I',f.proname,f.proname||'_pre_mvp');
    execute format('revoke all on function public.%I(jsonb) from public,anon,authenticated,service_role',f.proname||'_pre_mvp');
    execute format('create function public.%I(p_profile jsonb) returns jsonb language plpgsql security definer set search_path='''' as $body$ begin perform public.kouponly_ensure_free_month(auth.uid()); return public.%I(p_profile); end $body$',f.proname,f.proname||'_pre_mvp');
    execute format('revoke all on function public.%I(jsonb) from public,anon',f.proname);
    execute format('grant execute on function public.%I(jsonb) to authenticated',f.proname);
  end loop;
end $$;

create or replace function public.kouponly_qualify_referral(p_referred uuid) returns text language plpgsql security definer set search_path='' as $$
declare inviter uuid; r public.referral_uses%rowtype; period uuid; reward uuid; cap integer; begin
  select * into r from public.referral_uses where referred_user_id=p_referred;
  if r.inviter_user_id is null then return null; end if;
  if r.status<>'attached' then return r.status; end if;
  if not exists(select 1 from auth.users where id=p_referred and not coalesce(is_anonymous,false) and email_confirmed_at is not null and public.kouponly_school_email(email)) then return 'attached'; end if;
  inviter:=r.inviter_user_id;
  -- Every path locks both accounts in UUID order, avoiding attribution/qualification deadlocks.
  perform public.kouponly_lock_account(least(p_referred,inviter)); perform public.kouponly_lock_account(greatest(p_referred,inviter));
  select * into r from public.referral_uses where referred_user_id=p_referred for update;
  if r.status<>'attached' then return r.status; end if;
  if not exists(select 1 from auth.users where id=p_referred and not coalesce(is_anonymous,false) and email_confirmed_at is not null and public.kouponly_school_email(email)) then return 'attached'; end if;
  if exists(select 1 from auth.users where id=inviter and email_confirmed_at is not null and public.kouponly_school_email(email)) then period:=public.kouponly_ensure_free_month(inviter); end if;
  select max_rewards_per_period into cap from public.kouponly_referral_policy where id;
  if period is null then
    update public.referral_uses set status='ineligible',qualified_at=now(),reason='INVITER_NOT_ELIGIBLE' where referred_user_id=p_referred; return 'ineligible';
  end if;
  if (select count(*) from public.kouponly_reward_grants where user_id=inviter and source_type='referral')>=cap then
    update public.referral_uses set status='ineligible',qualified_at=now(),reason='REFERRAL_LIMIT_REACHED' where referred_user_id=p_referred; return 'ineligible';
  end if;
  reward:=public.kouponly_open_reward_round(inviter,period,'referral',p_referred::text);
  update public.referral_uses set status='rewarded',qualified_at=now(),reward_grant_id=reward where referred_user_id=p_referred;
  return 'rewarded';
end $$;

create or replace function public.kouponly_account_benefits() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.kouponly_subscription_periods%rowtype; r public.kouponly_coupon_rounds%rowtype; code text; referral jsonb; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if not public.kouponly_is_benefits_admin() or exists(select 1 from auth.users where id=uid and public.kouponly_school_email(email)) then perform public.kouponly_ensure_free_month(uid); end if;
  code:=public.kouponly_allocate_invite(uid);
  -- Allocator's account lock also serializes reads with refresh/redeem.
  select periods.* into p from public.kouponly_subscription_periods periods join public.kouponly_subscriptions s on s.id=periods.subscription_id where periods.user_id=uid and s.provider='free_mvp' and revoked_at is null and starts_at<=now() and ends_at>now();
  if p.id is not null then select * into r from public.kouponly_coupon_rounds where period_id=p.id and closed_at is null; end if;
  select jsonb_build_object('status',status,'reason',reason) into referral from public.referral_uses where referred_user_id=uid;
  return jsonb_build_object('inviteCode',code,'serverTime',now(),'referral',referral,
    'referralCount',(select count(*) from public.referral_uses where inviter_user_id=uid),
    'rewardedReferrals',(select count(*) from public.kouponly_reward_grants where user_id=uid and source_type='referral'),
    'referralLimit',(select max_rewards_per_period from public.kouponly_referral_policy where id),
    'subscription',case when p.id is null then null else jsonb_build_object('periodId',p.id,'startsAt',p.starts_at,'endsAt',p.ends_at,'roundId',r.id,'roundNumber',r.round_number,
      'planName',(select pl.name from public.kouponly_subscriptions s join public.kouponly_subscription_plans pl on pl.id=s.plan_id where s.id=p.subscription_id),
      'cancelAtPeriodEnd',(select cancel_at_period_end from public.kouponly_subscriptions where id=p.subscription_id)) end,
    'usedVendorIds',coalesce((select jsonb_agg(distinct vendor_id) from public.redemptions where user_id=uid and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at and period_id in (select id from public.kouponly_subscription_periods where subscription_id in (select id from public.kouponly_subscriptions where provider<>'free_mvp')))) and consumed_at is not null),'[]'::jsonb));
end $$;

create or replace function public.kouponly_claim_code_inner(p_code text,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); code text:=upper(trim(p_code)); inviter uuid; existing uuid; result jsonb; prior public.mutation_receipts%rowtype; fp text; status text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if not exists(select 1 from auth.users where id=uid and public.kouponly_school_email(email) and email_confirmed_at is not null) then raise exception 'Verified @rajagiri.edu.in email required'; end if;
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
      insert into public.referral_uses(referred_user_id,inviter_user_id,status) values(uid,inviter,'attached');
    end if;
    status:=public.kouponly_qualify_referral(uid);
    result:=jsonb_build_object('kind','invite','status',status,'rewardRecipient','inviter');
  else
    raise exception 'Only personal invite codes are available in the free MVP';
  end if;
  result:=result||jsonb_build_object('benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint) values(uid,p_mutation_id,'claim-code',result,fp);
  return result;
end $$;

create or replace function public.kouponly_redeem_coupon(p_offer_id text,p_round_id uuid,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.kouponly_subscription_periods%rowtype; r public.kouponly_coupon_rounds%rowtype;
  o record; prior public.mutation_receipts%rowtype; fp text; result jsonb; receipt text; receipt_code text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if p_mutation_id is null or p_round_id is null or p_offer_id is null then raise exception 'Invalid redemption request'; end if;
  fp:=encode(extensions.digest('redeem:'||p_offer_id||':'||p_round_id::text,'sha256'),'hex');
  perform public.kouponly_ensure_free_month(uid);
  select * into prior from public.mutation_receipts where user_id=uid and mutation_id=p_mutation_id;
  if found then
    if prior.operation<>'kouponly-redeem-coupon' or prior.request_fingerprint is distinct from fp then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return prior.result;
  end if;
  select periods.* into p from public.kouponly_subscription_periods periods join public.kouponly_subscriptions s on s.id=periods.subscription_id where periods.user_id=uid and s.provider='free_mvp' and revoked_at is null and starts_at<=now() and ends_at>now();
  if p.id is null then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  select * into r from public.kouponly_coupon_rounds where period_id=p.id and closed_at is null;
  if r.id is distinct from p_round_id then raise exception 'ROUND_CHANGED'; end if;
  select offers.*,vendors.name as vendor_name into o from public.kouponly_entitlement_offers offers join public.kouponly_entitlement_vendors vendors on vendors.id=offers.vendor_id
    where offers.id=p_offer_id and offers.active and vendors.status='Active' and (offers.starts_at is null or offers.starts_at<=now()) and (offers.ends_at is null or offers.ends_at>now());
  if not found then raise exception 'OFFER_UNAVAILABLE'; end if;
  if o.redemption_mode<>'inStore' then raise exception 'Online coupon redemption is not available'; end if;
  if exists(select 1 from public.redemptions where user_id=uid and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at and period_id in (select id from public.kouponly_subscription_periods where subscription_id in (select id from public.kouponly_subscriptions where provider<>'free_mvp')))) and vendor_id=o.vendor_id and consumed_at is not null) then raise exception 'VENDOR_ALREADY_USED'; end if;
  receipt:='coupon-'||gen_random_uuid()::text;
  receipt_code:=upper(replace(substr(receipt,8),'-',''));
  insert into public.redemptions(user_id,redemption_id,mode,status,code,completed_at,consumed_at,period_id,round_id,vendor_id,offer_id,offer_snapshot)
  values(uid,receipt,'inStore','success',receipt_code,now(),now(),p.id,r.id,o.vendor_id,o.id,jsonb_build_object('title',o.title,'vendorName',o.vendor_name));
  result:=jsonb_build_object('id',receipt,'code',receipt_code,'status','success','consumedAt',extract(epoch from now())*1000,'vendorName',o.vendor_name,'offerTitle',o.title,'benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint) values(uid,p_mutation_id,'kouponly-redeem-coupon',result,fp);
  return result;
end $$;

-- Old clients remain unable to bypass month/round validation.
create or replace function public.validate_redemption_atomic(p_redemption_id text,p_mode text,p_idempotency_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin raise exception 'Update Kouponly to redeem free monthly coupons' using errcode='0A000'; end $$;

-- Suspend prepaid issuance and manual refresh vouchers during the free MVP.
create or replace function public.kouponly_apply_billing_event(p_event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$ begin raise exception 'Payments are disabled for the free MVP'; end $$;
create or replace function public.kouponly_admin_create_voucher(p_label text,p_max_claims integer,p_ends_at timestamptz,p_mutation_id uuid default gen_random_uuid()) returns jsonb language plpgsql security definer set search_path='' as $$ begin raise exception 'Manual refresh vouchers are disabled for the free MVP'; end $$;

create function public.kouponly_admin_mvp_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return jsonb_build_object('eligibleUsers',(select count(*) from auth.users where public.kouponly_school_email(email) and email_confirmed_at is not null and not coalesce(is_anonymous,false)),
    'redemptionsThisMonth',(select count(*) from public.redemptions where consumed_at>=month_start),
    'referralRefreshes',(select count(*) from public.kouponly_reward_grants where source_type='referral'),
    'recentRedemptions',coalesce((select jsonb_agg(item order by consumed_at desc) from
      (select r.redemption_id as id,r.code,r.consumed_at,u.email,r.offer_snapshot->>'vendorName' as vendor,r.offer_snapshot->>'title' as offer
       from public.redemptions r join auth.users u on u.id=r.user_id where r.consumed_at is not null and r.round_id is not null order by r.consumed_at desc limit 50) item),'[]'::jsonb));
end $$;
revoke all on function public.kouponly_school_email(text),public.kouponly_guard_signup_email(),public.kouponly_ensure_free_month(uuid),public.kouponly_admin_mvp_overview() from public,anon,authenticated;
grant execute on function public.kouponly_admin_mvp_overview() to authenticated;
notify pgrst,'reload schema';

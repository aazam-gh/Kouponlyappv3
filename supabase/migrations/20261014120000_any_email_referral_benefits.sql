-- Coupons and personal referral refreshes are available to every verified email account.
create function public.kouponly_has_verified_email(p_uid uuid)
returns boolean language sql set search_path='' as $$
  select exists(select 1 from auth.users where id=p_uid
    and not coalesce(is_anonymous,false)
    and nullif(trim(email),'') is not null and email_confirmed_at is not null);
$$;
revoke all on function public.kouponly_has_verified_email(uuid) from public,anon,authenticated,service_role;

update public.kouponly_subscription_plans set name='Free Kouponly membership' where id='free_mvp';


create or replace function public.kouponly_ensure_free_month(p_uid uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare sub uuid; period uuid;
  month_start timestamptz := date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  month_end timestamptz := (date_trunc('month',now() at time zone 'Asia/Kolkata')+interval '1 month') at time zone 'Asia/Kolkata';
begin
  if not public.kouponly_has_verified_email(p_uid) then
    raise exception 'Verified email required' using errcode='42501';
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

create or replace function public.kouponly_qualify_referral(p_referred uuid) returns text language plpgsql security definer set search_path='' as $$
declare inviter uuid; r public.referral_uses%rowtype; period uuid; reward uuid; cap integer; begin
  select * into r from public.referral_uses where referred_user_id=p_referred;
  if r.inviter_user_id is null then return null; end if;
  if r.status<>'attached' then return r.status; end if;
  if not public.kouponly_has_verified_email(p_referred) then return 'attached'; end if;
  inviter:=r.inviter_user_id;
  -- Every path locks both accounts in UUID order, avoiding attribution/qualification deadlocks.
  perform public.kouponly_lock_account(least(p_referred,inviter)); perform public.kouponly_lock_account(greatest(p_referred,inviter));
  select * into r from public.referral_uses where referred_user_id=p_referred for update;
  if r.status<>'attached' then return r.status; end if;
  if not public.kouponly_has_verified_email(p_referred) then return 'attached'; end if;
  if public.kouponly_has_verified_email(inviter) then period:=public.kouponly_ensure_free_month(inviter); end if;
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
          (select id from public.kouponly_subscriptions where provider<>'free_mvp')))) and consumed_at is not null),'[]'::jsonb)
  );
end $$;

create or replace function public.kouponly_claim_code_inner(p_code text,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); code text:=upper(trim(p_code)); inviter uuid; existing uuid; result jsonb; prior public.mutation_receipts%rowtype; fp text; status text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if not public.kouponly_has_verified_email(uid) then raise exception 'Verified email required'; end if;
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

create or replace function public.kouponly_admin_mvp_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  return jsonb_build_object('eligibleUsers',(select count(*) from auth.users where public.kouponly_has_verified_email(id)),
    'redemptionsThisMonth',(select count(*) from public.redemptions where consumed_at>=month_start),
    'referralRefreshes',(select count(*) from public.kouponly_reward_grants where source_type='referral'),
    'recentRedemptions',coalesce((select jsonb_agg(item order by consumed_at desc) from
      (select r.redemption_id as id,r.code,r.consumed_at,u.email,r.offer_snapshot->>'vendorName' as vendor,r.offer_snapshot->>'title' as offer
       from public.redemptions r join auth.users u on u.id=r.user_id where r.consumed_at is not null and r.round_id is not null order by r.consumed_at desc limit 50) item),'[]'::jsonb));
end $$;

create or replace function public.kouponly_admin_students(
  p_search text default '',p_offset integer default 0,p_limit integer default 25,p_user_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  result jsonb;
  month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 or p_search is null or length(p_search)>200 then
    raise exception 'Invalid pagination or search' using errcode='22023';
  end if;
  with students as (
    select u.id,u.email,coalesce(nullif(p.full_name,''),nullif(concat_ws(' ',s.first_name,s.last_name),''),nullif(u.raw_user_meta_data->>'full_name',''),'Unnamed student') as name,
      p.city,coalesce(p.mobile,s.phone) as phone,u.created_at as "createdAt",u.email_confirmed_at as "emailVerifiedAt",
      public.kouponly_has_verified_email(u.id) as eligible,
      (select code from public.kouponly_invite_codes where user_id=u.id) as "inviteCode",
      (select count(*) from public.kouponly_reward_grants where user_id=u.id and source_type='referral') as "referralRefreshes",
      (select max_rewards_per_period from public.kouponly_referral_policy where id) as "referralLimit",
      (select count(*) from public.referral_uses where inviter_user_id=u.id) as "invitedFriends",
      (select count(*) from public.redemptions where user_id=u.id and round_id is not null and consumed_at>=month_start) as "consumedThisMonth",
      (select jsonb_build_object('startsAt',sp.starts_at,'endsAt',sp.ends_at,'roundNumber',r.round_number,
         'usedOffers',(select count(distinct offer_id) from public.redemptions where user_id=u.id and consumed_at is not null
           and (round_id=r.id or (r.round_number=0 and consumed_at>=sp.starts_at and consumed_at<sp.ends_at
             and period_id in (select periods.id from public.kouponly_subscription_periods periods join public.kouponly_subscriptions paid on paid.id=periods.subscription_id where paid.provider<>'free_mvp')))))
       from public.kouponly_subscription_periods sp join public.kouponly_subscriptions sub on sub.id=sp.subscription_id
       left join public.kouponly_coupon_rounds r on r.period_id=sp.id and r.closed_at is null
       where sp.user_id=u.id and sub.provider='free_mvp' and sp.revoked_at is null and sp.starts_at<=now() and sp.ends_at>now()
       order by sp.starts_at desc limit 1) as "couponMonth"
    from auth.users u left join public.profiles p on p.user_id=u.id left join public.couponly_students s on s.id=u.id
    where not coalesce(u.is_anonymous,false)
      and (p.user_id is not null or s.id is not null or public.kouponly_has_verified_email(u.id))
      and not exists(select 1 from public.couponly_user_roles where user_id=u.id and role in ('admin','vendor'))
      and (p_user_id is null or u.id=p_user_id)
  ), filtered as (select * from students where p_search='' or position(lower(p_search) in lower(concat_ws(' ',name,email,"inviteCode")))>0)
  select jsonb_build_object('total',(select count(*) from filtered),'students',coalesce((select jsonb_agg(x order by "createdAt" desc,id)
    from (select * from filtered order by "createdAt" desc,id offset p_offset limit p_limit)x),'[]'::jsonb)) into result;
  if p_user_id is not null and (result->>'total')::integer>0 then
    result:=result || jsonb_build_object(
      'savedItems',coalesce((select jsonb_agg(x order by "savedAt" desc,id) from (
        select 'vendor:'||d.deal_id as id,'Vendor' as type,coalesce(v.name,'Unavailable vendor') as title,v.id as "vendorId",d.created_at as "savedAt"
        from public.saved_deals d left join public.couponly_vendors v on v.catalogue_deal_id=d.deal_id where d.user_id=p_user_id
        union all
        select 'offer:'||o.offer_id,'Offer',coalesce(f.title,'Unavailable offer'),f.vendor_id,o.created_at
        from public.saved_offers o left join public.couponly_offers f on f.id=o.offer_id where o.user_id=p_user_id
      )x),'[]'::jsonb),
      'referrals',coalesce((select jsonb_agg(x order by "createdAt" desc,id) from (
        select r.referred_user_id as id,u.email,r.status,r.reason,r.created_at as "createdAt"
        from public.referral_uses r left join auth.users u on u.id=r.referred_user_id where r.inviter_user_id=p_user_id
      )x),'[]'::jsonb));
  end if;
  return result;
end $$;

-- Keep profile validation and the deployed signup aliases; require verified email for free access.
do $$
declare f record;
begin
  for f in select proname from pg_proc where pronamespace='public'::regnamespace
    and proname in ('kouponly_complete_signup','couponly_complete_signup','kouponly_complete_signup')
    and to_regprocedure(format('public.%I(jsonb)',proname||'_pre_mvp')) is not null
  loop
    execute format('create or replace function public.%I(p_profile jsonb) returns jsonb language plpgsql security definer set search_path='''' as $body$ begin perform public.kouponly_ensure_free_month(auth.uid()); return public.%I(p_profile); end $body$',f.proname,f.proname||'_pre_mvp');
  end loop;
end $$;
notify pgrst,'reload schema';

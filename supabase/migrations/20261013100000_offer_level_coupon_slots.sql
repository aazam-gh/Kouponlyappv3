-- A consumed coupon occupies the offer's slot for this round, not the whole vendor.
drop index if exists public.kouponly_vendor_redemption_once_idx;
create unique index kouponly_offer_redemption_once_idx
  on public.redemptions(user_id,round_id,offer_id)
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
  if not public.kouponly_is_benefits_admin() or exists(select 1 from auth.users where id=uid and public.kouponly_school_email(email)) then
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

create or replace function public.kouponly_redeem_coupon(
  p_offer_id text,p_round_id uuid,p_mutation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
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
  fp:=encode(extensions.digest('redeem:'||p_offer_id||':'||p_round_id::text,'sha256'),'hex');
  perform public.kouponly_ensure_free_month(uid);
  select * into prior from public.mutation_receipts where user_id=uid and mutation_id=p_mutation_id;
  if found then
    if prior.operation<>'kouponly-redeem-coupon' or prior.request_fingerprint is distinct from fp then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return prior.result;
  end if;
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
        period_id,round_id,vendor_id,offer_id,offer_snapshot
      ) values(
        uid,receipt,'inStore','success',receipt_code,now(),now(),p.id,r.id,o.vendor_id,o.id,
        jsonb_build_object('title',o.title,'vendorName',o.vendor_name,
          'estimatedSavings',savings_amount,'currency',o.currency)
      );
      exit;
    exception when unique_violation then
      get stacked diagnostics collision_constraint=constraint_name;
      if collision_constraint<>'kouponly_short_receipt_code_unique' then raise; end if;
    end;
  end loop;
  result:=jsonb_build_object('id',receipt,'code',receipt_code,'status','success',
    'consumedAt',extract(epoch from now())*1000,'vendorName',o.vendor_name,
    'offerTitle',o.title,'estimatedSavings',savings_amount,'currency',o.currency,
    'benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint)
    values(uid,p_mutation_id,'kouponly-redeem-coupon',result,fp);
  return result;
end $$;

revoke all on function public.kouponly_account_benefits() from public,anon;
grant execute on function public.kouponly_account_benefits() to authenticated;
revoke all on function public.kouponly_redeem_coupon(text,uuid,uuid) from public,anon;
grant execute on function public.kouponly_redeem_coupon(text,uuid,uuid) to authenticated;

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
      public.kouponly_school_email(u.email) and u.email_confirmed_at is not null as eligible,
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
      and (p.user_id is not null or s.id is not null or public.kouponly_school_email(u.email))
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

revoke all on function public.kouponly_admin_students(text,integer,integer,uuid) from public,anon;
grant execute on function public.kouponly_admin_students(text,integer,integer,uuid) to authenticated;
notify pgrst,'reload schema';

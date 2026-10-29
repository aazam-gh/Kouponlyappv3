-- Monthly vendor entitlements. Account and receipt history are never reset or deleted.
create table public.kouponly_invite_codes (
  code text primary key check (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$'),
  user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
insert into public.kouponly_invite_codes(code,user_id)
select referral_code,user_id from public.profiles where referral_code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$';

-- Views retain table dependencies through the pending backend renames.
do $$ declare vendors regclass; offers regclass; roles regclass; begin
  vendors := coalesce(to_regclass('public.kouponly_vendors'),to_regclass('public.couponly_vendors'),to_regclass('public.kouponly_vendors'));
  offers := coalesce(to_regclass('public.kouponly_offers'),to_regclass('public.couponly_offers'),to_regclass('public.kouponly_offers'));
  roles := coalesce(to_regclass('public.kouponly_user_roles'),to_regclass('public.couponly_user_roles'),to_regclass('public.kouponly_user_roles'));
  execute format('create view public.kouponly_entitlement_vendors as select id,name,status,catalogue_deal_id from %s',vendors);
  execute format('create view public.kouponly_entitlement_offers as select id,vendor_id,title,active,starts_at,ends_at,redemption_mode,sort_order from %s',offers);
  execute format('create view public.kouponly_entitlement_roles as select user_id,role from %s',roles);
end $$;
revoke all on public.kouponly_entitlement_vendors,public.kouponly_entitlement_offers,public.kouponly_entitlement_roles from public,anon,authenticated;

create table public.kouponly_subscription_plans (
  id text primary key, name text not null, active boolean not null default true
);
insert into public.kouponly_subscription_plans values ('monthly','Monthly membership',true);
create table public.kouponly_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null references public.kouponly_subscription_plans(id), provider text not null,
  provider_subscription_id text not null, cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now(), unique(provider,provider_subscription_id), unique(id,user_id)
);
create table public.kouponly_subscription_periods (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null, provider_period_key text not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  revoked_at timestamptz, created_at timestamptz not null default now(), check(starts_at < ends_at),
  foreign key(subscription_id,user_id) references public.kouponly_subscriptions(id,user_id),
  unique(subscription_id,provider_period_key), unique(id,user_id)
);
create index kouponly_subscription_periods_user_idx on public.kouponly_subscription_periods(user_id,ends_at desc);
create table public.kouponly_billing_events (
  id uuid primary key default gen_random_uuid(), provider text not null, event_id text not null,
  user_id uuid references auth.users(id) on delete set null, event_type text not null,
  request jsonb not null, result jsonb, received_at timestamptz not null default now(), processed_at timestamptz,
  unique(provider,event_id)
);
create table public.kouponly_reward_grants (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check(source_type in ('referral','voucher')), source_id text not null,
  period_id uuid not null, created_at timestamptz not null default now(), revoked_at timestamptz,
  foreign key(period_id,user_id) references public.kouponly_subscription_periods(id,user_id),
  unique(source_type,source_id,user_id), unique(id,period_id,user_id)
);
create table public.kouponly_coupon_rounds (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  period_id uuid not null, round_number integer not null check(round_number>=0), reward_grant_id uuid unique,
  opened_at timestamptz not null default now(), closed_at timestamptz,
  foreign key(period_id,user_id) references public.kouponly_subscription_periods(id,user_id),
  foreign key(reward_grant_id,period_id,user_id) references public.kouponly_reward_grants(id,period_id,user_id),
  unique(period_id,round_number), unique(id,period_id,user_id)
);
create unique index kouponly_coupon_rounds_open_idx on public.kouponly_coupon_rounds(period_id) where closed_at is null;
create table public.kouponly_vouchers (
  id uuid primary key default gen_random_uuid(), code_digest text not null unique,
  label text not null, starts_at timestamptz not null default now(), ends_at timestamptz not null,
  max_claims integer not null check(max_claims>0), claimed_count integer not null default 0,
  active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), check(starts_at<ends_at), check(claimed_count between 0 and max_claims)
);
create table public.kouponly_voucher_claims (
  id uuid primary key default gen_random_uuid(), voucher_id uuid not null references public.kouponly_vouchers(id),
  user_id uuid not null references auth.users(id) on delete cascade, period_id uuid not null,
  created_at timestamptz not null default now(), unique(voucher_id,user_id),
  foreign key(period_id,user_id) references public.kouponly_subscription_periods(id,user_id)
);
create table public.kouponly_referral_policy (
  id boolean primary key default true check(id), signup_window_days integer not null default 7 check(signup_window_days>0),
  max_rewards_per_period integer not null default 5 check(max_rewards_per_period>0)
);
insert into public.kouponly_referral_policy(id) values(true);
alter table public.referral_uses
  add column status text not null default 'legacy' check(status in ('legacy','attached','qualified','rewarded','ineligible','revoked')),
  add column qualified_at timestamptz, add column reason text, add column reward_grant_id uuid references public.kouponly_reward_grants(id);
alter table public.redemptions
  add column period_id uuid, add column round_id uuid, add column vendor_id text, add column offer_id text, add column offer_snapshot jsonb,
  add constraint kouponly_redemption_round_fk foreign key(round_id,period_id,user_id) references public.kouponly_coupon_rounds(id,period_id,user_id),
  add constraint kouponly_redemption_fields_check check ((round_id is null and period_id is null) or (round_id is not null and period_id is not null and vendor_id is not null and offer_id is not null));
create unique index kouponly_vendor_redemption_once_idx on public.redemptions(user_id,round_id,vendor_id) where round_id is not null and consumed_at is not null;
alter table public.mutation_receipts add column request_fingerprint text;

create function public.kouponly_lock_account(p_uid uuid) returns void language sql set search_path='' as $$
  select pg_advisory_xact_lock(hashtextextended('kouponly:entitlement:'||p_uid::text,0));
$$;
create function public.kouponly_allocate_invite(p_uid uuid) returns text language plpgsql security definer set search_path='' as $$
declare candidate text; attempt integer; begin
  perform public.kouponly_lock_account(p_uid);
  if not exists(select 1 from auth.users where id=p_uid and not coalesce(is_anonymous,false)) then return null; end if;
  select code into candidate from public.kouponly_invite_codes where user_id=p_uid;
  if found then return candidate; end if;
  for attempt in 1..32 loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',get_byte(extensions.gen_random_bytes(1),0)%32+1,1),'') into candidate from generate_series(1,5);
    begin
      insert into public.kouponly_invite_codes(code,user_id) values(candidate,p_uid);
      return candidate;
    exception when unique_violation then null;
    end;
  end loop;
  raise exception 'Invite allocation failed. Please try again.';
end $$;
-- Allocation is authoritative in the registry. The old profile column stays read-only legacy data.
do $$ declare u record; begin for u in select id from auth.users where not coalesce(is_anonymous,false) loop perform public.kouponly_allocate_invite(u.id); end loop; end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),coalesce(new.email,'')) on conflict(user_id) do nothing;
  perform public.kouponly_allocate_invite(new.id);
  -- Untrusted signup metadata only records attribution; qualification happens after verification.
  insert into public.referral_uses(referred_user_id,inviter_user_id,status)
  select new.id,c.user_id,'attached' from public.kouponly_invite_codes c
  where c.code=upper(trim(new.raw_user_meta_data->>'referral_code')) and c.user_id is not null and c.user_id<>new.id
  on conflict(referred_user_id) do nothing;
  if new.email_confirmed_at is not null or new.phone_confirmed_at is not null then perform public.kouponly_qualify_referral(new.id); end if;
  return new;
end $$;

create function public.kouponly_is_benefits_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.kouponly_entitlement_roles where user_id=auth.uid() and role='admin');
$$;
create function public.kouponly_open_reward_round(p_uid uuid,p_period uuid,p_type text,p_source text) returns uuid language plpgsql security definer set search_path='' as $$
declare grant_id uuid; next_round integer; begin
  perform public.kouponly_lock_account(p_uid);
  select id into grant_id from public.kouponly_reward_grants where user_id=p_uid and source_type=p_type and source_id=p_source;
  if found then return grant_id; end if;
  if not exists(select 1 from public.kouponly_subscription_periods where id=p_period and user_id=p_uid and revoked_at is null and starts_at<=now() and ends_at>now()) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  insert into public.kouponly_reward_grants(user_id,source_type,source_id,period_id) values(p_uid,p_type,p_source,p_period) returning id into grant_id;
  select coalesce(max(round_number),-1)+1 into next_round from public.kouponly_coupon_rounds where period_id=p_period;
  update public.kouponly_coupon_rounds set closed_at=now() where period_id=p_period and closed_at is null;
  insert into public.kouponly_coupon_rounds(user_id,period_id,round_number,reward_grant_id) values(p_uid,p_period,next_round,grant_id);
  return grant_id;
end $$;

create function public.kouponly_qualify_referral(p_referred uuid) returns text language plpgsql security definer set search_path='' as $$
declare inviter uuid; r public.referral_uses%rowtype; period uuid; reward uuid; cap integer; begin
  select inviter_user_id into inviter from public.referral_uses where referred_user_id=p_referred;
  if inviter is null then return null; end if;
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
create function public.kouponly_after_account_verification() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.kouponly_qualify_referral(new.id); return new; end $$;
create trigger kouponly_after_account_verification after update of email_confirmed_at,phone_confirmed_at on auth.users for each row
  when (old.email_confirmed_at is distinct from new.email_confirmed_at or old.phone_confirmed_at is distinct from new.phone_confirmed_at)
  execute function public.kouponly_after_account_verification();

create function public.kouponly_account_benefits() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.kouponly_subscription_periods%rowtype; r public.kouponly_coupon_rounds%rowtype; code text; referral jsonb; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  code:=public.kouponly_allocate_invite(uid);
  -- Allocator's account lock also serializes reads with refresh/redeem.
  select * into p from public.kouponly_subscription_periods where user_id=uid and revoked_at is null and starts_at<=now() and ends_at>now();
  if p.id is not null then select * into r from public.kouponly_coupon_rounds where period_id=p.id and closed_at is null; end if;
  select jsonb_build_object('status',status,'reason',reason) into referral from public.referral_uses where referred_user_id=uid;
  return jsonb_build_object('inviteCode',code,'serverTime',now(),'referral',referral,
    'referralCount',(select count(*) from public.referral_uses where inviter_user_id=uid),
    'rewardedReferrals',(select count(*) from public.kouponly_reward_grants where user_id=uid and period_id=p.id and source_type='referral'),
    'referralLimit',(select max_rewards_per_period from public.kouponly_referral_policy where id),
    'subscription',case when p.id is null then null else jsonb_build_object('periodId',p.id,'startsAt',p.starts_at,'endsAt',p.ends_at,'roundId',r.id,'roundNumber',r.round_number,
      'planName',(select pl.name from public.kouponly_subscriptions s join public.kouponly_subscription_plans pl on pl.id=s.plan_id where s.id=p.subscription_id),
      'cancelAtPeriodEnd',(select cancel_at_period_end from public.kouponly_subscriptions where id=p.subscription_id)) end,
    'usedVendorIds',coalesce((select jsonb_agg(distinct vendor_id) from public.redemptions where user_id=uid and round_id=r.id and consumed_at is not null),'[]'::jsonb));
end $$;

create function public.kouponly_claim_code_inner(p_code text,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=auth.uid(); code text:=upper(trim(p_code)); inviter uuid; existing uuid; v public.kouponly_vouchers%rowtype; period uuid; claim uuid; result jsonb; prior public.mutation_receipts%rowtype; fp text; status text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
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

create function public.kouponly_redeem_coupon(p_offer_id text,p_round_id uuid,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.kouponly_subscription_periods%rowtype; r public.kouponly_coupon_rounds%rowtype;
  o record; prior public.mutation_receipts%rowtype; fp text; result jsonb; receipt text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
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
-- Old clients cannot bypass paid access or round-aware confirmation.
create or replace function public.validate_redemption_atomic(p_redemption_id text,p_mode text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$ begin raise exception 'Update Kouponly to use subscription coupons' using errcode='0A000'; end $$;

-- Only verified server integrations or administrators can create/revoke paid periods.
create function public.kouponly_apply_billing_event(p_event jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare uid uuid:=(p_event->>'userId')::uuid; provider text:=p_event->>'provider'; event_key text:=p_event->>'eventId'; typ text:=p_event->>'type';
  start_at timestamptz:=(p_event->>'startsAt')::timestamptz; end_at timestamptz:=(p_event->>'endsAt')::timestamptz;
  sub_id uuid; period uuid; prior public.kouponly_billing_events%rowtype; result jsonb; begin
  if uid is null or provider is null or event_key is null or length(event_key) not between 1 and 200 or typ is null or typ not in ('paid','revoke','cancel') or nullif(p_event->>'subscriptionId','') is null then raise exception 'Invalid billing event'; end if;
  if not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false)) then raise exception 'Permanent account required'; end if;
  perform public.kouponly_lock_account(uid);
  -- Serialize across event IDs too: distinct notifications can describe one period.
  perform pg_advisory_xact_lock(hashtextextended('kouponly:billing:'||provider||':'||event_key,0));
  select * into prior from public.kouponly_billing_events where kouponly_billing_events.provider=provider and event_id=event_key;
  if found then if prior.request<>p_event then raise exception 'IDEMPOTENCY_MISMATCH'; end if; return prior.result; end if;
  select id into sub_id from public.kouponly_subscriptions where kouponly_subscriptions.provider=provider and provider_subscription_id=p_event->>'subscriptionId';
  if sub_id is not null and not exists(select 1 from public.kouponly_subscriptions where id=sub_id and user_id=uid) then raise exception 'Subscription owner mismatch'; end if;
  if sub_id is null then
    insert into public.kouponly_subscriptions(user_id,plan_id,provider,provider_subscription_id) values(uid,'monthly',provider,p_event->>'subscriptionId') returning id into sub_id;
  end if;
  if typ='paid' then
    if start_at is null or end_at is null or start_at>=end_at or nullif(p_event->>'periodKey','') is null then raise exception 'Invalid paid period'; end if;
    select id into period from public.kouponly_subscription_periods where subscription_id=sub_id and provider_period_key=p_event->>'periodKey';
    if period is not null then
      if not exists(select 1 from public.kouponly_subscription_periods where id=period and starts_at=start_at and ends_at=end_at) then raise exception 'Period mismatch'; end if;
      -- A later duplicate paid notification never revives a revoked period.
    else
      if exists(select 1 from public.kouponly_subscription_periods where user_id=uid and revoked_at is null and starts_at<end_at and ends_at>start_at) then raise exception 'Subscription periods overlap'; end if;
      insert into public.kouponly_subscription_periods(user_id,subscription_id,provider_period_key,starts_at,ends_at) values(uid,sub_id,p_event->>'periodKey',start_at,end_at) returning id into period;
      insert into public.kouponly_coupon_rounds(user_id,period_id,round_number) values(uid,period,0);
    end if;
  elsif typ='revoke' then
    select id into period from public.kouponly_subscription_periods where subscription_id=sub_id and provider_period_key=p_event->>'periodKey';
    if period is null then
      -- Persist a revoked tombstone if a refund arrives before its paid notification.
      if start_at is null or end_at is null or start_at>=end_at or nullif(p_event->>'periodKey','') is null then raise exception 'Unknown revoked period requires its bounds'; end if;
      insert into public.kouponly_subscription_periods(user_id,subscription_id,provider_period_key,starts_at,ends_at,revoked_at) values(uid,sub_id,p_event->>'periodKey',start_at,end_at,now()) returning id into period;
    else update public.kouponly_subscription_periods set revoked_at=coalesce(revoked_at,now()) where id=period; end if;
    update public.kouponly_coupon_rounds set closed_at=coalesce(closed_at,now()) where period_id=period;
  else update public.kouponly_subscriptions set cancel_at_period_end=true,updated_at=now() where id=sub_id;
  end if;
  result:=jsonb_build_object('subscriptionId',sub_id,'periodId',period,'type',typ);
  insert into public.kouponly_billing_events(provider,event_id,user_id,event_type,request,result,processed_at) values(provider,event_key,uid,typ,p_event,result,now());
  return result;
end $$;
create function public.kouponly_admin_grant_month(p_user_id uuid,p_reference text,p_starts_at timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare starts timestamptz; existing public.kouponly_billing_events%rowtype; event jsonb; begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if nullif(trim(p_reference),'') is null or length(p_reference)>160 then raise exception 'Payment or prepaid reference is required'; end if;
  perform public.kouponly_lock_account(p_user_id);
  select * into existing from public.kouponly_billing_events where provider='admin_prepaid' and event_id=p_reference;
  if found then
    if existing.user_id<>p_user_id or (p_starts_at is not null and (existing.request->>'startsAt')::timestamptz<>p_starts_at) then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return existing.result;
  end if;
  select coalesce(p_starts_at,greatest(now(),coalesce(max(ends_at),now()))) into starts from public.kouponly_subscription_periods where user_id=p_user_id and revoked_at is null;
  event:=jsonb_build_object('userId',p_user_id,'provider','admin_prepaid','eventId',p_reference,'type','paid','subscriptionId',p_user_id::text,'periodKey',p_reference,'startsAt',starts,'endsAt',starts+interval '1 month');
  return public.kouponly_apply_billing_event(event);
end $$;
create function public.kouponly_admin_issue_month(p_email text,p_reference text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid; begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  select id into uid from auth.users where lower(email)=lower(trim(p_email)) and not coalesce(is_anonymous,false);
  if uid is null then raise exception 'Account not found'; end if;
  return public.kouponly_admin_grant_month(uid,p_reference);
end $$;
create function public.kouponly_admin_revoke_period(p_period_id uuid,p_reference text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.kouponly_subscription_periods%rowtype; s public.kouponly_subscriptions%rowtype; begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if nullif(trim(p_reference),'') is null then raise exception 'Revocation reference is required'; end if;
  select * into p from public.kouponly_subscription_periods where id=p_period_id;
  if p.id is null then raise exception 'Period not found'; end if;
  select * into s from public.kouponly_subscriptions where id=p.subscription_id;
  return public.kouponly_apply_billing_event(jsonb_build_object('provider',s.provider,'eventId',p_reference,'type','revoke','userId',p.user_id,'subscriptionId',s.provider_subscription_id,'periodKey',p.provider_period_key,'startsAt',p.starts_at,'endsAt',p.ends_at));
end $$;
create function public.kouponly_admin_create_voucher(p_label text,p_max_claims integer,p_ends_at timestamptz,p_mutation_id uuid default gen_random_uuid()) returns jsonb language plpgsql security definer set search_path='' as $$
declare code text; voucher uuid; prior public.mutation_receipts%rowtype; fp text; result jsonb; begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
  if p_mutation_id is null or nullif(trim(p_label),'') is null or length(p_label)>100 or p_max_claims is null or p_max_claims not between 1 and 100000 or p_ends_at is null then raise exception 'Invalid voucher limits'; end if;
  perform public.kouponly_lock_account(auth.uid());
  fp:=encode(extensions.digest(jsonb_build_array(trim(p_label),p_max_claims,p_ends_at)::text,'sha256'),'hex');
  select * into prior from public.mutation_receipts where user_id=auth.uid() and mutation_id=p_mutation_id;
  if found then
    if prior.operation<>'create-voucher' or prior.request_fingerprint is distinct from fp then raise exception 'IDEMPOTENCY_MISMATCH'; end if;
    return prior.result;
  end if;
  if p_ends_at<=now() then raise exception 'Invalid voucher limits'; end if;
  code:='KPN-'||upper(encode(extensions.gen_random_bytes(8),'hex'));
  insert into public.kouponly_vouchers(code_digest,label,max_claims,ends_at,created_by) values(encode(extensions.digest(code,'sha256'),'hex'),trim(p_label),p_max_claims,p_ends_at,auth.uid()) returning id into voucher;
  result:=jsonb_build_object('id',voucher,'code',code,'label',trim(p_label));
  -- Private issuance receipt lets the issuing administrator recover a timed-out response.
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint) values(auth.uid(),p_mutation_id,'create-voucher',result,fp);
  return result;
end $$;

create table public.kouponly_code_attempts(user_id uuid primary key references auth.users(id) on delete cascade, window_start timestamptz not null, attempts integer not null);
alter table public.kouponly_code_attempts enable row level security;
revoke all on public.kouponly_code_attempts from public,anon,authenticated;
create function public.kouponly_claim_code(p_code text,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); hits integer; message text; begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  insert into public.kouponly_code_attempts values(uid,now(),1) on conflict(user_id) do update set
    attempts=case when kouponly_code_attempts.window_start>now()-interval '60 seconds' then kouponly_code_attempts.attempts+1 else 1 end,
    window_start=case when kouponly_code_attempts.window_start>now()-interval '60 seconds' then kouponly_code_attempts.window_start else now() end returning attempts into hits;
  if hits>10 then return jsonb_build_object('error','RATE_LIMITED'); end if;
  -- Catch validation inside a subtransaction so failed attempts still count.
  begin return public.kouponly_claim_code_inner(p_code,p_mutation_id);
  exception when raise_exception then get stacked diagnostics message=message_text; return jsonb_build_object('error',message);
  end;
end $$;

-- Explicit grants: no client can write benefits or discover another account's code.
do $$ declare tbl text; fn record; begin
  foreach tbl in array array['kouponly_invite_codes','kouponly_subscriptions','kouponly_subscription_periods','kouponly_coupon_rounds','kouponly_reward_grants','kouponly_voucher_claims'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('create policy own_read on public.%I for select to authenticated using (user_id=(select auth.uid()))',tbl);
  end loop;
  foreach tbl in array array['kouponly_subscription_plans','kouponly_billing_events','kouponly_vouchers','kouponly_referral_policy'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from public,anon,authenticated',tbl);
  end loop;
  for fn in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname like 'kouponly_%' and proname in
    ('kouponly_lock_account','kouponly_allocate_invite','kouponly_is_benefits_admin','kouponly_open_reward_round','kouponly_qualify_referral','kouponly_after_account_verification','kouponly_account_benefits','kouponly_claim_code','kouponly_claim_code_inner','kouponly_redeem_coupon','kouponly_apply_billing_event','kouponly_admin_grant_month','kouponly_admin_issue_month','kouponly_admin_revoke_period','kouponly_admin_create_voucher') loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
  end loop;
end $$;
grant execute on function public.kouponly_account_benefits(),public.kouponly_claim_code(text,uuid),public.kouponly_redeem_coupon(text,uuid,uuid),public.kouponly_admin_grant_month(uuid,text,timestamptz),public.kouponly_admin_create_voucher(text,integer,timestamptz,uuid),public.kouponly_admin_issue_month(text,text),public.kouponly_admin_revoke_period(uuid,text),public.kouponly_is_benefits_admin() to authenticated;
grant execute on function public.kouponly_apply_billing_event(jsonb),public.kouponly_qualify_referral(uuid) to service_role;
revoke insert,update,delete on public.referral_uses,public.redemptions,public.offer_usage from anon,authenticated;
notify pgrst,'reload schema';

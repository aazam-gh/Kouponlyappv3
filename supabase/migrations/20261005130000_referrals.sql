alter table public.profiles add column referral_code text unique;

do $$
declare
  profile_row record;
  generated_code text;
begin
  for profile_row in select user_id from public.profiles where referral_code is null loop
    loop
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
        (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1), '')
        into generated_code from generate_series(1, 5);
      exit when not exists(select 1 from public.profiles where referral_code = generated_code);
    end loop;
    update public.profiles set referral_code = generated_code where user_id = profile_row.user_id;
  end loop;
end;
$$;

create table public.referral_uses (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referred_user_id <> inviter_user_id)
);
alter table public.referral_uses enable row level security;
create policy "Users can read their referrals" on public.referral_uses
  for select to authenticated using ((select auth.uid()) = inviter_user_id);
grant select on public.referral_uses to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  generated_code text;
  inviter uuid;
  submitted_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'referral_code', '')));
begin
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
      (get_byte(extensions.gen_random_bytes(1), 0) % 32) + 1, 1), '')
      into generated_code from generate_series(1, 5);
    exit when not exists(select 1 from public.profiles where referral_code = generated_code);
  end loop;

  insert into public.profiles (user_id, full_name, email, referral_code)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), coalesce(new.email, ''), generated_code)
  on conflict (user_id) do nothing;

  if submitted_code <> '' then
    select user_id into inviter from public.profiles where referral_code = submitted_code;
    if inviter is null then raise exception 'Invalid referral code'; end if;
    if inviter = new.id then raise exception 'You cannot use your own referral code'; end if;

    insert into public.referral_uses (referred_user_id, inviter_user_id) values (new.id, inviter);
    update public.offer_usage
      set use_count = 0, updated_at = now()
      where user_id = inviter
        and use_count > 0
        and period_start = date_trunc('month', now() at time zone 'UTC')::date;
  end if;
  return new;
end;
$$;

-- Each redemption gets a distinct receipt so a referral refresh can be redeemed again
-- without overwriting the prior receipt or treating it as an idempotent replay.
create or replace function public.validate_redemption_atomic(
  p_redemption_id text,p_mode text,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid := (select auth.uid());
  prior jsonb;
  response jsonb;
  deal_key text;
  listing_key text;
  offer_key text;
  quota_key text;
  receipt_id text := p_redemption_id;
  vendor_key text;
  used_count integer := 0;
  consumed_at_value timestamptz;
  current_period date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_mode is null or p_mode not in ('online','inStore') then raise exception 'Invalid redemption mode' using errcode='22023'; end if;
  if p_mode='online' then raise exception 'Online checkout is not connected to partner verification' using errcode='0A000'; end if;
  if p_redemption_id is null or length(p_redemption_id)>240 then raise exception 'Invalid redemption id' using errcode='22023'; end if;
  if p_idempotency_key is null then raise exception 'Idempotency key is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':receipt:'||p_idempotency_key::text,0));
  select result into prior from public.mutation_receipts where user_id=uid and mutation_id=p_idempotency_key;
  if prior is not null then return prior; end if;

  if p_redemption_id ~ '^deal-[0-9]+-[0-9]+(-[A-F0-9]{8})?(-[0-9]{4}-[0-9]{2})?$' then
    deal_key := substring(p_redemption_id from '^deal-([0-9]+)-');
    offer_key := substring(p_redemption_id from '^deal-[0-9]+-([0-9]+)');
    if p_redemption_id ~ '-[0-9]{4}-[0-9]{2}$' and right(p_redemption_id, 7) <> to_char(current_period, 'YYYY-MM') then
      raise exception 'Redemption month changed. Reopen the offer and try again.' using errcode='22023';
    end if;
    if p_redemption_id !~ '-[0-9]{4}-[0-9]{2}$' then receipt_id := p_redemption_id || '-' || to_char(current_period, 'YYYY-MM'); end if;
    quota_key := deal_key || '-' || offer_key;
  elsif p_redemption_id ~ '^listing-[A-Za-z0-9_-]+(-[A-F0-9]{8})?(-[0-9]{4}-[0-9]{2})?$' then
    if p_redemption_id ~ '-[0-9]{4}-[0-9]{2}$' then
      if right(p_redemption_id, 7) <> to_char(current_period, 'YYYY-MM') then
        raise exception 'Redemption month changed. Reopen the offer and try again.' using errcode='22023';
      end if;
      if p_redemption_id ~ '-[A-F0-9]{8}-[0-9]{4}-[0-9]{2}$' then
        listing_key := substring(p_redemption_id from '^listing-(.+)-[A-F0-9]{8}-[0-9]{4}-[0-9]{2}$');
      else
        listing_key := substring(p_redemption_id from '^listing-(.+)-[0-9]{4}-[0-9]{2}$');
      end if;
    else
      listing_key := substring(p_redemption_id from '^listing-(.+)$');
      receipt_id := p_redemption_id || '-' || to_char(current_period, 'YYYY-MM');
    end if;
    quota_key := 'listing-' || listing_key;
  else
    raise exception 'Offer is unavailable' using errcode='P0001';
  end if;

  if deal_key is not null then
    select id into vendor_key from public.kouponly_vendors where catalogue_deal_id=deal_key::integer and status='Active';
    if not exists(select 1 from public.catalogue_deals where id=deal_key and published)
      and (vendor_key is null or not exists(select 1 from public.kouponly_offers where vendor_id=vendor_key and active
        and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()))) then
      raise exception 'Offer is unavailable' using errcode='P0001';
    end if;
  elsif not exists(select 1 from public.catalogue_partners where id=listing_key and published) then
    raise exception 'Offer is unavailable' using errcode='P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text||':offer:'||quota_key,1));
  select case when u.period_start < current_period then 0 else u.use_count end into used_count
    from public.offer_usage u where u.user_id=uid and u.offer_id=quota_key;
  select consumed_at into consumed_at_value from public.redemptions where user_id=uid and redemption_id=receipt_id;
  if consumed_at_value is not null and consumed_at_value >= current_period::timestamptz then
    return jsonb_build_object('id',receipt_id,'code',null,'expiresAt',null,'status','success',
      'consumedAt',extract(epoch from consumed_at_value)*1000,'periodStart',current_period);
  end if;
  if coalesce(used_count,0)>=1 then raise exception 'Monthly coupon redemption limit reached' using errcode='P0001'; end if;

  consumed_at_value := now();
  insert into public.redemptions(user_id,redemption_id,mode,status,code,expires_at,completed_at,consumed_at)
  values(uid,receipt_id,'inStore','success',null,null,consumed_at_value,consumed_at_value)
  on conflict(user_id,redemption_id) do update set mode=excluded.mode,status=excluded.status,
    code=excluded.code,expires_at=excluded.expires_at,completed_at=excluded.completed_at,consumed_at=excluded.consumed_at,updated_at=now();
  if deal_key is not null then
    perform public.record_redemption_usage(uid,receipt_id);
  else
    insert into public.offer_usage(user_id,offer_id,use_count,period_start) values(uid,quota_key,1,current_period)
    on conflict(user_id,offer_id) do update set use_count=1,period_start=current_period,updated_at=now();
  end if;
  response := jsonb_build_object('id',receipt_id,'code',null,'expiresAt',null,'status','success',
    'consumedAt',extract(epoch from consumed_at_value)*1000,'periodStart',current_period);
  insert into public.mutation_receipts(user_id,mutation_id,operation,result) values(uid,p_idempotency_key,'validate-redemption',response);
  return response;
end $$;
revoke all on function public.validate_redemption_atomic(text,text,uuid) from public,anon;
grant execute on function public.validate_redemption_atomic(text,text,uuid) to authenticated;

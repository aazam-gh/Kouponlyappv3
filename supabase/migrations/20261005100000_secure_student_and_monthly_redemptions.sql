-- Keep student-owned profile edits, but protect backend-controlled account state.
create or replace function public.realx_guard_student_account_state()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() = old.id and not public.realx_is_admin() and (
    new.cashback is distinct from old.cashback or
    new.savings is distinct from old.savings or
    new.verification_status is distinct from old.verification_status or
    new.account_role is distinct from old.account_role or
    new.email is distinct from old.email or
    new.creator_code is distinct from old.creator_code or
    new.created_at is distinct from old.created_at or
    new.profile->'redemptionDisabled' is distinct from old.profile->'redemptionDisabled' or
    new.profile->'accountType' is distinct from old.profile->'accountType'
  ) then
    raise exception 'Protected account fields can only be changed by an administrator' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger realx_guard_student_account_state
before update on public.realx_students
for each row execute function public.realx_guard_student_account_state();

-- Keep gift-card checkout behavior, but reject its legacy coupon mode.
alter function public.realx_redeem_offer(text,text,numeric,text,numeric,integer,text,uuid)
  rename to realx_redeem_offer_legacy;
create function public.realx_redeem_offer(
  p_vendor_id text,p_offer_id text,p_total_amount numeric,p_type text,
  p_giftcard_amount numeric,p_offer_index integer,p_creator_code text,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_type = 'offer' then
    raise exception 'Use the monthly coupon redemption flow' using errcode='42501';
  end if;
  return public.realx_redeem_offer_legacy(p_vendor_id,p_offer_id,p_total_amount,p_type,
    p_giftcard_amount,p_offer_index,p_creator_code,p_idempotency_key);
end $$;
revoke all on function public.realx_redeem_offer_legacy(text,text,numeric,text,numeric,integer,text,uuid) from public,anon,authenticated;
revoke all on function public.realx_redeem_offer(text,text,numeric,text,numeric,integer,text,uuid) from public,anon;
grant execute on function public.realx_redeem_offer(text,text,numeric,text,numeric,integer,text,uuid) to authenticated;

-- Include the UTC month in current mobile receipt IDs. Legacy IDs remain accepted
-- during app rollout, but are mapped to the same strict vendor/offer quota key.
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

  if p_redemption_id ~ '^deal-[0-9]+-[0-9]+(-[0-9]{4}-[0-9]{2})?$' then
    deal_key := substring(p_redemption_id from '^deal-([0-9]+)-');
    offer_key := substring(p_redemption_id from '^deal-[0-9]+-([0-9]+)');
    if p_redemption_id ~ '-[0-9]{4}-[0-9]{2}$' and
       right(p_redemption_id, 7) <> to_char(current_period, 'YYYY-MM') then
      raise exception 'Redemption month changed. Reopen the offer and try again.' using errcode='22023';
    end if;
    if p_redemption_id !~ '-[0-9]{4}-[0-9]{2}$' then
      receipt_id := p_redemption_id || '-' || to_char(current_period, 'YYYY-MM');
    end if;
    quota_key := deal_key || '-' || offer_key;
  elsif p_redemption_id ~ '^listing-[A-Za-z0-9_-]+(-[0-9]{4}-[0-9]{2})?$' then
    if p_redemption_id ~ '-[0-9]{4}-[0-9]{2}$' then
      if right(p_redemption_id, 7) <> to_char(current_period, 'YYYY-MM') then
        raise exception 'Redemption month changed. Reopen the offer and try again.' using errcode='22023';
      end if;
      listing_key := substring(p_redemption_id from '^listing-(.+)-[0-9]{4}-[0-9]{2}$');
    else
      listing_key := substring(p_redemption_id from '^listing-(.+)$');
      receipt_id := p_redemption_id || '-' || to_char(current_period, 'YYYY-MM');
    end if;
    quota_key := 'listing-' || listing_key;
  else
    raise exception 'Offer is unavailable' using errcode='P0001';
  end if;

  if deal_key is not null then
    select id into vendor_key from public.realx_vendors
      where catalogue_deal_id=deal_key::integer and status='Active';
    if not exists(select 1 from public.catalogue_deals where id=deal_key and published)
      and (vendor_key is null or not exists(select 1 from public.realx_offers where vendor_id=vendor_key and active
        and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()))) then
      raise exception 'Offer is unavailable' using errcode='P0001';
    end if;
  elsif not exists(select 1 from public.catalogue_partners where id=listing_key and published) then
    raise exception 'Offer is unavailable' using errcode='P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text||':offer:'||quota_key,1));
  select case when u.period_start < current_period then 0 else u.use_count end into used_count
    from public.offer_usage u where u.user_id=uid and u.offer_id=quota_key;
  select consumed_at into consumed_at_value from public.redemptions
    where user_id=uid and redemption_id=receipt_id;
    if consumed_at_value is not null and consumed_at_value >= current_period::timestamptz then
      return jsonb_build_object('id',receipt_id,'code',null,'expiresAt',null,'status','success',
        'consumedAt',extract(epoch from consumed_at_value)*1000,'periodStart',current_period);
  end if;
  if coalesce(used_count,0)>=1 then raise exception 'Monthly coupon redemption limit reached' using errcode='P0001'; end if;

  consumed_at_value := now();
  insert into public.redemptions(user_id,redemption_id,mode,status,code,expires_at,completed_at,consumed_at)
  values(uid,receipt_id,'inStore','success',null,null,consumed_at_value,consumed_at_value)
  on conflict(user_id,redemption_id) do update set mode=excluded.mode,status=excluded.status,
    code=excluded.code,expires_at=excluded.expires_at,completed_at=excluded.completed_at,
    consumed_at=excluded.consumed_at,updated_at=now();
  if deal_key is not null then
    perform public.record_redemption_usage(uid,receipt_id);
  else
    insert into public.offer_usage(user_id,offer_id,use_count,period_start)
    values(uid,quota_key,1,current_period)
    on conflict(user_id,offer_id) do update set use_count=1,period_start=current_period,updated_at=now();
  end if;
  response := jsonb_build_object('id',receipt_id,'code',null,'expiresAt',null,'status','success',
    'consumedAt',extract(epoch from consumed_at_value)*1000,'periodStart',current_period);
  insert into public.mutation_receipts(user_id,mutation_id,operation,result)
    values(uid,p_idempotency_key,'validate-redemption',response);
  return response;
end $$;

revoke all on function public.validate_redemption_atomic(text,text,uuid) from public,anon;
grant execute on function public.validate_redemption_atomic(text,text,uuid) to authenticated;

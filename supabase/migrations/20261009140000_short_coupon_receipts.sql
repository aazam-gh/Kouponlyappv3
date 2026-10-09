create unique index kouponly_short_receipt_code_unique on public.redemptions(code) where round_id is not null and length(code)=5;
create or replace function public.kouponly_redeem_coupon(p_offer_id text,p_round_id uuid,p_mutation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); p public.kouponly_subscription_periods%rowtype; r public.kouponly_coupon_rounds%rowtype;
  o record; prior public.mutation_receipts%rowtype; fp text; result jsonb; receipt text; receipt_code text; collision_constraint text; code_bytes bytea; attempts integer:=0; begin
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
  loop
    attempts:=attempts+1;
    if attempts>100 then raise exception 'Unable to allocate a confirmation code. Try again.'; end if;
    code_bytes:=extensions.gen_random_bytes(5);
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',1+(get_byte(code_bytes,n)%32),1),'') into receipt_code from generate_series(0,4) n;
    begin
      insert into public.redemptions(user_id,redemption_id,mode,status,code,completed_at,consumed_at,period_id,round_id,vendor_id,offer_id,offer_snapshot)
      values(uid,receipt,'inStore','success',receipt_code,now(),now(),p.id,r.id,o.vendor_id,o.id,jsonb_build_object('title',o.title,'vendorName',o.vendor_name));
      exit;
    exception when unique_violation then
      get stacked diagnostics collision_constraint=constraint_name;
      if collision_constraint<>'kouponly_short_receipt_code_unique' then raise; end if;
    end;
  end loop;
  result:=jsonb_build_object('id',receipt,'code',receipt_code,'status','success','consumedAt',extract(epoch from now())*1000,'vendorName',o.vendor_name,'offerTitle',o.title,'benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint) values(uid,p_mutation_id,'kouponly-redeem-coupon',result,fp);
  return result;
end $$;

-- Old clients remain unable to bypass month/round validation.
notify pgrst,'reload schema';

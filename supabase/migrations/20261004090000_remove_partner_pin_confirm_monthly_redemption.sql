-- Redemption confirmation consumes the coupon's single monthly use.
-- Partner PINs are no longer part of mobile redemption or vendor checkout.

drop function if exists public.validate_redemption_atomic(text,text,text,uuid);

create or replace function public.validate_redemption_atomic(
  p_redemption_id text,p_mode text,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=(select auth.uid());
  prior jsonb;
  response jsonb;
  generated_code text;
  expiration timestamptz;
  deal_key text;
  listing_key text;
  offer_key text;
  vendor_key text;
  used_count integer:=0;
  usage_already_counted boolean:=false;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_mode not in ('online','inStore') then raise exception 'Invalid redemption mode' using errcode='22023'; end if;
  if p_redemption_id is null or length(p_redemption_id)>240 then raise exception 'Invalid redemption id' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':receipt:'||p_idempotency_key::text,0));
  select result into prior from public.mutation_receipts where user_id=uid and mutation_id=p_idempotency_key;
  if prior is not null then return prior; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':redemption:'||p_redemption_id,1));

  deal_key:=substring(p_redemption_id from '^deal-([0-9]+)');
  listing_key:=substring(p_redemption_id from '^listing-(.+)$');
  offer_key:=substring(p_redemption_id from '^deal-[0-9]+-([0-9]+)');
  if deal_key is not null then
    select id into vendor_key from public.kouponly_vendors
      where catalogue_deal_id=deal_key::integer and status='Active';
    if not exists(select 1 from public.catalogue_deals where id=deal_key and published)
      and (vendor_key is null or not exists(select 1 from public.kouponly_offers where vendor_id=vendor_key and active
        and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()))) then
      raise exception 'Offer is unavailable' using errcode='P0001';
    end if;
    select case when period_start<date_trunc('month',now())::date then 0 else use_count end into used_count
      from public.offer_usage where user_id=uid and offer_id=deal_key||'-'||coalesce(offer_key,'0');
  elsif listing_key is not null then
    if not exists(select 1 from public.catalogue_partners where id=listing_key and published) then
      raise exception 'Offer is unavailable' using errcode='P0001';
    end if;
  else raise exception 'Offer is unavailable' using errcode='P0001'; end if;

  if p_mode='online' then
    select code,expires_at,(consumed_at is not null) into generated_code,expiration,usage_already_counted
      from public.redemptions where user_id=uid and redemption_id=p_redemption_id and status='code' and expires_at>now();
  end if;
  usage_already_counted:=coalesce(usage_already_counted,false);
  if p_mode='inStore' and exists(select 1 from public.redemptions where user_id=uid and redemption_id=p_redemption_id and consumed_at is not null) then
    raise exception 'Redemption already completed' using errcode='P0001';
  end if;
  if deal_key is not null and not usage_already_counted and coalesce(used_count,0)>=1 then
    raise exception 'Monthly coupon redemption limit reached' using errcode='P0001';
  end if;

  if p_mode='online' and generated_code is null then
    generated_code:='KPN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    expiration:=now()+interval '10 minutes';
  end if;
  insert into public.redemptions(user_id,redemption_id,mode,status,code,expires_at,completed_at,consumed_at)
  values(uid,p_redemption_id,p_mode,case when p_mode='online' then 'code' else 'success' end,generated_code,expiration,
    case when p_mode='inStore' then now() end,now())
  on conflict(user_id,redemption_id) do update set mode=excluded.mode,status=excluded.status,code=excluded.code,
    expires_at=excluded.expires_at,completed_at=excluded.completed_at,consumed_at=excluded.consumed_at,updated_at=now();
  if deal_key is not null and not usage_already_counted then perform public.record_redemption_usage(uid,p_redemption_id); end if;
  response:=jsonb_build_object('code',generated_code,'expiresAt',case when expiration is null then null else extract(epoch from expiration)*1000 end,
    'status',case when p_mode='online' then 'code' else 'success' end,'consumedAt',extract(epoch from now())*1000);
  insert into public.mutation_receipts(user_id,mutation_id,operation,result) values(uid,p_idempotency_key,'validate-redemption',response);
  return response;
end $$;
revoke all on function public.validate_redemption_atomic(text,text,uuid) from public,anon;
grant execute on function public.validate_redemption_atomic(text,text,uuid) to authenticated;

create or replace function public.complete_redemption_atomic(p_redemption_id text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=(select auth.uid());
  prior jsonb;
  current_redemption public.redemptions%rowtype;
  response jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_redemption_id is null or length(p_redemption_id)>240 then raise exception 'Invalid redemption id' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':receipt:'||p_idempotency_key::text,0));
  select result into prior from public.mutation_receipts where user_id=uid and mutation_id=p_idempotency_key;
  if prior is not null then return prior; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':redemption:'||p_redemption_id,1));
  select * into current_redemption from public.redemptions where user_id=uid and redemption_id=p_redemption_id for update;
  if not found or current_redemption.mode<>'online' or current_redemption.status<>'code' or current_redemption.completed_at is not null then
    raise exception 'No active online redemption exists' using errcode='P0001';
  end if;
  if current_redemption.expires_at is null or current_redemption.expires_at<=now() then
    update public.redemptions set status='expired',updated_at=now() where user_id=uid and redemption_id=p_redemption_id;
    raise exception 'Redemption code expired' using errcode='P0001';
  end if;
  update public.redemptions set status='success',completed_at=now(),updated_at=now()
    where user_id=uid and redemption_id=p_redemption_id;
  response:=jsonb_build_object('id',p_redemption_id,'status','success','completedAt',extract(epoch from now())*1000);
  insert into public.mutation_receipts(user_id,mutation_id,operation,result) values(uid,p_idempotency_key,'complete-redemption',response);
  return response;
end $$;

revoke all on function public.complete_redemption_atomic(text,uuid) from public,anon;
grant execute on function public.complete_redemption_atomic(text,uuid) to authenticated;

-- Remove PIN based transactions while retaining the checkout transaction logic.
drop function if exists public.kouponly_redeem_offer(text,text,numeric,text,text,numeric,integer,text,uuid);
create function public.kouponly_redeem_offer(
  p_vendor_id text,p_offer_id text,p_total_amount numeric,p_type text,
  p_giftcard_amount numeric,p_offer_index integer,p_creator_code text,p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); student public.kouponly_students%rowtype; vendor public.kouponly_vendors%rowtype;
  creator public.kouponly_students%rowtype; txn public.kouponly_transactions%rowtype; offer_data jsonb;
  creator_code_row public.kouponly_creator_codes%rowtype; total_cents bigint; discount_cents bigint:=0;
  gift_cents bigint:=0; final_cents bigint; user_cashback bigint:=0; creator_cashback bigint:=0;
  rate_key text; rate_row public.kouponly_rate_limits%rowtype; creator_name text;
  discount_type text; discount_value numeric; allowed_values jsonb; response jsonb;
begin
  if uid is null then raise exception 'Login required' using errcode='28000'; end if;
  if p_type is null or p_type not in ('offer','giftcard') then raise exception 'Invalid redemption type' using errcode='22023'; end if;
  if p_total_amount is null or p_total_amount<0.01 or p_total_amount>1000000 or round(p_total_amount*100)<>p_total_amount*100 then raise exception 'Total amount is invalid' using errcode='22023'; end if;
  select * into txn from public.kouponly_transactions where student_id=uid and idempotency_key=p_idempotency_key;
  if found and txn.payload ? 'finalAmount' then return txn.payload; end if;
  select * into student from public.kouponly_students where id=uid for update;
  if not found then raise exception 'User not found' using errcode='P0002'; end if;
  if coalesce((student.profile->>'redemptionDisabled')::boolean,false) or student.profile->>'accountType'='browse_only' then raise exception 'This account cannot make redemptions' using errcode='42501'; end if;
  select * into vendor from public.kouponly_vendors where id=p_vendor_id for share;
  if not found then raise exception 'Vendor not found' using errcode='P0002'; end if;
  rate_key:=encode(extensions.digest(uid::text||':'||p_vendor_id,'sha256'),'hex');
  insert into public.kouponly_rate_limits(key,window_started_at,hit_count) values(rate_key,now(),1)
    on conflict(key) do update set hit_count=case when now()-kouponly_rate_limits.window_started_at<interval '5 minutes' then kouponly_rate_limits.hit_count+1 else 1 end,
      window_started_at=case when now()-kouponly_rate_limits.window_started_at<interval '5 minutes' then kouponly_rate_limits.window_started_at else now() end returning * into rate_row;
  if rate_row.hit_count>10 then raise exception 'Too many redemption attempts. Please try again later.' using errcode='42900'; end if;
  total_cents:=round(p_total_amount*100);final_cents:=total_cents;
  if p_type='offer' then
    if p_offer_index is not null then
      offer_data:=vendor.payload->'offers'->p_offer_index;
      if offer_data is null then raise exception 'Offer not found for this vendor' using errcode='P0002'; end if;
      if coalesce((offer_data->>'isActive')::boolean,true)=false then raise exception 'Offer is not available' using errcode='55000'; end if;
      discount_type:=offer_data->>'discountType';discount_value:=coalesce((offer_data->>'discountValue')::numeric,0);
      if discount_value<0 then raise exception 'Invalid discount value' using errcode='22023'; end if;
      if discount_type='percentage' then discount_cents:=round(total_cents*discount_value/100);
      elsif discount_type='amount' then discount_cents:=round(discount_value*100);
      elsif discount_type='buy1get1' then discount_cents:=0;
      else raise exception 'Invalid discount type' using errcode='22023'; end if;
      discount_cents:=least(discount_cents,total_cents);final_cents:=total_cents-discount_cents;
    end if;
    if nullif(trim(coalesce(p_creator_code,'')),'') is not null then
      select * into creator_code_row from public.kouponly_creator_codes where code=upper(trim(p_creator_code));
      if not found then raise exception 'Invalid creator code' using errcode='P0002'; end if;
      select * into creator from public.kouponly_students where id=creator_code_row.student_id;
      if not found then raise exception 'Creator not found' using errcode='P0002'; end if;
      creator_name:=coalesce(creator.profile->>'name',nullif(creator.first_name||' '||creator.last_name,' '));
    end if;
    if coalesce((vendor.payload->>'xcard')::boolean,false) then
      user_cashback:=round(final_cents*0.01);if creator_code_row.student_id is not null then creator_cashback:=round(final_cents*0.01);end if;
    end if;
  else
    allowed_values:=vendor.payload->'loyalty';if jsonb_typeof(allowed_values)<>'array' or jsonb_array_length(allowed_values)=0 then allowed_values:='[25,50,75]'::jsonb;end if;
    if p_giftcard_amount is null or p_giftcard_amount<=0 or not exists(select 1 from jsonb_array_elements_text(allowed_values) item where round(item::numeric*100)=round(p_giftcard_amount*100)) then raise exception 'Gift card value is not available for this vendor' using errcode='22023'; end if;
    gift_cents:=round(p_giftcard_amount*100);
    if round(student.cashback*100)<gift_cents then raise exception 'Insufficient balance' using errcode='55000'; end if;
    final_cents:=greatest(0,total_cents-gift_cents);
    update public.kouponly_students set cashback=cashback-(gift_cents::numeric/100),savings=savings+(gift_cents::numeric/100) where id=uid;
  end if;
  insert into public.kouponly_transactions(student_id,vendor_id,vendor_id_snapshot,offer_id,transaction_type,status,idempotency_key,amount,total_amount,final_amount,discount_amount,vendor_name,type,cashback_amount,creator_cashback_amount,creator_code,creator_uid,discount_type,discount_value,redemption_card_amount,remaining_amount,metadata,completed_at)
  values(uid,p_vendor_id,p_vendor_id,p_offer_id,p_type,'completed',p_idempotency_key,p_total_amount,p_total_amount,final_cents::numeric/100,discount_cents::numeric/100,vendor.name,p_type,user_cashback::numeric/100,creator_cashback::numeric/100,nullif(p_creator_code,''),creator_code_row.student_id,discount_type,discount_value,gift_cents::numeric/100,final_cents::numeric/100,
    jsonb_build_object('totalAmount',p_total_amount,'finalAmount',final_cents::numeric/100,'offer',offer_data,'creatorCode',nullif(p_creator_code,''),'cashbackAmount',user_cashback::numeric/100,'creatorCashbackAmount',creator_cashback::numeric/100),now()) returning * into txn;
  if p_type='offer' and (discount_cents+gift_cents)>0 then update public.kouponly_students set savings=savings+(discount_cents::numeric/100) where id=uid; end if;
  if user_cashback>0 then update public.kouponly_students set cashback=cashback+(user_cashback::numeric/100) where id=uid; end if;
  if creator_cashback>0 then update public.kouponly_students set cashback=cashback+(creator_cashback::numeric/100) where id=creator_code_row.student_id; end if;
  insert into public.kouponly_reward_accounts(student_id,status_points,redemption_count,last_earned_at,updated_at)
    values(uid,100,1,now(),now()) on conflict(student_id) do update set status_points=kouponly_reward_accounts.status_points+100,redemption_count=kouponly_reward_accounts.redemption_count+1,last_earned_at=now(),updated_at=now();
  response:=jsonb_build_object('transactionId',txn.id,'finalAmount',final_cents::numeric/100,'discountAmount',discount_cents::numeric/100,
    'savedAmount',(discount_cents+gift_cents)::numeric/100,'cashbackAmount',case when creator_code_row.student_id=uid then (user_cashback+creator_cashback)::numeric/100 else user_cashback::numeric/100 end,
    'creatorUid',creator_code_row.student_id,'creatorName',creator_name,'creatorCashback',creator_cashback::numeric/100,'vendorName',vendor.name);
  update public.kouponly_transactions set payload=response where id=txn.id;
  return response;
end $$;
revoke all on function public.kouponly_redeem_offer(text,text,numeric,text,numeric,integer,text,uuid) from public,anon;
grant execute on function public.kouponly_redeem_offer(text,text,numeric,text,numeric,integer,text,uuid) to authenticated;

create or replace function public.kouponly_redeem_gift_card(p_vendor_id text,p_amount numeric,p_idempotency_key uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path='' as $$
begin raise exception 'Use kouponly_redeem_offer for vendor checkout' using errcode='42501'; end $$;

drop function if exists public.kouponly_set_vendor_redemption_pin(text,text);
drop table if exists public.partner_redemption_pins;
drop table if exists public.kouponly_vendor_redemption_secrets;

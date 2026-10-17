-- Preserve the existing gateway-only request boundary and retry semantics.
alter table public.kouponly_student_requests add column location text check (length(location)<=160);
drop function public.kouponly_submit_student_request(uuid,text,text,text,text,text,text,uuid,text);
create function public.kouponly_submit_student_request(p_id uuid,p_kind text,p_name text,p_domain text,p_email text,p_contact text,p_phone text,p_user_id uuid,p_origin_hash text,p_location text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=p_user_id; prior public.kouponly_student_requests%rowtype;
begin
  if p_origin_hash is null or p_origin_hash !~ '^[a-f0-9]{64}$' then raise exception 'Request origin required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('community-origin:'||p_origin_hash,0));
  if uid is not null then perform pg_advisory_xact_lock(hashtextextended('community-user:'||uid::text,0)); end if;
  p_name:=trim(p_name); p_domain:=lower(trim(coalesce(p_domain,''))); p_email:=lower(trim(p_email));
  p_contact:=trim(coalesce(p_contact,'')); p_phone:=trim(coalesce(p_phone,''));
  p_location:=trim(coalesce(p_location,''));
  if p_kind='restaurant' then p_domain:=''; if length(p_location) not between 1 and 160 then raise exception 'Enter the restaurant location.'; end if; end if;
  if p_kind='school' and (length(p_contact)<2 or p_phone !~ '^[+0-9][0-9 ()-]{6,39}$') then raise exception 'Enter your name and a valid phone number.'; end if;
  if p_id is null or p_kind is null or p_kind not in ('school','restaurant') or p_name is null or length(p_name) not between 2 and 160
    or p_email is null or length(p_email)>254 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    or length(p_contact)>160 or length(p_phone)>40 then raise exception 'Check the request details.'; end if;
  if p_kind='restaurant' and (uid is null or not exists(select 1 from public.couponly_students where id=uid)) then raise exception 'Sign in as a student to request a restaurant.' using errcode='42501'; end if;
  if p_kind='school' and (length(p_domain)>253 or p_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?([.][a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') then raise exception 'Enter a valid school email domain.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('school-request:'||p_email,0));
  select * into prior from public.kouponly_student_requests where id=p_id;
  if found then
    if prior.user_id is not distinct from uid and prior.contact_email=p_email and prior.kind=p_kind and prior.name=p_name
      and coalesce(prior.domain,'')=p_domain and coalesce(prior.contact_name,'')=p_contact and coalesce(prior.phone,'')=p_phone and coalesce(prior.location,'')=p_location then return p_id; end if;
    raise exception 'This request changed. Submit a new request.';
  end if;
  if (select count(*) from public.kouponly_student_requests where contact_email=p_email and created_at>now()-interval '1 day')>=3 then raise exception 'You have submitted three requests today. Please try again tomorrow.'; end if;
  if (select count(*) from public.kouponly_community_request_log where kind in ('school','restaurant') and created_at>now()-interval '1 day' and (origin_hash=p_origin_hash or (uid is not null and user_id=uid)))>=3 then raise exception 'You have submitted three requests today. Please try again tomorrow.'; end if;
  insert into public.kouponly_community_request_log(id,user_id,origin_hash,kind) values(p_id,uid,p_origin_hash,p_kind);
  insert into public.kouponly_student_requests(id,user_id,kind,name,domain,contact_email,contact_name,phone,location)
    values(p_id,uid,p_kind,p_name,nullif(p_domain,''),p_email,nullif(p_contact,''),nullif(p_phone,''),nullif(p_location,''));
  return p_id;
end $$;
revoke all on function public.kouponly_submit_student_request(uuid,text,text,text,text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.kouponly_submit_student_request(uuid,text,text,text,text,text,text,uuid,text,text) to service_role;


create or replace view public.kouponly_entitlement_offers as
select id,vendor_id,title,active,starts_at,ends_at,redemption_mode,sort_order,offer_value,currency,
 discount_type,discount_value from public.couponly_offers;
revoke all on public.kouponly_entitlement_offers from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.kouponly_redeem_coupon(p_offer_id text, p_round_id uuid, p_mutation_id uuid, p_bill_amount numeric, p_free_item_amount numeric)
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
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  perform public.kouponly_qualify_referral(uid);
  if p_mutation_id is null or p_round_id is null or p_offer_id is null then raise exception 'Invalid redemption request'; end if;
  if p_bill_amount is not null and not (p_bill_amount>0 and p_bill_amount<=9999999999.99 and p_bill_amount=round(p_bill_amount,2)) then
    raise exception 'INVALID_BILL_AMOUNT' using errcode='22023';
  end if;
  fp:=encode(extensions.digest('redeem:'||p_offer_id||':'||p_round_id::text
    ||case when p_bill_amount is null then '' else ':'||p_bill_amount::numeric(12,2)::text end
    ||case when p_free_item_amount is null then '' else ':free:'||p_free_item_amount::numeric(12,2)::text end,'sha256'),'hex');
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
  if exists(
    select 1 from public.redemptions
    where user_id=uid
      and (round_id=r.id or (r.round_number=0 and consumed_at>=p.starts_at and consumed_at<p.ends_at
        and period_id in (select id from public.kouponly_subscription_periods where subscription_id in
          (select id from public.kouponly_subscriptions where provider<>'free_mvp'))))
      and offer_id=o.id and consumed_at is not null
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
        period_id,round_id,vendor_id,offer_id,bill_amount,offer_snapshot
      ) values(
        uid,receipt,'inStore','success',receipt_code,now(),now(),p.id,r.id,o.vendor_id,o.id,p_bill_amount,
        jsonb_build_object('title',o.title,'vendorName',o.vendor_name,
          'estimatedSavings',savings_amount,'payableAmount',payable_amount,'currency',o.currency,'billAmount',p_bill_amount)
      );
      exit;
    exception when unique_violation then
      get stacked diagnostics collision_constraint=constraint_name;
      if collision_constraint<>'kouponly_short_receipt_code_unique' then raise; end if;
    end;
  end loop;
  result:=jsonb_build_object('id',receipt,'code',receipt_code,'status','success',
    'consumedAt',extract(epoch from now())*1000,'vendorName',o.vendor_name,
    'offerTitle',o.title,'estimatedSavings',savings_amount,'payableAmount',payable_amount,'currency',o.currency,'billAmount',p_bill_amount,
    'benefits',public.kouponly_account_benefits());
  insert into public.mutation_receipts(user_id,mutation_id,operation,result,request_fingerprint)
    values(uid,p_mutation_id,'kouponly-redeem-coupon',result,fp);
  return result;
end $function$
;


-- Existing callers keep their four-argument API.
create or replace function public.kouponly_redeem_coupon(p_offer_id text,p_round_id uuid,p_mutation_id uuid,p_bill_amount numeric)
returns jsonb language sql security definer set search_path='' as $$
 select public.kouponly_redeem_coupon(p_offer_id,p_round_id,p_mutation_id,p_bill_amount,null::numeric);
$$;
revoke all on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric) from public,anon;
grant execute on function public.kouponly_redeem_coupon(text,uuid,uuid,numeric,numeric) to authenticated;

-- Student creation happens after Auth's empty profile bootstrap. Synchronize once
-- here so signup never consumes the user's one permitted profile edit.
create function public.kouponly_initialize_student_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare birth date;
begin
 if nullif(new.profile->>'dob','') is not null then
   birth:=(new.profile->>'dob')::date;
   if birth>current_date then raise exception 'Date of birth cannot be in the future'; end if;
 end if;
 if length(coalesce(new.profile->>'phone',''))>40 then raise exception 'Phone number is too long'; end if;
 update public.profiles set full_name=concat_ws(' ',new.first_name,new.last_name),
   mobile=coalesce(nullif(new.phone,''),new.profile->>'phone',''),date_of_birth=birth,updated_at=now()
 where user_id=new.id;
 insert into public.notifications(user_id,title,body,kind)
 values(new.id,'Welcome to Kouponly!',
 'You have pre-launch access. Thanks for joining Kouponly! Share it with your friends and visit https://kouponly.in.', 'prelaunch_welcome');
 return new;
end $$;
revoke all on function public.kouponly_initialize_student_profile() from public,anon,authenticated;
create trigger kouponly_initialize_student_profile after insert on public.couponly_students
for each row execute function public.kouponly_initialize_student_profile();
-- Repair missing fields on existing accounts without overwriting later edits.
update public.profiles p set
 full_name=coalesce(nullif(trim(p.full_name),''),concat_ws(' ',s.first_name,s.last_name)),
 mobile=coalesce(nullif(p.mobile,''),nullif(s.phone,''),s.profile->>'phone','')
from public.couponly_students s where p.user_id=s.id;
-- Ignore malformed historical metadata rather than failing the whole repair.
do $$ declare student record; birth date; begin
 for student in select s.id,s.profile->>'dob' as dob from public.couponly_students s
 join public.profiles p on p.user_id=s.id where p.date_of_birth is null and s.profile->>'dob' ~ '^\d{4}-\d{2}-\d{2}$' loop
  begin birth:=student.dob::date;
   if birth<=current_date then update public.profiles set date_of_birth=birth where user_id=student.id; end if;
  exception when invalid_datetime_format or datetime_field_overflow then null;
  end;
 end loop;
end $$;
notify pgrst,'reload schema';

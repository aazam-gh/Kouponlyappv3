drop function if exists public.kouponly_admin_coupons(text, uuid, text, integer, integer);

create table public.kouponly_redemption_amount_audit (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  redemption_id text not null,
  previous_amount numeric(12,2) not null,
  updated_amount numeric(12,2) not null check (updated_amount >= 0),
  reason text not null check (length(trim(reason)) between 1 and 500),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  foreign key (user_id, redemption_id) references public.redemptions(user_id, redemption_id) on delete cascade
);
create index kouponly_redemption_amount_audit_latest_idx on public.kouponly_redemption_amount_audit(user_id, redemption_id, changed_at desc);
alter table public.kouponly_redemption_amount_audit enable row level security;
create policy kouponly_redemption_amount_audit_admin_read on public.kouponly_redemption_amount_audit for select to authenticated using (public.kouponly_is_benefits_admin());

create function public.kouponly_admin_correct_redemption_amount(p_user_id uuid, p_redemption_id text, p_updated_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare old_amount numeric(12,2); bill numeric(12,2);
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_updated_amount is null or p_updated_amount < 0 or p_updated_amount != round(p_updated_amount, 2)
    or length(trim(coalesce(p_reason, ''))) not between 1 and 500 then raise exception 'Enter a valid amount and correction reason' using errcode = '22023'; end if;
  select coalesce((select a.updated_amount from public.kouponly_redemption_amount_audit a where a.user_id = p_user_id and a.redemption_id = p_redemption_id order by a.changed_at desc, a.id desc limit 1), nullif(r.offer_snapshot->>'payableAmount','')::numeric), r.bill_amount
    into old_amount, bill from public.redemptions r where r.user_id = p_user_id and r.redemption_id = p_redemption_id and r.consumed_at is not null for update;
  if not found then raise exception 'Redeemed coupon not found' using errcode = 'P0002'; end if;
  if p_updated_amount > coalesce(bill, 9999999999.99) then raise exception 'Updated amount cannot exceed the bill amount' using errcode = '22023'; end if;
  insert into public.kouponly_redemption_amount_audit(user_id, redemption_id, previous_amount, updated_amount, reason, changed_by)
    values(p_user_id, p_redemption_id, coalesce(old_amount, 0), p_updated_amount, trim(p_reason), auth.uid());
end $$;
revoke all on function public.kouponly_admin_correct_redemption_amount(uuid,text,numeric,text) from public, anon;
grant execute on function public.kouponly_admin_correct_redemption_amount(uuid,text,numeric,text) to authenticated;

create function public.kouponly_admin_coupons(p_vendor_id text default null, p_user_id uuid default null, p_search text default '', p_offset integer default 0, p_limit integer default 25, p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
 if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_offset < 0 or p_limit not between 1 and 100 or length(coalesce(p_search,'')) > 200 or (p_from is not null and p_to is not null and p_from > p_to) then raise exception 'Invalid search, date range, or pagination' using errcode='22023'; end if;
 with receipts as (
  select r.redemption_id as id, r.user_id as "userId", r.vendor_id as "vendorId", r.offer_id as "offerId", r.bill_amount as "billAmount",
   r.offer_snapshot->>'currency' as currency, r.code, r.consumed_at as "consumedAt", r.status, r.round_id as "roundId", r.period_id as "periodId",
   u.email, coalesce(nullif(trim(s.first_name || ' ' || s.last_name),''), s.profile->>'name', u.email, r.user_id::text) as "studentName",
   s.phone as "studentPhone", s.first_name as "firstName", s.last_name as "lastName", s.profile->>'dateOfBirth' as "dateOfBirth",
   s.profile->>'secondaryEmail' as "secondaryEmail", s.university_id as "universityId", un.name as university,
   coalesce(r.offer_snapshot->>'vendorName', v.name, r.vendor_id) as vendor,
   coalesce(r.offer_snapshot->>'title', r.offer_id) as offer,
   coalesce((select a.updated_amount from public.kouponly_redemption_amount_audit a where a.user_id=r.user_id and a.redemption_id=r.redemption_id order by a.changed_at desc,a.id desc limit 1), nullif(r.offer_snapshot->>'payableAmount','')::numeric) as "finalAmount",
   nullif(r.offer_snapshot->>'estimatedSavings','')::numeric as "discountAmount",
   v.payload->>'email' as "vendorEmail", coalesce(v.payload->>'phoneNumber',v.payload->>'phone') as "vendorPhone",
   coalesce(v.payload->>'address', v.locations->0->>'address') as "vendorAddress",
   (select jsonb_agg(jsonb_build_object('updatedAmount', a.updated_amount, 'previousAmount', a.previous_amount, 'reason', a.reason, 'changedBy', a.changed_by, 'changedAt', a.changed_at) order by a.changed_at desc,a.id desc)
    from public.kouponly_redemption_amount_audit a where a.user_id=r.user_id and a.redemption_id=r.redemption_id) as "corrections"
  from public.redemptions r left join auth.users u on u.id=r.user_id left join public.realx_students s on s.id=r.user_id
  left join public.realx_universities un on un.id=s.university_id left join public.realx_vendors v on v.id=r.vendor_id
  where r.round_id is not null and r.consumed_at is not null and (p_vendor_id is null or r.vendor_id=p_vendor_id) and (p_user_id is null or r.user_id=p_user_id)
   and (p_from is null or r.consumed_at >= p_from::timestamptz) and (p_to is null or r.consumed_at < (p_to+1)::timestamptz)
 ), filtered as (select * from receipts where coalesce(p_search,'')='' or concat_ws(' ',vendor,offer,email,"studentName",code,id) ilike '%'||p_search||'%')
 select jsonb_build_object('total',(select count(*) from filtered),'allTime',(select count(*) from receipts),
  'thisMonth',(select count(*) from receipts where "consumedAt">=month_start),'uniqueUsers',(select count(distinct "userId") from receipts),
  'receipts',coalesce((select jsonb_agg(x order by "consumedAt" desc,id) from (select * from filtered order by "consumedAt" desc,id offset p_offset limit p_limit)x),'[]'::jsonb),
  'vendors',coalesce((select jsonb_agg(x order by count desc,vendor) from (select "vendorId",max(vendor) as vendor,count(*),count(*) filter(where "consumedAt">=month_start) as "thisMonth",count(distinct "userId") as "uniqueUsers" from receipts group by "vendorId" order by count(*) desc,max(vendor) limit 20)x),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(x order by day) from (select ("consumedAt" at time zone 'Asia/Kolkata')::date as day,count(*) from receipts where "consumedAt">=month_start group by 1)x),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.kouponly_admin_coupons(text,uuid,text,integer,integer,date,date) from public, anon;
grant execute on function public.kouponly_admin_coupons(text,uuid,text,integer,integer,date,date) to authenticated;
notify pgrst, 'reload schema';

create or replace function public.couponly_vendor_dashboard_stats(p_vendor_id text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not (public.realx_is_admin() or public.realx_is_vendor_member(p_vendor_id)) then raise exception 'Not authorized to view this vendor dashboard' using errcode = '42501'; end if;
  select jsonb_build_object(
    'totalRedemptions', count(t.id) filter (where t.status = 'completed'),
    'thisMonthRedemptions', count(t.id) filter (where t.status = 'completed' and t.created_at >= month_start),
    'totalRevenue', coalesce(sum(t.final_amount) filter (where t.status = 'completed'), 0),
    'totalDiscount', coalesce(sum(t.discount_amount) filter (where t.status = 'completed'), 0),
    'uniqueCustomers', count(distinct t.student_id) filter (where t.status = 'completed'),
    'activeOffers', coalesce((select jsonb_array_length(case when jsonb_typeof(v.payload->'offers') = 'array' then v.payload->'offers' else '[]'::jsonb end) from public.realx_vendors v where v.id = p_vendor_id), 0),
    'pendingTransactions', count(t.id) filter (where t.status = 'pending')
  ) into result from public.realx_transactions t where t.vendor_id = p_vendor_id;
  return result;
end $$;
revoke all on function public.couponly_vendor_dashboard_stats(text) from public, anon;
grant execute on function public.couponly_vendor_dashboard_stats(text) to authenticated;
notify pgrst, 'reload schema';

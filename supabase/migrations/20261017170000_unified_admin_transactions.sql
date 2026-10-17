create table public.kouponly_transaction_amount_audit (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.couponly_transactions(id) on delete cascade,
  previous_amount numeric(12,2) not null,
  updated_amount numeric(12,2) not null check (updated_amount >= 0),
  reason text not null check (length(trim(reason)) between 1 and 500),
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now()
);
create index kouponly_transaction_amount_audit_latest_idx on public.kouponly_transaction_amount_audit(transaction_id, changed_at desc);
alter table public.kouponly_transaction_amount_audit enable row level security;

create function public.kouponly_admin_correct_transaction_amount(p_transaction_id uuid, p_updated_amount numeric, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare old_amount numeric(12,2); bill numeric(12,2);
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_updated_amount is null or p_updated_amount < 0 or p_updated_amount != round(p_updated_amount,2) or length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'Enter a valid amount and correction reason' using errcode = '22023'; end if;
  select coalesce((select a.updated_amount from public.kouponly_transaction_amount_audit a where a.transaction_id=t.id order by a.changed_at desc,a.id desc limit 1),t.final_amount), t.total_amount
    into old_amount,bill from public.couponly_transactions t where t.id=p_transaction_id for update;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  if p_updated_amount > bill then raise exception 'Updated amount cannot exceed the bill amount' using errcode = '22023'; end if;
  insert into public.kouponly_transaction_amount_audit(transaction_id,previous_amount,updated_amount,reason,changed_by)
    values(p_transaction_id,coalesce(old_amount,0),p_updated_amount,trim(p_reason),auth.uid());
end $$;
revoke all on function public.kouponly_admin_correct_transaction_amount(uuid,numeric,text) from public,anon;
grant execute on function public.kouponly_admin_correct_transaction_amount(uuid,numeric,text) to authenticated;

create or replace function public.kouponly_admin_coupons(p_vendor_id text default null,p_user_id uuid default null,p_search text default '',p_offset integer default 0,p_limit integer default 25,p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
 if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode='42501'; end if;
 if p_offset<0 or p_limit not between 1 and 100 or length(coalesce(p_search,''))>200 or (p_from is not null and p_to is not null and p_from>p_to) then raise exception 'Invalid search, date range, or pagination' using errcode='22023'; end if;
 with records as (
  select 'redemption'::text as source,r.redemption_id as id,r.user_id as "userId",r.vendor_id as "vendorId",r.offer_id as "offerId",r.bill_amount as "billAmount",
   r.offer_snapshot->>'currency' as currency,r.code,r.consumed_at as "consumedAt",r.status,r.round_id::text as "roundId",r.period_id::text as "periodId",
   u.email,coalesce(nullif(trim(s.first_name||' '||s.last_name),''),s.profile->>'name',u.email,r.user_id::text) as "studentName",s.phone as "studentPhone",
   s.first_name as "firstName",s.last_name as "lastName",s.profile->>'dateOfBirth' as "dateOfBirth",s.profile->>'secondaryEmail' as "secondaryEmail",s.university_id as "universityId",un.name as university,
   coalesce(r.offer_snapshot->>'vendorName',v.name,r.vendor_id) as vendor,coalesce(r.offer_snapshot->>'title',r.offer_id) as offer,
   coalesce((select a.updated_amount from public.kouponly_redemption_amount_audit a where a.user_id=r.user_id and a.redemption_id=r.redemption_id order by a.changed_at desc,a.id desc limit 1),nullif(r.offer_snapshot->>'payableAmount','')::numeric) as "finalAmount",
   nullif(r.offer_snapshot->>'estimatedSavings','')::numeric as "discountAmount",v.payload->>'email' as "vendorEmail",coalesce(v.payload->>'phoneNumber',v.payload->>'phone') as "vendorPhone",
   coalesce(v.payload->>'address',v.locations->0->>'address') as "vendorAddress",
   (select jsonb_agg(jsonb_build_object('updatedAmount',a.updated_amount,'previousAmount',a.previous_amount,'reason',a.reason,'changedBy',a.changed_by,'changedAt',a.changed_at) order by a.changed_at desc,a.id desc) from public.kouponly_redemption_amount_audit a where a.user_id=r.user_id and a.redemption_id=r.redemption_id) as corrections
  from public.redemptions r left join auth.users u on u.id=r.user_id left join public.realx_students s on s.id=r.user_id left join public.realx_universities un on un.id=s.university_id left join public.realx_vendors v on v.id=r.vendor_id
  where r.round_id is not null and r.consumed_at is not null and (p_vendor_id is null or r.vendor_id=p_vendor_id) and (p_user_id is null or r.user_id=p_user_id)
   and (p_from is null or r.consumed_at>=p_from::timestamptz) and (p_to is null or r.consumed_at<(p_to+1)::timestamptz)
  union all
  select 'transaction'::text,t.id::text,t.student_id,t.vendor_id,t.offer_id,t.total_amount,coalesce(t.payload->>'currency','INR'),t.code,t.created_at,t.status,null::text,null::text,
   u.email,coalesce(nullif(p.full_name,''),nullif(trim(s.first_name||' '||s.last_name),''),u.email,t.student_id::text),coalesce(p.mobile,s.phone),s.first_name,s.last_name,p.date_of_birth::text,
   coalesce(s.profile->>'secondaryEmail',u.raw_user_meta_data->>'secondary_email'),s.university_id,un.name,
   coalesce(v.name,t.vendor_name,t.vendor_id_snapshot),coalesce(o.title,t.payload->>'offerTitle',t.type,'—'),
   coalesce((select a.updated_amount from public.kouponly_transaction_amount_audit a where a.transaction_id=t.id order by a.changed_at desc,a.id desc limit 1),t.final_amount),
   t.discount_amount,v.payload->>'email',coalesce(v.payload->>'phoneNumber',v.payload->>'phone'),coalesce(v.payload->>'address',v.locations->0->>'address'),
   (select jsonb_agg(jsonb_build_object('updatedAmount',a.updated_amount,'previousAmount',a.previous_amount,'reason',a.reason,'changedBy',a.changed_by,'changedAt',a.changed_at) order by a.changed_at desc,a.id desc) from public.kouponly_transaction_amount_audit a where a.transaction_id=t.id)
  from public.couponly_transactions t left join auth.users u on u.id=t.student_id left join public.couponly_students s on s.id=t.student_id left join public.profiles p on p.user_id=t.student_id
   left join public.realx_universities un on un.id=s.university_id left join public.couponly_vendors v on v.id=t.vendor_id left join public.couponly_offers o on o.id=t.offer_id
  where t.status='completed' and (p_vendor_id is null or t.vendor_id=p_vendor_id) and (p_user_id is null or t.student_id=p_user_id)
   and (p_from is null or t.created_at>=p_from::timestamptz) and (p_to is null or t.created_at<(p_to+1)::timestamptz)
 ), filtered as (select * from records where coalesce(p_search,'')='' or concat_ws(' ',vendor,offer,email,"studentName",code,id) ilike '%'||p_search||'%')
 select jsonb_build_object('total',(select count(*) from filtered),'allTime',(select count(*) from records),'thisMonth',(select count(*) from records where "consumedAt">=month_start),
  'uniqueUsers',(select count(distinct "userId") from records),'receipts',coalesce((select jsonb_agg(x order by "consumedAt" desc,id) from (select * from filtered order by "consumedAt" desc,id offset p_offset limit p_limit)x),'[]'::jsonb),
  'vendors',coalesce((select jsonb_agg(x order by count desc,vendor) from (select "vendorId",max(vendor) as vendor,count(*),count(*) filter(where "consumedAt">=month_start) as "thisMonth",count(distinct "userId") as "uniqueUsers" from records group by "vendorId" order by count(*) desc,max(vendor) limit 20)x),'[]'::jsonb),
  'daily',coalesce((select jsonb_agg(x order by day) from (select ("consumedAt" at time zone 'Asia/Kolkata')::date as day,count(*) from records where "consumedAt">=month_start group by 1)x),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.kouponly_admin_coupons(text,uuid,text,integer,integer,date,date) from public,anon;
grant execute on function public.kouponly_admin_coupons(text,uuid,text,integer,integer,date,date) to authenticated;
notify pgrst,'reload schema';

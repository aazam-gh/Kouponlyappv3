drop function if exists public.kouponly_admin_dashboard();

create or replace function public.kouponly_admin_dashboard(p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if not public.kouponly_is_benefits_admin() then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_from is not null and p_to is not null and p_from > p_to then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;

  with tx as (
    select t.* from public.kouponly_transactions t
    where t.status = 'completed'
      and (p_from is null or t.created_at >= p_from::timestamptz)
      and (p_to is null or t.created_at < (p_to + 1)::timestamptz)
  ), redemptions as (
    select r.* from public.redemptions r
    where r.consumed_at is not null
      and r.round_id is not null
      and (p_from is null or r.consumed_at >= p_from::timestamptz)
      and (p_to is null or r.consumed_at < (p_to + 1)::timestamptz)
  ), activity as (
    select t.created_at, coalesce((select a.updated_amount from public.kouponly_transaction_amount_audit a where a.transaction_id=t.id order by a.changed_at desc,a.id desc limit 1),t.final_amount) as amount from tx t
    union all
    select r.consumed_at, coalesce((select a.updated_amount from public.kouponly_redemption_amount_audit a where a.user_id=r.user_id and a.redemption_id=r.redemption_id order by a.changed_at desc,a.id desc limit 1),nullif(r.offer_snapshot->>'payableAmount','')::numeric,
      greatest(coalesce(r.bill_amount,0)-coalesce(nullif(r.offer_snapshot->>'estimatedSavings','')::numeric,0),0))
    from redemptions r
  ), monthly as (
    select date_trunc('month', a.created_at)::date as month,
           coalesce(sum(a.amount), 0) as volume,
           count(*) as transactions
    from activity a group by 1
  ), redemption_monthly as (
    select date_trunc('month', r.consumed_at)::date as month, count(*) as redemptions
    from redemptions r group by 1
  ), student_accounts as (
    select u.id, u.created_at
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.kouponly_students s on s.id = u.id
    where not coalesce(u.is_anonymous, false)
      and (p.user_id is not null or s.id is not null or public.kouponly_school_email(u.email))
      and not exists (select 1 from public.couponly_user_roles role where role.user_id = u.id and role.role in ('admin','vendor'))
  ), student_monthly as (
    select date_trunc('month', s.created_at)::date as month, count(*) as students
    from student_accounts s
    where (p_from is null or s.created_at >= p_from::timestamptz) and (p_to is null or s.created_at < (p_to + 1)::timestamptz)
    group by 1
  ), vendor_monthly as (
    select date_trunc('month', v.created_at)::date as month, count(*) as vendors
    from public.kouponly_vendors v
    where p_from is null or v.created_at >= p_from::timestamptz
    group by 1
  )
  select jsonb_build_object(
    'stats', jsonb_build_object(
      'students', (select count(*) from student_accounts s where (p_from is null or s.created_at >= p_from::timestamptz) and (p_to is null or s.created_at < (p_to + 1)::timestamptz)),
      'vendors', (select count(*) from public.kouponly_vendors v where (p_from is null or v.created_at >= p_from::timestamptz) and (p_to is null or v.created_at < (p_to + 1)::timestamptz)),
      'activeVendors', (select count(*) from public.kouponly_vendors v where v.status = 'Active'),
      'transactions', (select count(*) from activity),
      'volume', (select coalesce(sum(amount), 0) from activity),
      'redemptions', (select count(*) from redemptions)
    ),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(months.month, 'YYYY-MM'), 'volume', coalesce(mo.volume,0), 'transactions', coalesce(mo.transactions,0), 'redemptions', coalesce(rm.redemptions,0), 'students', coalesce(sm.students,0), 'vendors', coalesce(vm.vendors,0)) order by months.month)
      from (select generate_series(
        date_trunc('month', coalesce(p_from, (select min(start_date) from (
          select min(created_at)::date as start_date from public.kouponly_transactions
          union all select min(created_at)::date from auth.users
          union all select min(consumed_at)::date from public.redemptions
        ) dates), current_date))::date,
        date_trunc('month', coalesce(p_to, current_date))::date, interval '1 month')::date as month) months
      left join monthly mo on mo.month = months.month left join redemption_monthly rm on rm.month = months.month
      left join student_monthly sm on sm.month = months.month left join vendor_monthly vm on vm.month = months.month), '[]'::jsonb),
    'topVendors', coalesce((select jsonb_agg(jsonb_build_object('id', vendor_id, 'name', name, 'redemptions', redemptions, 'volume', volume) order by redemptions desc, volume desc)
      from (select r.vendor_id, coalesce(max(r.offer_snapshot->>'vendorName'), max(v.name), r.vendor_id, 'Unknown vendor') as name,
        count(*) as redemptions, coalesce(sum(coalesce((select a.updated_amount from public.kouponly_redemption_amount_audit a where a.user_id=r.user_id and a.redemption_id=r.redemption_id order by a.changed_at desc,a.id desc limit 1),nullif(r.offer_snapshot->>'payableAmount','')::numeric,greatest(coalesce(r.bill_amount,0)-coalesce(nullif(r.offer_snapshot->>'estimatedSavings','')::numeric,0),0))), 0) as volume
        from redemptions r left join public.kouponly_vendors v on v.id = r.vendor_id group by r.vendor_id order by count(*) desc limit 10) q), '[]'::jsonb),
    'topOffers', coalesce((select jsonb_agg(jsonb_build_object('id', offer_id, 'offer', offer, 'vendor', vendor, 'redemptions', redemptions) order by redemptions desc)
      from (select r.offer_id, max(coalesce(r.offer_snapshot->>'title', r.offer_id)) as offer,
        max(coalesce(r.offer_snapshot->>'vendorName', v.name, r.vendor_id)) as vendor, count(*) as redemptions
        from redemptions r left join public.kouponly_vendors v on v.id = r.vendor_id group by r.offer_id order by count(*) desc limit 10) q), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.kouponly_admin_dashboard(date,date) from public, anon;
grant execute on function public.kouponly_admin_dashboard(date,date) to authenticated;
notify pgrst, 'reload schema';

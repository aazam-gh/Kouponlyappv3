create or replace function public.couponly_vendor_dashboard_stats(p_vendor_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not (public.kouponly_is_benefits_admin() or public.couponly_is_vendor_member(p_vendor_id)) then
    raise exception 'Not authorized to view this vendor dashboard' using errcode = '42501';
  end if;
  with activity as (
    select t.created_at, t.final_amount, t.discount_amount, t.student_id, t.status
    from public.couponly_transactions t
    where t.vendor_id = p_vendor_id and t.status in ('completed', 'pending')
    union all
    select r.consumed_at,
      coalesce(nullif(r.offer_snapshot->>'payableAmount','')::numeric,
        r.bill_amount - coalesce(nullif(r.offer_snapshot->>'estimatedSavings','')::numeric, 0), r.bill_amount),
      coalesce(nullif(r.offer_snapshot->>'estimatedSavings','')::numeric,
        r.bill_amount - nullif(r.offer_snapshot->>'payableAmount','')::numeric, 0),
      r.user_id, 'completed'::text
    from public.redemptions r
    where r.vendor_id = p_vendor_id and r.mode = 'inStore' and r.status = 'success'
      and r.consumed_at is not null and r.round_id is not null
  )
  select jsonb_build_object(
    'totalRedemptions', count(*) filter (where status = 'completed'),
    'thisMonthRedemptions', count(*) filter (where status = 'completed' and created_at >= month_start),
    'totalRevenue', coalesce(sum(final_amount) filter (where status = 'completed'), 0),
    'totalDiscount', coalesce(sum(discount_amount) filter (where status = 'completed'), 0),
    'uniqueCustomers', count(distinct student_id) filter (where status = 'completed'),
    'activeOffers', coalesce((select jsonb_array_length(case when jsonb_typeof(v.payload->'offers') = 'array' then v.payload->'offers' else '[]'::jsonb end) from public.kouponly_vendors v where v.id = p_vendor_id), 0),
    'pendingTransactions', count(*) filter (where status = 'pending')
  ) into result from activity;
  return result;
end $$;
revoke all on function public.couponly_vendor_dashboard_stats(text) from public, anon;
grant execute on function public.couponly_vendor_dashboard_stats(text) to authenticated;

create or replace function public.couponly_vendor_dashboard_chart(p_vendor_id text, p_range_days integer)
returns table(date date, redemptions bigint, revenue numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.kouponly_is_benefits_admin() or public.couponly_is_vendor_member(p_vendor_id)) then
    raise exception 'Not authorized to view this vendor dashboard' using errcode = '42501';
  end if;
  if p_range_days not in (7, 30, 90) then raise exception 'Unsupported dashboard range' using errcode = '22023'; end if;
  return query
  with activity as (
    select t.created_at, t.final_amount
    from public.couponly_transactions t
    where t.vendor_id = p_vendor_id and t.status = 'completed'
      and t.created_at >= current_date - (p_range_days - 1)
    union all
    select r.consumed_at,
      coalesce(nullif(r.offer_snapshot->>'payableAmount','')::numeric,
        r.bill_amount - coalesce(nullif(r.offer_snapshot->>'estimatedSavings','')::numeric, 0), r.bill_amount)
    from public.redemptions r
    where r.vendor_id = p_vendor_id and r.mode = 'inStore' and r.status = 'success'
      and r.consumed_at is not null and r.round_id is not null
      and r.consumed_at >= current_date - (p_range_days - 1)
  )
  select a.created_at::date, count(*)::bigint, coalesce(sum(a.final_amount), 0)::numeric
  from activity a group by a.created_at::date order by a.created_at::date;
end $$;
revoke all on function public.couponly_vendor_dashboard_chart(text, integer) from public, anon;
grant execute on function public.couponly_vendor_dashboard_chart(text, integer) to authenticated;

create or replace function public.couponly_vendor_dashboard_range(p_vendor_id text, p_from date default null, p_to date default null)
returns table(date date, redemptions bigint, revenue numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.couponly_is_vendor_member(p_vendor_id) then raise exception 'Not authorized to view this vendor dashboard' using errcode = '42501'; end if;
  if p_from is not null and p_to is not null and p_from > p_to then raise exception 'Invalid date range' using errcode = '22023'; end if;
  return query
  with activity as (
    select t.created_at, t.final_amount from public.couponly_transactions t
    where t.vendor_id = p_vendor_id and t.status = 'completed'
      and (p_from is null or t.created_at >= p_from::timestamptz)
      and (p_to is null or t.created_at < (p_to + 1)::timestamptz)
    union all
    select r.consumed_at,
      coalesce(nullif(r.offer_snapshot->>'payableAmount','')::numeric,
        r.bill_amount - coalesce(nullif(r.offer_snapshot->>'estimatedSavings','')::numeric, 0), r.bill_amount)
    from public.redemptions r
    where r.vendor_id = p_vendor_id and r.mode = 'inStore' and r.status = 'success'
      and r.consumed_at is not null and r.round_id is not null
      and (p_from is null or r.consumed_at >= p_from::timestamptz)
      and (p_to is null or r.consumed_at < (p_to + 1)::timestamptz)
  )
  select a.created_at::date, count(*)::bigint, coalesce(sum(a.final_amount),0)::numeric
  from activity a group by a.created_at::date order by a.created_at::date;
end $$;
revoke all on function public.couponly_vendor_dashboard_range(text, date, date) from public, anon;
grant execute on function public.couponly_vendor_dashboard_range(text, date, date) to authenticated;
notify pgrst, 'reload schema';

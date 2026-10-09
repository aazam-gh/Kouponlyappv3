create index if not exists realx_transactions_created_at_idx
  on public.realx_transactions(created_at desc);

create or replace function public.couponly_vendor_dashboard_stats(p_vendor_id text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not (public.realx_is_admin() or public.realx_is_vendor_member(p_vendor_id)) then
    raise exception 'Not authorized to view this vendor dashboard' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totalRedemptions', count(t.id),
    'totalRevenue', coalesce(sum(t.final_amount) filter (where t.status = 'completed'), 0),
    'totalDiscount', coalesce(sum(t.discount_amount) filter (where t.status = 'completed'), 0),
    'activeOffers', coalesce((
      select jsonb_array_length(case when jsonb_typeof(v.payload->'offers') = 'array' then v.payload->'offers' else '[]'::jsonb end)
      from public.realx_vendors v where v.id = p_vendor_id
    ), 0),
    'pendingTransactions', count(t.id) filter (where t.status = 'pending'),
    'redemptionsTrend', 5.2,
    'revenueTrend', 8.4
  )
  into result
  from public.realx_transactions t
  where t.vendor_id = p_vendor_id;

  return result;
end;
$$;

create or replace function public.couponly_vendor_dashboard_chart(p_vendor_id text, p_range_days integer)
returns table(date date, redemptions bigint, revenue numeric)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not (public.realx_is_admin() or public.realx_is_vendor_member(p_vendor_id)) then
    raise exception 'Not authorized to view this vendor dashboard' using errcode = '42501';
  end if;
  if p_range_days not in (7, 30, 90) then
    raise exception 'Unsupported dashboard range' using errcode = '22023';
  end if;

  return query
  select t.created_at::date,
         count(*)::bigint,
         coalesce(sum(t.final_amount), 0)::numeric
  from public.realx_transactions t
  where t.vendor_id = p_vendor_id
    and t.status = 'completed'
    and t.created_at >= current_date - (p_range_days - 1)
  group by t.created_at::date
  order by t.created_at::date;
end;
$$;

create or replace function public.couponly_admin_dashboard()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.realx_is_admin() then
    raise exception 'Not authorized to view the admin dashboard' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'stats', jsonb_build_object(
      'students', (select count(*) from public.realx_students),
      'activeVendors', (select count(*) from public.realx_vendors where status = 'Active'),
      'offers', (select coalesce(sum(jsonb_array_length(case when jsonb_typeof(payload->'offers') = 'array' then payload->'offers' else '[]'::jsonb end)), 0) from public.realx_vendors),
      'vendorsWithOffers', (select count(*) from public.realx_vendors where jsonb_array_length(case when jsonb_typeof(payload->'offers') = 'array' then payload->'offers' else '[]'::jsonb end) > 0),
      'vendorsWithoutOffers', (select count(*) from public.realx_vendors where jsonb_array_length(case when jsonb_typeof(payload->'offers') = 'array' then payload->'offers' else '[]'::jsonb end) = 0),
      'transactions', (select count(*) from public.realx_transactions)
    ),
    'revenue', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(month_start, 'Mon'), 'amount', amount) order by month_start)
      from (
        select months.month_start,
               coalesce(sum(t.final_amount) filter (where t.status = 'completed'), 0) as amount
        from generate_series(date_trunc('month', current_date)::date - interval '5 months', date_trunc('month', current_date)::date, interval '1 month') as months(month_start)
        left join public.realx_transactions t
          on t.created_at >= months.month_start
         and t.created_at < months.month_start + interval '1 month'
        group by months.month_start
      ) monthly
    ), '[]'::jsonb),
    'topVendors', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'sales', sales) order by sales desc)
      from (
        select coalesce(t.vendor_name, v.name, t.vendor_id_snapshot, 'Unknown Vendor') as name,
               sum(t.final_amount) as sales
        from public.realx_transactions t
        left join public.realx_vendors v on v.id = t.vendor_id
        where t.status = 'completed' and t.created_at >= now() - interval '30 days'
        group by 1 order by sales desc limit 5
      ) top_vendors
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', recent.id,
        'studentName', coalesce(nullif(recent.payload->>'studentName', ''), nullif(recent.profile->>'name', ''), nullif(trim(recent.first_name || ' ' || recent.last_name), ''), 'Unknown Student'),
        'vendorName', coalesce(recent.vendor_name, recent.vendor_display_name, 'Unknown Vendor'),
        'amount', recent.final_amount,
        'createdAt', recent.created_at,
        'status', recent.status
      ) order by recent.created_at desc)
      from (
        select t.id, t.final_amount, t.created_at, t.status, t.vendor_name, t.payload,
               v.name as vendor_display_name, s.profile, s.first_name, s.last_name
        from public.realx_transactions t
        left join public.realx_students s on s.id = t.student_id
        left join public.realx_vendors v on v.id = t.vendor_id
        order by t.created_at desc limit 15
      ) recent
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.couponly_vendor_dashboard_stats(text) from public, anon;
revoke all on function public.couponly_vendor_dashboard_chart(text, integer) from public, anon;
revoke all on function public.couponly_admin_dashboard() from public, anon;
grant execute on function public.couponly_vendor_dashboard_stats(text) to authenticated;
grant execute on function public.couponly_vendor_dashboard_chart(text, integer) to authenticated;
grant execute on function public.couponly_admin_dashboard() to authenticated;

notify pgrst, 'reload schema';

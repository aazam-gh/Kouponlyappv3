create or replace function public.couponly_vendor_dashboard_stats(p_vendor_id text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  if not (public.kouponly_is_benefits_admin() or public.couponly_is_vendor_member(p_vendor_id)) then raise exception 'Not authorized to view this vendor dashboard' using errcode = '42501'; end if;
  select jsonb_build_object(
    'totalRedemptions', count(t.id) filter (where t.status = 'completed'),
    'thisMonthRedemptions', count(t.id) filter (where t.status = 'completed' and t.created_at >= month_start),
    'totalRevenue', coalesce(sum(t.final_amount) filter (where t.status = 'completed'), 0),
    'totalDiscount', coalesce(sum(t.discount_amount) filter (where t.status = 'completed'), 0),
    'uniqueCustomers', count(distinct t.student_id) filter (where t.status = 'completed'),
    'activeOffers', coalesce((select jsonb_array_length(case when jsonb_typeof(v.payload->'offers') = 'array' then v.payload->'offers' else '[]'::jsonb end) from public.kouponly_vendors v where v.id = p_vendor_id), 0),
    'pendingTransactions', count(t.id) filter (where t.status = 'pending')
  ) into result from public.kouponly_transactions t where t.vendor_id = p_vendor_id;
  return result;
end $$;
revoke all on function public.couponly_vendor_dashboard_stats(text) from public, anon;
grant execute on function public.couponly_vendor_dashboard_stats(text) to authenticated;
notify pgrst, 'reload schema';

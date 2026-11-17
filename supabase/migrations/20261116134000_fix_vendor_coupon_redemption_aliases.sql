create or replace function public.kouponly_vendor_transactions(p_vendor_id text, p_from date default null, p_to date default null, p_offset integer default 0, p_limit integer default 50)
returns table(transaction_id text, created_at timestamptz, transaction_type text, total_amount numeric, discount_amount numeric, final_amount numeric, status text, offer_title text, student_name text, student_phone text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.couponly_is_vendor_member(p_vendor_id) then raise exception 'Not authorized to view this vendor’s transactions' using errcode = '42501'; end if;
  if p_offset < 0 or p_limit not between 1 and 100 or (p_from is not null and p_to is not null and p_from > p_to) then raise exception 'Invalid date range or pagination' using errcode = '22023'; end if;
  return query
  select * from (
  select t.id::text as transaction_id, t.created_at, t.transaction_type, t.total_amount, t.discount_amount, t.final_amount, t.status,
    coalesce(o.title, t.payload->>'offerTitle', t.type, '—') as offer_title,
    coalesce(nullif(p.full_name,''), nullif(trim(s.first_name || ' ' || s.last_name), ''), 'Student') as student_name,
    coalesce(p.mobile, s.phone) as student_phone
  from public.couponly_transactions t
  left join public.couponly_offers o on o.id = t.offer_id
  left join public.couponly_students s on s.id = t.student_id
  left join public.profiles p on p.user_id = t.student_id
  where t.vendor_id = p_vendor_id and (p_from is null or t.created_at >= p_from::timestamptz)
    and (p_to is null or t.created_at < (p_to + 1)::timestamptz)

  union all

  select r.redemption_id, r.consumed_at, 'coupon_redemption', r.bill_amount,
    coalesce(nullif(r.offer_snapshot->>'estimatedSavings','')::numeric,
      r.bill_amount - nullif(r.offer_snapshot->>'payableAmount','')::numeric, 0),
    coalesce(nullif(r.offer_snapshot->>'payableAmount','')::numeric,
      r.bill_amount - nullif(r.offer_snapshot->>'estimatedSavings','')::numeric, r.bill_amount),
    'completed', coalesce(r.offer_snapshot->>'title', r.offer_id),
    coalesce(nullif(p.full_name,''), nullif(trim(s.first_name || ' ' || s.last_name), ''), 'Student'),
    coalesce(p.mobile, s.phone)
  from public.redemptions r
  left join public.kouponly_students s on s.id = r.user_id
  left join public.profiles p on p.user_id = r.user_id
  where r.vendor_id = p_vendor_id and r.mode = 'inStore' and r.status = 'success' and r.consumed_at is not null
    and r.round_id is not null
    and (p_from is null or r.consumed_at >= p_from::timestamptz)
    and (p_to is null or r.consumed_at < (p_to + 1)::timestamptz)
  ) records
  order by records.created_at desc, records.transaction_id desc offset p_offset limit p_limit;
end $$;

revoke all on function public.kouponly_vendor_transactions(text, date, date, integer, integer) from public, anon;
grant execute on function public.kouponly_vendor_transactions(text, date, date, integer, integer) to authenticated;
notify pgrst, 'reload schema';

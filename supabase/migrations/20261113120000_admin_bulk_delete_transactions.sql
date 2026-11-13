create function public.kouponly_admin_delete_transactions(p_transaction_ids uuid[] default '{}', p_redemptions jsonb default '[]')
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer; redemption_count integer;
begin
  if not public.kouponly_is_benefits_admin() then raise exception 'Administrator required' using errcode = '42501'; end if;
  if jsonb_typeof(coalesce(p_redemptions, '[]'::jsonb)) <> 'array' then
    raise exception 'Redemptions must be an array' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_transaction_ids, '{}'::uuid[])) + jsonb_array_length(coalesce(p_redemptions, '[]'::jsonb)) > 500 then
    raise exception 'Select no more than 500 records' using errcode = '22023';
  end if;

  delete from public.couponly_transactions where id = any(coalesce(p_transaction_ids, '{}'::uuid[])) and status = 'completed';
  get diagnostics deleted_count = row_count;
  delete from public.redemptions r using jsonb_to_recordset(coalesce(p_redemptions, '[]'::jsonb)) as x(user_id uuid, redemption_id text)
    where r.user_id = x.user_id and r.redemption_id = x.redemption_id and r.round_id is not null and r.consumed_at is not null;
  get diagnostics redemption_count = row_count;
  deleted_count := deleted_count + redemption_count;
  return deleted_count;
end $$;
revoke all on function public.kouponly_admin_delete_transactions(uuid[], jsonb) from public, anon;
grant execute on function public.kouponly_admin_delete_transactions(uuid[], jsonb) to authenticated;
notify pgrst, 'reload schema';

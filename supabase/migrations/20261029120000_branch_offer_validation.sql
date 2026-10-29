begin;

-- Branch assignments travel with the existing embedded offer payload and stable offer IDs.
create function public.kouponly_validate_vendor_branches()
returns trigger language plpgsql set search_path = '' as $$
declare branch jsonb; offer jsonb; branch_ids text[] := '{}';
begin
  for branch in select value from jsonb_array_elements(coalesce(new.locations, '[]'::jsonb)) loop
    if coalesce(branch->>'id', '') = '' or branch->>'id' = any(branch_ids) then
      raise exception 'Each branch must have a unique, nonempty ID' using errcode = '23514';
    end if;
    branch_ids := array_append(branch_ids, branch->>'id');
    if (nullif(branch->>'latitude', '') is null) <> (nullif(branch->>'longitude', '') is null)
      or not coalesce((branch->>'latitude')::double precision between -90 and 90, true)
      or not coalesce((branch->>'longitude')::double precision between -180 and 180, true) then
      raise exception 'Enter a valid latitude and longitude together for each branch' using errcode = '23514';
    end if;
  end loop;
  for offer in select value from jsonb_array_elements(coalesce(new.payload->'offers', '[]'::jsonb)) loop
    if offer ? 'branchIds' then
      if jsonb_typeof(offer->'branchIds') <> 'array' then
        raise exception 'Offer branches must be a list' using errcode = '23514';
      end if;
      if exists (select 1 from jsonb_array_elements(offer->'branchIds') id
        where jsonb_typeof(id) <> 'string' or not (id #>> '{}') = any(branch_ids)) then
        raise exception 'Offer branches must belong to this vendor. Reassign coupons before deleting a branch.' using errcode = '23514';
      end if;
    end if;
  end loop;
  return new;
end $$;
create trigger kouponly_validate_vendor_branches before insert or update of locations, payload
on public.couponly_vendors for each row execute function public.kouponly_validate_vendor_branches();
revoke all on function public.kouponly_validate_vendor_branches() from public, anon, authenticated;
commit;

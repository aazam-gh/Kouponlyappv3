create or replace function public.couponly_vendor_set_offer_badge_label(p_offer_id text, p_badge_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_vendor_id text;
  normalized_label text := nullif(btrim(coalesce(p_badge_label, '')), '');
  updated_rows integer;
begin
  if normalized_label is not null and char_length(normalized_label) > 60 then
    raise exception 'Badge label must be 60 characters or fewer' using errcode = '22023';
  end if;

  select vendor_id into target_vendor_id
  from public.realx_offers
  where id = p_offer_id;

  if target_vendor_id is null then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if not (public.couponly_is_benefits_admin() or public.couponly_is_vendor_member(target_vendor_id)) then
    raise exception 'Not authorized to update this offer badge' using errcode = '42501';
  end if;

  update public.realx_vendors as vendor
  set payload = jsonb_set(vendor.payload, '{offers}', (
    select jsonb_agg(
      case when coalesce(nullif(item.value->>'id', ''), target_vendor_id || ':embedded:' || item.ordinal::text) = p_offer_id then
        case when normalized_label is null then item.value - 'badgeLabel'
          else jsonb_set(item.value, '{badgeLabel}', to_jsonb(normalized_label), true)
        end
      else item.value end
      order by item.ordinal
    )
    from jsonb_array_elements(
      case when jsonb_typeof(vendor.payload->'offers') = 'array' then vendor.payload->'offers' else '[]'::jsonb end
    ) with ordinality as item(value, ordinal)
  ), true)
  where vendor.id = target_vendor_id
    and jsonb_typeof(vendor.payload->'offers') = 'array'
    and exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(vendor.payload->'offers') = 'array' then vendor.payload->'offers' else '[]'::jsonb end
      ) with ordinality as item(value, ordinal)
      where coalesce(nullif(item.value->>'id', ''), target_vendor_id || ':embedded:' || item.ordinal::text) = p_offer_id
    );

  get diagnostics updated_rows = row_count;
  if updated_rows = 0 then
    raise exception 'Offer is not available in the vendor catalogue' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.couponly_vendor_set_offer_badge_label(text, text) from public, anon, authenticated;
grant execute on function public.couponly_vendor_set_offer_badge_label(text, text) to authenticated;

notify pgrst, 'reload schema';

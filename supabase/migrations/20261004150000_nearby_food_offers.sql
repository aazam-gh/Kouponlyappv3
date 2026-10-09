-- The location table is the canonical source for branch coordinates. Keep
-- vendor branch lookups and active offer selection index-backed.
create index if not exists realx_vendor_locations_vendor_nearby_idx
  on public.realx_vendor_locations(vendor_id, is_primary desc, sort_order)
  where latitude is not null and longitude is not null;

create index if not exists realx_offers_nearby_vendor_sort_idx
  on public.realx_offers(vendor_id, sort_order, created_at, id)
  where active = true;

create or replace function public.get_nearby_food_offers(
  p_latitude double precision,
  p_longitude double precision
)
returns table (
  vendor_id text,
  deal_id integer,
  vendor_name text,
  offer_id text,
  offer_title text,
  category text,
  place text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  rating numeric,
  saving_label text,
  offer_value numeric,
  image_url text,
  description text,
  redemption_mode text,
  website text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with user_point as (
    select p_latitude as latitude, p_longitude as longitude
    where p_latitude between -90 and 90 and p_longitude between -180 and 180
  ), eligible_vendors as (
    select v.id, v.catalogue_deal_id, v.name, v.rating, v.saving_label,
           v.offer_value, v.image_url, v.logo_path, v.description, v.website,
           v.payload, coalesce(nullif(c.name, ''), nullif(v.payload->>'mainCategory', ''), v.payload->>'category') as category_name
    from public.realx_vendors v
    left join public.realx_categories c on c.id = v.category_id
    where v.status = 'Active'
      and v.vendor_type = 'in_store'
      and lower(btrim(coalesce(nullif(c.name, ''), nullif(v.payload->>'mainCategory', ''), v.payload->>'category'))) = 'food'
      and v.catalogue_deal_id is not null
  ), nearest_food_offers as (
    select v.id as vendor_id, v.catalogue_deal_id as deal_id, v.name as vendor_name,
           o.id as offer_id, o.title as offer_title, v.category_name as category_name,
           coalesce(nullif(branch.address, ''), nullif(v.payload->>'place', ''), 'Nearby') as place,
           branch.latitude, branch.longitude, branch.distance_km, v.rating,
           coalesce(o.saving_label, v.saving_label) as saving_label,
           coalesce(o.offer_value, o.discount_value, v.offer_value) as offer_value,
           coalesce(nullif(o.image_url, ''), nullif(v.image_url, ''), nullif(v.logo_path, ''),
                    nullif(v.payload->>'profilePicture', ''), nullif(v.payload->>'logo', '')) as image_url,
           coalesce(nullif(o.description, ''), nullif(v.description, ''), o.title) as description,
           coalesce(o.redemption_mode, 'inStore') as redemption_mode, v.website
    from user_point point
    join eligible_vendors v on true
    join lateral (
      select offer.id, offer.title, offer.saving_label, offer.offer_value, offer.discount_value,
             offer.description, offer.image_url, offer.redemption_mode
      from public.realx_offers offer
      where offer.vendor_id = v.id
        and offer.active
        and (offer.starts_at is null or offer.starts_at <= now())
        and (offer.ends_at is null or offer.ends_at > now())
      order by offer.sort_order, offer.created_at, offer.id
      limit 1
    ) o on true
    join lateral (
      select location.latitude, location.longitude, location.address,
             2 * 6371.0088 * asin(sqrt(least(1::double precision, greatest(0::double precision,
               power(sin(radians((location.latitude - point.latitude) / 2)), 2) +
               cos(radians(point.latitude)) * cos(radians(location.latitude)) *
               power(sin(radians((location.longitude - point.longitude) / 2)), 2)
             )))) as distance_km
      from public.realx_vendor_locations location
      where location.vendor_id = v.id
        and location.latitude between -90 and 90
        and location.longitude between -180 and 180
      order by distance_km, location.is_primary desc, location.sort_order, location.id
      limit 1
    ) branch on true
  )
  select nearby.vendor_id, nearby.deal_id, nearby.vendor_name, nearby.offer_id,
         nearby.offer_title, 'Food'::text, nearby.place, nearby.latitude, nearby.longitude,
         nearby.distance_km, nearby.rating, nearby.saving_label, nearby.offer_value,
         nearby.image_url, nearby.description, nearby.redemption_mode, nearby.website
  from nearest_food_offers nearby
  order by nearby.distance_km, nearby.vendor_name, nearby.vendor_id
  limit 10;
$$;

revoke all on function public.get_nearby_food_offers(double precision, double precision) from public;
grant execute on function public.get_nearby_food_offers(double precision, double precision) to anon, authenticated;

notify pgrst, 'reload schema';

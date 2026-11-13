create or replace function public.kouponly_home_preview_cards()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with brand_doc as (
    select payload->'brands' as items from public.kouponly_cms_documents where id = 'brand'
  ), eligible as (
    select v.id, v.name, v.new_deals_priority, v.trending_priority,
      coalesce(nullif(v.logo_path, ''), nullif(v.payload->>'profilePicture', ''), nullif(v.payload->>'logo', '')) as logo,
      coalesce(nullif(v.cover_image_url, ''), nullif(v.image_url, ''), nullif(v.logo_path, ''), nullif(v.payload->>'profilePicture', '')) as image,
      v.card_label, v.payload->'xcard' = 'true'::jsonb as xcard
    from public.kouponly_vendors v
    join public.kouponly_categories c on c.id = v.category_id and c.active
    where v.status = 'Active'
      and coalesce(v.catalogue_deal_id::text, v.payload->>'id') ~ '^[1-9][0-9]*$'
      and exists (
        select 1 from public.kouponly_offers o
        where o.vendor_id = v.id and o.active
          and (o.starts_at is null or o.starts_at <= now())
          and (o.ends_at is null or o.ends_at > now())
      )
  ), ranked as (
    select e.*, jsonb_build_object('id', e.id, 'vendorId', e.id, 'name', e.name,
      'image', e.image, 'logo', e.logo, 'xcard', coalesce(e.xcard, false), 'cardLabel', e.card_label) as card
    from eligible e
  )
  select jsonb_build_object(
    'newDeals', coalesce((select jsonb_agg(card order by new_deals_priority, name, id)
      from (select * from ranked where new_deals_priority > 0 order by new_deals_priority, name, id limit 12) n), '[]'::jsonb),
    'trending', coalesce((select jsonb_agg(card order by trending_priority, name, id)
      from (select * from ranked where trending_priority > 0 order by trending_priority, name, id limit 12) t), '[]'::jsonb),
    'brands', coalesce((select jsonb_agg(card order by position) from (
      select jsonb_build_object('id', coalesce(b.item->>'id', e.id::text), 'vendorId', e.id,
        'name', e.name, 'logoUrl', coalesce(nullif(b.item->>'logoUrl', ''), e.logo, ''), 'isActive', true) as card, b.position
      from brand_doc d
      cross join lateral jsonb_array_elements(case when jsonb_typeof(d.items) = 'array' then d.items else '[]'::jsonb end)
        with ordinality as b(item, position)
      join eligible e on e.id::text = b.item->>'vendorId'
      where b.item->'isActive' = 'true'::jsonb
    ) b), '[]'::jsonb)
  );
$$;


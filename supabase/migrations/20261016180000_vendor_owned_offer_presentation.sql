begin;

alter table public.couponly_vendors add column card_label text
  check (card_label is null or (card_label = btrim(card_label) and length(card_label) between 1 and 32));

-- Preserve the label currently shown for each vendor; leave legacy offer settings stored.
update public.couponly_vendors v set card_label = (
  select left(coalesce(nullif(btrim(o.payload->'cardLabels'->>0), ''), nullif(btrim(o.payload->>'cardLabel'), '')), 32)
  from public.couponly_offers o
  where o.vendor_id = v.id and o.active
    and (o.starts_at is null or o.starts_at <= now()) and (o.ends_at is null or o.ends_at > now())
  order by o.sort_order, o.id limit 1
);

create or replace function public.kouponly_offer_vendor_presentation()
returns trigger language plpgsql set search_path = '' as $$
declare vendor_logo text; vendor_label text;
begin
  select logo_path, card_label into vendor_logo, vendor_label
  from public.couponly_vendors where id = new.vendor_id;
  new.image_url := vendor_logo;
  -- Existing installed apps still read presentation from offer rows.
  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'imageUrl', vendor_logo, 'cardLabel', vendor_label,
    'cardLabels', case when vendor_label is null then '[]'::jsonb else jsonb_build_array(vendor_label) end
  );
  return new;
end $$;

create trigger kouponly_offer_vendor_presentation
before insert or update on public.couponly_offers
for each row execute function public.kouponly_offer_vendor_presentation();

update public.couponly_offers set image_url = image_url;

create or replace view public.kouponly_vendors with (security_invoker = true) as
select * from public.couponly_vendors;

commit;

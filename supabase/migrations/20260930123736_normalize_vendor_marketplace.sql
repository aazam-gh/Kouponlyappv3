-- Canonical marketplace model for Kouponly vendors and offers.
-- The catalogue_* tables remain available to older mobile app versions.

create sequence if not exists public.realx_vendor_catalogue_deal_id_seq;
select setval(
  'public.realx_vendor_catalogue_deal_id_seq',
  greatest(coalesce((select max((payload->>'id')::integer) from public.catalogue_deals where payload->>'id' ~ '^[0-9]+$'), 0), 16) + 1,
  false
);

alter table public.realx_vendors
  add column if not exists catalogue_deal_id integer default nextval('public.realx_vendor_catalogue_deal_id_seq'),
  add column if not exists place_label text,
  add column if not exists image_url text,
  add column if not exists cover_image_url text,
  add column if not exists color text,
  add column if not exists rating numeric(2,1),
  add column if not exists distance_km numeric(8,2),
  add column if not exists saving_label text,
  add column if not exists offer_value numeric(12,2),
  add column if not exists trend integer not null default 0,
  add column if not exists newest integer not null default 0,
  add column if not exists sort_order integer not null default 0,
  add column if not exists featured boolean not null default false,
  add column if not exists phone text,
  add column if not exists gallery_images jsonb not null default '[]'::jsonb,
  add column if not exists tags text[] not null default '{}',
  add column if not exists business_hours jsonb not null default '{}'::jsonb;

alter table public.realx_offers
  add column if not exists title_ar text,
  add column if not exists description_ar text,
  add column if not exists discount_type text,
  add column if not exists discount_value numeric(12,2),
  add column if not exists currency text not null default 'INR',
  add column if not exists saving_label text,
  add column if not exists offer_value numeric(12,2),
  add column if not exists terms text,
  add column if not exists redemption_instructions text,
  add column if not exists image_url text,
  add column if not exists redemption_mode text not null default 'inStore',
  add column if not exists sort_order integer not null default 0;

create unique index if not exists realx_vendors_catalogue_deal_id_key
  on public.realx_vendors(catalogue_deal_id) where catalogue_deal_id is not null;
create unique index if not exists realx_categories_slug_key
  on public.realx_categories(slug) where slug is not null;

create table if not exists public.realx_vendor_locations (
  id text primary key,
  vendor_id text not null references public.realx_vendors(id) on delete cascade,
  name text,
  name_ar text,
  phone text,
  address text,
  address_ar text,
  latitude double precision,
  longitude double precision,
  geohash text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);
create index if not exists realx_vendor_locations_vendor_idx
  on public.realx_vendor_locations(vendor_id, sort_order);

-- Seed the vendor category picker from the business categories already used by
-- the live mobile deal cards. Arabic labels are left empty until supplied.
insert into public.realx_categories(id,name,slug,image_path,active,sort_order,payload)
select 'market-'||lower(regexp_replace(trim(payload->>'category'),'[^a-zA-Z0-9]+','-','g')),
       trim(payload->>'category'),
       lower(regexp_replace(trim(payload->>'category'),'[^a-zA-Z0-9]+','-','g')),
       null, true,
       row_number() over (order by min(sort_order))::integer,
       jsonb_build_object(
         'nameEnglish',trim(payload->>'category'),'nameArabic','',
         'imageUrl','','subcategories','[]'::jsonb,
         'order',row_number() over (order by min(sort_order))::integer
       )
from public.catalogue_deals
where published and nullif(trim(payload->>'category'),'') is not null
group by trim(payload->>'category')
on conflict(id) do update set name=excluded.name,slug=excluded.slug,active=true,
  sort_order=excluded.sort_order,payload=public.realx_categories.payload || excluded.payload,updated_at=now();

-- The map sync trigger has legacy variable/column name collisions. Prefer its
-- PL/pgSQL vendor_id variable and stop it deleting normalized offer rows.
do $$
declare source text;
begin
  source:=pg_get_functiondef('public.realx_sync_vendor_map()'::regprocedure);
  if position('delete from public.realx_offers where realx_offers.vendor_id=vendor_id;' in source)=0 then
    raise exception 'Expected offer cleanup statement not found in realx_sync_vendor_map';
  end if;
  source:=replace(source,'delete from public.realx_offers where realx_offers.vendor_id=vendor_id;','-- reconciled by realx_sync_vendor_catalogue');
  source:=replace(source,'AS $function$','AS $function$'||chr(10)||'#variable_conflict use_variable');
  execute source;
end $$;

-- Import only the 16 published marketplace deals, not the directory's demo rows.
insert into public.realx_vendors(
  id,name,status,vendor_type,category_id,catalogue_deal_id,place_label,image_url,color,rating,
  distance_km,saving_label,offer_value,trend,newest,sort_order,description,locations,payload
)
select 'catalogue-vendor-'||d.id,
       coalesce(d.payload->>'name',d.id),'Active','in_store',c.id,
       coalesce(nullif(d.payload->>'id','')::integer,nullif(d.id,'')::integer),
       d.payload->>'place',d.payload->>'image',d.payload->>'color',nullif(d.payload->>'rating','')::numeric,
       nullif(d.payload->>'distanceKm','')::numeric,d.payload->>'saving',nullif(d.payload->>'offerValue','')::numeric,
       coalesce(nullif(d.payload->>'trend','')::integer,0),coalesce(nullif(d.payload->>'newest','')::integer,0),d.sort_order,
       d.payload->>'description',jsonb_build_array(jsonb_build_object('id','primary','address',d.payload->>'place','isPrimary',true)),
       d.payload || jsonb_build_object('vendorType','in_store','mainCategory',d.payload->>'category',
         'profilePicture',d.payload->>'image','searchTokens',jsonb_build_array(lower(d.payload->>'name'),lower(d.payload->>'category'),lower(d.payload->>'place')),
         'locations',jsonb_build_array(jsonb_build_object('id','primary','address',d.payload->>'place','isPrimary',true)),
         'offers',jsonb_build_array(jsonb_build_object('id','catalogue-'||d.id,'titleEn',d.payload->>'offer',
           'descriptionEn',d.payload->>'description','discountType',case when lower(d.payload->>'offer') like '%buy one%' or lower(d.payload->>'offer') like '%get one free%' then 'buy1get1' else 'amount' end,
           'discountValue',nullif(d.payload->>'offerValue','')::numeric,'savingLabel',d.payload->>'saving',
           'offerValue',nullif(d.payload->>'offerValue','')::numeric,'active',true,'currency','INR')))
from public.catalogue_deals d
left join public.realx_categories c on c.slug=lower(regexp_replace(trim(d.payload->>'category'),'[^a-zA-Z0-9]+','-','g'))
where d.published and nullif(trim(d.payload->>'name'),'') is not null
on conflict(id) do update set
  name=excluded.name,status='Active',category_id=excluded.category_id,catalogue_deal_id=excluded.catalogue_deal_id,
  place_label=excluded.place_label,image_url=excluded.image_url,color=excluded.color,rating=excluded.rating,
  distance_km=excluded.distance_km,saving_label=excluded.saving_label,offer_value=excluded.offer_value,
  trend=excluded.trend,newest=excluded.newest,sort_order=excluded.sort_order,description=excluded.description,
  payload=public.realx_vendors.payload || excluded.payload,updated_at=now();

insert into public.realx_offers(
  id,vendor_id,category_id,title,description,offer_type,discount,discount_type,discount_value,
  currency,saving_label,offer_value,active,redemption_mode,sort_order,payload
)
select 'catalogue-'||d.id,v.id,v.category_id,d.payload->>'offer',d.payload->>'description',
       case when lower(d.payload->>'offer') like '%buy one%' or lower(d.payload->>'offer') like '%get one free%' then 'buy1get1' else 'discount' end,
       nullif(d.payload->>'offerValue','')::numeric,
       case when lower(d.payload->>'offer') like '%buy one%' or lower(d.payload->>'offer') like '%get one free%' then 'buy1get1' else 'amount' end,
       nullif(d.payload->>'offerValue','')::numeric,'INR',d.payload->>'saving',nullif(d.payload->>'offerValue','')::numeric,
       true,'inStore',0,jsonb_build_object('id','catalogue-'||d.id,'titleEn',d.payload->>'offer',
         'descriptionEn',d.payload->>'description','discountType',case when lower(d.payload->>'offer') like '%buy one%' or lower(d.payload->>'offer') like '%get one free%' then 'buy1get1' else 'amount' end,
         'discountValue',nullif(d.payload->>'offerValue','')::numeric,'savingLabel',d.payload->>'saving',
         'offerValue',nullif(d.payload->>'offerValue','')::numeric,'currency','INR','active',true)
from public.catalogue_deals d join public.realx_vendors v on v.id='catalogue-vendor-'||d.id
where d.published
on conflict(id) do update set vendor_id=excluded.vendor_id,category_id=excluded.category_id,title=excluded.title,
  description=excluded.description,offer_type=excluded.offer_type,discount=excluded.discount,
  discount_type=excluded.discount_type,discount_value=excluded.discount_value,currency=excluded.currency,
  saving_label=excluded.saving_label,offer_value=excluded.offer_value,active=true,
  redemption_mode=excluded.redemption_mode,payload=excluded.payload,updated_at=now();

-- The pre-existing map trigger used ordinal IDs and ignored IDs in payload.
-- Leave the canonical imported offer only for these migrated rows.
delete from public.realx_offers
where vendor_id like 'catalogue-vendor-%' and id like '%:embedded:%';

create or replace function public.realx_apply_vendor_catalogue_fields()
returns trigger language plpgsql set search_path='' as $$
declare category text;
begin
  category:=coalesce(new.payload->>'mainCategory',new.payload->>'category');
  if new.category_id is null and category is not null then
    select id into new.category_id from public.realx_categories where lower(name)=lower(category) limit 1;
  end if;
  if new.catalogue_deal_id is null then new.catalogue_deal_id:=nextval('public.realx_vendor_catalogue_deal_id_seq'); end if;
  new.phone:=coalesce(nullif(new.payload->>'phoneNumber',''),nullif(new.payload->>'phone',''),new.phone);
  new.image_url:=coalesce(nullif(new.payload->>'profilePicture',''),nullif(new.payload->>'logo',''),nullif(new.payload->>'logoUrl',''),new.image_url);
  new.cover_image_url:=coalesce(nullif(new.payload->>'coverImage',''),new.cover_image_url);
  new.place_label:=coalesce(nullif(new.payload->>'address',''),nullif(new.payload->>'place',''),new.place_label);
  if new.gallery_images='[]'::jsonb and jsonb_typeof(new.payload->'galleryImages')='array' then new.gallery_images:=new.payload->'galleryImages'; end if;
  if cardinality(new.tags)=0 and jsonb_typeof(new.payload->'tagsEn')='array' then
    select coalesce(array_agg(value), '{}') into new.tags from jsonb_array_elements_text(new.payload->'tagsEn');
  end if;
  return new;
end $$;

drop trigger if exists realx_vendor_catalogue_fields on public.realx_vendors;
create trigger realx_vendor_catalogue_fields
before insert or update on public.realx_vendors
for each row execute function public.realx_apply_vendor_catalogue_fields();

create or replace function public.realx_sync_vendor_catalogue()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  item jsonb;
  loc jsonb;
  primary_offer public.realx_offers%rowtype;
  offer_id text;
  location_id text;
  primary_place text;
  deal_payload jsonb;
  ordinal integer;
  loc_ordinal integer;
begin
  if tg_op='DELETE' then
    delete from public.realx_vendor_locations where vendor_id=old.id;
    if old.catalogue_deal_id is not null then
      update public.catalogue_deals set published=false,updated_at=now() where id=old.catalogue_deal_id::text;
    end if;
    return old;
  end if;
  -- Stable offer IDs keep references intact across edits and make retries idempotent.
  ordinal:=0;
  for item in select value from jsonb_array_elements(coalesce(new.payload->'offers','[]'::jsonb)) loop
    ordinal:=ordinal+1;
    offer_id:=coalesce(nullif(item->>'id',''),new.id||':embedded:'||ordinal::text);
    insert into public.realx_offers(
      id,vendor_id,category_id,title,title_ar,description,description_ar,offer_type,discount,
      discount_type,discount_value,starts_at,ends_at,active,currency,saving_label,offer_value,
      terms,redemption_instructions,image_url,redemption_mode,sort_order,payload
    ) values (
      offer_id,new.id,new.category_id,coalesce(item->>'titleEn',item->>'title',new.name),item->>'titleAr',
      coalesce(item->>'descriptionEn',item->>'description'),item->>'descriptionAr',
      coalesce(item->>'discountType','discount'),nullif(coalesce(item->>'discountValue',item->>'offerValue'),'')::numeric,
      coalesce(item->>'discountType','discount'),nullif(item->>'discountValue','')::numeric,
      nullif(item->>'startsAt','')::timestamptz,nullif(item->>'endsAt','')::timestamptz,
      coalesce((item->>'active')::boolean,(item->>'isActive')::boolean,true),coalesce(nullif(item->>'currency',''),'INR'),
      coalesce(item->>'savingLabel',item->>'saving'),nullif(item->>'offerValue','')::numeric,
      coalesce(item->>'termsEn',item->>'terms'),coalesce(item->>'redemptionInstructionsEn',item->>'redemptionInstructions'),
      item->>'imageUrl',coalesce(item->>'redemptionMode','inStore'),ordinal-1,item
    ) on conflict(id) do update set
      vendor_id=excluded.vendor_id,category_id=excluded.category_id,title=excluded.title,title_ar=excluded.title_ar,
      description=excluded.description,description_ar=excluded.description_ar,offer_type=excluded.offer_type,
      discount=excluded.discount,discount_type=excluded.discount_type,discount_value=excluded.discount_value,
      starts_at=excluded.starts_at,ends_at=excluded.ends_at,active=excluded.active,currency=excluded.currency,
      saving_label=excluded.saving_label,offer_value=excluded.offer_value,terms=excluded.terms,
      redemption_instructions=excluded.redemption_instructions,image_url=excluded.image_url,
      redemption_mode=excluded.redemption_mode,sort_order=excluded.sort_order,payload=excluded.payload,updated_at=now();
  end loop;
  delete from public.realx_offers where vendor_id=new.id
    and id not in (select coalesce(nullif(value->>'id',''),new.id||':embedded:'||ordinality::text)
                   from jsonb_array_elements(coalesce(new.payload->'offers','[]'::jsonb)) with ordinality);

  delete from public.realx_vendor_locations where vendor_id=new.id;
  loc_ordinal:=0;
  for loc in select value from jsonb_array_elements(coalesce(new.locations,'[]'::jsonb)) loop
    loc_ordinal:=loc_ordinal+1;
    location_id:=new.id||':'||coalesce(nullif(loc->>'id',''),'location:'||loc_ordinal::text);
    insert into public.realx_vendor_locations(id,vendor_id,name,name_ar,phone,address,address_ar,latitude,longitude,geohash,is_primary,sort_order,payload)
    values(location_id,new.id,loc->>'name',loc->>'nameAr',loc->>'phoneNumber',loc->>'address',loc->>'addressAr',
      nullif(coalesce(loc->>'latitude',loc->>'lat'),'')::double precision,
      nullif(coalesce(loc->>'longitude',loc->>'lng'),'')::double precision,loc->>'geohash',
      coalesce((loc->>'isPrimary')::boolean,loc_ordinal=1),loc_ordinal-1,loc)
    on conflict(id) do update set vendor_id=excluded.vendor_id,name=excluded.name,name_ar=excluded.name_ar,
      phone=excluded.phone,address=excluded.address,address_ar=excluded.address_ar,latitude=excluded.latitude,
      longitude=excluded.longitude,geohash=excluded.geohash,is_primary=excluded.is_primary,
      sort_order=excluded.sort_order,payload=excluded.payload,updated_at=now();
  end loop;

  select * into primary_offer from public.realx_offers
  where vendor_id=new.id and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())
  order by sort_order,created_at,id limit 1;
  if new.status='Active' and found and new.catalogue_deal_id is not null then
    select address into primary_place from public.realx_vendor_locations
      where vendor_id=new.id order by is_primary desc,sort_order limit 1;
    deal_payload:=jsonb_strip_nulls(jsonb_build_object(
      'id',new.catalogue_deal_id,'name',new.name,'category',coalesce(new.payload->>'mainCategory',new.payload->>'category'),
      'place',coalesce(new.place_label,primary_place),'distanceKm',new.distance_km,
      'distance',case when new.distance_km is null then null else new.distance_km::text||' km' end,
      'rating',new.rating::text,'offer',primary_offer.title,'saving',coalesce(primary_offer.saving_label,new.saving_label),
      'offerValue',coalesce(primary_offer.offer_value,primary_offer.discount_value,new.offer_value),
      'description',coalesce(primary_offer.description,new.description),'image',coalesce(new.image_url,new.logo_path),
      'logo',new.logo_path,'color',new.color,'trend',new.trend,'newest',new.newest,'redemption',primary_offer.redemption_mode,
      'externalUrl',case when primary_offer.redemption_mode='online' then new.website end
    ));
    insert into public.catalogue_deals(id,payload,sort_order,published)
      values(new.catalogue_deal_id::text,deal_payload,new.sort_order,true)
    on conflict(id) do update set payload=excluded.payload,sort_order=excluded.sort_order,published=true,updated_at=now();
  elsif new.catalogue_deal_id is not null then
    update public.catalogue_deals set published=false,updated_at=now() where id=new.catalogue_deal_id::text;
  end if;
  return new;
end $$;

drop trigger if exists zz_realx_vendor_catalogue_sync on public.realx_vendors;
create trigger zz_realx_vendor_catalogue_sync
after insert or update or delete on public.realx_vendors
for each row execute function public.realx_sync_vendor_catalogue();

insert into public.realx_vendor_locations(id,vendor_id,name,name_ar,phone,address,address_ar,latitude,longitude,geohash,is_primary,sort_order,payload)
select v.id||':'||coalesce(nullif(loc.value->>'id',''),'location:'||loc.ordinality::text),v.id,
  loc.value->>'name',loc.value->>'nameAr',loc.value->>'phoneNumber',loc.value->>'address',loc.value->>'addressAr',
  nullif(coalesce(loc.value->>'latitude',loc.value->>'lat'),'')::double precision,
  nullif(coalesce(loc.value->>'longitude',loc.value->>'lng'),'')::double precision,loc.value->>'geohash',
  coalesce((loc.value->>'isPrimary')::boolean,loc.ordinality=1),loc.ordinality-1,loc.value
from public.realx_vendors v cross join lateral jsonb_array_elements(v.locations) with ordinality loc(value,ordinality)
on conflict(id) do update set vendor_id=excluded.vendor_id,address=excluded.address,latitude=excluded.latitude,
  longitude=excluded.longitude,is_primary=excluded.is_primary,sort_order=excluded.sort_order,payload=excluded.payload,updated_at=now();

create or replace function public.validate_redemption_atomic(p_redemption_id text,p_mode text,p_pin text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=(select auth.uid());
  prior jsonb;
  response jsonb;
  generated_code text;
  expiration timestamptz;
  deal_key text;
  listing_key text;
  offer_key text;
  vendor_key text;
  pin_is_valid boolean:=false;
  used_count integer:=0;
begin
  if uid is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_mode not in ('online','inStore') then raise exception 'Invalid redemption mode' using errcode='22023'; end if;
  if p_redemption_id is null or length(p_redemption_id)>240 then raise exception 'Invalid redemption id' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':receipt:'||p_idempotency_key::text,0));
  select result into prior from public.mutation_receipts where user_id=uid and mutation_id=p_idempotency_key;
  if prior is not null then return prior; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text||':redemption:'||p_redemption_id,1));

  deal_key:=substring(p_redemption_id from '^deal-([0-9]+)');
  listing_key:=substring(p_redemption_id from '^listing-(.+)$');
  offer_key:=substring(p_redemption_id from '^deal-[0-9]+-([0-9]+)');
  if deal_key is not null then
    select id into vendor_key from public.realx_vendors
      where catalogue_deal_id=deal_key::integer and status='Active';
    if not exists(select 1 from public.catalogue_deals where id=deal_key and published)
      and (vendor_key is null or not exists(select 1 from public.realx_offers where vendor_id=vendor_key and active
        and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()))) then
      raise exception 'Offer is unavailable' using errcode='P0001';
    end if;
    select case when period_start<date_trunc('month',now())::date then 0 else use_count end into used_count
      from public.offer_usage where user_id=uid and offer_id=deal_key||'-'||coalesce(offer_key,'0');
    if coalesce(used_count,0)>=3 then raise exception 'Offer usage limit reached' using errcode='P0001'; end if;
  elsif listing_key is not null then
    if not exists(select 1 from public.catalogue_partners where id=listing_key and published) then
      raise exception 'Offer is unavailable' using errcode='P0001';
    end if;
  else raise exception 'Offer is unavailable' using errcode='P0001'; end if;

  if exists(select 1 from public.redemptions where user_id=uid and redemption_id=p_redemption_id and consumed_at is not null) then
    raise exception 'Redemption already completed' using errcode='P0001';
  end if;
  if p_mode='inStore' then
    if vendor_key is not null and exists(select 1 from public.realx_vendor_redemption_secrets where vendor_id=vendor_key) then
      select extensions.crypt(p_pin,pin_hash)=pin_hash into pin_is_valid
        from public.realx_vendor_redemption_secrets where vendor_id=vendor_key;
    else
      select exists(select 1 from public.partner_redemption_pins where enabled and pin_hash=extensions.crypt(p_pin,pin_hash)) into pin_is_valid;
    end if;
    if not coalesce(pin_is_valid,false) then raise exception 'Invalid partner PIN' using errcode='P0001'; end if;
  end if;
  if p_mode='online' then
    select code,expires_at into generated_code,expiration from public.redemptions
      where user_id=uid and redemption_id=p_redemption_id and status='code' and expires_at>now();
    if generated_code is null then
      generated_code:='KPN-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
      expiration:=now()+interval '10 minutes';
    end if;
  end if;
  insert into public.redemptions(user_id,redemption_id,mode,status,code,expires_at,completed_at,consumed_at)
  values(uid,p_redemption_id,p_mode,case when p_mode='online' then 'code' else 'success' end,generated_code,expiration,
    case when p_mode='inStore' then now() end,case when p_mode='inStore' then now() end)
  on conflict(user_id,redemption_id) do update set mode=excluded.mode,status=excluded.status,code=excluded.code,
    expires_at=excluded.expires_at,completed_at=excluded.completed_at,consumed_at=excluded.consumed_at,updated_at=now();
  if p_mode='inStore' then perform public.record_redemption_usage(uid,p_redemption_id); end if;
  response:=jsonb_build_object('code',generated_code,'expiresAt',case when expiration is null then null else extract(epoch from expiration)*1000 end,
    'status',case when p_mode='online' then 'code' else 'success' end);
  insert into public.mutation_receipts(user_id,mutation_id,operation,result) values(uid,p_idempotency_key,'validate-redemption',response);
  return response;
end $$;
revoke all on function public.validate_redemption_atomic(text,text,text,uuid) from public,anon;
grant execute on function public.validate_redemption_atomic(text,text,text,uuid) to authenticated;

grant usage,select on sequence public.realx_vendor_catalogue_deal_id_seq to authenticated,service_role;

alter table public.realx_vendor_locations enable row level security;
drop policy if exists realx_vendor_locations_read on public.realx_vendor_locations;
create policy realx_vendor_locations_read on public.realx_vendor_locations
  for select to anon,authenticated using (
    exists(select 1 from public.realx_vendors v where v.id=vendor_id and v.status='Active')
    or public.realx_is_admin() or public.realx_is_vendor_member(vendor_id)
  );
drop policy if exists realx_vendor_locations_admin_write on public.realx_vendor_locations;
create policy realx_vendor_locations_admin_write on public.realx_vendor_locations
  for all to authenticated using(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id))
  with check(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
grant select on public.realx_vendor_locations to anon,authenticated;
grant insert,update,delete on public.realx_vendor_locations to authenticated;
drop trigger if exists realx_vendor_locations_touch on public.realx_vendor_locations;
create trigger realx_vendor_locations_touch before update on public.realx_vendor_locations
for each row execute function public.realx_touch_updated_at();

do $$
declare target_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach target_table in array array['realx_vendors','realx_offers','realx_vendor_locations'] loop
      if not exists(select 1 from pg_publication_tables p where p.pubname='supabase_realtime' and p.schemaname='public' and p.tablename=target_table) then
        execute format('alter publication supabase_realtime add table public.%I',target_table);
      end if;
    end loop;
  end if;
end $$;

-- Keep category payloads compatible with the admin's Category shape and expose
-- normalized vendor/offer/location rows to the mobile client.
grant select on public.realx_categories,public.realx_vendors,public.realx_offers to anon,authenticated;

notify pgrst,'reload schema';

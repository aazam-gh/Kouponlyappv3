-- One required main category, many subcategories, existing offers and branches.
-- Keep the admin's embedded payload format as a write bridge for existing clients.
insert into public.realx_categories(id,name,slug,sort_order,payload)
values ('market-food','Food','food',0,'{"nameEnglish":"Food","subcategories":[]}');

update public.realx_categories set name='Stays',slug='stays',
  payload=payload||'{"nameEnglish":"Stays"}' where id='market-staycations';
update public.realx_vendors set category_id='market-food',
  payload=payload||'{"mainCategory":"Food"}' where category_id in ('market-dining','market-cafes');
update public.realx_vendors set payload=payload||'{"mainCategory":"Stays"}' where category_id='market-staycations';
update public.realx_vendors set category_id='market-entertainment',
  payload=payload||'{"mainCategory":"Entertainment"}' where category_id='market-activities';
update public.realx_categories set active=false where id in ('market-dining','market-cafes','market-activities');

alter table public.realx_vendors
  drop constraint realx_vendors_category_id_fkey,
  alter column category_id set not null,
  add constraint realx_vendors_category_id_fkey foreign key(category_id)
    references public.realx_categories(id) on delete restrict,
  add constraint realx_vendors_id_category_key unique(id,category_id);

create table public.realx_subcategories (
  id text primary key,
  category_id text not null references public.realx_categories(id) on delete cascade,
  name text not null check(btrim(name)<>''),
  name_ar text not null default '',
  slug text not null check(btrim(slug)<>''),
  image_path text,
  sort_order integer not null default 0,
  unique(category_id,slug),
  unique(id,category_id)
);
create table public.realx_vendor_subcategories (
  vendor_id text not null,
  subcategory_id text not null,
  category_id text not null,
  primary key(vendor_id,subcategory_id),
  foreign key(vendor_id,category_id) references public.realx_vendors(id,category_id)
    on delete cascade deferrable initially deferred,
  foreign key(subcategory_id,category_id) references public.realx_subcategories(id,category_id)
    on delete restrict
);
create index realx_vendor_subcategories_subcategory_idx
  on public.realx_vendor_subcategories(subcategory_id,category_id);
create index realx_vendor_subcategories_vendor_category_idx
  on public.realx_vendor_subcategories(vendor_id,category_id);

create function public.kouponly_sync_category_subcategories()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(coalesce(new.payload->'subcategories','[]'))<>'array' then
    raise exception 'Subcategories must be an array' using errcode='22023';
  end if;
  insert into public.realx_subcategories(id,category_id,name,name_ar,slug,image_path,sort_order)
  select new.id||':'||coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))),
    new.id,btrim(item->>'nameEnglish'),coalesce(item->>'nameArabic',''),
    coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))),
    nullif(item->>'imageUrl',''),ordinality-1
  from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) with ordinality as items(item,ordinality)
  on conflict(id) do update set name=excluded.name,name_ar=excluded.name_ar,
    image_path=excluded.image_path,sort_order=excluded.sort_order;
  -- Referenced subcategories cannot be silently removed from vendors.
  delete from public.realx_subcategories s where s.category_id=new.id and not exists(
    select 1 from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) item
    where s.slug=coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g')))
  );
  return new;
end $$;
create trigger kouponly_category_subcategories_sync
after insert or update of payload on public.realx_categories
for each row execute function public.kouponly_sync_category_subcategories();

-- Taxonomy labels are configuration, not example vendor/offer records.
update public.realx_categories c set payload=c.payload||jsonb_build_object('subcategories',(
  select jsonb_agg(jsonb_build_object('nameEnglish',label,'nameArabic','','imageUrl','') order by ordinal)
  from unnest(case c.id
    when 'market-food' then array['Rice','Biryani','Mains','Snacks','Drinks','Sweets','Dietary','Vegetarian','Vegan','Breakfast','Buffet','Cuisines','Cafes']
    when 'market-staycations' then array['Homestays','Hotels','Resorts','Staycations']
    when 'market-entertainment' then array['Cinema','Theme parks','Activities','Events']
    when 'market-beauty' then array['Salons','Spas','Cosmetics']
    when 'market-fitness' then array['Gyms','Sports','Wellness']
    when 'market-shopping' then array['Fashion','Electronics','Home']
    when 'market-travel' then array['Flights','Tours','Transport']
  end) with ordinality as labels(label,ordinal)
)) where c.active and coalesce(c.payload->'subcategories','[]')='[]'::jsonb;
-- Import any existing admin-defined subcategories as well.
update public.realx_categories set payload=payload where jsonb_array_length(coalesce(payload->'subcategories','[]'))>0;

create function public.kouponly_apply_vendor_taxonomy()
returns trigger language plpgsql set search_path='' as $$
declare category_name text; requested_name text;
begin
  requested_name:=coalesce(new.payload->>'mainCategory',new.payload->>'category');
  if new.category_id is null or (tg_op='UPDATE' and new.category_id is not distinct from old.category_id
    and requested_name is distinct from coalesce(old.payload->>'mainCategory',old.payload->>'category')) then
    select id into new.category_id from public.realx_categories
    where active and lower(name)=lower(requested_name);
  end if;
  select name into category_name from public.realx_categories where id=new.category_id and active;
  if category_name is null then
    raise exception 'Select one active main category' using errcode='22023';
  end if;
  if jsonb_typeof(coalesce(new.payload->'subcategory','[]'))<>'array' then
    raise exception 'Vendor subcategories must be an array' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements_text(coalesce(new.payload->'subcategory','[]')) label
    where not exists(select 1 from public.realx_subcategories s
      where s.category_id=new.category_id and s.name=label)) then
    raise exception 'Every subcategory must belong to the selected main category' using errcode='22023';
  end if;
  new.payload:=new.payload||jsonb_build_object('mainCategory',category_name);
  return new;
end $$;
create trigger zz_kouponly_vendor_taxonomy_fields before insert or update on public.realx_vendors
for each row execute function public.kouponly_apply_vendor_taxonomy();

create function public.kouponly_sync_vendor_subcategories()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.realx_vendor_subcategories where vendor_id=new.id;
  insert into public.realx_vendor_subcategories(vendor_id,subcategory_id,category_id)
  select distinct new.id,s.id,new.category_id from public.realx_subcategories s
  join jsonb_array_elements_text(coalesce(new.payload->'subcategory','[]')) label on label=s.name
  where s.category_id=new.category_id;
  return new;
end $$;
create trigger kouponly_vendor_subcategories_sync after insert or update of category_id,payload
on public.realx_vendors for each row execute function public.kouponly_sync_vendor_subcategories();
update public.realx_vendors set payload=payload;

alter table public.realx_subcategories enable row level security;
alter table public.realx_vendor_subcategories enable row level security;
create policy kouponly_subcategories_read on public.realx_subcategories for select to anon,authenticated
using(exists(select 1 from public.realx_categories c where c.id=category_id and c.active) or public.realx_is_admin());
create policy kouponly_subcategories_admin on public.realx_subcategories for all to authenticated
using(public.realx_is_admin()) with check(public.realx_is_admin());
create policy kouponly_vendor_subcategories_read on public.realx_vendor_subcategories for select to anon,authenticated
using(exists(select 1 from public.realx_vendors v where v.id=vendor_id and v.status='Active')
  or public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
grant select on public.realx_subcategories,public.realx_vendor_subcategories to anon,authenticated;
grant insert,update,delete on public.realx_subcategories to authenticated;
revoke all on function public.kouponly_sync_category_subcategories(),public.kouponly_apply_vendor_taxonomy(),
  public.kouponly_sync_vendor_subcategories() from public,anon,authenticated;

-- Stop publishing the old discovery/example directory; vendor rows are canonical.
update public.catalogue_partners set published=false where published;
update public.catalogue_offers set published=false where published;
update public.catalogue_categories set published=false where published;
update public.catalogue_hero_slides set published=false where published;
update public.catalogue_rewards set published=false where published;

-- Redemption must refer to a current normalized offer, including its real index.
do $$
declare source text; first_pos integer; last_pos integer;
begin
  source:=pg_get_functiondef('public.validate_redemption_atomic(text,text,uuid)'::regprocedure);
  first_pos:=strpos(source,'  if deal_key is not null then'||chr(10)||'    select id into vendor_key');
  last_pos:=strpos(source,'  elsif not exists(select 1 from public.catalogue_partners');
  if first_pos=0 or last_pos<=first_pos then raise exception 'Unexpected redemption function definition'; end if;
  source:=substring(source from 1 for first_pos-1)||$replacement$
  if deal_key is not null then
    select id into vendor_key from public.realx_vendors where catalogue_deal_id=deal_key::integer and status='Active';
    if vendor_key is null or not exists(
      select 1 from (
        select o.* from public.realx_offers o where o.vendor_id=vendor_key
        order by o.sort_order,o.id offset offer_key::integer limit 1
      ) selected_offer where selected_offer.active and selected_offer.redemption_mode=p_mode
        and (selected_offer.starts_at is null or selected_offer.starts_at<=now())
        and (selected_offer.ends_at is null or selected_offer.ends_at>now())
    ) then raise exception 'Offer is unavailable' using errcode='P0001'; end if;
$replacement$||substring(source from last_pos);
  execute source;
end $$;

do $$
declare target text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach target in array array['realx_categories','realx_subcategories','realx_vendor_subcategories'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
        and schemaname='public' and tablename=target) then
        execute format('alter publication supabase_realtime add table public.%I',target);
      end if;
    end loop;
  end if;
end $$;
notify pgrst,'reload schema';

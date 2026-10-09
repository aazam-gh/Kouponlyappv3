-- Renaming an assigned subcategory must preserve vendor links and admin labels.
create or replace function public.kouponly_sync_category_subcategories()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(coalesce(new.payload->'subcategories','[]'))<>'array' then
    raise exception 'Subcategories must be an array' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) item
    join public.realx_subcategories s on s.id=item->>'id' where s.category_id<>new.id) then
    raise exception 'Subcategory IDs must belong to this main category' using errcode='22023';
  end if;
  insert into public.realx_subcategories(id,category_id,name,name_ar,slug,image_path,sort_order)
  select coalesce(nullif(item->>'id',''),new.id||':'||coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g')))),
    new.id,btrim(item->>'nameEnglish'),coalesce(item->>'nameArabic',''),
    coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))),
    nullif(item->>'imageUrl',''),ordinality-1
  from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) with ordinality as items(item,ordinality)
  on conflict(id) do update set name=excluded.name,name_ar=excluded.name_ar,
    slug=excluded.slug,image_path=excluded.image_path,sort_order=excluded.sort_order
    where public.realx_subcategories.category_id=excluded.category_id;
  -- Referenced subcategories cannot be silently removed from vendors.
  delete from public.realx_subcategories s where s.category_id=new.id and not exists(
    select 1 from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) item
    where s.id=coalesce(nullif(item->>'id',''),new.id||':'||coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))))
  );
  return new;
end $$;
create function public.kouponly_refresh_subcategory_labels()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.realx_vendors v set payload=v.payload||jsonb_build_object('subcategory',(
    select jsonb_agg(s.name order by s.sort_order,s.id) from public.realx_vendor_subcategories link
    join public.realx_subcategories s on s.id=link.subcategory_id where link.vendor_id=v.id
  )) where exists(select 1 from public.realx_vendor_subcategories link where link.vendor_id=v.id and link.subcategory_id=new.id);
  return new;
end $$;
create trigger kouponly_subcategory_labels_sync after update of name on public.realx_subcategories
for each row when(old.name is distinct from new.name) execute function public.kouponly_refresh_subcategory_labels();
revoke all on function public.kouponly_refresh_subcategory_labels() from public,anon,authenticated;
notify pgrst,'reload schema';

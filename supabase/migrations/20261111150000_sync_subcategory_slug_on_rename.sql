create or replace function public.kouponly_sync_category_subcategories()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if jsonb_typeof(coalesce(new.payload->'subcategories','[]'))<>'array' then
    raise exception 'Subcategories must be an array' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) item
    join public.kouponly_subcategories s on s.id=item->>'id' where s.category_id<>new.id) then
    raise exception 'Subcategory IDs must belong to this main category' using errcode='22023';
  end if;
  insert into public.kouponly_subcategories(id,category_id,name,slug,image_path,sort_order)
  select coalesce(nullif(item->>'id',''),new.id||':'||coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g')))),
    new.id,btrim(item->>'nameEnglish'),
    coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))),
    nullif(item->>'imageUrl',''),ordinality-1
  from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) with ordinality as items(item,ordinality)
  on conflict(id) do update set name=excluded.name,
    slug=excluded.slug,image_path=excluded.image_path,sort_order=excluded.sort_order
    where public.kouponly_subcategories.category_id=excluded.category_id;
  update public.kouponly_vendors v set payload=v.payload||jsonb_build_object('subcategory',coalesce((
    select jsonb_agg(label order by ordinality)
    from jsonb_array_elements_text(coalesce(v.payload->'subcategory','[]')) with ordinality as labels(label,ordinality)
    where not exists(
      select 1 from public.kouponly_vendor_subcategories link
      join public.kouponly_subcategories s on s.id=link.subcategory_id
      where link.vendor_id=v.id and s.category_id=new.id and s.name=label
        and not exists(select 1 from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) item
          where s.id=coalesce(nullif(item->>'id',''),new.id||':'||coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))))
        )
    )
  ),'[]'::jsonb))
  where exists(
    select 1 from public.kouponly_vendor_subcategories link
    join public.kouponly_subcategories s on s.id=link.subcategory_id
    where link.vendor_id=v.id and s.category_id=new.id and not exists(
      select 1 from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) item
      where s.id=coalesce(nullif(item->>'id',''),new.id||':'||coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))))
    )
  );
  delete from public.kouponly_subcategories s where s.category_id=new.id and not exists(
    select 1 from jsonb_array_elements(coalesce(new.payload->'subcategories','[]')) item
    where s.id=coalesce(nullif(item->>'id',''),new.id||':'||coalesce(nullif(item->>'slug',''),lower(regexp_replace(btrim(item->>'nameEnglish'),'[^a-zA-Z0-9]+','-','g'))))
  );
  return new;
end $$;
revoke all on function public.kouponly_sync_category_subcategories() from public,anon,authenticated;

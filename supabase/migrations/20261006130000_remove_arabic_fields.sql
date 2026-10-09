create or replace function public.kouponly_remove_arabic_fields(value jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare
  result jsonb;
begin
  if jsonb_typeof(value)='object' then
    select coalesce(jsonb_object_agg(key,public.kouponly_remove_arabic_fields(item)), '{}'::jsonb)
      into result
      from jsonb_each(value) as fields(key,item)
      where key !~ '(?:_ar|Ar|Arabic)$';
    return result;
  elsif jsonb_typeof(value)='array' then
    select coalesce(jsonb_agg(public.kouponly_remove_arabic_fields(item)), '[]'::jsonb)
      into result from jsonb_array_elements(value) as items(item);
    return result;
  end if;
  return value;
end $$;

create or replace function public.kouponly_strip_arabic_json_fields()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  cleaned jsonb;
begin
  select coalesce(jsonb_object_agg(field.key,public.kouponly_remove_arabic_fields(field.value)), '{}'::jsonb)
    into cleaned
    from jsonb_each(to_jsonb(new)) as field(key,value)
    where exists (
      select 1 from pg_catalog.pg_attribute attribute
      where attribute.attrelid=tg_relid and attribute.attname=field.key
        and attribute.atttypid='jsonb'::regtype and attribute.attnum>0
        and not attribute.attisdropped and attribute.attgenerated=''
    );
  new:=jsonb_populate_record(new,cleaned);
  return new;
end $$;
revoke all on function public.kouponly_remove_arabic_fields(jsonb) from public,anon,authenticated;
revoke all on function public.kouponly_strip_arabic_json_fields() from public,anon,authenticated;

do $$
declare
  target record;
begin
  for target in
    select distinct c.oid::regclass as relation
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.oid
    where n.nspname='public' and c.relkind in ('r','p') and a.atttypid='jsonb'::regtype
      and a.attnum>0 and not a.attisdropped and a.attgenerated=''
      and not exists(select 1 from pg_catalog.pg_inherits inheritance where inheritance.inhrelid=c.oid)
  loop
    execute format('drop trigger if exists kouponly_strip_arabic_json on %s',target.relation);
    execute format('create trigger kouponly_strip_arabic_json before insert or update on %s for each row execute function public.kouponly_strip_arabic_json_fields()',target.relation);
  end loop;
end $$;

-- Keep active vendor synchronization functions compatible with the removed columns.
do $$
declare
  definition text;
begin
  definition:=pg_get_functiondef('public.realx_sync_vendor_catalogue()'::regprocedure);
  definition:=replace(definition,'title,title_ar,description,description_ar,offer_type','title,description,offer_type');
  definition:=replace(definition,',item->>''titleAr''','');
  definition:=replace(definition,',item->>''descriptionAr''','');
  definition:=replace(definition,',title_ar=excluded.title_ar','');
  definition:=replace(definition,',description_ar=excluded.description_ar','');
  definition:=replace(definition,'name,name_ar,phone,address,address_ar,latitude','name,phone,address,latitude');
  definition:=replace(definition,',loc->>''nameAr''','');
  definition:=replace(definition,',loc->>''addressAr''','');
  definition:=replace(definition,',name_ar=excluded.name_ar','');
  definition:=replace(definition,',address_ar=excluded.address_ar','');
  definition:=replace(definition,'select value from jsonb_array_elements(coalesce(new.payload->''offers'',''[]''::jsonb))','select public.kouponly_remove_arabic_fields(value) from jsonb_array_elements(coalesce(new.payload->''offers'',''[]''::jsonb))');
  definition:=replace(definition,'select value from jsonb_array_elements(coalesce(new.locations,''[]''::jsonb))','select public.kouponly_remove_arabic_fields(value) from jsonb_array_elements(coalesce(new.locations,''[]''::jsonb))');
  if definition ~ '(title_ar|description_ar|name_ar|address_ar|titleAr|descriptionAr|nameAr|addressAr)' then raise exception 'Could not remove Arabic vendor catalogue fields'; end if;
  execute definition;

  definition:=pg_get_functiondef('public.realx_sync_vendor_map()'::regprocedure);
  definition:=replace(definition,'''titleAr'',offer->>''titleAr'',','');
  definition:=replace(definition,'''nameAr'',payload->>''nameAr'',','');
  definition:=replace(definition,'''vendorNameAr'',payload->>''nameAr'',','');
  definition:=replace(definition,'''branchNameAr'',loc.value->>''nameAr'',','');
  definition:=replace(definition,'''addressAr'',coalesce(location->''addressAr'',payload->''addressAr''),','');
  definition:=replace(definition,'''addressAr'',coalesce(loc.value->''addressAr'',payload->''addressAr''),','');
  definition:=replace(definition,'''addressAr'',payload->''addressAr'',','');
  definition:=replace(definition,'''addressAr'',coalesce(payload->''addressAr'',primary_location->''addressAr''),','');
  definition:=replace(definition,'''nameAr'',loc.value->>''nameAr'',','');
  definition:=replace(definition,'offers:=case when jsonb_typeof(payload->''offers'')=''array'' then payload->''offers'' else ''[]''::jsonb end;','offers:=case when jsonb_typeof(payload->''offers'')=''array'' then public.kouponly_remove_arabic_fields(payload->''offers'') else ''[]''::jsonb end;');
  definition:=replace(definition,'select value,ordinality from jsonb_array_elements(new.locations) with ordinality','select public.kouponly_remove_arabic_fields(value) as value,ordinality from jsonb_array_elements(new.locations) with ordinality');
  if definition ~ '(title_ar|description_ar|name_ar|address_ar|titleAr|descriptionAr|nameAr|addressAr)' then raise exception 'Could not remove Arabic vendor map fields'; end if;
  execute definition;

  definition:=pg_get_functiondef('public.kouponly_sync_category_subcategories()'::regprocedure);
  definition:=replace(definition,'id,category_id,name,name_ar,slug,image_path,sort_order','id,category_id,name,slug,image_path,sort_order');
  definition:=replace(definition,'new.id,btrim(item->>''nameEnglish''),coalesce(item->>''nameArabic'',''''),','new.id,btrim(item->>''nameEnglish''),');
  definition:=replace(definition,',name_ar=excluded.name_ar','');
  definition:=replace(definition,'coalesce(new.payload->''subcategories'',''[]'')','public.kouponly_remove_arabic_fields(coalesce(new.payload->''subcategories'',''[]''))');
  if definition ~ '(name_ar|nameArabic)' then raise exception 'Could not remove Arabic subcategory fields'; end if;
  execute definition;

  definition:=pg_get_functiondef('public.realx_configure_badrgo_pilot(jsonb,jsonb)'::regprocedure);
  definition:=regexp_replace(definition,E'\n[ \t]*''(titleAr|descriptionAr|instructionsAr)'',[^\n]*,\n',E'\n','g');
  if definition ~ 'titleAr|descriptionAr|instructionsAr' then raise exception 'Could not remove Arabic pilot campaign fields'; end if;
  execute definition;

  definition:=pg_get_functiondef('public.realx_get_badrgo_voucher_program()'::regprocedure);
  definition:=regexp_replace(definition,E'\n[ \t]*''(titleAr|descriptionAr|instructionsAr)'',[^\n]*,\n',E'\n','g');
  if definition ~ 'titleAr|descriptionAr|instructionsAr' then raise exception 'Could not remove Arabic voucher response fields'; end if;
  execute definition;
end $$;

-- Scrub old JSON records in every public JSONB column, including nested arrays and objects.
do $$
declare
  column_record record;
begin
  for column_record in
    select table_schema,table_name,column_name
    from information_schema.columns
    where table_schema='public' and udt_name='jsonb'
  loop
    execute format('update %I.%I set %I=public.kouponly_remove_arabic_fields(%I) where %I is not null',
      column_record.table_schema,column_record.table_name,column_record.column_name,column_record.column_name,column_record.column_name);
  end loop;
end $$;

alter table public.realx_offers drop column if exists title_ar, drop column if exists description_ar;
alter table public.realx_vendor_locations drop column if exists name_ar, drop column if exists address_ar;
alter table public.realx_subcategories drop column if exists name_ar;

notify pgrst,'reload schema';

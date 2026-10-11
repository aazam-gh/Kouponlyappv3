-- Run against the linked database; fixture writes are rolled back.
begin;
set local plpgsql.check_asserts=on;
do $$
declare
  target record;
  dirty boolean;
  fixture text:='english-check-'||gen_random_uuid()::text;
  caught boolean;
begin
  assert public.kouponly_remove_arabic_fields(
    '{"titleEn":"Keep","titleAr":"Remove","nested":[{"nameArabic":"Remove","name":"Keep","address_ar":"Remove"},null,3],"enabled":true}'
  )='{"titleEn":"Keep","nested":[{"name":"Keep"},null,3],"enabled":true}'::jsonb,
    'Nested translation removal must preserve English values, arrays, nulls and scalars';
  assert public.kouponly_remove_arabic_fields(null) is null, 'SQL null must be preserved';
  assert not exists(
    select 1 from information_schema.columns where table_schema='public' and column_name ~ '(?:_ar|Ar|Arabic)$'
  ), 'Arabic columns must be absent from tables and compatibility views';
  for target in
    select c.oid::regclass as relation,a.attname
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.oid
    where n.nspname='public' and c.relkind in ('r','p') and a.atttypid='jsonb'::regtype
      and a.attnum>0 and not a.attisdropped and a.attgenerated=''
  loop
    execute format('select exists(select 1 from %s where %I is distinct from public.kouponly_remove_arabic_fields(%I))',target.relation,target.attname,target.attname)
      into dirty;
    assert not dirty, format('Stored translations remain in %s.%I',target.relation,target.attname);
  end loop;
  assert to_regprocedure('public.couponly_redeem_gift_card(text,numeric,uuid)') is null
    and to_regprocedure('public.realx_redeem_gift_card(text,numeric,uuid)') is null,
    'Gift-card checkout must be removed under both backend names';
  caught:=false;
  begin
    perform public.couponly_redeem_offer(fixture,fixture,10,'giftcard',10,0,null,gen_random_uuid());
  exception when feature_not_supported then caught:=true; end;
  assert caught, 'The renamed offer RPC must reject gift-card checkout';

  insert into public.couponly_categories(id,name,slug,payload) values(fixture,'English check',fixture,
    '{"nameEnglish":"English check","nameArabic":"Remove","subcategories":[{"nameEnglish":"Check","nameArabic":"Remove"}]}');
  assert exists(select 1 from public.realx_subcategories where category_id=fixture and name='Check'),
    'Category synchronization and legacy reads must work without Arabic columns';
  insert into public.couponly_vendors(id,name,status,category_id,locations,payload) values(fixture,'English vendor','Active',fixture,
    '[{"id":"one","name":"English branch","nameAr":"Remove","address":"English address","addressAr":"Remove","latitude":10,"longitude":76}]',
    '{"nameAr":"Remove","subcategory":["Check"],"offers":[{"titleEn":"English offer","titleAr":"Remove","descriptionEn":"English description","descriptionAr":"Remove","active":true}]}');
  assert exists(select 1 from public.realx_offers where vendor_id=fixture and title='English offer' and description='English description'),
    'Vendor offer synchronization must preserve English fields';
  assert exists(select 1 from public.realx_vendor_locations where vendor_id=fixture and name='English branch' and address='English address'),
    'Branch synchronization must preserve English fields';
  assert exists(select 1 from public.realx_map_locations where vendor_id=fixture and payload->>'name'='English vendor'),
    'Map synchronization must still work';
  assert (select not (payload ? 'nameAr') and not (locations->0 ? 'nameAr') and not (payload->'offers'->0 ? 'titleAr')
    from public.realx_vendors where id=fixture), 'Future writes must strip translations';
  update public.realx_vendors set payload=payload||'{"descriptionAr":"Remove","descriptionEn":"Updated English"}' where id=fixture;
  assert (select not (payload ? 'descriptionAr') and payload->>'descriptionEn'='Updated English' from public.realx_vendors where id=fixture),
    'Updates through legacy views must strip translations and preserve English';
  assert not exists(
    select 1 from pg_catalog.pg_class where oid in ('public.realx_offers'::regclass,'public.realx_vendor_locations'::regclass,'public.realx_subcategories'::regclass)
      and (relkind<>'v' or not coalesce(reloptions @> array['security_invoker=true'],false))
  ), 'Compatibility views must retain invoker security';
end $$;
set local role anon;
do $$
begin
  perform id from public.realx_offers limit 1;
  perform id from public.realx_vendor_locations limit 1;
  perform id from public.realx_subcategories limit 1;
end $$;
reset role;
rollback;

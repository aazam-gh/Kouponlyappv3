-- Runnable against the linked database; all test records are rolled back.
begin;
do $$
declare caught boolean;
begin
  insert into public.couponly_vendors(id,name,status,category_id,locations,payload)
  values ('taxonomy-check','Taxonomy check','Active','market-food',
    '[{"id":"one","address":"First branch","latitude":10,"longitude":76},{"id":"two","address":"Second branch"}]',
    '{"mainCategory":"Food","subcategory":["Rice","Sweets","Rice"],"offers":[{"id":"taxonomy-check-offer-one","titleEn":"First offer","active":true},{"id":"taxonomy-check-offer-two","titleEn":"Second offer","active":true}]}');
  assert (select count(*)=2 from public.couponly_vendor_subcategories where vendor_id='taxonomy-check'), 'Multiple subcategories must be distinct';
  assert (select count(*)=2 from public.couponly_offers where vendor_id='taxonomy-check'), 'Offers must remain linked';
  assert (select count(*)=2 from public.couponly_vendor_locations where vendor_id='taxonomy-check'), 'Branches must remain linked';
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  caught:=false;
  begin
    perform public.validate_redemption_atomic('deal-'||(select catalogue_deal_id from public.couponly_vendors where id='taxonomy-check')||'-999','inStore',gen_random_uuid());
  exception when raise_exception then caught:=true; end;
  assert caught, 'A fabricated offer index must be rejected before redemption';
  update public.couponly_categories set payload=payload||jsonb_build_object('subcategories',(
    select jsonb_agg(jsonb_build_object('id',s.id,'nameEnglish',case when s.id='market-food:rice' then 'Rice dishes' else s.name end))
    from public.couponly_subcategories s where s.category_id='market-food'
  )) where id='market-food';
  assert exists(select 1 from public.couponly_vendor_subcategories where vendor_id='taxonomy-check' and subcategory_id='market-food:rice'), 'Renaming must preserve assignments';
  assert (select payload->'subcategory' ? 'Rice dishes' from public.couponly_vendors where id='taxonomy-check'), 'Renaming must refresh admin labels';
  caught:=false;
  begin
    update public.couponly_vendors set payload=payload||'{"subcategory":["Homestays"]}' where id='taxonomy-check';
  exception when invalid_parameter_value then caught:=true; end;
  assert caught, 'Cross-category payload assignment must fail';
  caught:=false;
  begin
    insert into public.couponly_vendor_subcategories values('taxonomy-check','market-staycations:homestays','market-food');
  exception when foreign_key_violation then caught:=true; end;
  assert caught, 'Cross-category direct assignment must fail';
  caught:=false;
  begin
    insert into public.couponly_vendors(id,name,status,payload) values('taxonomy-missing','No category','Active','{}');
  exception when invalid_parameter_value then caught:=true; end;
  assert caught, 'Main category must be required';
  update public.couponly_vendors set category_id='market-staycations',
    payload=payload||'{"mainCategory":"Stays","subcategory":["Homestays"]}' where id='taxonomy-check';
  set constraints all immediate;
  assert (select count(*)=1 from public.couponly_vendor_subcategories where vendor_id='taxonomy-check' and category_id='market-staycations'), 'Changing the main category must replace assignments';
  caught:=false;
  begin
    delete from public.couponly_categories where id='market-staycations';
  exception when foreign_key_violation then caught:=true; end;
  assert caught, 'A referenced main category must not be deleted';
end $$;
set local role anon;
do $$
declare caught boolean:=false;
begin
  assert exists(select 1 from public.couponly_subcategories where id='market-food:rice'), 'Taxonomy must be public';
  assert exists(select 1 from public.couponly_vendor_subcategories where vendor_id='taxonomy-check'), 'Active vendor assignments must be public';
  begin
    insert into public.couponly_subcategories(id,category_id,name,slug) values('forbidden','market-food','Forbidden','forbidden');
  exception when insufficient_privilege then caught:=true; end;
  assert caught, 'Public taxonomy writes must fail';
end $$;
reset role;
rollback;

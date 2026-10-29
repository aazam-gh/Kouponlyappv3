begin;
do $$
declare category text; vendor text := 'qa-branch-offers';
begin
  select id into category from public.couponly_categories where active order by sort_order limit 1;
  insert into public.couponly_vendors(id,name,status,vendor_type,category_id,locations,payload)
  values(vendor,'Branch QA','Active','in_store',category,
    '[{"id":"kochi","name":"Kochi","latitude":9.93,"longitude":76.27},{"id":"tvm","name":"TVM","latitude":8.52,"longitude":76.94}]',
    '{"offers":[{"id":"qa-kochi","titleEn":"50% off Kochi","discountType":"percentage","discountValue":50,"branchIds":["kochi"]},{"id":"qa-tvm","titleEn":"20% off TVM","discountType":"percentage","discountValue":20,"branchIds":["tvm"]},{"id":"qa-all","titleEn":"All branches"}]}');
  assert (select payload->'branchIds'='["kochi"]'::jsonb from public.couponly_offers where id='qa-kochi'), 'Branch scope must survive normalized offer sync';
  assert (select count(*)=2 from public.couponly_vendor_locations where vendor_id=vendor), 'Both branches must project';
  begin
    update public.couponly_vendors set locations=locations-'1'::int where id=vendor;
    raise exception 'Deleting a referenced branch was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.couponly_vendors set payload=jsonb_set(payload,'{offers,0,branchIds}','["another-vendors-branch"]') where id=vendor;
    raise exception 'Foreign branch was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.couponly_vendors set locations=jsonb_set(locations,'{0,latitude}','91') where id=vendor;
    raise exception 'Invalid coordinates accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;

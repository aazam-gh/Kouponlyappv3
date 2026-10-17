begin;
set local role service_role;
do $$
declare category text; vendor text := 'qa-vendor-category-access';
begin
  select id into category from public.couponly_categories where active order by sort_order limit 1;
  assert category is not null, 'Active category required';
  perform 1 from public.couponly_subcategories limit 1;
  insert into public.couponly_vendors(id,name,status,vendor_type,category_id,payload)
  values(vendor,'QA vendor creation','Active','in_store',category,'{"offers":[],"locations":[]}');
  assert exists(select 1 from public.couponly_vendors where id=vendor and payload->>'mainCategory' is not null), 'Category must be applied';
  update public.couponly_vendors set name='QA vendor updated' where id=vendor;
  delete from public.couponly_vendors where id=vendor;
end $$;
rollback;

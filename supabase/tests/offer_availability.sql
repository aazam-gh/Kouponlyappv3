begin;
do $$
declare category text; vendor text := 'qa-offer-availability';
begin
  select id into category from public.couponly_categories where active order by sort_order limit 1;
  assert category is not null, 'Active category required';
  insert into public.couponly_vendors(id,name,status,vendor_type,category_id,payload)
  values(vendor,'QA offer availability','Inactive','in_store',category,
    '{"offers":[{"id":"qa-availability-published","titleEn":"Published offer","active":true,"startsAt":"2099-01-01T00:00:00Z","endsAt":"2100-01-01T00:00:00Z"},{"id":"qa-availability-unpublished","titleEn":"Unpublished offer","active":false,"endsAt":"2020-01-01T00:00:00Z"}]}');
  assert (select count(*)=2 from public.couponly_offers where vendor_id=vendor), 'Both offers must remain';
  assert not exists(select 1 from public.couponly_offers where vendor_id=vendor and (starts_at is not null or ends_at is not null)), 'Legacy dates must not control offer availability';
  assert (select active from public.couponly_offers where id='qa-availability-published'), 'Published offer must remain active';
  assert not (select active from public.couponly_offers where id='qa-availability-unpublished'), 'Unpublished offer must stay inactive';
  update public.couponly_offers set starts_at='2099-01-01',ends_at='2100-01-01' where id='qa-availability-published';
  assert (select starts_at is null and ends_at is null from public.couponly_offers where id='qa-availability-published'), 'Direct writes must not restore scheduling';
  update public.couponly_vendors set payload=jsonb_set(payload,'{offers,0,active}','false') where id=vendor;
  assert not (select active from public.couponly_offers where id='qa-availability-published'), 'Publish toggle must still control availability';
end $$;
rollback;

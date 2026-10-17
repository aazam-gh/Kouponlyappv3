begin;
do $$
declare category text; vendor text := 'qa-vendor-presentation';
begin
  select id into category from public.couponly_categories where active order by sort_order limit 1;
  assert category is not null, 'Active category required';
  insert into public.couponly_vendors(id,name,status,vendor_type,category_id,logo_path,card_label,payload)
  values(vendor,'QA presentation','Active','in_store',category,'https://example.test/vendor.png','Student favourite',
    '{"offers":[{"id":"qa-presentation-first","titleEn":"First offer","active":true,"imageUrl":"https://example.test/old-offer.png","cardLabels":["Old badge","Extra badge"]},{"id":"qa-presentation-second","titleEn":"Second offer","active":true,"cardLabel":"Different badge"}]}');
  assert (select count(*) = 2 from public.couponly_offers where vendor_id=vendor), 'Offer identities must be preserved';
  assert not exists(select 1 from public.couponly_offers where vendor_id=vendor and
    (image_url is distinct from 'https://example.test/vendor.png' or payload->>'cardLabel' is distinct from 'Student favourite'
      or payload->'cardLabels' is distinct from '["Student favourite"]'::jsonb)), 'All offers must inherit vendor branding';
  assert (select payload#>>'{offers,0,imageUrl}'='https://example.test/old-offer.png' from public.couponly_vendors where id=vendor), 'Legacy assets must remain stored';

  update public.couponly_offers set image_url='https://example.test/override.png', payload='{"cardLabels":["Override"]}' where id='qa-presentation-second';
  assert (select image_url='https://example.test/vendor.png' and payload->>'cardLabel'='Student favourite' from public.couponly_offers where id='qa-presentation-second'), 'Direct offer writes cannot override vendor presentation';

  update public.couponly_vendors set logo_path='https://example.test/replacement.png', card_label='Campus choice' where id=vendor;
  assert not exists(select 1 from public.couponly_offers where vendor_id=vendor and (image_url is distinct from 'https://example.test/replacement.png' or payload->>'cardLabel' is distinct from 'Campus choice')), 'Vendor changes must reach existing offers';
  update public.couponly_vendors set payload=jsonb_set(payload,'{offers}',jsonb_build_array(payload#>'{offers,1}',payload#>'{offers,0}')) where id=vendor;
  assert not exists(select 1 from public.couponly_offers where vendor_id=vendor and payload->>'cardLabel' is distinct from 'Campus choice'), 'Offer order cannot change the vendor badge';

  update public.couponly_vendors set card_label=null,logo_path=null where id=vendor;
  assert not exists(select 1 from public.couponly_offers where vendor_id=vendor and (image_url is not null or payload->>'cardLabel' is not null or payload->'cardLabels' is distinct from '[]'::jsonb)), 'Clearing vendor branding must clear compatibility fields';
  assert (select card_label is null from public.realx_vendors where id=vendor), 'Legacy mobile view must expose the canonical label';
  begin
    update public.couponly_vendors set card_label=repeat('x',33) where id=vendor;
    raise exception 'Oversized label was accepted';
  exception when check_violation then null;
  end;
end $$;
rollback;

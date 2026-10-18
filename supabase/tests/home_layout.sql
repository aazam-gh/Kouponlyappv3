begin;
do $$
declare original jsonb; invalid jsonb;
begin
  select payload into original from public.couponly_cms_documents where id='homeLayout';
  assert original is not null, 'Default layout must exist';
  update public.couponly_cms_documents set payload=jsonb_set(payload,'{sectionOrder}',
    '["brand-logos","trending-offers","featured-showcase","new-deals","nearby-vendors","categories","partner-banners"]') where id='homeLayout';
  assert (select payload->'sectionOrder'->>0='brand-logos' from public.couponly_cms_documents where id='homeLayout'), 'Valid order must save';
  for invalid in select value from jsonb_array_elements('[null, {}, [], ["categories"], ["partner-banners","categories","nearby-vendors","new-deals","featured-showcase","trending-offers","categories"], ["top-brands","categories","nearby-vendors","new-deals","featured-showcase","trending-offers","brand-logos"]]'::jsonb)
  loop
    begin
      update public.couponly_cms_documents set payload=jsonb_build_object('sectionOrder',invalid) where id='homeLayout';
      raise exception 'Invalid Home order accepted: %', invalid;
    exception when check_violation then null;
    end;
  end loop;
  insert into public.couponly_cms_documents(id,payload) values('qa-other-layout','{}');
end $$;
set local role anon;
do $$ begin
  assert (select count(*)=1 from public.couponly_cms_documents where id='homeLayout'), 'Students must be able to read Home layout';
  begin
    insert into public.couponly_cms_documents(id,payload) values('qa-anon-layout','{}');
    raise exception 'Anonymous CMS write accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

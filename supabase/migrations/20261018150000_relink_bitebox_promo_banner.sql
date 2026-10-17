begin;

do $$
declare
  bitebox_id text;
  match_count integer;
  updated_count integer;
begin
  select count(*) into match_count
  from public.couponly_vendors
  where lower(name) = 'bitebox' and status = 'Active';

  if match_count <> 1 then
    raise exception 'Expected exactly one active Bitebox vendor, found %', match_count;
  end if;

  select id::text into bitebox_id
  from public.couponly_vendors
  where lower(name) = 'bitebox' and status = 'Active';

  if (select count(*)
      from public.couponly_cms_documents d
      cross join lateral jsonb_array_elements(coalesce(d.payload->'banners', '[]'::jsonb)) as entries(banner)
      where d.id = 'banner' and banner->>'bannerId' = 'promo_ntpc2hm16'
        and coalesce((banner->>'isActive')::boolean, false)) <> 1 then
    raise exception 'Expected exactly one active Bitebox promo banner (promo_ntpc2hm16)';
  end if;

  update public.couponly_cms_documents d
  set payload = jsonb_set(
        d.payload,
        '{banners}',
        (select jsonb_agg(
                  case when banner->>'bannerId' = 'promo_ntpc2hm16' then
                    jsonb_set(
                      jsonb_set(banner, '{vendorId}', to_jsonb(bitebox_id), true),
                      '{vendorIds}', jsonb_build_array(bitebox_id), true
                    )
                  else banner end
                  order by ordinality
                )
         from jsonb_array_elements(coalesce(d.payload->'banners', '[]'::jsonb))
              with ordinality as entries(banner, ordinality)),
        true
      ),
      updated_at = now()
  where d.id = 'banner';

  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'Expected to update one banner CMS document, updated %', updated_count;
  end if;
end $$;

commit;

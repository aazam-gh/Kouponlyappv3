-- Preserve the live mobile app's existing online destinations for non-local
-- catalog categories while keeping vendor accounts themselves in-store-only.
update public.kouponly_vendors
set payload=jsonb_set(
  payload,
  '{offers,0,redemptionMode}',
  to_jsonb(case when payload->>'category' in ('Shopping','Travel','Entertainment') then 'online' else 'inStore' end),
  true
)
where id like 'catalogue-vendor-%' and jsonb_typeof(payload->'offers')='array';

notify pgrst,'reload schema';

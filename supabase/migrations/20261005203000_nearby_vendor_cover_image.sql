-- The admin's offer image_url is an offer logo. Use the branding cover for
-- nearby card photos, matching the shared mobile catalogue projection.
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.get_nearby_food_offers(double precision,double precision)'::regprocedure);
  definition := replace(definition, 'v.offer_value, v.image_url, v.logo_path,', 'v.offer_value, v.cover_image_url, v.image_url, v.logo_path,');
  definition := replace(definition, 'coalesce(nullif(o.image_url, ''''), nullif(v.image_url, ''''),', 'coalesce(nullif(v.cover_image_url, ''''), nullif(v.image_url, ''''),');
  execute definition;
end $$;
notify pgrst, 'reload schema';

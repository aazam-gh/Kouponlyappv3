-- Trigger entry points are implementation details and should not be callable
-- through PostgREST RPC by public application roles.
revoke all on function public.kouponly_sync_vendor_catalogue() from public,anon,authenticated;
revoke all on function public.kouponly_sync_vendor_map() from public,anon,authenticated;
revoke all on function public.kouponly_apply_vendor_catalogue_fields() from public,anon,authenticated;

-- Keep the read policy as the sole SELECT policy for normalized locations.
drop policy if exists kouponly_vendor_locations_admin_write on public.kouponly_vendor_locations;
create policy kouponly_vendor_locations_admin_insert on public.kouponly_vendor_locations
  for insert to authenticated with check(public.kouponly_is_admin() or public.kouponly_is_vendor_member(vendor_id));
create policy kouponly_vendor_locations_admin_update on public.kouponly_vendor_locations
  for update to authenticated using(public.kouponly_is_admin() or public.kouponly_is_vendor_member(vendor_id))
  with check(public.kouponly_is_admin() or public.kouponly_is_vendor_member(vendor_id));
create policy kouponly_vendor_locations_admin_delete on public.kouponly_vendor_locations
  for delete to authenticated using(public.kouponly_is_admin() or public.kouponly_is_vendor_member(vendor_id));

-- Foreign key indexes and the mobile offer query path.
create index if not exists kouponly_vendors_category_id_idx on public.kouponly_vendors(category_id);
create index if not exists kouponly_vendors_user_id_idx on public.kouponly_vendors(user_id);
create index if not exists kouponly_offers_vendor_id_idx on public.kouponly_offers(vendor_id);
create index if not exists kouponly_offers_category_id_idx on public.kouponly_offers(category_id);
create index if not exists kouponly_offers_marketplace_active_idx on public.kouponly_offers(active,sort_order,starts_at,ends_at);

notify pgrst,'reload schema';

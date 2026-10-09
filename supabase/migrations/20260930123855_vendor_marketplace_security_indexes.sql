-- Trigger entry points are implementation details and should not be callable
-- through PostgREST RPC by public application roles.
revoke all on function public.realx_sync_vendor_catalogue() from public,anon,authenticated;
revoke all on function public.realx_sync_vendor_map() from public,anon,authenticated;
revoke all on function public.realx_apply_vendor_catalogue_fields() from public,anon,authenticated;

-- Keep the read policy as the sole SELECT policy for normalized locations.
drop policy if exists realx_vendor_locations_admin_write on public.realx_vendor_locations;
create policy realx_vendor_locations_admin_insert on public.realx_vendor_locations
  for insert to authenticated with check(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
create policy realx_vendor_locations_admin_update on public.realx_vendor_locations
  for update to authenticated using(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id))
  with check(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));
create policy realx_vendor_locations_admin_delete on public.realx_vendor_locations
  for delete to authenticated using(public.realx_is_admin() or public.realx_is_vendor_member(vendor_id));

-- Foreign key indexes and the mobile offer query path.
create index if not exists realx_vendors_category_id_idx on public.realx_vendors(category_id);
create index if not exists realx_vendors_user_id_idx on public.realx_vendors(user_id);
create index if not exists realx_offers_vendor_id_idx on public.realx_offers(vendor_id);
create index if not exists realx_offers_category_id_idx on public.realx_offers(category_id);
create index if not exists realx_offers_marketplace_active_idx on public.realx_offers(active,sort_order,starts_at,ends_at);

notify pgrst,'reload schema';

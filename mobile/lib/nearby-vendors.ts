import { dealAtBranch } from './vendor-branches';
import type { Deal } from '@/lib/data';
import { projectVendorCatalogue, type MarketplaceOfferRow, type MarketplaceVendorRow } from '@/lib/vendor-catalogue';
import { getSupabase } from '@/lib/supabase';

export type VendorMapLocation = Deal & { vendorId: string; locationId: string; branchName?: string; phoneNumber?: string };

export async function fetchVendorMapLocations(search?: string, bounds?: { south: number; north: number; west: number; east: number }): Promise<VendorMapLocation[]> {
  const client = getSupabase();
  let vendorQuery = client.from('kouponly_vendors').select('*').eq('status', 'Active');
  if (search?.trim()) {
    const term = `%${search.trim().replace(/[%,()]/g, ' ')}%`;
    vendorQuery = vendorQuery.or(`name.ilike.${term},description.ilike.${term}`);
  }
  let locationQuery = client.from('kouponly_vendor_locations').select('*').order('sort_order');
  if (bounds) {
    locationQuery = locationQuery.gte('latitude', bounds.south).lte('latitude', bounds.north)
      .gte('longitude', bounds.west).lte('longitude', bounds.east);
  }
  const [vendors, offers, locations, categories, subcategories, assignments] = await Promise.all([
    vendorQuery,
    client.from('kouponly_offers').select('*').order('sort_order'),
    locationQuery,
    client.from('kouponly_categories').select('*').eq('active', true),
    client.from('kouponly_subcategories').select('*').order('sort_order'),
    client.from('kouponly_vendor_subcategories').select('*'),
  ]);
  for (const result of [vendors, offers, locations, categories, subcategories, assignments]) {
    if (result.error) throw new Error(result.error.message || 'Vendor locations could not be loaded.');
  }
  const vendorRows = (vendors.data ?? []) as MarketplaceVendorRow[];
  const projected = projectVendorCatalogue(vendorRows, (offers.data ?? []) as MarketplaceOfferRow[], locations.data ?? [], {
    categories: categories.data ?? [], subcategories: subcategories.data ?? [], assignments: assignments.data ?? [],
  });
  const dealsById = new Map(projected.deals.map((deal) => [deal.id, deal]));
  const locationsByVendor = new Map<string, Record<string, any>[]>();
  for (const location of locations.data ?? []) {
    const list = locationsByVendor.get(location.vendor_id) ?? [];
    list.push(location);
    locationsByVendor.set(location.vendor_id, list);
  }

  return vendorRows.flatMap((vendor) => {
    const payload = vendor.payload && typeof vendor.payload === 'object' ? vendor.payload : {};
    const dealId = Number(vendor.catalogue_deal_id ?? payload.id);
    const deal = dealsById.get(dealId);
    if (!deal) return [];
    return (locationsByVendor.get(vendor.id) ?? []).flatMap((location) => {
      if (location.latitude == null || location.longitude == null) return [];
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
      return [{
        ...dealAtBranch(deal, String(location.id)),
        place: location.address || location.name || deal.place,
        branchName: location.name || undefined,
        phoneNumber: location.phone || location.payload?.phoneNumber || deal.phoneNumber,
        latitude,
        longitude,
        vendorId: vendor.id,
        locationId: String(location.id),
      }];
    });
  });
}

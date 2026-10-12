import type { Deal } from './data';
export type RecentRedemption = { vendorId: string; vendorName?: string; redeemedAt: string };
export function recentRedeemedVendors(rows: RecentRedemption[], limit = 5): RecentRedemption[] {
  const seen = new Set<string>();
  return [...rows].filter(row => row.vendorId && Number.isFinite(Date.parse(row.redeemedAt)))
    .sort((a, b) => Date.parse(b.redeemedAt) - Date.parse(a.redeemedAt))
    .filter(row => { if (seen.has(row.vendorId)) return false; seen.add(row.vendorId); return true; }).slice(0, limit);
}
export function recommendedVendors(catalogue: Deal[], savedIds: Set<string>, recentIds: string[], limit = 6) {
  const categories = new Set(catalogue.filter(vendor => savedIds.has(String(vendor.vendorId || vendor.id)) || recentIds.includes(String(vendor.vendorId || vendor.id))).map(vendor => vendor.category));
  return catalogue.filter(vendor => !savedIds.has(String(vendor.vendorId || vendor.id)) && vendor.offers?.length)
    .sort((a, b) => Number(categories.has(b.category)) - Number(categories.has(a.category)) || b.trend - a.trend || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name))
    .slice(0, limit).map(vendor => ({ vendor, reason: categories.has(vendor.category) ? `Because you like ${vendor.category.toLowerCase()}` : 'Popular offers to explore' }));
}

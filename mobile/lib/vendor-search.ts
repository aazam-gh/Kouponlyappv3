import type { Deal } from './data';

export function searchVendors(vendors: Deal[], query: string): Deal[] {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return [];
  // Keep name completion narrow even when other vendors share a place or keyword.
  const names = vendors.filter(vendor => vendor.name.toLocaleLowerCase().startsWith(text));
  const categoryQuery = vendors.some(vendor => vendor.category.toLocaleLowerCase() === text);
  if ((names.length && !categoryQuery) || text.length === 1) return names;
  const terms = text.split(/\s+/);
  return vendors.filter(vendor => {
    const haystack = [vendor.name, vendor.category, vendor.place, vendor.offer, vendor.saving, vendor.description, vendor.keywords,
      ...(vendor.locations || []).flatMap(location => [location.name, location.address]),
      ...(vendor.offers || []).flatMap(offer => [offer.title, offer.description, offer.saving])].join(' ').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

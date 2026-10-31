import type { Deal, VendorLocation, VendorOffer } from './data';

export function offerAppliesToBranch(offer: VendorOffer, branch: VendorLocation) {
  return !offer.branchIds?.length || offer.branchIds.includes(branch.branchId || branch.id);
}

export function dealAtBranch(deal: Deal, locationId?: string): Deal {
  if (locationId === undefined) return deal;
  const branch = deal.locations?.find(row => row.id === locationId || row.branchId === locationId);
  if (!branch) return deal;
  const offers = (deal.offers || []).filter(offer => offerAppliesToBranch(offer, branch));
  return { ...deal, offers, place: branch.address || branch.name, latitude: branch.latitude, longitude: branch.longitude,
    offer: offers[0]?.title || '', saving: offers[0]?.saving || '', offerValue: offers[0]?.discountValue || 0,
    phoneNumber: branch.phoneNumber || deal.phoneNumber, openingHours: branch.openingHours || deal.openingHours };
}

export function offerBranchLabel(offer: VendorOffer, locations: VendorLocation[] = []) {
  if (!offer.branchIds?.length) return locations.length > 1 ? 'All branches' : locations[0]?.name || locations[0]?.address || 'In-store';
  return locations.filter(branch => offerAppliesToBranch(offer, branch)).map(branch => branch.name || branch.address).filter(Boolean).join(', ') || 'Selected branches';
}

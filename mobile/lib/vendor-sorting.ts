export type VendorSortMode = 'alphabetical' | 'discount-high' | 'discount-low' | 'coupon-availability';
type SortableVendor = { name?: string; offerValue?: number; offers?: { discountValue?: number }[] };

export const vendorSortOptions: { id: VendorSortMode; label: string; icon: 'text-outline' | 'trending-up-outline' | 'trending-down-outline' | 'ticket-outline' }[] = [
  { id: 'alphabetical', label: 'Alphabetical', icon: 'text-outline' },
  { id: 'discount-high', label: 'Discount: high to low', icon: 'trending-up-outline' },
  { id: 'discount-low', label: 'Discount: low to high', icon: 'trending-down-outline' },
  { id: 'coupon-availability', label: 'Coupon availability', icon: 'ticket-outline' },
];

function discountValue(deal: SortableVendor) {
  const offer = deal.offers?.[0];
  return Number.isFinite(offer?.discountValue) ? offer!.discountValue! : Number.isFinite(deal.offerValue) ? deal.offerValue! : 0;
}

export function sortVendors<T extends SortableVendor>(
  vendors: readonly T[],
  mode: VendorSortMode,
  isCouponAvailable: (vendor: T) => boolean = () => true,
): T[] {
  return [...vendors].sort((a, b) => {
    const nameOrder = String(a.name || '').localeCompare(String(b.name || ''));
    if (mode === 'alphabetical') return nameOrder;
    if (mode === 'discount-high') return discountValue(b) - discountValue(a) || nameOrder;
    if (mode === 'discount-low') return discountValue(a) - discountValue(b) || nameOrder;
    if (mode === 'coupon-availability') return Number(isCouponAvailable(b)) - Number(isCouponAvailable(a)) || nameOrder;
    return 0;
  });
}

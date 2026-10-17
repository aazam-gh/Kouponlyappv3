export type VendorSortMode = 'alphabetical' | 'coupon-availability';
type SortableVendor = { name?: string };

export const vendorSortOptions: { id: VendorSortMode; label: string; icon: 'text-outline' | 'ticket-outline' }[] = [
  { id: 'alphabetical', label: 'Alphabetical', icon: 'text-outline' },
  { id: 'coupon-availability', label: 'Coupon availability', icon: 'ticket-outline' },
];

export function sortVendors<T extends SortableVendor>(
  vendors: readonly T[],
  mode: VendorSortMode,
  isCouponAvailable: (vendor: T) => boolean = () => true,
): T[] {
  return [...vendors].sort((a, b) => {
    const nameOrder = String(a.name || '').localeCompare(String(b.name || ''));
    if (mode === 'alphabetical') return nameOrder;
    if (mode === 'coupon-availability') return Number(isCouponAvailable(b)) - Number(isCouponAvailable(a)) || nameOrder;
    return 0;
  });
}

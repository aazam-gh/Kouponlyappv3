import { recentRedeemedVendors, recommendedVendors } from '../lib/saved-discovery';
import type { Deal } from '../lib/data';
const vendor = (id: string, category: string, trend: number) => ({ id: Number(id), vendorId: id, name: id, category, trend, distanceKm: 1, offers: [{ id: 'offer-'+id }] }) as Deal;
test('recent vendors are deduplicated in redemption order and invalid dates are ignored', () => {
  expect(recentRedeemedVendors([{ vendorId: '1', redeemedAt: '2026-01-01' }, { vendorId: '2', redeemedAt: '2026-02-01' }, { vendorId: '1', redeemedAt: '2026-03-01' }, { vendorId: '3', redeemedAt: 'invalid' }]).map(row => row.vendorId)).toEqual(['1', '2']);
});
test('recommendations exclude saved vendors and rank saved and redeemed categories first', () => {
  const catalogue = [vendor('1', 'Food', 1), vendor('2', 'Food', 1), vendor('3', 'Beauty', 100), vendor('4', 'Fitness', 2), vendor('5', 'Fitness', 3)];
  expect(recommendedVendors(catalogue, new Set(['1']), ['4']).map(row => row.vendor.vendorId)).toEqual(['5', '4', '2', '3']);
  expect(catalogue[0].vendorId).toBe('1');
});
test('new users see trending vendors with offers, without invented personalization', () => {
  const catalogue = [vendor('1', 'Food', 1), vendor('2', 'Beauty', 100), { ...vendor('3', 'Food', 500), offers: [] }];
  const recommended = recommendedVendors(catalogue, new Set(), []);
  expect(recommended.map(row => row.vendor.vendorId)).toEqual(['2', '1']);
  expect(recommended[0].reason).toBe('Popular offers to explore');
});

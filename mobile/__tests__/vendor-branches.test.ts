import { projectVendorCatalogue } from '../lib/vendor-catalogue';
import { dealAtBranch, offerBranchLabel } from '../lib/vendor-branches';
import { nearestLocationsByVendor } from '../lib/vendor-distance';
import { vendor, taxonomy } from '../test/catalogue-fixture';

const locations = [
  { id: 'vendor-1:kochi', vendor_id: vendor.id, name: 'Kochi', latitude: 9.93, longitude: 76.27, payload: { id: 'kochi' } },
  { id: 'vendor-1:tvm', vendor_id: vendor.id, name: 'TVM', latitude: 8.52, longitude: 76.94, payload: { id: 'tvm' } },
];
const offers = [
  { id: 'kochi-offer', vendor_id: vendor.id, title: '50% off', discount_type: 'percentage', discount_value: 50, payload: { branchIds: ['kochi'] } },
  { id: 'tvm-offer', vendor_id: vendor.id, title: '20% off', discount_type: 'percentage', discount_value: 20, payload: { branchIds: ['tvm'] } },
  { id: 'all-offer', vendor_id: vendor.id, title: 'All branches', sort_order: 2 },
];
const deal = projectVendorCatalogue([vendor], offers, locations, taxonomy).deals[0];

test.each([
  [9.93, 76.27, 'kochi', 'kochi-offer', 'tvm-offer'],
  [8.52, 76.94, 'tvm', 'tvm-offer', 'kochi-offer'],
])('selects nearby branch and its coupons at %s,%s', (latitude, longitude, branch, included, excluded) => {
  const nearest = nearestLocationsByVendor(locations.map(row => ({ ...row, vendorId: row.vendor_id })), { latitude, longitude }).get(vendor.id)!;
  expect(nearest.location.payload.id).toBe(branch);
  const local = dealAtBranch(deal, nearest.location.id);
  expect(local.offers?.map(offer => offer.id)).toEqual(expect.arrayContaining([included, 'all-offer']));
  expect(local.offers?.some(offer => offer.id === excluded)).toBe(false);
  expect(local.latitude).toBe(latitude);
  expect(offerBranchLabel(local.offers!.find(offer => offer.id === included)!, deal.locations)).toBe(branch === 'kochi' ? 'Kochi' : 'TVM');
  expect(offerBranchLabel(local.offers!.find(offer => offer.id === 'all-offer')!, deal.locations)).toBe('All branches');
});

test('keeps stable coupon indexes, supports raw branch IDs and never invents an offer at an empty branch', () => {
  const local = dealAtBranch(deal, 'tvm');
  expect(local.offers?.find(offer => offer.id === 'tvm-offer')?.index).toBe(deal.offers?.find(offer => offer.id === 'tvm-offer')?.index);
  const empty = dealAtBranch({ ...deal, offers: deal.offers?.filter(offer => offer.id === 'kochi-offer') }, 'tvm');
  expect(empty.offers).toEqual([]);
  expect(empty.offer).toBe('');
  expect(dealAtBranch(deal)).toBe(deal);
  expect(deal.offers).toHaveLength(3);
});

test('keeps branch discounts independent and excludes a disabled branch offer', () => {
  const projected = projectVendorCatalogue([vendor], offers.map(offer => ({ ...offer, active: offer.id !== 'tvm-offer' })), locations, taxonomy).deals[0];
  expect(dealAtBranch(projected, 'kochi').offers?.find(offer => offer.id === 'kochi-offer')?.discountValue).toBe(50);
  expect(dealAtBranch(projected, 'tvm').offers?.map(offer => offer.id)).toEqual(['all-offer']);
  const enabled = dealAtBranch(deal, 'tvm');
  expect(enabled.offers?.find(offer => offer.id === 'tvm-offer')?.discountValue).toBe(20);
});

test('retains exhausted offers and their server usage counts for the consumed state', () => {
  const projected = projectVendorCatalogue([vendor], offers.map(offer => ({ ...offer, redemption_limit: 100, redemption_count: 100 })), locations, taxonomy).deals[0];
  expect(projected.offers).toHaveLength(3);
  expect(projected.offers![0].redemptionLimit).toBe(100);
  expect(projected.offers![0].redemptionCount).toBe(100);
});

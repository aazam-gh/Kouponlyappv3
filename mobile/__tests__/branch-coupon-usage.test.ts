import { hasAvailableBranchCoupon, isCouponOfferUsed, redeemSubscriptionCoupon } from '../lib/benefits';
import type { AccountBenefits } from '../lib/benefits';
import type { Deal } from '../lib/data';
const mockRpc = jest.fn();
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ rpc: mockRpc }) }));
const benefits = { usedVendorIds: ['v'], usedOfferIds: ['o'], usedOfferBranches: [{ offerId: 'o', branchId: 'a' }] } as AccountBenefits;
const deal = { vendorId: 'v', offers: [{ id: 'o', branchIds: [] }], locations: [{ id: 'v:a', branchId: 'a' }, { id: 'v:b', branchId: 'b' }] } as unknown as Deal;
test('branch usage takes precedence over conservative legacy fields', () => {
  expect(isCouponOfferUsed(benefits, 'o', 'v', 'a')).toBe(true);
  expect(isCouponOfferUsed(benefits, 'o', 'v', 'b')).toBe(false);
  expect(isCouponOfferUsed({ ...benefits, usedOfferBranches: [] }, 'o', 'v', 'a')).toBe(false);
  expect(isCouponOfferUsed({ ...benefits, usedOfferBranches: undefined }, 'o', 'v', 'b')).toBe(true);
  expect(isCouponOfferUsed({ ...benefits, usedOfferBranches: [{ offerId: 'o', branchId: null }] }, 'o', 'v', 'b')).toBe(true);
});
test('availability sorting recognizes unused branches and offer restrictions', () => {
  expect(hasAvailableBranchCoupon(deal, benefits)).toBe(true);
  expect(hasAvailableBranchCoupon({ ...deal, offers: [{ ...deal.offers![0], branchIds: ['a'] }] }, benefits)).toBe(false);
  expect(hasAvailableBranchCoupon(deal, { ...benefits, usedOfferBranches: [{ offerId: 'o', branchId: 'a' }, { offerId: 'o', branchId: 'b' }] })).toBe(false);
});
test('RPC sends branch and nullable BOGO value to the unambiguous six-argument function', async () => {
  mockRpc.mockResolvedValue({ data: { id: 'receipt' }, error: null });
  await redeemSubscriptionCoupon('o', 'round', 'mutation', 100, undefined, 'b');
  expect(mockRpc).toHaveBeenCalledWith('kouponly_redeem_coupon', { p_offer_id: 'o', p_round_id: 'round', p_mutation_id: 'mutation', p_bill_amount: 100, p_free_item_amount: null, p_branch_id: 'b' });
});

test('exhausted offers cannot make a vendor appear redeemable', () => {
  const exhausted = { ...deal, offers: [{ ...deal.offers![0], redemptionLimit: 100, redemptionCount: 100 }] };
  expect(hasAvailableBranchCoupon(exhausted, null)).toBe(false);
  expect(hasAvailableBranchCoupon({ ...exhausted, offers: [{ ...exhausted.offers![0], redemptionCount: 99 }] }, null)).toBe(true);
});

import { offerAmounts } from '../utils/offer-amounts';
test.each([
 ['percentage', 25, 100, undefined, 75, 25],
 ['percentage', 12.5, 99.99, undefined, 87.49, 12.5],
 ['amount', 30, 100, undefined, 70, 30],
 ['amount', 150, 100, undefined, 0, 100],
 ['buy1get1', undefined, 150, 60, 90, 60],
 ['free', undefined, 100, undefined, 0, 100],
 ['combo', 75, 100, undefined, 75, 25],
 ['fixed_price', 60, 100, undefined, 60, 40],
] as const)('%s computes payable and saved', (discountType, discountValue, bill, item, payable, saved) => {
 expect(offerAmounts({discountType,discountValue},bill,item)).toEqual({payable,saved});
});
test('rejects missing, unsupported, and impossible values', () => {
 for (const offer of [{discountType:'unknown'}, {discountType:'percentage',discountValue:110}, {discountType:'fixed_price',discountValue:101}, {discountType:'amount',discountValue:NaN}, {discountType:'buy1get1'}]) expect(offerAmounts(offer,100)).toBeNull();
 expect(offerAmounts({discountType:'buy1get1'},100,60)).toBeNull();
});

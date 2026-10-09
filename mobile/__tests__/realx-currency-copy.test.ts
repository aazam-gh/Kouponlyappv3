import { formatKouponlyCurrencyText } from '../utils/numbers';

describe('Kouponly currency copy', () => {
  it.each([
    ['Save up to ₹480', 'Save up to QAR 480'],
    ['INR 320 cashback', 'QAR 320 cashback'],
  ])('formats Supabase catalogue currency copy', (input, expected) => {
    expect(formatKouponlyCurrencyText(input)).toBe(expected);
  });
});

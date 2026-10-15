import { parseBillAmount } from '../utils/bill-amount';

it.each(['', '0', '-1', '1.234', '1e3', '1,000', 'NaN', 'Infinity', '10000000000', '.50'])('rejects invalid bill %s', value => {
  expect(parseBillAmount(value)).toBeNull();
});
it.each([['125.50', 125.5], ['0.01', 0.01], ['9999999999.99', 9999999999.99], [' 25 ', 25], ['١٢.٥٠', 12.5]])('parses bill %s without changing its value', (value, amount) => {
  expect(parseBillAmount(value as string)).toBe(amount);
});

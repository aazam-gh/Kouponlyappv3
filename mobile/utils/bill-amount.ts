import { normalizeDigits } from './numbers';

export function parseBillAmount(input: string): number | null {
  const value = normalizeDigits(input.trim());
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(value)) return null;
  const amount = Number(value);
  return amount > 0 && amount <= 9999999999.99 ? amount : null;
}

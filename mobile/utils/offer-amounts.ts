import type { VendorOffer } from '@/lib/data';
export function offerAmounts(offer: Pick<VendorOffer, 'discountType' | 'discountValue'>, bill: number, freeItem?: number | null) {
  const total = Math.round(bill * 100), value = offer.discountValue;
  if (!Number.isFinite(bill) || total <= 0) return null;
  let saved: number;
  switch (offer.discountType) {
    case 'percentage': if (!Number.isFinite(value) || value! < 0 || value! > 100) return null; saved = Math.round(total * value! / 100); break;
    case 'amount': if (!Number.isFinite(value) || value! < 0) return null; saved = Math.round(value! * 100); break;
    case 'free': saved = total; break;
    case 'buy1get1': if (!freeItem || !Number.isFinite(freeItem) || freeItem > bill / 2) return null; saved = Math.round(freeItem * 100); break;
    case 'combo': case 'fixed_price': if (!Number.isFinite(value) || value! < 0 || value! * 100 > total) return null; saved = total - Math.round(value! * 100); break;
    default: return null;
  }
  saved = Math.min(total, Math.max(0, saved));
  return { saved: saved / 100, payable: (total - saved) / 100 };
}

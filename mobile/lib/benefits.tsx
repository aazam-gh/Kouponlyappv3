import { AppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth';
import { getSupabase } from './supabase';
import { makeMutationId } from './backend';

export type AccountBenefits = {
  inviteCode: string | null; serverTime: string; referralCount: number; rewardedReferrals: number; referralLimit: number;
  referral: { status: string; reason: string | null } | null;
  subscription: { periodId: string; roundId: string; roundNumber: number; startsAt: string; endsAt: string; planName: string; cancelAtPeriodEnd: boolean } | null;
  /** Consumed offer slots in the active coupon round. */
  usedOfferIds?: string[];
  /** Kept in the API during rollout for clients that still expect vendor-level usage. */
  usedVendorIds: string[];
};
export type ClaimResult = { kind: 'invite' | 'voucher'; status: string; rewardRecipient: 'self' | 'inviter'; benefits: AccountBenefits };
const messages: Record<string, string> = {
  INVALID_CODE: 'This code is not valid. Check it and try again.', SELF_REFERRAL: 'You cannot use your own invite code.',
  INVITE_ALREADY_ATTACHED: 'An invite code has already been applied to this account.', INVITE_WINDOW_CLOSED: 'Invite codes can be entered within seven days of signup.',
  SUBSCRIPTION_REQUIRED: 'Verify your email to access free coupons.', VOUCHER_EXPIRED: 'This voucher has expired or is not active.',
  VOUCHER_ALREADY_USED: 'You have already used this voucher.', VOUCHER_EXHAUSTED: 'This voucher has reached its claim limit.',
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.', ROUND_CHANGED: 'Your coupons have refreshed. Review the offer and confirm again.',
  OFFER_UNAVAILABLE: 'This offer is no longer available.',
  OFFER_ALREADY_USED: 'You have already used this offer in the current round.', IDEMPOTENCY_MISMATCH: 'This request changed. Reopen the screen and try again.',
  BILL_AMOUNT_REQUIRED: 'Enter the bill amount before confirming redemption.', INVALID_BILL_AMOUNT: 'Enter a positive bill amount with at most two decimal places.',
};
export function benefitsError(message: string) { return messages[message] ?? message; }
export function isCouponOfferUsed(
  benefits: Pick<AccountBenefits, 'usedOfferIds' | 'usedVendorIds'> | null | undefined,
  offerId: string,
  vendorId?: string | null,
) {
  if (!benefits) return false;
  if (Array.isArray(benefits.usedOfferIds)) return benefits.usedOfferIds.includes(offerId);
  // Older server responses are vendor-scoped; keep them safe until the new RPC is deployed.
  return Boolean(vendorId && benefits.usedVendorIds.includes(vendorId));
}
export async function benefitsRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw new Error(benefitsError(error.message));
  if (data?.error) throw new Error(benefitsError(data.error));
  return data as T;
}
export async function redeemSubscriptionCoupon(offerId: string, roundId: string, mutationId: string, billAmount: number, freeItemAmount?: number) {
  return benefitsRpc<{ id: string; code?: string; status: 'success'; consumedAt: number; vendorName: string; offerTitle: string; billAmount: number; estimatedSavings?: number; payableAmount?: number; currency: string; benefits: AccountBenefits }>(
    'kouponly_redeem_coupon', { p_offer_id: offerId, p_round_id: roundId, p_mutation_id: mutationId, p_bill_amount: billAmount, ...(freeItemAmount !== undefined ? { p_free_item_amount: freeItemAmount } : {}) });
}
type Value = { benefits: AccountBenefits | null; loading: boolean; error: string; isAdmin: boolean; refresh: () => Promise<void>; claim: (code: string, mutationId: string) => Promise<ClaimResult> };
const Context = createContext<Value | null>(null);
export function BenefitsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const sequence = useRef(0);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const [snapshot, setSnapshot] = useState<{ userId: string; value: AccountBenefits } | null>(null);
  const [adminOwner, setAdminOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const id = user?.id;
    if (!id) return;
    const seq = ++sequence.current;
    setLoading(true); setError('');
    try {
      const value = await benefitsRpc<AccountBenefits>('kouponly_account_benefits');
      if (owner.current === id && sequence.current === seq) setSnapshot({ userId: id, value });
    } catch (e) { if (owner.current === id && sequence.current === seq) { const message = e instanceof Error ? e.message : 'Unable to load account benefits.'; if (message === 'Verified email required' || message === 'Verified @rajagiri.edu.in email required' || message === 'Account access unavailable') setSnapshot(null); setError(message); throw e; } }
    finally { if (owner.current === id && sequence.current === seq) setLoading(false); }
  }, [user?.id]);
  useEffect(() => {
    setSnapshot(null); setAdminOwner(null); setError(''); setLoading(Boolean(user));
    if (!user) return;
    const id = user.id;
    void refresh().catch(() => {});
    void benefitsRpc<boolean>('kouponly_is_benefits_admin').then(value => { if (owner.current === id && value) setAdminOwner(id); }).catch(() => {});
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh().catch(() => {}); });
    // Poll only while foregrounded; owner-scoped state never crosses an account switch.
    const poll = setInterval(() => { if (AppState.currentState === 'active') void refresh().catch(() => {}); }, 30000);
    return () => { listener.remove(); clearInterval(poll); };
  }, [user?.id, refresh]);
  const claim = useCallback(async (code: string, mutationId: string) => {
    const id = user?.id;
    if (!id) throw new Error('Sign in to enter a code.');
    const result = await benefitsRpc<ClaimResult>('kouponly_claim_code', { p_code: code.trim().toUpperCase(), p_mutation_id: mutationId });
    if (owner.current !== id) throw new Error('The signed-in account changed.');
    sequence.current++;
    setSnapshot(current => current?.userId === id && Date.parse(current.value.serverTime) > Date.parse(result.benefits.serverTime)
      ? current : { userId: id, value: result.benefits });
    void refresh().catch(() => {});
    return result;
  }, [user?.id, refresh]);
  return <Context.Provider value={{ benefits: snapshot && snapshot.userId === user?.id ? snapshot.value : null, isAdmin: !!user && adminOwner === user.id, loading, error, refresh, claim }}>{children}</Context.Provider>;
}
export function useBenefits() { const value = useContext(Context); if (!value) throw new Error('useBenefits must be inside BenefitsProvider'); return value; }
export { makeMutationId };

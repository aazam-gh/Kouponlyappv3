import { isSchoolEmail, SCHOOL_EMAIL_MESSAGE } from './school-email';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';

export type VerificationRole = 'student' | 'creator';
export type CouponlyVerificationStatus = 'pending' | 'approving' | 'approved' | 'rejected' | 'cancelled' | 'profile_completed';

export async function invoke<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data: result, error } = await getSupabase().functions.invoke('kouponly-mobile-action', {
    body: { action, data },
  });
  if (error) {
    let message = error.message || 'The request could not be completed.';
    try {
      const details = await (error as any).context?.json?.();
      if (details?.error) message = details.error;
    } catch {}
    throw new Error(message);
  }
  return result as T;
}

export const checkCouponlyStudentExists = (email: string) =>
  invoke<{ exists: boolean }>('checkStudentExists', { email });
export const checkCouponlyStudentLogin = (email: string) =>
  invoke<{ exists: boolean }>('checkStudentExistsLogin', { email });

export async function sendCouponlyEmailCode(email: string, purpose: 'signup'|'login'|'verification') {
  if (purpose === 'verification' && !isSchoolEmail(email)) throw new Error(SCHOOL_EMAIL_MESSAGE);
  return invoke<{ success: true; expiresIn: number }>('sendOtp', { email, purpose });
}
export async function verifyCouponlyEmailCode(email: string, purpose: 'signup'|'login'|'verification', code: string) {
  const result=await invoke<{ success: true; verified: true; accessToken?: string; refreshToken?: string }>('verifyOtp', { email, purpose, code });
  if(result.accessToken&&result.refreshToken){
    const {error}=await getSupabase().auth.setSession({access_token:result.accessToken,refresh_token:result.refreshToken});
    if(error)throw error;
  }
  return result;
}
export async function completeCouponlySignup(profile: {
  email: string; firstName: string; lastName: string; accountRole?: VerificationRole;
  dob?: string; gender?: string;
}) {
  return invoke<{ success: true; alreadyExists?: boolean; creatorCode?: string|null }>('completeSignup', profile);
}
export async function assignCouponlyCreatorCode() {
  return invoke<{ creatorCode: string }>('assignCreatorCode');
}

export async function submitCouponlyVerificationRequest(input: {
  email: string; role: VerificationRole; idImageBase64?: string;
  imageExtension?: string; contentType?: string; details?: Record<string, unknown>;
}) {
  return invoke<{ success: true; requestId: string; statusToken: string }>('submitVerificationRequest', input);
}
export async function getCouponlyVerificationStatus(requestId: string, statusToken: string) {
  return invoke<{ status: CouponlyVerificationStatus; requestId: string; rejectionReason: string|null; role: VerificationRole }>(
    'checkVerificationStatus', { requestId, statusToken },
  );
}
export async function cancelCouponlyVerificationRequest(requestId: string, statusToken: string) {
  return invoke<{ success: true }>('cancelVerificationRequest', { requestId, statusToken });
}
export async function setCouponlyVendorRedemptionPin(vendorId: string, pin: string) {
  return invoke<{ success: true }>('setVendorRedemptionPin', { vendorId, pin });
}
export async function redeemCouponlyOffer(input: {
  vendorId: string; offerId?: string|null; offerIndex?: number|null; totalAmount: number;
  pin: string; creatorCode?: string|null; idempotencyKey?: string;
}) {
  return invoke<Record<string, unknown>>('redeemOffer', input);
}
export async function getCouponlyOnlineVendorOffer(vendorId: string) {
  return invoke<{ vendorId: string; vendorData: Record<string, unknown>; purchaseUrl: string|null; iosUrl: string|null; androidUrl: string|null; fulfillmentMode: 'link'|'coupon'; discountCode: string|null; ctaLabel: string|null; ctaLabelAr: string|null; instructions: string|null; instructionsAr: string|null; remainingToday: number }>(
    'getOnlineVendorOffer', { vendorId },
  );
}
export async function trackCouponlyOutboundClick(input: { vendorId: string; platform: 'ios'|'android'|'web'; requestId: string }) {
  return invoke<{ clickId: string; vendorId: string; clickedAt: string; purchaseUrl?: string }>('recordOnlineVendorOutboundClick', input);
}
export async function registerCouponlyPushToken(token: string, platform: 'ios'|'android'|'web') {
  return invoke<{ success: true }>('registerPushToken', { token, platform });
}
export async function unregisterCouponlyPushToken(token: string) {
  return invoke<{ success: true }>('unregisterPushToken', { token });
}

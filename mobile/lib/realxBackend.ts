import { getSupabase, supabaseConfigured } from '@/lib/supabase';

export type VerificationRole = 'student' | 'creator';
export type RealXVerificationStatus = 'pending' | 'approving' | 'approved' | 'rejected' | 'cancelled' | 'profile_completed';

async function invoke<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  if (!supabaseConfigured) throw new Error('Supabase is not configured.');
  const { data: result, error } = await getSupabase().functions.invoke('realx-mobile-action', {
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

export const checkRealXStudentExists = (email: string) =>
  invoke<{ exists: boolean }>('checkStudentExists', { email });
export const checkRealXStudentLogin = (email: string) =>
  invoke<{ exists: boolean }>('checkStudentExistsLogin', { email });

export async function sendRealXEmailCode(email: string, purpose: 'signup'|'login'|'verification') {
  return invoke<{ success: true; expiresIn: number }>('sendOtp', { email, purpose });
}
export async function verifyRealXEmailCode(email: string, purpose: 'signup'|'login'|'verification', code: string) {
  const result=await invoke<{ success: true; verified: true; accessToken?: string; refreshToken?: string }>('verifyOtp', { email, purpose, code });
  if(result.accessToken&&result.refreshToken){
    const {error}=await getSupabase().auth.setSession({access_token:result.accessToken,refresh_token:result.refreshToken});
    if(error)throw error;
  }
  return result;
}
export async function completeRealXSignup(profile: {
  email: string; firstName: string; lastName: string; accountRole?: VerificationRole;
  dob?: string; gender?: string;
}) {
  return invoke<{ success: true; alreadyExists?: boolean; creatorCode?: string|null }>('completeSignup', profile);
}
export async function assignRealXCreatorCode() {
  return invoke<{ creatorCode: string }>('assignCreatorCode');
}

export async function submitRealXVerificationRequest(input: {
  email: string; role: VerificationRole; idImageBase64?: string;
  imageExtension?: string; contentType?: string; details?: Record<string, unknown>;
}) {
  return invoke<{ success: true; requestId: string; statusToken: string }>('submitVerificationRequest', input);
}
export async function getRealXVerificationStatus(requestId: string, statusToken: string) {
  return invoke<{ status: RealXVerificationStatus; requestId: string; rejectionReason: string|null; role: VerificationRole }>(
    'checkVerificationStatus', { requestId, statusToken },
  );
}
export async function cancelRealXVerificationRequest(requestId: string, statusToken: string) {
  return invoke<{ success: true }>('cancelVerificationRequest', { requestId, statusToken });
}
export async function setRealXVendorRedemptionPin(vendorId: string, pin: string) {
  return invoke<{ success: true }>('setVendorRedemptionPin', { vendorId, pin });
}
export async function redeemRealXOffer(input: {
  vendorId: string; offerId?: string|null; offerIndex?: number|null; totalAmount: number;
  pin: string; creatorCode?: string|null; idempotencyKey?: string;
}) {
  return invoke<Record<string, unknown>>('redeemOffer', input);
}
export async function redeemRealXGiftCard(input: {
  vendorId: string; totalAmount: number; giftCardAmount: number; pin: string; idempotencyKey?: string;
}) {
  return invoke<Record<string, unknown>>('redeemGiftCard', input);
}
export async function getRealXOnlineVendorOffer(vendorId: string) {
  return invoke<{ vendorId: string; vendorData: Record<string, unknown>; purchaseUrl: string|null; iosUrl: string|null; androidUrl: string|null; fulfillmentMode: 'link'|'coupon'; discountCode: string|null; ctaLabel: string|null; ctaLabelAr: string|null; instructions: string|null; instructionsAr: string|null; remainingToday: number }>(
    'getOnlineVendorOffer', { vendorId },
  );
}
export async function trackRealXOutboundClick(input: { vendorId: string; platform: 'ios'|'android'|'web'; requestId: string }) {
  return invoke<{ clickId: string; vendorId: string; clickedAt: string; purchaseUrl?: string }>('recordOnlineVendorOutboundClick', input);
}
export async function claimBadrgoVoucher() {
  return invoke<{ success: true; alreadyClaimed: boolean; code: string; week: string }>('claimBadrgoVoucher');
}
export async function getRealXBadrgoVoucherProgram() {
  const {data,error}=await getSupabase().rpc('realx_get_badrgo_voucher_program');
  if(error)throw error;
  return data as Record<string,any>;
}
export const getRealXBadrgoPilotCampaign = () => invoke<Record<string, any>>('getBadrgoPilotCampaign');
export const claimRealXBadrgoPilotCoupon = () =>
  invoke<{ success: true; alreadyClaimed: boolean; code: string; pool: 'public'|'reserved'; claimedAt: string }>('claimBadrgoPilotCoupon');
export async function getRealXOpportunityAction(opportunityId:string,requestId:string) {
  return invoke<{actionUrl:string;tracked:boolean}>('getOpportunityAction',{opportunityId,requestId});
}
export async function trackRealXOpportunityEvent(opportunityId:string,event:'view'|'save'|'unsave'|'share',payload:Record<string,unknown>={}) {
  return invoke<{success:true}>('trackOpportunityEvent',{opportunityId,event,payload});
}
export async function checkRealXWaktiStudent(email:string) {
  return invoke<{isStudent:boolean}>('verifyWaktiStudent',{email});
}
export async function registerRealXPushToken(token: string, platform: 'ios'|'android'|'web') {
  return invoke<{ success: true }>('registerPushToken', { token, platform });
}
export async function unregisterRealXPushToken(token: string) {
  return invoke<{ success: true }>('unregisterPushToken', { token });
}

import * as Crypto from 'expo-crypto';
import type { KouponlyState, RedemptionMode } from '@/lib/store';
import type { CloudCatalogue, PendingMutation, StorageAsset } from '@/lib/cloud.types';
import { getSupabase, supabaseConfigured } from '@/lib/supabase';
import { projectVendorCatalogue, type MarketplaceVendorRow, type MarketplaceOfferRow } from '@/lib/vendor-catalogue';

export const makeMutationId = () => Crypto.randomUUID();
type Row = Record<string, any>;
type EdgeEnvelope<T> = { data: T; error?: { code?: string; message?: string } };

function fail(error: { message?: string } | null | undefined, action: string): never {
  throw new Error(error?.message || `${action} failed. Please try again.`);
}

async function rows(query: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>, action: string): Promise<Row[]> {
  const { data, error } = await query;
  if (error) fail(error, action);
  return data ?? [];
}

async function single<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>, action: string): Promise<T | null> {
  const { data, error } = await query;
  if (error) fail(error, action);
  return data;
}

const dateMs = (value: string | null | undefined) => value ? new Date(value).getTime() : undefined;

export async function fetchCloudState(): Promise<Partial<KouponlyState> | null> {
  const client = getSupabase();
  const [profile, saved, savedOffers, used, usage, interests, redemptions, rewards] = await Promise.all([
    single(client.from('profiles').select('points').maybeSingle(), 'Profile load'),
    rows(client.from('saved_deals').select('deal_id'), 'Saved places load'),
    rows(client.from('saved_offers').select('offer_id'), 'Saved offers load'),
    rows(client.from('used_deals').select('deal_id'), 'Redemption history load'),
    rows(client.from('offer_usage').select('offer_id,use_count,period_start'), 'Offer usage load'),
    rows(client.from('user_interests').select('interest_id'), 'Interests load'),
    rows(client.from('redemptions').select('redemption_id,mode,status,code,expires_at,completed_at,consumed_at'), 'Redemptions load'),
    rows(client.from('redeemed_rewards').select('reward_id'), 'Rewards load'),
  ]);

  const redemptionState: KouponlyState['redemptions'] = {};
  const currentPeriod = `${new Date().toISOString().slice(0, 7)}-01`;
  for (const row of redemptions) {
    const expiresAt = dateMs(row.expires_at);
    const status = row.status === 'code' && expiresAt !== undefined && expiresAt <= Date.now() ? 'expired' : row.status;
    redemptionState[row.redemption_id] = {
      id: row.redemption_id,
      mode: row.mode,
      status,
      ...(row.code ? { code: row.code } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(dateMs(row.completed_at) !== undefined ? { completedAt: dateMs(row.completed_at) } : {}),
      ...(dateMs(row.consumed_at) !== undefined ? { consumedAt: dateMs(row.consumed_at) } : {}),
    };
  }

  return {
    saved: saved.map(row => Number(row.deal_id)),
    savedOffers: savedOffers.map(row => String(row.offer_id)),
    used: used.map(row => Number(row.deal_id)),
    offerUsage: Object.fromEntries(usage.map(row => [String(row.offer_id), row.period_start < currentPeriod ? 0 : Number(row.use_count)])),
    interests: interests.map(row => String(row.interest_id)),
    redemptions: redemptionState,
    redeemedRewards: rewards.map(row => String(row.reward_id)),
    points: Number((profile as Row | null)?.points ?? 0),
  };
}

export async function applyMutation(mutation: PendingMutation): Promise<void> {
  const client = getSupabase();
  const { userId, entityId, operation, kind } = mutation;
  const entityColumn = kind === 'save-deal' ? 'deal_id' : kind === 'save-offer' ? 'offer_id' : 'interest_id';
  const table = kind === 'save-deal' ? 'saved_deals' : kind === 'save-offer' ? 'saved_offers' : 'user_interests';
  const entityValue = kind === 'save-deal' ? Number(entityId) : entityId;
  if (operation === 'delete') {
    const { error } = await client.from(table).delete().eq('user_id', userId).eq(entityColumn, entityValue);
    if (error) fail(error, 'Sync');
    return;
  }
  const { error } = await client.from(table).upsert({ user_id: userId, [entityColumn]: entityValue }, { onConflict: `user_id,${entityColumn}` });
  if (error) fail(error, 'Sync');
}

export async function fetchCloudCatalogue(): Promise<CloudCatalogue> {
  const client = getSupabase();
  const [vendors, offers, locations, categories, subcategories, assignments, bannerDocument] = await Promise.all([
    rows(client.from('realx_vendors').select('*').eq('status', 'Active').order('sort_order'), 'Vendor catalogue load'),
    rows(client.from('realx_offers').select('*').order('sort_order'), 'Vendor offer load'),
    rows(client.from('realx_vendor_locations').select('*').order('sort_order'), 'Vendor locations load'),
    rows(client.from('realx_categories').select('*').eq('active', true).order('sort_order'), 'Categories load'),
    rows(client.from('realx_subcategories').select('*').order('sort_order'), 'Subcategories load'),
    rows(client.from('realx_vendor_subcategories').select('*'), 'Vendor subcategories load'),
    single<Row>(client.from('realx_cms_documents').select('payload').eq('id', 'banner').maybeSingle(), 'Hero banners load'),
  ]);
  const projected = projectVendorCatalogue(vendors as MarketplaceVendorRow[], offers as MarketplaceOfferRow[], locations, { categories, subcategories, assignments });
  const featured = new Set(vendors.filter(vendor => vendor.featured).map(vendor => vendor.id));
  const banners = Array.isArray(bannerDocument?.payload?.banners)
    ? bannerDocument.payload.banners as Row[]
    : [];
  const bannerSlides = banners.flatMap(banner => {
    if (!banner.isActive || !banner.vendorId || !banner.images?.mobile) return [];
    const deal = projected.deals.find(item => item.vendorId === String(banner.vendorId));
    return deal ? [{
      brand: deal.name, kicker: deal.category, title: deal.offer, copy: deal.description,
      cta: 'View offers', image: String(banner.images.mobile), logo: deal.logo, dealId: deal.id,
    }] : [];
  });
  return {
    ...projected,
    heroSlides: bannerSlides.length ? bannerSlides : projected.deals.filter(deal => featured.has(deal.vendorId)).map(deal => ({
      brand: deal.name, kicker: deal.category, title: deal.offer, copy: deal.description,
      cta: 'View offers', image: deal.image, logo: deal.logo, dealId: deal.id,
    })),
    rewards: [], source: 'cloud',
    updatedAt: Math.max(0, ...[...vendors, ...offers, ...categories].map(row => dateMs(row.updated_at) ?? 0)),
  };
}

export async function validateRedemption(id: string, mode: RedemptionMode) {
  const { data, error } = await getSupabase().rpc('validate_redemption_atomic', {
    p_redemption_id: id,
    p_mode: mode,
    p_idempotency_key: makeMutationId(),
  });
  if (error) fail(error, 'Redemption');
  return data as { code: string | null; expiresAt: number | null; status: 'code' | 'success'; consumedAt: number };
}

export async function completeRedemptionCloud(id: string) {
  const { data, error } = await getSupabase().rpc('complete_redemption_atomic', {
    p_redemption_id: id,
    p_idempotency_key: makeMutationId(),
  });
  if (error) fail(error, 'Redemption');
  return data as { id: string; status: 'success'; completedAt: number };
}

export async function redeemRewardCloud(rewardId: string) {
  const { data, error } = await getSupabase().rpc('redeem_reward_atomic', { p_reward_id: rewardId, p_idempotency_key: makeMutationId() });
  if (error) fail(error, 'Reward redemption');
  return data as { rewardId: string; points: number; cost: number };
}

export async function deleteAccountCloud() {
  const client = getSupabase();
  const { data: { session }, error: sessionError } = await client.auth.getSession();
  if (sessionError || !session) fail(sessionError, 'Account deletion');
  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/kouponly-delete-account`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '', 'Content-Type': 'application/json' },
    body: '{}',
  });
  let result: EdgeEnvelope<{ deleted: boolean }> | null = null;
  try { result = await response.json() as EdgeEnvelope<{ deleted: boolean }>; } catch {}
  if (response.status === 404) throw new Error('Account deletion service is not deployed yet.');
  if (!response.ok || !result?.data?.deleted) throw new Error(result?.error?.message || 'Account deletion failed.');
  await client.auth.signOut();
  return result.data;
}

type LocalProfile = { full_name: string; email: string; city: string; mobile?: string; avatar_path?: string | null };
type LocalPreferences = { offer_alerts: boolean; location: string; language: string };

export async function updateProfile(value: Partial<LocalProfile>): Promise<void> {
  const client = getSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) fail(userError, 'Profile update');
  const fields = {
    ...(value.full_name !== undefined ? { full_name: value.full_name.trim() } : {}),
    ...(value.email !== undefined ? { email: value.email.trim() } : {}),
    ...(value.city !== undefined ? { city: value.city.trim() } : {}),
    ...(value.mobile !== undefined ? { mobile: value.mobile.trim() } : {}),
    ...(value.avatar_path !== undefined ? { avatar_path: value.avatar_path } : {}),
  };
  if (!Object.keys(fields).length) return;
  const { data, error } = await client.from('profiles').update(fields).eq('user_id', user.id).select('user_id').maybeSingle();
  if (error) fail(error, 'Profile update');
  if (!data) throw new Error('Your profile is missing. Sign out and back in to repair the account profile.');
}

export async function fetchProfile(): Promise<LocalProfile | null> {
  const client = getSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return null;
  return single(client.from('profiles').select('full_name,email,city,mobile,avatar_path').eq('user_id', user.id).maybeSingle(), 'Profile load') as Promise<LocalProfile | null>;
}

export async function updatePreferences(value: LocalPreferences): Promise<void> {
  const client = getSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) fail(userError, 'Preference update');
  const { error } = await client.from('user_preferences').upsert({ user_id: user.id, offer_alerts: value.offer_alerts, location: value.location, language: value.language }, { onConflict: 'user_id' });
  if (error) fail(error, 'Preference update');
}

export async function fetchPreferences(): Promise<LocalPreferences | null> {
  const client = getSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return null;
  return single(client.from('user_preferences').select('offer_alerts,location,language').eq('user_id', user.id).maybeSingle(), 'Preference load') as Promise<LocalPreferences | null>;
}

export async function sendFeedback(message: string): Promise<void> {
  const client = getSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) fail(userError, 'Feedback submission');
  const { error } = await client.from('feedback').insert({ user_id: user.id, message: message.trim() });
  if (error) fail(error, 'Feedback submission');
}

const userTables = ['profiles','user_preferences','saved_deals','saved_offers','used_deals','offer_usage','user_interests','redemptions','redeemed_rewards','notifications'] as const;
export function subscribeToUser(userId: string, onChange: () => void) {
  if (!supabaseConfigured) return { unsubscribe: () => {} };
  const client = getSupabase();
  let channel = client.channel(`kouponly-user-${userId}`);
  for (const table of userTables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` }, onChange);
  }
  channel.subscribe();
  return { unsubscribe: () => { void client.removeChannel(channel); } };
}

const catalogueTables = ['realx_categories','realx_subcategories','realx_vendor_subcategories','realx_vendors','realx_offers','realx_vendor_locations','realx_cms_documents'] as const;
export function subscribeToCatalogue(onChange: () => void) {
  if (!supabaseConfigured) return { unsubscribe: () => {} };
  const client = getSupabase();
  let channel = client.channel('kouponly-public-catalogue');
  for (const table of catalogueTables) channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  channel.subscribe();
  return { unsubscribe: () => { void client.removeChannel(channel); } };
}

export async function signedUrl(bucket: StorageAsset['bucket'], path: string): Promise<string> {
  const { data, error } = await getSupabase().storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) fail(error, 'Photo load');
  return data.signedUrl;
}

export async function removeStorageAsset(asset: Pick<StorageAsset, 'bucket' | 'path'>): Promise<void> {
  const client = getSupabase();
  const { error } = await client.storage.from(asset.bucket).remove([asset.path]);
  if (error) fail(error, 'Photo removal');
  if (asset.bucket === 'avatars') {
    const { data: { user } } = await client.auth.getUser();
    if (user) {
      const { error: profileError } = await client.from('profiles').update({ avatar_path: null }).eq('user_id', user.id).eq('avatar_path', asset.path);
      if (profileError) fail(profileError, 'Profile photo update');
    }
  }
}

function xhrUpload(asset: StorageAsset, bytes: Blob, onProgress?: (value: number) => void) {
  const client = getSupabase();
  const request = new XMLHttpRequest();
  let cancelled = false;
  const promise = new Promise<void>((resolve, reject) => {
    void (async () => {
      try {
        const [{ data: { session }, error }, baseUrl, apiKey] = await Promise.all([
          client.auth.getSession(),
          Promise.resolve(process.env.EXPO_PUBLIC_SUPABASE_URL!),
          Promise.resolve((process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!),
        ]);
        if (error || !session) fail(error, 'Upload authentication');
        if (cancelled) throw new Error('Upload cancelled.');
        const encodedPath = asset.path.split('/').map(encodeURIComponent).join('/');
        request.open('POST', `${baseUrl}/storage/v1/object/${asset.bucket}/${encodedPath}`);
        request.setRequestHeader('apikey', apiKey);
        request.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        request.setRequestHeader('Content-Type', asset.mimeType);
        request.setRequestHeader('cache-control', '3600');
        request.setRequestHeader('x-upsert', 'false');
        request.upload.onprogress = event => {
          if (event.lengthComputable) onProgress?.(event.total ? event.loaded / event.total : 0);
        };
        request.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
        request.onabort = () => reject(new Error('Upload cancelled.'));
        request.onload = () => {
          if (request.status < 200 || request.status >= 300) {
            try { reject(new Error(JSON.parse(request.responseText)?.message || 'Upload failed.')); }
            catch { reject(new Error('Upload failed.')); }
          } else resolve();
        };
        request.send(bytes);
      } catch (error) { reject(error); }
    })();
  });
  return { promise, request, cancel: () => { cancelled = true; request.abort(); } };
}

export function uploadStorageAsset(asset: StorageAsset, userId: string, onProgress?: (value: number) => void) {
  const client = getSupabase();
  const task = { cancelled: false, request: undefined as XMLHttpRequest | undefined };
  const promise = (async (): Promise<StorageAsset> => {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user || user.id !== userId) fail(userError, 'Upload authentication');
    const response = await fetch(asset.uri);
    const file = await response.blob();
    if (!file.size) throw new Error('The selected file could not be read. Choose it again and retry.');
    if (file.size > 5 * 1024 * 1024) throw new Error('The selected file is larger than the upload limit.');
    if (task.cancelled) throw new Error('Upload cancelled.');
    const upload = xhrUpload(asset, file, onProgress);
    // Keep the request reachable so the caller can cancel it while the transfer is active.
    task.request = upload.request;
    await upload.promise;
    try {
      await updateProfile({ avatar_path: asset.path });
    } catch (error) {
      await client.storage.from(asset.bucket).remove([asset.path]);
      throw error;
    }
    onProgress?.(1);
    return { ...asset, byteSize: file.size, status: 'uploaded', progress: 1 };
  })();
  return {
    promise,
    cancel: () => {
      task.cancelled = true;
      task.request?.abort();
    },
  };
}

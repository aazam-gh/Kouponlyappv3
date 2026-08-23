import * as Crypto from 'expo-crypto';
import type { KouponlyState, RedemptionMode } from '@/lib/store';
import type { StorageAsset } from '@/lib/cloud.types';

const unavailable = () => Promise.reject(new Error('This feature is unavailable in the local app.'));
export const makeMutationId = () => Crypto.randomUUID();
export async function fetchCloudState(..._args: unknown[]): Promise<Partial<KouponlyState> | null> { return null; }
export async function applyMutation(..._args: unknown[]): Promise<void> { return; }
export const validateRedemption = (...args: unknown[]) => Promise.resolve({ code: null, expiresAt: null, status: args[1] === 'online' ? 'code' as const : 'success' as const });
export const submitCampaign = (..._args: unknown[]) => unavailable() as Promise<{ status: string; attachmentIds?: string[] }>;
export const redeemRewardCloud = (..._args: unknown[]) => unavailable() as Promise<{ rewardId: string; points: number; cost: number }>;
export const sendGiftCloud = (..._args: unknown[]) => unavailable() as Promise<{ id: number; offer: string; recipient: string; sent_at: string }>;
export const acceptGiftCloud = (..._args: unknown[]) => unavailable() as Promise<{ giftId: string; status: string }>;
export const deleteAccountCloud = (..._args: unknown[]) => unavailable() as Promise<{ deleted: boolean }>;
type LocalProfile = { full_name: string; email: string; city: string; mobile?: string; avatar_path?: string | null; offer_alerts?: boolean; creator_updates?: boolean; location?: string; language?: string };
type LocalPreferences = { offer_alerts: boolean; creator_updates: boolean; location: string; language: string };
export async function updateProfile(..._args: unknown[]): Promise<void> { return unavailable(); }
export async function fetchProfile(..._args: unknown[]): Promise<LocalProfile | null> { return null; }
export async function updatePreferences(..._args: unknown[]): Promise<void> { return unavailable(); }
export async function fetchPreferences(..._args: unknown[]): Promise<LocalPreferences | null> { return null; }
export async function sendFeedback(..._args: unknown[]): Promise<void> { return; }
export function subscribeToUser(..._args: unknown[]) { return { unsubscribe: () => {} }; }
export function subscribeToCatalogue(..._args: unknown[]) { return { unsubscribe: () => {} }; }
export async function signedUrl(..._args: unknown[]): Promise<string> { return ''; }
export async function removeStorageAsset(..._args: unknown[]): Promise<void> { return unavailable(); }
export async function removeCampaignAttachment(..._args: unknown[]): Promise<void> { return unavailable(); }
export function uploadStorageAsset(asset: StorageAsset, _userId: string, _campaignId?: string, onProgress?: (value: number) => void) {
  onProgress?.(1);
  return { promise: Promise.resolve(asset), cancel: () => {} };
}

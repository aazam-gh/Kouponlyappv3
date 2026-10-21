import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerCouponlyPushToken, unregisterCouponlyPushToken } from '@/lib/couponlyBackend';
import { getSupabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const TOKEN_KEY = 'couponly.expoPushToken';
const LEGACY_TOKEN_KEY = 'realx.expoPushToken';
const SYNC_KEY = 'couponly.expoPushTokenSync';
const LEGACY_SYNC_KEY = 'realx.expoPushTokenSync';
const PERMISSION_PROMPTED_KEY = 'couponly.notificationPermissionPrompted';
const syncsInFlight = new Map<string, Promise<string | null>>();

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
}

async function isCouponlyStudent(userId: string) {
  const { data, error } = await getSupabase().from('realx_students').select('id').eq('id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export function syncCouponlyPushToken(userId: string, requestPermission = false, repeatPermissionPrompt = false): Promise<string | null> {
  const existingSync = syncsInFlight.get(userId);
  if (existingSync) {
    return requestPermission && repeatPermissionPrompt
      ? existingSync.then(() => syncCouponlyPushToken(userId, requestPermission, repeatPermissionPrompt))
      : existingSync;
  }
  const sync = performCouponlyPushTokenSync(userId, requestPermission, repeatPermissionPrompt).finally(() => {
    syncsInFlight.delete(userId);
  });
  syncsInFlight.set(userId, sync);
  return sync;
}

async function performCouponlyPushTokenSync(userId: string, requestPermission: boolean, repeatPermissionPrompt: boolean) {
  try {
    if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !Device.isDevice || !(await isCouponlyStudent(userId))) return null;
    await setupCouponlyNotificationChannels();
    let permissions = await Notifications.getPermissionsAsync();
    let { status } = permissions;
    if (status !== 'granted' && requestPermission && permissions.canAskAgain) {
      const alreadyPrompted = repeatPermissionPrompt ? null : await AsyncStorage.getItem(PERMISSION_PROMPTED_KEY);
      if (repeatPermissionPrompt || alreadyPrompted !== 'true') {
        permissions = await Notifications.requestPermissionsAsync();
        status = permissions.status;
        await AsyncStorage.setItem(PERMISSION_PROMPTED_KEY, 'true');
      }
    }
    if (status !== 'granted') return null;
    const easProjectId = projectId();
    if (!easProjectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
    // Always upsert: a local cache must not prevent recovery if the server row was removed.
    await registerCouponlyPushToken(token, platform);
    await Promise.all([AsyncStorage.setItem(TOKEN_KEY, token), AsyncStorage.setItem(SYNC_KEY, JSON.stringify({ token, userId, syncedAt: Date.now() })), AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_SYNC_KEY])]);
    return token;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (__DEV__) logger.error('[push] Could not sync the device push token:', detail);
    else console.error('[push] Could not sync the device push token:', detail);
    return null;
  }
}

export async function setupCouponlyNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('reelx_general_v2', { name: 'General', importance: Notifications.AndroidImportance.HIGH, sound: null }),
    Notifications.setNotificationChannelAsync('reelx_redemptions_v2', { name: 'Redemptions', importance: Notifications.AndroidImportance.HIGH, sound: null }),
  ]);
}

export async function unregisterCouponlyPushTokenForCurrentUser() {
  const token = (await AsyncStorage.getItem(TOKEN_KEY)) || (await AsyncStorage.getItem(LEGACY_TOKEN_KEY));
  if (!token) return;
  try {
    await unregisterCouponlyPushToken(token);
    await AsyncStorage.multiRemove([TOKEN_KEY, SYNC_KEY, LEGACY_TOKEN_KEY, LEGACY_SYNC_KEY]);
  } catch {
    // Keep the local record so sign-out can retry on the next visit.
  }
}

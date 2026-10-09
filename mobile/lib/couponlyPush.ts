import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerCouponlyPushToken, unregisterCouponlyPushToken } from '@/lib/couponlyBackend';
import { getSupabase } from '@/lib/supabase';

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
const MAX_SYNC_AGE = 7 * 24 * 60 * 60 * 1000;

type TokenSync = { token: string; userId: string; syncedAt: number };

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
}

async function isCouponlyStudent(userId: string) {
  const { data, error } = await getSupabase().from('realx_students').select('id').eq('id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function syncCouponlyPushToken(userId: string, requestPermission = false) {
  try {
    if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !Device.isDevice || !(await isCouponlyStudent(userId))) return null;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && requestPermission) ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;
    const easProjectId = projectId();
    if (!easProjectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    let cached: TokenSync | null = null;
    try { cached = JSON.parse((await AsyncStorage.getItem(SYNC_KEY)) || (await AsyncStorage.getItem(LEGACY_SYNC_KEY)) || 'null') as TokenSync | null; } catch {}
    if (cached?.token === token && cached.userId === userId && Date.now() - cached.syncedAt < MAX_SYNC_AGE) return token;
    const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
    await registerCouponlyPushToken(token, platform);
    await Promise.all([AsyncStorage.setItem(TOKEN_KEY, token), AsyncStorage.setItem(SYNC_KEY, JSON.stringify({ token, userId, syncedAt: Date.now() })), AsyncStorage.multiRemove([LEGACY_TOKEN_KEY, LEGACY_SYNC_KEY])]);
    return token;
  } catch {
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

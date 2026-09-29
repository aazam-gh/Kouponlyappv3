import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerRealXPushToken, unregisterRealXPushToken } from '@/lib/realxBackend';
import { getSupabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const TOKEN_KEY = 'realx.expoPushToken';
const SYNC_KEY = 'realx.expoPushTokenSync';
const MAX_SYNC_AGE = 7 * 24 * 60 * 60 * 1000;

type TokenSync = { token: string; userId: string; syncedAt: number };

function projectId() {
  return Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || undefined;
}

async function isRealXStudent(userId: string) {
  const { data, error } = await getSupabase().from('realx_students').select('id').eq('id', userId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function syncRealXPushToken(userId: string, requestPermission = false) {
  try {
    if ((Platform.OS !== 'ios' && Platform.OS !== 'android') || !Device.isDevice || !(await isRealXStudent(userId))) return null;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && requestPermission) ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return null;
    const easProjectId = projectId();
    if (!easProjectId) return null;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: easProjectId })).data;
    let cached: TokenSync | null = null;
    try { cached = JSON.parse((await AsyncStorage.getItem(SYNC_KEY)) || 'null') as TokenSync | null; } catch {}
    if (cached?.token === token && cached.userId === userId && Date.now() - cached.syncedAt < MAX_SYNC_AGE) return token;
    const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
    await registerRealXPushToken(token, platform);
    await Promise.all([AsyncStorage.setItem(TOKEN_KEY, token), AsyncStorage.setItem(SYNC_KEY, JSON.stringify({ token, userId, syncedAt: Date.now() }))]);
    return token;
  } catch {
    return null;
  }
}

export async function setupRealXNotificationChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('reelx_general', { name: 'General', importance: Notifications.AndroidImportance.HIGH, sound: 'sound.wav' }),
    Notifications.setNotificationChannelAsync('reelx_redemptions', { name: 'Redemptions', importance: Notifications.AndroidImportance.HIGH, sound: 'sound.wav' }),
  ]);
}

export async function unregisterRealXPushTokenForCurrentUser() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  try {
    await unregisterRealXPushToken(token);
    await AsyncStorage.multiRemove([TOKEN_KEY, SYNC_KEY]);
  } catch {
    // Keep the local record so sign-out can retry on the next visit.
  }
}

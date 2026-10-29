import { Platform } from 'react-native';
import { logger } from './logger';
import {
  AndroidImportance,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';

setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Register Android notification channels for local Expo notifications.
 */
export const setupNotificationChannels = async () => {
  if (Platform.OS !== 'android') return;

  await setNotificationChannelAsync('kouponly_general_v2', {
    name: 'General',
    importance: AndroidImportance.HIGH,
    sound: null,
  });
  await setNotificationChannelAsync('kouponly_redemptions_v2', {
    name: 'Redemptions',
    importance: AndroidImportance.HIGH,
    sound: null,
  });
};

const ensureNotificationPermission = async (): Promise<boolean> => {
  const { status } = await getPermissionsAsync();
  if (status === 'granted') return true;

  const result = await requestPermissionsAsync();
  return result.status === 'granted';
};

/**
 * Show a local notification immediately using expo-notifications.
 */
export const showLocalNotification = async (
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId?: string,
): Promise<boolean> => {
  try {
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) {
      logger.warn('Cannot show notification: permission not granted');
      return false;
    }

    await scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: false,
        ...(Platform.OS === 'android' && channelId ? { channelId } : {}),
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    logger.error('Error showing local notification:', error);
    return false;
  }
};

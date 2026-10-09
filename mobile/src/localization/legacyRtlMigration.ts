import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { I18nManager } from 'react-native';

import { logger } from '../../utils/logger';

const LEGACY_RTL_MIGRATION_KEY = 'app_rtl_runtime_migrated_v1';

export async function migrateLegacyGlobalRTL() {
  const alreadyMigrated = await AsyncStorage.getItem(LEGACY_RTL_MIGRATION_KEY).catch(() => null);
  if (alreadyMigrated === 'true') return false;

  const requiresReload = I18nManager.isRTL;

  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
  await AsyncStorage.setItem(LEGACY_RTL_MIGRATION_KEY, 'true').catch((error) => {
    logger.error('Unable to persist RTL migration state:', error);
  });

  if (!requiresReload) return false;

  try {
    await Updates.reloadAsync();
    return true;
  } catch (error) {
    logger.error('Unable to reload after legacy RTL migration:', error);
    return false;
  }
}

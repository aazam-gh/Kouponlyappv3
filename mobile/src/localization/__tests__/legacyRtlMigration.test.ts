/// <reference types="jest" />

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { I18nManager } from 'react-native';

import { migrateLegacyGlobalRTL } from '../legacyRtlMigration';

jest.mock('@react-native-async-storage/async-storage', () => (
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
));
jest.mock('expo-updates', () => ({
  reloadAsync: jest.fn(),
}));
const reloadAsync = Updates.reloadAsync as jest.MockedFunction<typeof Updates.reloadAsync>;

function setNativeRTL(value: boolean) {
  Object.defineProperty(I18nManager, 'isRTL', { configurable: true, value });
}

describe('legacy RTL migration', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await AsyncStorage.clear();
    setNativeRTL(false);
    jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => undefined);
    jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => undefined);
    reloadAsync.mockReset();
    reloadAsync.mockResolvedValue(undefined);
  });

  test('normalizes native direction once without reloading an unaffected install', async () => {
    await expect(migrateLegacyGlobalRTL()).resolves.toBe(false);
    expect(I18nManager.allowRTL).toHaveBeenCalledWith(false);
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    expect(reloadAsync).not.toHaveBeenCalled();

    jest.clearAllMocks();
    await expect(migrateLegacyGlobalRTL()).resolves.toBe(false);
    expect(I18nManager.forceRTL).not.toHaveBeenCalled();
  });

  test('reloads exactly once when an old install still has native RTL forced', async () => {
    setNativeRTL(true);

    await expect(migrateLegacyGlobalRTL()).resolves.toBe(true);
    expect(reloadAsync).toHaveBeenCalledTimes(1);

    await expect(migrateLegacyGlobalRTL()).resolves.toBe(false);
    expect(reloadAsync).toHaveBeenCalledTimes(1);
  });

  test('continues startup if the one-time normalization reload fails', async () => {
    setNativeRTL(true);
    reloadAsync.mockRejectedValueOnce(new Error('reload unavailable'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(migrateLegacyGlobalRTL()).resolves.toBe(false);
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    expect(consoleError).toHaveBeenCalled();
  });
});

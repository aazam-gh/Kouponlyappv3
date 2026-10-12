jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { eas: { projectId: 'test-eas-project' } } }, easConfig: null },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('@/lib/couponlyBackend', () => ({
  registerCouponlyPushToken: jest.fn(),
  unregisterCouponlyPushToken: jest.fn(),
}));
jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: jest.fn(async () => ({ data: { id: 'student-1' }, error: null })) }),
      }),
    }),
  }),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { registerCouponlyPushToken } from '@/lib/couponlyBackend';
import { syncCouponlyPushToken } from '@/lib/couponlyPush';

const mockNotifications = Notifications as jest.Mocked<typeof Notifications>;
const mockRegisterToken = registerCouponlyPushToken as jest.MockedFunction<typeof registerCouponlyPushToken>;

describe('syncCouponlyPushToken', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true } as any);
    mockNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-device]' } as any);
    mockRegisterToken.mockResolvedValue({ success: true });
  });

  it('requests permission and registers an Expo token for a signed-in student', async () => {
    await expect(syncCouponlyPushToken('student-1', true)).resolves.toBe('ExponentPushToken[test-device]');

    expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'test-eas-project' });
    expect(mockRegisterToken).toHaveBeenCalledWith('ExponentPushToken[test-device]', 'ios');
  });

  it('re-registers the token even when a local sync cache exists', async () => {
    await AsyncStorage.setItem('couponly.expoPushTokenSync', JSON.stringify({
      token: 'ExponentPushToken[test-device]', userId: 'student-1', syncedAt: Date.now(),
    }));
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as any);

    await expect(syncCouponlyPushToken('student-1')).resolves.toBe('ExponentPushToken[test-device]');

    expect(mockRegisterToken).toHaveBeenCalledTimes(1);
  });

  it('does not prompt again after a previous prompt was recorded', async () => {
    await AsyncStorage.setItem('couponly.notificationPermissionPrompted', 'true');

    await expect(syncCouponlyPushToken('student-1', true)).resolves.toBeNull();

    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });
});


describe('push registration recovery', () => {
  it('does not request a token when permission is denied', async () => {
    jest.clearAllMocks();
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false } as any);
    await expect(syncCouponlyPushToken('student-1', true)).resolves.toBeNull();
    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRegisterToken).not.toHaveBeenCalled();
  });

  it('deduplicates simultaneous registration attempts', async () => {
    jest.clearAllMocks();
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: false } as any);
    mockNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-device]' } as any);
    await Promise.all([syncCouponlyPushToken('student-1'), syncCouponlyPushToken('student-1')]);
    expect(mockRegisterToken).toHaveBeenCalledTimes(1);
  });
});

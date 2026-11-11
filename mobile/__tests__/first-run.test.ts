import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasCompletedFirstRun, markFirstRunComplete } from '@/lib/first-run';

beforeEach(async () => { await AsyncStorage.clear(); jest.clearAllMocks(); });

it.each(['kouponly.guest.state.v3', 'kouponly.prototype.state.v2', 'kouponly.user.previous-user.state.v3'])(
  'migrates %s once and uses the marker on later launches',
  async key => {
    await AsyncStorage.setItem(key, '{}');
    expect(await hasCompletedFirstRun()).toBe(true);
    expect(await hasCompletedFirstRun()).toBe(true);
    expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
  },
);

it('keeps welcome pending across launches until the visitor continues', async () => {
  expect(await hasCompletedFirstRun()).toBe(false);
  await AsyncStorage.setItem('kouponly.guest.state.v3', '{}');
  expect(await hasCompletedFirstRun()).toBe(false);
  await markFirstRunComplete();
  expect(await hasCompletedFirstRun()).toBe(true);
  expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(1);
});

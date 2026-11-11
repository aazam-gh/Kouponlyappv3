import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_RUN_KEY = 'kouponly.first-run-complete.v1';

export function markFirstRunComplete() {
  return AsyncStorage.setItem(FIRST_RUN_KEY, '1').catch(() => {});
}

export async function hasCompletedFirstRun() {
  try {
    const marker = await AsyncStorage.getItem(FIRST_RUN_KEY);
    if (marker === '1' || marker === '0') return marker === '1';
    const keys = await AsyncStorage.getAllKeys();
    const existing = keys.some(key =>
      key === 'kouponly.guest.state.v3' || /^kouponly\.prototype\.state\.v[123]$/.test(key) ||
      (key.startsWith('kouponly.user.') && key.endsWith('.state.v3')),
    );
    await AsyncStorage.setItem(FIRST_RUN_KEY, existing ? '1' : '0').catch(() => {});
    return existing;
  } catch {
    return true;
  }
}

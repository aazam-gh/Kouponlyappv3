import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'couponly_verification_pending';
const staleAfter = 30 * 24 * 60 * 60 * 1000;
export type PendingVerification = { email: string; role: string; requestId: string; statusToken: string; submittedAt: string };

export async function savePendingVerification(value: Omit<PendingVerification, 'submittedAt'>) {
  await AsyncStorage.setItem(key, JSON.stringify({ ...value, submittedAt: new Date().toISOString() }));
}

export async function getPendingVerification(): Promise<PendingVerification | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingVerification;
    if (!value.email || !value.role || !value.requestId || !value.statusToken || !value.submittedAt || Date.now() - Date.parse(value.submittedAt) > staleAfter) {
      await clearPendingVerification();
      return null;
    }
    return value;
  } catch { return null; }
}

export const clearPendingVerification = () => AsyncStorage.removeItem(key);

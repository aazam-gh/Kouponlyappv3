import { Linking, Platform } from 'react-native';
import { triggerSubtleHaptic } from './haptics';

export async function openWaktiStore(): Promise<boolean> {
  triggerSubtleHaptic();
  const urls = Platform.OS === 'android'
    ? ['market://details?id=ai.wakti.app', 'https://play.google.com/store/apps/details?id=ai.wakti.app']
    : ['itms-apps://itunes.apple.com/app/id6755150700', 'https://apps.apple.com/app/id6755150700'];
  for (const url of urls) {
    try { await Linking.openURL(url); return true; } catch { /* Try the browser store URL when the native store is unavailable. */ }
  }
  return false;
}

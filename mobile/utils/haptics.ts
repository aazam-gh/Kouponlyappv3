import * as Haptics from 'expo-haptics';
import { logger } from './logger';

export function triggerSubtleHaptic() {
  try {
    void Haptics.selectionAsync();
  } catch (error) {
    logger.warn('Haptic feedback failed', error);
  }
}

import { Stack } from 'expo-router';
import { useMotionPreferences } from '@/lib/theme';

export default function SubscriptionLayout() {
  const { reduceMotion } = useMotionPreferences();
  return <Stack screenOptions={{ headerShown: false, animation: reduceMotion ? 'fade' : 'default' }} />;
}

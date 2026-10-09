import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InviteCodeCard from '../components/InviteCodeCard';
import AppHeader from '../components/navigation/AppHeader';
import { useAppTheme } from '../context/AppThemeContext';
import { useRouter } from 'expo-router';

export default function InviteCodeScreen() {
  const router = useRouter(); const insets = useSafeAreaInsets(); const { theme } = useAppTheme();
  return <View style={{ flex: 1, backgroundColor: theme.background }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <AppHeader title="Invite friends" onBackPress={() => router.canGoBack() ? router.back() : router.replace('/realx/profile' as any)} />
    <View style={{ padding: 24 }}><InviteCodeCard /></View>
  </ScrollView></View>;
}

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Typography } from '../constants/Typography';
import { useAppTheme } from '../context/AppThemeContext';

export default function InviteCodePill() {
  const { theme } = useAppTheme(); const router = useRouter();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Your invite code" onPress={() => router.push('/invite-code' as any)} activeOpacity={0.75} style={{ minHeight: 68, borderRadius: 24, backgroundColor: theme.cardMuted, paddingHorizontal: 20, paddingVertical: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Ionicons name="ticket-outline" size={24} color={theme.icon} />
      <Text style={{ color: theme.text, fontSize: 16, ...Typography.getTextVariantStyle('bodyStrong') }}>Your invite code</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={theme.mutedText} />
  </TouchableOpacity>;
}

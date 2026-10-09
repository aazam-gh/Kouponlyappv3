import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../../components/navigation/AppHeader';
import { useAppTheme } from '../../context/AppThemeContext';
import { benefitsRpc, useBenefits } from '../../lib/benefits';

export default function MvpActivityScreen() {
  const router = useRouter(); const { theme } = useAppTheme(); const insets = useSafeAreaInsets(); const { isAdmin } = useBenefits();
  const [counts, setCounts] = useState<{ eligibleUsers: number; redemptionsThisMonth: number; referralRefreshes: number } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (isAdmin) void benefitsRpc<NonNullable<typeof counts>>('kouponly_admin_mvp_overview').then(value => { if (active) setCounts(value); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [isAdmin]);
  return <View style={{ flex: 1, backgroundColor: theme.background }}><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 24, paddingTop: Platform.OS === 'android' ? insets.top : 0, paddingBottom: insets.bottom + 24 }}>
    <AppHeader title="MVP activity" onBackPress={() => router.back()} />
    {!isAdmin ? <Text style={{ color: theme.text }}>Administrator access required.</Text> : <>
      <Text style={{ color: theme.text }}>Free Rajagiri membership. No payments or prepaid activation.</Text>
      {counts ? <View style={{ gap: 16, paddingTop: 24 }}>
        <Text style={{ color: theme.text }}>Verified eligible users: {counts.eligibleUsers}</Text>
        <Text style={{ color: theme.text }}>Redemptions this month: {counts.redemptionsThisMonth}</Text>
        <Text style={{ color: theme.text }}>Total referral refreshes: {counts.referralRefreshes}</Text>
      </View> : !error ? <ActivityIndicator color={theme.actionSolid} /> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
    </>}
  </ScrollView></View>;
}

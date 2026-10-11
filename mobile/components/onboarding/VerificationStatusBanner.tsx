import { Colors as BorderPalette } from '@/constants/Colors';
import ScalePressable from '@/components/ScalePressable';
import { useFocusEffect, router } from 'expo-router';
import { Clock3, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/context/AppThemeContext';
import { clearPendingVerification, getPendingVerification, type PendingVerification } from '@/lib/verification-pending';
import { getCouponlyVerificationStatus } from '@/lib/couponlyBackend';

export default function VerificationStatusBanner() {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const [pending, setPending] = React.useState<PendingVerification | null>(null);

  useFocusEffect(React.useCallback(() => {
    let active = true;
    void (async () => {
      const value = await getPendingVerification();
      if (!value) { if (active) setPending(null); return; }
      try {
        const result = await getCouponlyVerificationStatus(value.requestId, value.statusToken);
        if (['approved', 'rejected', 'cancelled', 'expired', 'profile_completed'].includes(result.status)) { await clearPendingVerification(); if (active) setPending(null); return; }
      } catch { /* Keep the status entry available while offline. */ }
      if (active) setPending(value);
    })();
    return () => { active = false; };
  }, []));

  if (!pending) return null;
  return <ScalePressable accessibilityRole="button" accessibilityHint="Open verification status" style={[styles.banner, { backgroundColor: theme.brandSoft, borderColor: BorderPalette.border }]} onPress={() => router.push({ pathname: '/realx/onboarding', params: { flow: 'verification', step: 'status', requestId: pending.requestId, statusToken: pending.statusToken } } as any)}>
    <Clock3 size={22} color={theme.brand} /><View style={styles.copy}><Text style={[styles.title, { color: theme.brandText }]}>{t('onboarding_pending_banner_title')}</Text><Text style={[styles.message, { color: theme.mutedText }]}>{t('onboarding_pending_banner_message')}</Text></View><ChevronRight size={20} color={theme.brand} />
  </ScalePressable>;
}

const styles = StyleSheet.create({ banner: { marginHorizontal: 20, marginTop: 12, borderRadius: 18, borderWidth: 1, minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, copy: { flex: 1 }, title: { fontSize: 14, lineHeight: 19, fontWeight: '700' }, message: { fontSize: 12, lineHeight: 17, marginTop: 2 } });

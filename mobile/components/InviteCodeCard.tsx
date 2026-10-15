import ScalePressable from '@/components/ScalePressable';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Share, Text, View } from 'react-native';
import { useAppTheme } from '../context/AppThemeContext';
import { Typography } from '../constants/Typography';
import { useBenefits } from '../lib/benefits';

export default function InviteCodeCard() {
  const { theme } = useAppTheme(); const router = useRouter();
  const { benefits, loading, error, refresh } = useBenefits();
  const [message, setMessage] = useState('');
  useFocusEffect(useCallback(() => { void refresh().catch(() => {}); }, [refresh]));
  const code = benefits?.inviteCode;
  const action = async (kind: 'copy' | 'share') => {
    if (!code) return;
    try {
      if (kind === 'copy') { await Clipboard.setStringAsync(code); setMessage('Invite code copied'); }
      else await Share.share({ message: `Join me on Kouponly! Enter my invite code ${code}. Free coupons with any verified email address.` });
    } catch { setMessage(kind === 'copy' ? 'Unable to copy your code. Try again.' : 'Unable to share your code. Try again.'); }
  };
  return <View style={{ gap: 20 }}>
    <View style={{ gap: 8, marginBottom: 2 }}>
      <Text style={{ color: theme.text, fontSize: 24, ...Typography.getTextVariantStyle('bodyStrong') }}>Invite friends</Text>
      <Text style={{ color: theme.mutedText, fontSize: 14, lineHeight: 21 }}>Share Kouponly with friends and help them discover great offers.</Text>
    </View>
    <View style={{ borderRadius: 24, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, padding: 20, gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 18, ...Typography.getTextVariantStyle('bodyStrong') }}>Your invite code</Text>
    {code ? <>
      <Text selectable testID="personal-invite-code" accessibilityLabel={`Invite code ${code}`} style={{ color: theme.brandText, fontSize: 30, letterSpacing: 5, ...Typography.getTextVariantStyle('bodyStrong') }}>{code}</Text>
      <Text style={{ color: theme.mutedText, fontSize: 13, lineHeight: 20 }}>Invite up to {benefits.referralLimit} friends using any email address. When they verify their email and use your code, all your coupons for this month refresh. Unused coupons do not accumulate.</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['copy', 'share'] as const).map(kind => <ScalePressable key={kind} accessibilityRole="button" onPress={() => void action(kind)} style={{ minHeight: 44, flex: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceElevated }}>
          <Text style={{ color: theme.text, ...Typography.getTextVariantStyle('bodyStrong') }}>{kind === 'copy' ? 'Copy code' : 'Share code'}</Text>
        </ScalePressable>)}
      </View>
      <Text style={{ color: theme.mutedText, fontSize: 12 }}>{benefits.rewardedReferrals} / {benefits.referralLimit} total referral refreshes</Text>
    </> : loading ? <ActivityIndicator accessibilityLabel="Loading invite code" color={theme.actionSolid} /> : <Text style={{ color: theme.mutedText }}>Your invite code is unavailable.</Text>}
    {error ? <><Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text><ScalePressable accessibilityRole="button" onPress={() => void refresh().catch(() => {})} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.text }}>Retry invite code</Text></ScalePressable></> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: theme.mutedText }}>{message}</Text> : null}
    </View>
    <View style={{ borderRadius: 24, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, padding: 20, gap: 8 }}>
      <Text style={{ color: theme.text, ...Typography.getTextVariantStyle('bodyStrong') }}>Have a friend’s invite code?</Text>
      <Text style={{ color: theme.mutedText, fontSize: 13, lineHeight: 20 }}>Enter their five-character code. Each account can use one friend’s code.</Text>
      <ScalePressable accessibilityRole="button" onPress={() => router.push('/enter-code' as any)} style={{ minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.actionSolid, marginTop: 4 }}><Text style={{ color: theme.buttonText, ...Typography.getTextVariantStyle('bodyStrong') }}>Enter a code</Text></ScalePressable>
    </View>
  </View>;
}

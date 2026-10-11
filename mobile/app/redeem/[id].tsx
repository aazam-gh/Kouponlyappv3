import { Colors as BorderPalette } from '@/constants/Colors';
import Animated from 'react-native-reanimated';
import { CONTENT_ENTER } from '@/utils/motion';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../../components/navigation/AppHeader';
import { useAppTheme } from '../../context/AppThemeContext';
import { Typography } from '../../constants/Typography';
import { useAuth } from '../../lib/auth';
import { useCatalogue } from '../../lib/catalogue';
import { dealById } from '../../lib/data';
import { benefitsError, makeMutationId, redeemSubscriptionCoupon, useBenefits } from '../../lib/benefits';
import { usePostHog } from 'posthog-react-native';
import { useStore } from '../../lib/store';
import ProfileSprites from '@/components/profile/ProfileSprites';

export default function RedeemScreen() {
  const posthog = usePostHog();
  const { id, offerIndex } = useLocalSearchParams<{ id: string; offerIndex?: string }>();
  const router = useRouter(); const { theme } = useAppTheme(); const styles = makeStyles(theme); const insets = useSafeAreaInsets(); const { user } = useAuth();
  const { status: catalogueStatus } = useCatalogue(); const { benefits, refresh, loading, error: benefitsFailure } = useBenefits(); const { retrySync } = useStore();
  const deal = dealById(id); const offer = deal?.offers?.find(item => item.index === Number(offerIndex ?? 0)) ?? deal?.offers?.[0];
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof redeemSubscriptionCoupon>> | null>(null);
  const request = useRef({ round: '', mutation: '' }); const inFlight = useRef(false);
  const context = `${user?.id ?? ''}:${id}:${offer?.id ?? ''}`; const currentContext = useRef(context); currentContext.current = context;
  useEffect(() => { setReceipt(null); setError(''); setBusy(false); request.current = { round: '', mutation: '' }; inFlight.current = false; }, [context]);
  const subscription = benefits?.subscription; const used = !!deal?.vendorId && benefits?.usedVendorIds.includes(deal.vendorId);
  const confirm = async () => {
    if (inFlight.current || !subscription || !offer) return;
    if (!request.current.mutation) request.current = { round: subscription.roundId, mutation: makeMutationId() };
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await redeemSubscriptionCoupon(offer.id, request.current.round, request.current.mutation);
      if (currentContext.current !== context) return;
      setReceipt(result);
      try { posthog?.capture('coupon_redeemed'); } catch {}
      await Promise.allSettled([refresh(), retrySync()]);
    } catch (e) { if (currentContext.current === context) { const message = e instanceof Error ? e.message : 'Unable to confirm this coupon. Try again.'; setError(message); if (message === benefitsError('ROUND_CHANGED')) request.current = { round: '', mutation: '' }; await refresh().catch(() => {}); } }
    finally { if (currentContext.current === context) { setBusy(false); inFlight.current = false; } }
  };
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/realx' as any);
  return <View style={[styles.screen, {paddingTop:insets.top}]}>
    <ProfileSprites />
    <AppHeader title={receipt ? '' : 'Redeem coupon'} onBackPress={goBack} />
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24, paddingTop:12 }]}>
      <Animated.View key={receipt ? "receipt" : "confirm"} entering={CONTENT_ENTER} style={{ gap: 20 }}>{receipt ? <>
        <View style={styles.ticket}>
          <Vendor name={receipt.vendorName} logo={deal?.logo} />
          <View style={styles.codeCard}>
            <Text style={styles.eyebrow}>VENDOR CONFIRMATION CODE</Text>
            <Text selectable accessibilityLabel="Unique redemption code" style={styles.code}>{receipt.code ?? '—'}</Text>
            <Text style={styles.centerCopy}>Show this code to the vendor if requested.</Text>
          </View>
          <View style={styles.timestamp}><Ionicons name="time-outline" size={18} color={theme.mutedText} /><Text selectable accessibilityLabel="Redeemed at" style={styles.body}>{new Date(receipt.consumedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</Text></View>
        </View>
        <Action label="Done" onPress={goBack} />
      </> : !user ? <><Text style={styles.body}>Sign in with your school email to redeem a free coupon.</Text><Action label="Sign in" onPress={() => router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any)} /></>
      : !deal || !offer ? <Text style={styles.body}>{catalogueStatus === 'loading' ? 'Loading offer…' : 'This offer is unavailable.'}</Text>
      : <>
        {deal.image ? <Image accessible={false} source={{uri: deal.image}} style={styles.hero} /> : null}
        <Vendor name={deal.name} logo={deal.logo} />
        <View style={styles.offerPanel}>
          <View style={styles.mode}><Ionicons name="storefront-outline" size={16} color={theme.brand} /><Text style={styles.eyebrow}>IN-STORE COUPON</Text></View>
          <Text style={styles.offerTitle}>{offer.title.toUpperCase()}</Text>
          {offer.description ? <Text style={styles.body}>{offer.description}</Text> : null}
          {offer.redemptionInstructions ? <Text style={styles.body}>{offer.redemptionInstructions}</Text> : null}
        </View>
        {loading && !benefits ? <ActivityIndicator color={theme.actionSolid} /> : subscription ? <>
          <View style={styles.notice}><Ionicons name="information-circle-outline" size={22} color={theme.brand} /><View style={{flex:1,gap:4}}><Text style={styles.noticeTitle}>Ready at the counter?</Text><Text style={styles.body}>Confirming uses your coupon at this vendor for this month. Only redeem when you’re there.</Text></View></View>
          {used ? <><Text style={styles.error}>Your coupon at this vendor is already used.</Text>{error && request.current.mutation ? <Action label="Recover confirmation" disabled={busy} onPress={() => void confirm()} /> : null}</> : offer.redemption === 'online' ? <Text style={styles.body}>Online coupon redemption is not available.</Text> : <Action label={busy ? 'Confirming…' : 'Confirm redemption'} disabled={busy} onPress={() => void confirm()} />}
        </> : !benefitsFailure ? <Text style={styles.body}>Verify your @rajagiri.edu.in email to access free coupons.</Text> : null}
        {error || benefitsFailure ? <><Text selectable accessibilityRole="alert" style={styles.error}>{error || benefitsFailure}</Text><Action label="Refresh coupons" onPress={() => void refresh().catch(() => {})} /></> : null}
      </>}</Animated.View>
    </ScrollView>
  </View>;
}
function Vendor({name, logo}: {name: string; logo?: string}) {
  const {theme} = useAppTheme(); const styles = makeStyles(theme);
  return <View style={styles.vendor}><Text accessibilityRole="header" style={styles.vendorName}>{name.toUpperCase()}</Text>{logo ? <View style={styles.logoTile}><Image accessible={false} source={{uri:logo}} resizeMode="contain" style={styles.logo} /></View> : null}</View>;
}
function makeStyles(theme: ReturnType<typeof useAppTheme>['theme']) {
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:theme.background},
    content:{paddingHorizontal:20,gap:20},
    hero:{width:'100%',height:170,borderRadius:28},
    vendor:{flexDirection:'row',alignItems:'center',gap:16},
    vendorName:{flex:1,color:theme.text,fontSize:26,letterSpacing:.5,...Typography.getTextVariantStyle('display')},
    logoTile:{width:64,height:64,borderRadius:16,borderWidth:1,borderColor:theme.border,backgroundColor:theme.card,alignItems:'center',justifyContent:'center'},
    logo:{width:48,height:48},
    offerPanel:{backgroundColor:theme.cardMuted,borderColor:BorderPalette.border,borderWidth:1,borderRadius:28,padding:24,gap:14},
    mode:{flexDirection:'row',gap:8,alignItems:'center'},
    eyebrow:{color:theme.mutedText,fontSize:11,letterSpacing:1,...Typography.getTextVariantStyle('bodyStrong')},
    offerTitle:{color:theme.text,fontSize:20,lineHeight:30,...Typography.getTextVariantStyle('bodyStrong')},
    body:{color:theme.mutedText,fontSize:14,lineHeight:22,...Typography.getTextVariantStyle('body')},
    notice:{flexDirection:'row',gap:12,paddingHorizontal:4},
    noticeTitle:{color:theme.text,fontSize:15,...Typography.getTextVariantStyle('bodyStrong')},
    error:{color:theme.danger,fontSize:14,...Typography.getTextVariantStyle('body')},
    centerCopy:{color:theme.mutedText,fontSize:13,lineHeight:21,textAlign:'center',...Typography.getTextVariantStyle('body')},
    ticket:{backgroundColor:theme.cardMuted,borderColor:BorderPalette.border,borderWidth:1,borderRadius:28,padding:20,gap:16},
    codeCard:{backgroundColor:theme.brandSoft,borderColor:BorderPalette.border,borderWidth:1,borderRadius:20,padding:16,alignItems:'center',gap:12},
    code:{color:theme.brand,fontSize:40,letterSpacing:8,...Typography.getTextVariantStyle('display')},
    timestamp:{flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',flexWrap:'wrap'},
  });
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useAppTheme(); return <ScalePressable accessibilityRole="button" accessibilityState={{disabled, busy:disabled}} disabled={disabled} onPress={onPress} style={{ minHeight: 54, padding: 14, borderRadius: 30, backgroundColor: theme.actionSolid, opacity: disabled ? 0.5 : 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.buttonText, ...Typography.getTextVariantStyle('bodyStrong') }}>{label}</Text></ScalePressable>;
}

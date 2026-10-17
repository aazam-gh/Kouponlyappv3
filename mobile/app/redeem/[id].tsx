import { Colors as BorderPalette } from '@/constants/Colors';
import Animated from 'react-native-reanimated';
import { CONTENT_ENTER } from '@/utils/motion';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '../../components/navigation/AppHeader';
import { useAppTheme } from '../../context/AppThemeContext';
import { Typography } from '../../constants/Typography';
import { useAuth } from '../../lib/auth';
import { useCatalogue } from '../../lib/catalogue';
import { dealById } from '../../lib/data';
import { benefitsError, isCouponOfferUsed, makeMutationId, redeemSubscriptionCoupon, useBenefits } from '../../lib/benefits';
import { usePostHog } from 'posthog-react-native';
import { useStore } from '../../lib/store';
import ProfileSprites from '@/components/profile/ProfileSprites';
import { OnboardingField } from '@/components/onboarding/OnboardingUI';
import { offerAmounts } from '@/utils/offer-amounts';
import { parseBillAmount } from '@/utils/bill-amount';

export default function RedeemScreen() {
  const posthog = usePostHog();
  const { id, offerIndex } = useLocalSearchParams<{ id: string; offerIndex?: string }>();
  const router = useRouter(); const { theme } = useAppTheme(); const styles = makeStyles(theme); const insets = useSafeAreaInsets(); const { user } = useAuth();
  const { status: catalogueStatus } = useCatalogue(); const { benefits, refresh, loading, error: benefitsFailure } = useBenefits(); const { retrySync } = useStore();
  const deal = dealById(id); const offer = deal?.offers?.find(item => item.index === Number(offerIndex ?? 0)) ?? deal?.offers?.[0];
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof redeemSubscriptionCoupon>> | null>(null);
  const [freeItemAmount, setFreeItemAmount] = useState('');
  const [billAmount, setBillAmount] = useState(''); const [billError, setBillError] = useState('');
  const request = useRef<{ round: string; mutation: string; billAmount: number | null }>({ round: '', mutation: '', billAmount: null }); const inFlight = useRef(false);
  const context = `${user?.id ?? ''}:${id}:${offer?.id ?? ''}`; const currentContext = useRef(context); currentContext.current = context;
  useEffect(() => { setReceipt(null); setError(''); setBusy(false); setBillAmount(''); setFreeItemAmount(''); setBillError(''); request.current = { round: '', mutation: '', billAmount: null }; inFlight.current = false; }, [context]);
  const parsedBill = parseBillAmount(billAmount);
  const amounts = offer && parsedBill ? offerAmounts(offer, parsedBill, parseBillAmount(freeItemAmount)) : null;
  const subscription = benefits?.subscription; const used = !!offer?.id && isCouponOfferUsed(benefits, offer.id, deal?.vendorId);
  const confirm = async () => {
    if (inFlight.current || !subscription || !offer) return;
    const amount = request.current.billAmount ?? parseBillAmount(billAmount);
    if (amount === null) { setBillError('Enter a positive bill amount with at most two decimal places.'); return; }
    if (!amounts && !request.current.mutation) { setBillError('Check the eligible bill total and offer value. For Buy 1 Get 1, enter the cheaper item’s price.'); return; }
    if (!request.current.mutation) request.current = { round: subscription.roundId, mutation: makeMutationId(), billAmount: amount };
    Keyboard.dismiss(); setBillError('');
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await redeemSubscriptionCoupon(offer.id, request.current.round, request.current.mutation, amount, ...(offer.discountType === 'buy1get1' ? [parseBillAmount(freeItemAmount) ?? undefined] : []));
      if (currentContext.current !== context) return;
      setReceipt(result);
      try { posthog?.capture('coupon_redeemed'); } catch {}
      await Promise.allSettled([refresh(), retrySync()]);
    } catch (e) { if (currentContext.current === context) { const message = e instanceof Error ? e.message : 'Unable to confirm this coupon. Try again.'; setError(message); if (message === benefitsError('ROUND_CHANGED')) request.current = { round: '', mutation: '', billAmount: null }; await refresh().catch(() => {}); } }
    finally { if (currentContext.current === context) { setBusy(false); inFlight.current = false; } }
  };
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/realx' as any);
  return <View style={[styles.screen, {paddingTop:insets.top}]}>
    <ProfileSprites />
    <AppHeader title={receipt ? '' : 'Redeem coupon'} onBackPress={goBack} />
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24, paddingTop:12 }]}>
      <Animated.View key={receipt ? "receipt" : "confirm"} entering={CONTENT_ENTER} style={{ gap: 20 }}>{receipt ? <>
        <View style={styles.ticket}>
          <Vendor name={receipt.vendorName} logo={deal?.logo} />
          <View style={styles.codeCard}>
            <Text style={styles.eyebrow}>VENDOR CONFIRMATION CODE</Text>
            <Text selectable accessibilityLabel="Unique redemption code" style={styles.code}>{receipt.code ?? '—'}</Text>
            <Text style={styles.centerCopy}>Show this code to the vendor if requested.</Text>
          </View>
          <Text testID="redemption-bill-amount" style={styles.body}>Bill amount before discount: {receipt.currency} {receipt.billAmount.toFixed(2)}</Text>
          {receipt.payableAmount != null ? <Text style={styles.body}>Payable: {receipt.currency} {receipt.payableAmount.toFixed(2)} · Saved: {receipt.currency} {(receipt.estimatedSavings ?? 0).toFixed(2)}</Text> : null}
          <View style={styles.timestamp}><Ionicons name="time-outline" size={18} color={theme.mutedText} /><Text selectable accessibilityLabel="Redeemed at" style={styles.body}>{new Date(receipt.consumedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</Text></View>
        </View>
        <Action label="Done" onPress={goBack} />
      </> : !user ? <><Text style={styles.body}>Sign in to redeem a free coupon.</Text><Action label="Sign in" onPress={() => router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any)} /></>
      : !deal || !offer ? <Text style={styles.body}>{catalogueStatus === 'loading' ? 'Loading offer…' : 'This offer is unavailable.'}</Text>
      : <>
        <Vendor name={deal.name} logo={deal.logo} />
        <View style={styles.offerPanel}>
          <View style={styles.mode}><Ionicons name="storefront-outline" size={16} color={theme.brand} /><Text style={styles.eyebrow}>IN-STORE COUPON</Text></View>
          <Text style={styles.offerTitle}>{offer.title.toUpperCase()}</Text>
          {['fixed_price', 'combo'].includes(offer.discountType || '') ? <Text style={styles.body}>Kouponly Exclusive Price: {offer.currency || 'INR'} {offer.discountValue}</Text> : null}
          {offer.description ? <Text style={styles.body}>{offer.description}</Text> : null}
          {offer.redemptionInstructions ? <Text style={styles.body}>{offer.redemptionInstructions}</Text> : null}
        </View>
        {loading && !benefits ? <ActivityIndicator color={theme.actionSolid} /> : subscription ? <>
          <View style={styles.notice}><Ionicons name="information-circle-outline" size={22} color={theme.brand} /><View style={{flex:1,gap:4}}><Text style={styles.noticeTitle}>Ready at the counter?</Text><Text style={styles.body}>Confirming uses this offer’s coupon for this month. Only redeem when you’re there.</Text></View></View>
          {used ? <><Text style={styles.error}>This offer’s coupon is already used. Available again {new Date(subscription.endsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. {benefits.rewardedReferrals < benefits.referralLimit ? 'Invite friends to earn an earlier coupon refresh.' : 'Your referral refresh limit has been reached.'}</Text><Action label="Invite friends" onPress={() => router.push('/invite-code')} />{error && request.current.mutation ? <Action label="Recover confirmation" disabled={busy} onPress={() => void confirm()} /> : null}</> : offer.redemption === 'online' ? <Text style={styles.body}>Online coupon redemption is not available.</Text> : <>
            <OnboardingField label={offer.currency ? `Bill amount (${offer.currency})` : 'Bill amount'} testID="bill-amount" value={billAmount} onChangeText={value => { setBillAmount(value); setBillError(''); }} error={billError} keyboardType="decimal-pad" maxLength={13} editable={!busy && !request.current.mutation} placeholder="0.00" />
            {offer.discountType === 'buy1get1' ? <OnboardingField label="Cheaper item price (free item)" value={freeItemAmount} onChangeText={value => { setFreeItemAmount(value); setBillError(''); }} keyboardType="decimal-pad" editable={!busy && !request.current.mutation} placeholder="0.00" /> : null}
            {amounts ? <Text testID="offer-amounts" style={styles.body}>Payable: {offer.currency || 'INR'} {amounts.payable.toFixed(2)} · Saved: {offer.currency || 'INR'} {amounts.saved.toFixed(2)}</Text> : null}
            <Text style={styles.body}>{request.current.mutation ? 'This bill amount is locked while confirmation is recovered.' : 'Enter the eligible items’ total before discount. For Buy 1 Get 1, enter the total for the pair; free offers cover only the eligible free items.'}</Text>
            <Action label={busy ? 'Confirming…' : 'Confirm redemption'} disabled={busy} onPress={() => void confirm()} />
          </>}
        </> : !benefitsFailure ? <Text style={styles.body}>Verify your email to access free coupons.</Text> : null}
        {error || benefitsFailure ? <><Text selectable accessibilityRole="alert" style={styles.error}>{error || benefitsFailure}</Text><Action label="Refresh coupons" onPress={() => void refresh().catch(() => {})} /></> : null}
      </>}</Animated.View>
    </ScrollView>
  </View>;
}
function Vendor({name, logo}: {name: string; logo?: string}) {
  const {theme} = useAppTheme(); const styles = makeStyles(theme);
  return <View style={styles.vendor}><Text accessibilityRole="header" style={styles.vendorName}>{name.toUpperCase()}</Text>{logo ? <View style={styles.logoTile}><Image accessible={false} source={{uri:logo}} resizeMode="cover" style={styles.logo} /></View> : null}</View>;
}
function makeStyles(theme: ReturnType<typeof useAppTheme>['theme']) {
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:theme.background},
    content:{paddingHorizontal:20,gap:20},
    vendor:{flexDirection:'row',alignItems:'center',gap:16},
    vendorName:{flex:1,color:theme.text,fontSize:26,letterSpacing:.5,...Typography.getTextVariantStyle('display')},
    logoTile:{width:64,height:64,borderRadius:16,borderWidth:1,borderColor:theme.border,backgroundColor:theme.card,overflow:'hidden'},
    logo:{width:'100%',height:'100%',borderRadius:15},
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

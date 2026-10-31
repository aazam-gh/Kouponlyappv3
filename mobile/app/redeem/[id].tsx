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
import { dealAtBranch, offerBranchLabel } from '../../lib/vendor-branches';
import { dealById } from '../../lib/data';
import { benefitsError, isCouponOfferUsed, makeMutationId, redeemSubscriptionCoupon, useBenefits } from '../../lib/benefits';
import { usePostHog } from 'posthog-react-native';
import { useStore } from '../../lib/store';
import { OnboardingField } from '@/components/onboarding/OnboardingUI';
import { offerAmounts } from '@/utils/offer-amounts';
import { parseBillAmount } from '@/utils/bill-amount';
import { syncCouponlyPushToken } from '@/lib/couponlyPush';

export default function RedeemScreen() {
  const posthog = usePostHog();
  const { id, offerIndex, branch } = useLocalSearchParams<{ id: string; offerIndex?: string; branch?: string }>();
  const router = useRouter(); const { theme } = useAppTheme(); const styles = makeStyles(theme); const insets = useSafeAreaInsets(); const { user } = useAuth();
  const { status: catalogueStatus } = useCatalogue(); const { benefits, refresh, loading, error: benefitsFailure } = useBenefits(); const { retrySync } = useStore();
  const vendorDeal = dealById(id);
  const deal = vendorDeal ? dealAtBranch(vendorDeal, branch) : undefined;
  const offer = deal?.offers?.find(item => item.index === Number(offerIndex ?? 0));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [receipt, setReceipt] = useState<Awaited<ReturnType<typeof redeemSubscriptionCoupon>> | null>(null);
  const [freeItemAmount, setFreeItemAmount] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selectedBranch = (branch ? deal?.locations?.find(location => location.id === branch || location.branchId === branch) : undefined) || (deal?.locations?.length === 1 ? deal.locations[0] : undefined);
  const branchKey = selectedBranch?.branchId || selectedBranch?.id || '';
  const branchMissing = !!deal?.locations?.length && !selectedBranch;
  const branchLabel = selectedBranch?.name || selectedBranch?.address || (offer ? offerBranchLabel(offer, deal?.locations) : '');
  const [billAmount, setBillAmount] = useState(''); const [billError, setBillError] = useState('');
  const request = useRef<{ round: string; mutation: string; billAmount: number | null }>({ round: '', mutation: '', billAmount: null }); const inFlight = useRef(false);
  const context = `${user?.id ?? ''}:${id}:${offer?.id ?? ''}:${branch ?? ''}`; const currentContext = useRef(context); currentContext.current = context;
  useEffect(() => { setReceipt(null); setDetailsOpen(false); setError(''); setBusy(false); setBillAmount(''); setFreeItemAmount(''); setBillError(''); request.current = { round: '', mutation: '', billAmount: null }; inFlight.current = false; }, [context]);
  const parsedBill = parseBillAmount(billAmount);
  const amounts = offer && parsedBill ? offerAmounts(offer, parsedBill, parseBillAmount(freeItemAmount)) : null;
  const subscription = benefits?.subscription; const used = !!offer?.id && isCouponOfferUsed(benefits, offer.id, deal?.vendorId, branchKey);
  const confirm = async () => {
    if (inFlight.current || !subscription || !offer) return;
    if (branchMissing) { setError('Select a branch on the vendor page before redeeming.'); return; }
    const amount = request.current.billAmount ?? parseBillAmount(billAmount);
    if (amount === null) { setBillError('Enter a positive bill amount with at most two decimal places.'); return; }
    if (!amounts && !request.current.mutation) { setBillError('Check the eligible bill total and offer value. For Buy 1 Get 1, enter the cheaper item’s price.'); return; }
    if (!request.current.mutation) request.current = { round: subscription.roundId, mutation: makeMutationId(), billAmount: amount };
    Keyboard.dismiss(); setBillError('');
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result = await redeemSubscriptionCoupon(offer.id, request.current.round, request.current.mutation, amount, offer.discountType === 'buy1get1' ? parseBillAmount(freeItemAmount) ?? undefined : undefined, branchKey);
      if (currentContext.current !== context) return;
      setReceipt(result);
      try { posthog?.capture('coupon_redeemed'); } catch {}
      if (user) void syncCouponlyPushToken(user.id, true, true);
      await Promise.allSettled([refresh(), retrySync()]);
    } catch (e) { if (currentContext.current === context) { const message = e instanceof Error ? e.message : 'Unable to confirm this coupon. Try again.'; setError(message); if (message === benefitsError('ROUND_CHANGED')) request.current = { round: '', mutation: '', billAmount: null }; await refresh().catch(() => {}); } }
    finally { if (currentContext.current === context) { setBusy(false); inFlight.current = false; } }
  };
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/kouponly' as any);
  return <View style={[styles.screen, {paddingTop:insets.top}]}>
    <AppHeader title={receipt ? 'Confirmation' : 'Redeem offer'} onBackPress={goBack} />
    <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24, paddingTop:12 }]}>
      <Animated.View key={receipt ? "receipt" : "confirm"} entering={CONTENT_ENTER} style={{ gap: 20 }}>{receipt ? <>
        <View style={styles.successHeader}>
          <View style={styles.successIcon}><Ionicons name="checkmark" size={28} color={theme.brand} /></View>
          <Text accessibilityRole="header" style={styles.successTitle}>You're all set</Text>
          <Text style={styles.centerCopy}>Your redemption is confirmed.</Text>
        </View>
        <View style={styles.ticket}>
          <Vendor name={receipt.vendorName} logo={deal?.logo} />
          <View style={styles.codeCard}>
            <Text style={styles.eyebrow}>CONFIRMATION CODE</Text>
            <Text selectable accessibilityLabel="Unique redemption code" style={styles.code}>{receipt.code ?? '—'}</Text>
            <Text style={styles.centerCopy}>Show this to the staff at checkout.</Text>
          </View>
          {(deal?.locations?.length ?? 0) > 1 ? <Text style={styles.body}>{receipt.branchName || branchLabel}</Text> : null}
          <View style={styles.amountRow}><Text style={styles.body}>Bill total</Text><Text selectable testID="redemption-bill-amount" style={styles.amountValue}>{receipt.currency} {receipt.billAmount.toFixed(2)}</Text></View>
          {receipt.payableAmount != null ? <AmountSummary currency={receipt.currency} payable={receipt.payableAmount} saved={receipt.estimatedSavings ?? 0} /> : null}
          <Text selectable accessibilityLabel="Redeemed at" style={styles.centerCopy}>{new Date(receipt.consumedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</Text>
        </View>
        <Action label="Done" onPress={goBack} />
      </> : !user ? <><Text style={styles.body}>Sign in to redeem a free coupon.</Text><Action label="Sign in" onPress={() => router.push({ pathname: '/kouponly/onboarding', params: { flow: 'login' } } as any)} /></>
      : !deal || !offer ? <Text style={styles.body}>{catalogueStatus === 'loading' ? 'Loading offer…' : 'This offer is unavailable.'}</Text>
      : <>
        <Vendor name={deal.name} logo={deal.logo} />
        <View style={styles.offerPanel}>
          <Text style={styles.eyebrow}>IN-STORE OFFER</Text>
          <Text style={styles.offerTitle}>{offer.title}</Text>
          {(deal.locations?.length ?? 0) > 1 ? <View style={styles.mode}><Ionicons name="location-outline" size={16} color={theme.mutedText} /><Text style={[styles.body, { flex: 1 }]}>{branchLabel}</Text></View> : null}
          {['fixed_price', 'combo'].includes(offer.discountType || '') ? <Text style={styles.body}>Exclusive price · {offer.currency || 'INR'} {offer.discountValue}</Text> : null}
          {offer.description || offer.terms || offer.redemptionInstructions ? <>
            <ScalePressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(open => !open)} style={styles.detailsToggle}>
              <Text style={styles.detailsLabel}>Offer details</Text><Ionicons name={detailsOpen ? 'chevron-up' : 'chevron-down'} size={16} color={theme.mutedText} />
            </ScalePressable>
            {detailsOpen ? <View style={{ gap: 8 }}>{[offer.description, offer.terms, offer.redemptionInstructions].filter(Boolean).map((text, index) => <Text selectable key={index} style={styles.body}>{text}</Text>)}</View> : null}
          </> : null}
        </View>
        {loading && !benefits ? <ActivityIndicator color={theme.actionSolid} /> : subscription ? <>
          {used ? <><Text style={styles.error}>This offer’s coupon is already used. Available again {new Date(subscription.endsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. {benefits.rewardedReferrals < benefits.referralLimit ? 'Invite friends to earn an earlier coupon refresh.' : 'Your referral refresh limit has been reached.'}</Text><Action label="Invite friends" onPress={() => router.push('/invite-code')} />{error && request.current.mutation ? <Action label="Recover confirmation" disabled={busy} onPress={() => void confirm()} /> : null}</> : offer.redemption === 'online' ? <Text style={styles.body}>Online coupon redemption is not available.</Text> : <>
            <OnboardingField label={`Bill total (${offer.currency || 'INR'})`} testID="bill-amount" value={billAmount} onChangeText={value => { setBillAmount(value); setBillError(''); }} error={billError} keyboardType="decimal-pad" maxLength={13} editable={!busy && !request.current.mutation} placeholder="0.00" />
            {offer.discountType === 'buy1get1' ? <OnboardingField label="Cheaper item price (free item)" value={freeItemAmount} onChangeText={value => { setFreeItemAmount(value); setBillError(''); }} keyboardType="decimal-pad" editable={!busy && !request.current.mutation} placeholder="0.00" /> : null}
            {amounts ? <AmountSummary currency={offer.currency || 'INR'} payable={amounts.payable} saved={amounts.saved} /> : null}
            <Text style={styles.body}>{request.current.mutation ? 'This bill amount is locked while confirmation is recovered.' : offer.discountType === 'buy1get1' ? 'Enter the total for both items before discount.' : offer.discountType === 'free' ? 'Enter the total for eligible free items only.' : 'Enter the eligible bill total before discount.'}</Text>
            <Text style={styles.centerCopy}>Confirm at the counter. This uses your monthly coupon for this offer at this branch.</Text>
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
  return <View style={styles.vendor}>{logo ? <View style={styles.logoTile}><Image accessible={false} source={{uri:logo}} resizeMode="cover" style={styles.logo} /></View> : null}<Text accessibilityRole="header" style={styles.vendorName}>{name}</Text></View>;
}
function makeStyles(theme: ReturnType<typeof useAppTheme>['theme']) {
  return StyleSheet.create({
    screen:{flex:1,backgroundColor:theme.background},
    content:{paddingHorizontal:20,gap:20},
    vendor:{flexDirection:'row',alignItems:'center',gap:16},
    vendorName:{flex:1,color:theme.text,fontSize:21,lineHeight:28,...Typography.getTextVariantStyle('bodyStrong')},
    logoTile:{width:48,height:48,borderRadius:14,backgroundColor:theme.cardMuted,overflow:'hidden'},
    logo:{width:'100%',height:'100%'},
    offerPanel:{backgroundColor:theme.cardMuted,borderRadius:20,padding:20,gap:10},
    mode:{flexDirection:'row',gap:6,alignItems:'center'},
    eyebrow:{color:theme.mutedText,fontSize:11,letterSpacing:1,...Typography.getTextVariantStyle('bodyStrong')},
    offerTitle:{color:theme.text,fontSize:25,lineHeight:32,...Typography.getTextVariantStyle('bodyStrong')},
    body:{color:theme.mutedText,fontSize:14,lineHeight:22,...Typography.getTextVariantStyle('body')},
    detailsToggle:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
    detailsLabel:{color:theme.text,fontSize:14,...Typography.getTextVariantStyle('bodyStrong')},
    error:{color:theme.danger,fontSize:14,...Typography.getTextVariantStyle('body')},
    centerCopy:{color:theme.mutedText,fontSize:13,lineHeight:20,textAlign:'center',...Typography.getTextVariantStyle('body')},
    ticket:{backgroundColor:theme.card,borderColor:theme.border,borderWidth:1,borderRadius:24,padding:20,gap:20},
    codeCard:{backgroundColor:theme.cardMuted,borderRadius:16,padding:20,alignItems:'center',gap:10},
    code:{color:theme.text,fontSize:36,letterSpacing:5,textAlign:'center',...Typography.getTextVariantStyle('display')},
    successHeader:{alignItems:'center',gap:8,paddingVertical:12},
    successIcon:{width:56,height:56,borderRadius:28,backgroundColor:theme.brandSoft,alignItems:'center',justifyContent:'center',marginBottom:4},
    successTitle:{color:theme.text,fontSize:28,...Typography.getTextVariantStyle('display')},
    amountSummary:{gap:12,borderTopWidth:1,borderTopColor:theme.border,paddingTop:16},
    amountRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'baseline',gap:16,flexWrap:'wrap'},
    amountValue:{color:theme.text,fontSize:15,fontVariant:['tabular-nums'],...Typography.getTextVariantStyle('bodyStrong')},
    payable:{color:theme.text,fontSize:24,fontVariant:['tabular-nums'],...Typography.getTextVariantStyle('bodyStrong')},
    savings:{color:theme.brandText,fontSize:14,...Typography.getTextVariantStyle('bodyStrong')},
  });
}

function AmountSummary({ currency, payable, saved }: { currency: string; payable: number; saved: number }) {
  const { theme } = useAppTheme(); const styles = makeStyles(theme);
  return <View testID="offer-amounts" style={styles.amountSummary}>
    <View style={styles.amountRow}><Text style={styles.body}>You save</Text><Text selectable style={styles.savings}>{currency} {saved.toFixed(2)}</Text></View>
    <View style={styles.amountRow}><Text style={styles.detailsLabel}>To pay at store</Text><Text selectable style={styles.payable}>{currency} {payable.toFixed(2)}</Text></View>
  </View>;
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { theme } = useAppTheme(); return <ScalePressable accessibilityRole="button" accessibilityState={{disabled, busy:disabled}} disabled={disabled} onPress={onPress} style={{ minHeight: 54, padding: 14, borderRadius: 30, backgroundColor: theme.actionSolid, opacity: disabled ? 0.5 : 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.buttonText, ...Typography.getTextVariantStyle('bodyStrong') }}>{label}</Text></ScalePressable>;
}

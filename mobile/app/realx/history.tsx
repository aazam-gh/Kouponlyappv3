import { Colors as BorderPalette } from '@/constants/Colors';
import ScalePressable from '@/components/ScalePressable';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppHeader from '@/components/navigation/AppHeader';
import { StateSurface } from '@/components/StateSurface';
import { useAuth } from '@/lib/auth';
import { deals } from '@/lib/data';
import { getSupabase } from '@/lib/supabase';
import { F } from '@/lib/theme';
import { useAppTheme as useDesignTheme } from '@/context/AppThemeContext';
import { useAppLocale } from '@/context/LocaleContext';
import ProfileSprites from '@/components/profile/ProfileSprites';

export default function RealXHistoryScreen() {
  const styles = React.useMemo(() => makeStyles(), []); const { user, loading: authLoading } = useAuth(); const { t } = useTranslation(); const { isRTL } = useAppLocale(); const { theme: design } = useDesignTheme();
  const isFocused = useIsFocused();
  const [snapshot, setSnapshot] = React.useState<{userId:string; rows:any[]} | null>(null);
  const owner = React.useRef(user?.id); owner.current = user?.id;
  const rows = snapshot?.userId === user?.id ? snapshot?.rows ?? [] : [];
  const [loading, setLoading] = React.useState(true); const [refreshing, setRefreshing] = React.useState(false); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    if (user || authLoading || !isFocused) return;
    Alert.alert(t('guest_auth_required_title'), t('guest_history_message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('onboarding_login_action'), onPress: () => router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any) },
      { text: t('onboarding_sign_up'), onPress: () => router.push('/realx/welcome' as any) },
    ]);
    router.replace('/realx/profile' as any);
  }, [user?.id, authLoading, isFocused, t]);
  const load = React.useCallback(async () => {
    if (!user) { setSnapshot(null); setLoading(false); return; }
    try {
      const [legacy, coupons] = await Promise.all([
        getSupabase().from('realx_transactions').select('*').eq('student_id', user.id).eq('transaction_type', 'offer').eq('status', 'completed').order('created_at', { ascending: false }).limit(100),
        getSupabase().from('redemptions').select('redemption_id,code,vendor_id,bill_amount,offer_snapshot,consumed_at').eq('user_id', user.id).eq('status', 'success').not('round_id', 'is', null).order('consumed_at', {ascending: false}).limit(100),
      ]);
      if (legacy.error) throw legacy.error; if (coupons.error) throw coupons.error;
      const receipts = (coupons.data || []).map(row => ({id: row.redemption_id, code: row.code, bill_amount: row.bill_amount, bill_currency: row.offer_snapshot?.currency, vendor_id: row.vendor_id, vendor_name: row.offer_snapshot?.vendorName, created_at: row.consumed_at, is_coupon: true, metadata: {offer: {title: row.offer_snapshot?.title}}}));
      if (owner.current !== user.id) return;
      setSnapshot({userId:user.id, rows:[...(legacy.data || []), ...receipts].sort((a,b) => new Date(b.created_at).getTime()-new Date(a.created_at).getTime())}); setMessage('');
    }
    catch (error) { if (owner.current === user.id) setMessage(error instanceof Error ? error.message : t('state_error_message')); }
    finally { if (owner.current === user.id) { setLoading(false); setRefreshing(false); } }
  }, [user?.id, t]);
  useFocusEffect(React.useCallback(() => { if (authLoading) return; setLoading(true); setMessage(''); void load(); }, [load, authLoading]));
  const amount = (value: unknown) => t('amount_with_currency', { amount: Number(value || 0).toFixed(2), currency: t('currency_qar') });
  const renderItem = ({ item: row }: { item: any }) => {
        const vendor = deals.find(deal => deal.vendorId === (row.vendor_id || row.vendor_id_snapshot)); const metadata = row.metadata || {}; const offer = metadata.offer || {}; const savings = row.discount_amount ?? 0; const paid = row.final_amount ?? row.total_amount ?? row.amount ?? 0;
        const discount = offer.discountType === 'buy1get1' ? t('buy1get1_label') : offer.discountValue ? `${offer.discountValue}${offer.discountType === 'percentage' ? '%' : ''} OFF` : row.discount_value ? `${row.discount_value}${row.discount_type === 'percentage' ? '%' : ''} OFF` : offer.title || t('offer_redeemed_label');
        const date = row.created_at ? new Date(row.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const vendorName = row.vendor_name || vendor?.name || 'VENDOR';
        return <View style={styles.item}><View style={[styles.card, { backgroundColor: design.cardMuted }]}><View style={[styles.header, isRTL && styles.rowReverse]}><View style={[styles.vendorInfo, isRTL && styles.rowReverse]}><View style={[styles.logo, { backgroundColor: design.logoTile, borderColor: design.logoTileBorder }]}>{vendor?.logo || vendor?.image ? <Image source={{ uri: vendor.logo || vendor.image }} style={styles.logoImage} contentFit="contain" /> : <Ionicons name="storefront" size={24} color={design.iconMuted} />}</View><View style={styles.vendorCopy}><Text style={[styles.vendorName, { color: design.text, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]} numberOfLines={1}>{vendorName}</Text><Text style={[styles.savings, { color: design.mutedText, writingDirection: isRTL ? 'rtl' : 'ltr' }]} numberOfLines={2}>{row.is_coupon ? 'Free monthly coupon' : t('estimated_savings', { amount: amount(savings) })}</Text></View></View><View style={[styles.paid, isRTL && { alignItems: 'flex-start' }]}><Text style={[styles.paidLabel, { color: design.mutedText }]} numberOfLines={1}>{row.is_coupon ? 'Status' : t('total_paid')}</Text><Text style={[styles.paidValue, { color: design.text, writingDirection: isRTL ? 'rtl' : 'ltr' }]} numberOfLines={1}>{row.is_coupon ? 'Redeemed' : amount(paid)}</Text></View></View>
          {row.is_coupon && row.bill_amount != null ? <Text testID="history-bill-amount" style={{ color: design.text, marginTop: 12 }}>Bill amount before discount: {row.bill_currency} {Number(row.bill_amount).toFixed(2)}</Text> : null}
          {row.is_coupon && row.code ? <Text selectable accessibilityLabel="Unique redemption code" style={{ color: design.text, marginTop: 12 }}>Code: {row.code}</Text> : null}<View style={[styles.divider, { backgroundColor: design.border }]} /><View style={[styles.footer, isRTL && styles.rowReverse]}><View style={styles.offerInfo}><Text style={[styles.offerLabel, { color: design.mutedText }]} numberOfLines={1}>{t('offer_redeemed_label')}</Text><Text style={[styles.offerValue, { color: design.text, writingDirection: isRTL ? 'rtl' : 'ltr' }]} numberOfLines={1}>{discount}</Text></View>{vendor ? <ScalePressable style={[styles.redeem, { backgroundColor: design.actionSolid }]} onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(vendor.id) } } as any)}><Text style={[styles.redeemText, { color: design.onActionSolid }]}>{row.is_coupon ? 'View offer' : t('redeem_again')}</Text></ScalePressable> : null}</View></View><Text style={[styles.date, { color: design.mutedText, writingDirection: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' }]}>{t('redeemed_on', { date })}</Text></View>;
  };
  return <SafeAreaView testID="couponly-history-screen" style={[styles.root, { backgroundColor: design.background }]} edges={['top']}>
    <ProfileSprites />
    <AppHeader title={t('redemption_history')} onBackPress={() => router.back()} />
    {!user || loading ? <StateSurface kind="loading" /> : message && rows.length === 0 ? <StateSurface kind="error" message={message} onRetry={() => void load()} /> : <FlatList data={rows} keyExtractor={row => row.id} renderItem={renderItem} contentContainerStyle={[styles.list, rows.length === 0 && { flexGrow: 1 }]} showsVerticalScrollIndicator={false} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} ListEmptyComponent={<StateSurface kind="empty" title={t('no_redemptions_found')} />} />}
  </SafeAreaView>;
}
const makeStyles = () => StyleSheet.create({ root: { flex: 1 }, list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }, item: { marginBottom: 24 }, card: { borderRadius: 24, borderWidth: 1, borderColor: BorderPalette.border, padding: 20, marginBottom: 8 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, rowReverse: { flexDirection: 'row-reverse' }, vendorInfo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 }, logo: { width: 50, height: 50, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, logoImage: { width: 50, height: 50 }, vendorCopy: { flex: 1, minWidth: 0 }, vendorName: { fontSize: 18, fontFamily: F.bodySemi, fontWeight: '700', marginBottom: 4 }, savings: { fontSize: 12, fontFamily: F.body }, paid: { alignItems: 'flex-end', flexShrink: 0, maxWidth: '42%' }, paidLabel: { fontSize: 12, fontFamily: F.body, marginBottom: 4 }, paidValue: { fontSize: 16 }, divider: { height: 1, marginVertical: 16 }, footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }, offerInfo: { flex: 1, minWidth: 0 }, offerLabel: { fontSize: 12, fontFamily: F.body, marginBottom: 4 }, offerValue: { fontSize: 14, fontFamily: F.bodySemi, fontWeight: '700' }, redeem: { flexShrink: 0, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }, redeemText: { fontSize: 14, fontFamily: F.bodySemi, fontWeight: '700' }, date: { fontSize: 12, fontFamily: F.body, marginStart: 8, marginTop: 2 } });

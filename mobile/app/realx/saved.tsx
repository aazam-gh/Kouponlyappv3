import { router } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppHeader from '@/components/navigation/AppHeader';
import AppText from '@/components/AppText';
import { StateSurface } from '@/components/StateSurface';
import { useAuth } from '@/lib/auth';
import { deals, type Deal } from '@/lib/data';
import { getSupabase } from '@/lib/supabase';
import { type ThemeColors, useAppTheme } from '@/lib/theme';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme as useDesignTheme } from '@/context/AppThemeContext';

type SavedOffer = { id: string; item_id: string; payload?: Record<string, any>; record: any; vendor?: Deal };

export default function RealXSavedScreen() {
  const theme = useAppTheme(); const { colors: C } = theme; const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]); const { user } = useAuth(); const { t } = useTranslation(); const { isRTL } = useAppLocale(); const { theme: design } = useDesignTheme();
  const [rows, setRows] = React.useState<SavedOffer[]>([]); const [loading, setLoading] = React.useState(true); const [refreshing, setRefreshing] = React.useState(false); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    if (user) return;
    Alert.alert(t('guest_auth_required_title'), t('guest_saved_offers_message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('onboarding_login_action'), onPress: () => router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any) },
      { text: t('onboarding_sign_up'), onPress: () => router.push('/realx/welcome' as any) },
    ]);
    router.replace('/realx/profile' as any);
  }, [user?.id, t]);
  const load = React.useCallback(async () => {
    if (!user) { setRows([]); setLoading(false); return; }
    try {
      const { data, error } = await getSupabase().from('realx_student_saved_items').select('*').eq('student_id', user.id).eq('item_type', 'offer').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      const items = data || []; const ids = items.map((item: any) => item.item_id);
      const { data: offers, error: offerError } = ids.length ? await getSupabase().from('realx_offers').select('id,vendor_id,title,description,payload,image_url').in('id', ids) : { data: [], error: null };
      if (offerError) throw offerError;
      const byId = new Map((offers || []).map((offer: any) => [offer.id, offer]));
      setRows(items.flatMap((item: any) => { const record = byId.get(item.item_id); if (!record) return []; return [{ ...item, record, vendor: deals.find(deal => deal.vendorId === record.vendor_id) }]; })); setMessage('');
    } catch (error) { setMessage(error instanceof Error ? error.message : t('state_error_message')); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.id, t]);
  React.useEffect(() => { void load(); }, [load]);
  const remove = async (item: SavedOffer) => {
    const { error } = await getSupabase().from('realx_student_saved_items').delete().eq('id', item.id).eq('student_id', user?.id);
    if (!error) setRows(current => current.filter(row => row.id !== item.id));
    else setMessage(error.message);
  };
  const renderItem = ({ item }: { item: SavedOffer }) => {
        const offer = item.record; const vendor = item.vendor; const vendorName = vendor?.name || offer.payload?.vendorName || item.payload?.vendorName || 'Partner';
        const title = offer.title || offer.payload?.titleEn || item.payload?.title || 'Member offer';
        const cover = vendor?.image || vendor?.galleryImages?.[0]; const logo = vendor?.logo || offer.image_url;
        return <TouchableOpacity activeOpacity={0.9} style={[styles.card, { backgroundColor: design.card, borderColor: design.border }]} onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(offer.vendor_id) } } as any)}>
          {cover ? <Image source={{ uri: cover }} style={[styles.cover, { backgroundColor: design.cardMuted }]} contentFit="cover" /> : <View style={[styles.cover, { backgroundColor: design.cardMuted }]} />}
          <View style={[styles.body, isRTL && styles.rowReverse]}><View style={[styles.logo, { backgroundColor: design.logoTile, borderColor: design.logoTileBorder }]}>{logo ? <Image source={{ uri: logo }} style={styles.logoImage} contentFit="contain" /> : <Ionicons name="storefront-outline" size={22} color={design.brand} />}</View><View style={styles.copy}><Text style={[styles.vendor, { color: design.mutedText, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]} numberOfLines={1}>{vendorName}</Text><AppText style={[styles.title, { color: design.text, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]} numberOfLines={2}>{title}</AppText></View></View>
          <View style={[styles.actions, isRTL && styles.rowReverse]}><TouchableOpacity style={[styles.action, { backgroundColor: design.actionSolid }, isRTL && styles.rowReverse]} onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(vendor?.id || offer.vendor_id), offer: String(vendor?.offers?.find(candidate => candidate.id === offer.id)?.index || 0) } } as any)}><Ionicons name="flash" size={18} color={design.onActionSolid} /><Text style={[styles.actionText, { color: design.onActionSolid }]}>{t('redeem_caps')}</Text></TouchableOpacity><TouchableOpacity style={[styles.action, styles.remove, { borderColor: design.border }, isRTL && styles.rowReverse]} onPress={() => void remove(item)}><Ionicons name="bookmark" size={18} color={design.brand} /><Text style={[styles.actionText, { color: design.text }]}>{t('remove')}</Text></TouchableOpacity></View>
        </TouchableOpacity>;
  };
  return <SafeAreaView testID="couponly-saved-screen" style={[styles.root, { backgroundColor: design.background }]} edges={['top']}>
    <AppHeader title={t('saved_offers')} onBackPress={() => router.back()} />
    {!user || loading ? <StateSurface kind="loading" /> : message && rows.length === 0 ? <StateSurface kind="error" message={message} onRetry={() => void load()} /> : rows.length === 0 ? <StateSurface kind="empty" title={t('no_saved_offers')} message={t('no_saved_offers_hint')} /> : <FlatList data={rows} keyExtractor={item => item.id} renderItem={renderItem} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />}
  </SafeAreaView>;
}
const makeStyles = (_C: ThemeColors) => StyleSheet.create({ root: { flex: 1 }, list: { paddingHorizontal: 20, paddingBottom: 120, gap: 16 }, card: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' }, cover: { width: '100%', height: 120 }, body: { flexDirection: 'row', gap: 12, padding: 14 }, rowReverse: { flexDirection: 'row-reverse' }, logo: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, logoImage: { width: '100%', height: '100%' }, copy: { flex: 1, minWidth: 0 }, vendor: { fontSize: 13, fontFamily: 'Poppins' }, title: { fontSize: 20, marginTop: 2 }, actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 }, action: { flex: 1, height: 46, borderRadius: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, actionText: { flexShrink: 1, fontWeight: '700', fontSize: 13, fontFamily: 'Poppins' }, remove: { borderWidth: 1 } });

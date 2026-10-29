import React from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '@/lib/auth';
import { useStore } from '@/lib/store';
import { deals } from '@/lib/data';
import { useCatalogue } from '@/lib/catalogue';
import { getSupabase } from '@/lib/supabase';
import { recommendedVendors } from '@/lib/saved-discovery';
import { useAppTheme } from '@/context/AppThemeContext';
import ScalePressable from '@/components/ScalePressable';
import { RemoteImage } from '@/components/RemoteImage';
import { StateSurface } from '@/components/StateSurface';

type SavedItem = { id: string; item_id: string; item_type: string; payload: Record<string, any> | null };
type Offer = { id: string; vendor_id: string; title: string; image_url: string | null };
type Card = { key: string; title: string; subtitle: string; image?: string; vendorId?: string; offer?: number; remove?: () => void };

export default function SavedScreen() {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const { state, hydrated, cloudStatus, toggleSaved, toggleSavedOffer, notify, retrySync } = useStore();
  const catalogue = useCatalogue();
  const insets = useSafeAreaInsets();
  const saved = useQuery({
    queryKey: ['saved-tab', user?.id], enabled: !!user,
    queryFn: async () => {
      const client = getSupabase();
      const [items, coupons, legacy] = await Promise.all([
        client.from('kouponly_student_saved_items').select('id,item_id,item_type,payload').eq('student_id', user!.id).order('created_at', { ascending: false }),
        client.from('redemptions').select('redemption_id,vendor_id,offer_snapshot,consumed_at').eq('user_id', user!.id).eq('status', 'success').not('consumed_at', 'is', null).order('consumed_at', { ascending: false }).limit(100),
        client.from('kouponly_transactions').select('vendor_id,vendor_id_snapshot,vendor_name,created_at').eq('student_id', user!.id).eq('transaction_type', 'offer').eq('status', 'completed').order('created_at', { ascending: false }).limit(100),
      ]);
      if (items.error) throw items.error; if (coupons.error) throw coupons.error; if (legacy.error) throw legacy.error;
      const ids = [...new Set([...(items.data || []).filter(item => item.item_type === 'offer').map(item => item.item_id), ...state.savedOffers])];
      const offers = ids.length ? await client.from('kouponly_offers').select('id,vendor_id,title,image_url').in('id', ids) : { data: [], error: null };
      if (offers.error) throw offers.error;
      const rawRecent = (coupons.data || []).length ? (coupons.data || []).map(row => ({
        id: String(row.redemption_id), vendorId: String(row.vendor_id), vendorName: row.offer_snapshot?.vendorName,
        offerTitle: row.offer_snapshot?.title || 'Redeemed offer', redeemedAt: String(row.consumed_at),
      })) : (legacy.data || []).map((row, index) => ({
        id: `legacy-${row.vendor_id || row.vendor_id_snapshot}-${row.created_at}-${index}`, vendorId: String(row.vendor_id || row.vendor_id_snapshot || ''), vendorName: row.vendor_name,
        offerTitle: 'Redeemed offer', redeemedAt: String(row.created_at),
      }));
      const recent = rawRecent.filter(row => row.vendorId && row.vendorId !== 'null' && Number.isFinite(Date.parse(row.redeemedAt)))
        .map(row => ({ ...row, id: row.id || `${row.vendorId}-${row.redeemedAt}-${row.offerTitle}` }));
      return { items: (items.data || []) as SavedItem[], offers: (offers.data || []) as Offer[], recent };
    },
  });
  useFocusEffect(React.useCallback(() => { if (user) void saved.refetch(); }, [user?.id, state.savedOffers.join(',')]));
  const data = user ? saved.data : undefined;
  const items = data?.items || [];
  const vendorId = (vendor: typeof deals[number]) => String(vendor.vendorId || vendor.id);
  const vendorFor = (id: string) => deals.find(vendor => vendorId(vendor) === id);
  const directlySavedVendors = deals.filter(vendor => state.saved.includes(vendor.id) || items.some(item => item.item_type === 'vendor' && item.item_id === vendorId(vendor)));
  const offers = new Map((data?.offers || []).map(offer => [offer.id, offer]));
  const offerIds = [...new Set([...items.filter(item => item.item_type === 'offer').map(item => item.item_id), ...state.savedOffers])];
  const savedOfferCards: Card[] = offerIds.map(id => {
    const item = items.find(item => item.item_type === 'offer' && item.item_id === id);
    const offer = offers.get(id);
    const vendor = vendorFor(offer?.vendor_id || item?.payload?.vendorId || '') || deals.find(vendor => vendor.offers?.some(offer => offer.id === id));
    const catalogueOffer = vendor?.offers?.find(offer => offer.id === id);
    return { key: id, title: offer?.title || catalogueOffer?.title || item?.payload?.title || 'Unavailable offer', subtitle: vendor?.name || 'This offer is no longer in the catalogue', image: vendor?.logo || offer?.image_url || undefined, vendorId: vendor && vendorId(vendor), offer: catalogueOffer?.index };
  });
  const savedVendors = deals.filter(vendor => directlySavedVendors.includes(vendor) || savedOfferCards.some(card => card.vendorId === vendorId(vendor)));
  const removeVendor = async (vendor: typeof deals[number]) => {
    const offerIds = savedOfferCards.filter(card => card.vendorId === vendorId(vendor)).map(card => card.key);
    const oldItems = items.filter(item =>
      (item.item_type === 'vendor' && item.item_id === vendorId(vendor)) ||
      (item.item_type === 'offer' && offerIds.includes(item.item_id))
    );
    if (oldItems.length) {
      const { error } = await getSupabase().from('kouponly_student_saved_items').delete().eq('student_id', user!.id).in('id', oldItems.map(item => item.id));
      if (error) { notify(error.message); return; }
    }
    if (state.saved.includes(vendor.id)) toggleSaved(vendor.id);
    offerIds.filter(id => state.savedOffers.includes(id)).forEach(id => toggleSavedOffer(id));
    if (user) await saved.refetch();
  };
  const recent = data?.recent || [];
  const savedIds = new Set([...savedVendors.map(vendorId), ...savedOfferCards.flatMap(card => card.vendorId ? [card.vendorId] : [])]);
  const recommendations = recommendedVendors(deals, savedIds, recent.map(row => row.vendorId));
  const sections: { title: string; empty: string; data: Card[] }[] = [
    { title: 'Saved Discounts', empty: 'Tap the bookmark on a vendor offer to save it.', data: savedVendors.map(vendor => ({ key: vendorId(vendor), title: vendor.name, subtitle: vendor.category, image: vendor.logo || vendor.image, vendorId: vendorId(vendor), remove: () => void removeVendor(vendor) })) },
    { title: 'Redemption History', empty: user ? 'Your successfully redeemed offers will appear here.' : 'Sign in to see your redemption history.', data: recent.map(row => { const vendor = vendorFor(row.vendorId); const offerTitle = row.offerTitle || 'Redeemed offer'; const matchedOffer = vendor?.offers?.find(offer => offer.title === offerTitle); return { key: row.id || `${row.vendorId}-${row.redeemedAt}-${offerTitle}`, title: offerTitle, subtitle: `${vendor?.name || row.vendorName || 'Previously redeemed vendor'} · ${new Date(row.redeemedAt).toLocaleDateString()}`, image: vendor?.logo || vendor?.image, vendorId: vendor && row.vendorId, offer: matchedOffer?.index }; }) },
    { title: 'More to explore', empty: 'New recommendations will appear when offers are available.', data: recommendations.map(({ vendor, reason }) => ({ key: vendorId(vendor), title: vendor.name, subtitle: reason, image: vendor.logo || vendor.image, vendorId: vendorId(vendor) })) },
  ];
  const refreshing = saved.isFetching || catalogue.status === 'loading';
  return <SafeAreaView testID="saved-tab-screen" edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
    <SectionList sections={hydrated ? sections : []} keyExtractor={item => item.key} stickySectionHeadersEnabled={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 110 }}
      refreshing={refreshing} onRefresh={() => { void catalogue.refresh(); if (user) void saved.refetch(); void retrySync(); }}
      ListHeaderComponent={<>
        {!user ? <ScalePressable accessibilityRole="button" onPress={() => router.push({ pathname: '/kouponly/onboarding', params: { flow: 'login' } } as any)} style={[styles.notice, { backgroundColor: theme.cardMuted }]}><Text style={{ color: theme.text }}>Sign in to sync saved vendors across devices.</Text></ScalePressable> : null}
        {saved.isError || cloudStatus === 'offline' || cloudStatus === 'error' || catalogue.error ? <StateSurface kind="error" message="Some saved items could not be refreshed. Your available items are shown below." onRetry={() => { if (user) void saved.refetch(); void retrySync(); void catalogue.refresh(); }} /> : null}
        {!hydrated || (user && saved.isPending) ? <StateSurface kind="loading" /> : null}
      </>}
      renderSectionHeader={({ section }) => <View style={styles.section}><Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>{section.title}</Text>{section.data.length === 0 && hydrated && !(user && saved.isPending) ? <Text style={{ color: theme.mutedText }}>{section.empty}</Text> : null}</View>}
      renderItem={({ item }) => <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ScalePressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} disabled={!item.vendorId} onPress={() => router.push({ pathname: '/kouponly/vendor/[id]', params: { id: item.vendorId!, ...(item.offer !== undefined ? { offer: String(item.offer) } : {}) } } as any)} style={styles.main}>
          <RemoteImage source={item.image ? { uri: item.image } : null} style={styles.image} contentFit="cover" />
          <View style={{ flex: 1 }}><Text style={[styles.title, { color: theme.text }]}>{item.title}</Text><Text style={[styles.subtitle, { color: theme.mutedText }]}>{item.subtitle}</Text></View>
          {!item.remove && item.vendorId ? <Ionicons name="chevron-forward" size={18} color={theme.iconMuted} /> : null}
        </ScalePressable>
        {item.remove ? <ScalePressable accessibilityRole="button" accessibilityLabel={`Remove ${item.title} from saved`} onPress={item.remove} style={styles.remove}><Ionicons name="bookmark" size={22} color={theme.brand} /></ScalePressable> : null}
      </View>}
    />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ section: { paddingTop: 24, paddingBottom: 12, gap: 8 }, heading: { fontSize: 23, fontFamily: 'Outfit_700Bold' }, notice: { padding: 16, borderRadius: 18 }, card: { flexDirection: 'row', borderRadius: 20, borderWidth: 1, marginBottom: 12, overflow: 'hidden', alignItems: 'center' }, main: { flex: 1, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }, image: { width: 64, height: 64, borderRadius: 14 }, title: { fontSize: 17, fontFamily: 'Outfit_600SemiBold' }, subtitle: { fontSize: 13, marginTop: 4, fontFamily: 'Outfit_400Regular' }, remove: { width: 48, minHeight: 64, alignItems: 'center', justifyContent: 'center' } });

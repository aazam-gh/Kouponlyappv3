import Animated from 'react-native-reanimated';
import { CONTENT_ENTER } from '@/utils/motion';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, FlatList, Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import RestaurantCard from '@/components/category/RestaurantCard';
import { HeaderIconButton } from '@/components/navigation/AppHeader';
import { useAppTheme } from '@/context/AppThemeContext';
import { useCatalogue } from '@/lib/catalogue';
import { useNearbyDistances } from '@/lib/nearby';
import { deals, type Deal } from '@/lib/data';
import { searchVendors } from '@/lib/vendor-search';
import { F } from '@/lib/theme';
import { triggerSubtleHaptic } from '@/utils/haptics';
import { usePostHog } from 'posthog-react-native';

const RECOMMENDATION_LIMIT = 6;

export default function RealXSearchScreen() {
  const posthog = usePostHog();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const { status, revision, refresh } = useCatalogue();
  const { distanceByVendor } = useNearbyDistances();
  const [input, setInput] = React.useState(typeof q === 'string' ? q : '');
  const [committed, setCommitted] = React.useState(typeof q === 'string' ? q.trim().toLocaleLowerCase() : '');
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    const next = typeof q === 'string' ? q : '';
    setInput(next);
    setCommitted(next.trim().toLocaleLowerCase());
  }, [q]);

  const results = React.useMemo(() => searchVendors(deals, committed), [committed, revision]);
  const recommendations = React.useMemo(() => [...deals].sort((a, b) => b.trend - a.trend).slice(0, RECOMMENDATION_LIMIT), [revision]);

  const submit = () => { setCommitted(input.trim().toLocaleLowerCase()); if (input.trim()) posthog.capture('search_submitted'); Keyboard.dismiss(); };
  const tryAnother = () => { triggerSubtleHaptic(); setInput(''); setCommitted(''); requestAnimationFrame(() => inputRef.current?.focus()); };
  const openVendor = (item: Deal) => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(item.vendorId || item.id) } } as any);
  const renderCard = ({ item }: { item: Deal }) => <View style={s.cardWrap}>
    <RestaurantCard id={String(item.vendorId || item.id)} name={item.name} imageUri={item.image} logoUri={item.logo} distance={distanceByVendor.get(String(item.vendorId || item.id))?.label} xcardEnabled={item.xcard} badgeLabel={item.cardLabel} distanceOnImage overlapLogo onPress={() => openVendor(item)} />
  </View>;
  const noMatches = !!committed && results.length === 0;

  return <SafeAreaView style={[s.root, { backgroundColor: theme.background }]} edges={['top']}>
    <StatusBar style={isDark ? 'light' : 'dark'} animated />
    <View style={s.header}>
      <HeaderIconButton icon={'arrow-back'} onPress={() => router.back()} accessibilityLabel={t('back')} />
      <View style={[s.search, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
        <Ionicons name="search" size={18} color={theme.brand} />
        <TextInput testID="vendor-search-input" ref={inputRef} style={[s.input, { color: theme.text, textAlign: 'left', writingDirection: 'ltr' }]} placeholder={t('search_offers_placeholder')} placeholderTextColor={theme.inputPlaceholder} value={input} onChangeText={text => { setInput(text); setCommitted(text.trim().toLocaleLowerCase()); }} onSubmitEditing={submit} returnKeyType="search" submitBehavior="blurAndSubmit" accessibilityLabel={t('search_offers_placeholder')} />
        {input.length > 0 ? <ScalePressable accessibilityRole="button" accessibilityLabel={t('clear')} onPress={() => { setInput(''); setCommitted(''); }} hitSlop={10}><Ionicons name="close-circle" size={18} color={theme.iconMuted} /></ScalePressable> : null}
      </View>
    </View>

    <Animated.View entering={CONTENT_ENTER} style={{ flex: 1 }}>{status === 'loading' && !deals.length ? <View style={s.center}><ActivityIndicator size="large" color={theme.brand} /></View> : !committed ? <View style={s.center}><EmptyState icon="search-outline" title={t('search_offers_empty_title')} body={t('search_offers_empty_hint')} color={theme} /></View> : noMatches ? <FlatList
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={recommendations}
      keyExtractor={item => String(item.vendorId || item.id)}
      numColumns={1}
      renderItem={renderCard}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.listBottom}
      onRefresh={() => void refresh()}
      refreshing={status === 'loading'}
      ListHeaderComponent={<View style={s.noResultHeader}>
        <View style={[s.emptyIcon, { backgroundColor: theme.brandSoft }]}><Ionicons name="search-outline" size={22} color={theme.brand} /></View>
        <Text style={[s.emptyTitle, { color: theme.text }]}>{t('search_offers_no_results_title')}</Text>
        <Text style={[s.emptyBody, { color: theme.mutedText }]}>{t('search_offers_no_results_hint', { query: committed })}</Text>
        <ScalePressable style={s.tryAnother} onPress={tryAnother}><Ionicons name="refresh-outline" size={16} color={theme.brand} /><Text style={[s.tryAnotherText, { color: theme.brand }]}>{t('search_try_another')}</Text></ScalePressable>
        {recommendations.length ? <Text style={[s.recommendationsTitle, { color: theme.text, alignSelf: 'flex-start' }]}>{t('search_recommendations_title')}</Text> : null}
      </View>}
      ListEmptyComponent={<View style={s.center}><EmptyState icon="search-outline" title={t('search_offers_no_results_title')} body={t('search_offers_no_results_hint', { query: committed })} color={theme} /></View>}
    /> : status === 'loading' && !results.length ? <View style={s.center}><ActivityIndicator size="large" color={theme.brand} /></View> : results.length ? <FlatList
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      data={results}
      keyExtractor={item => String(item.vendorId || item.id)}
      numColumns={1}
      renderItem={renderCard}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.listBottom}
      onRefresh={() => void refresh()}
      refreshing={status === 'loading'}
      ListHeaderComponent={<View style={s.resultCountRow}><Text style={[s.resultCount, { color: theme.mutedText }]}>{t('search_results_count', { count: results.length })}</Text></View>}
    /> : <View style={s.center}><EmptyState icon="search-outline" title={t('search_offers_empty_title')} body={t('search_offers_empty_hint')} color={theme} /></View>}
    </Animated.View>
  </SafeAreaView>;
}

function EmptyState({ icon, title, body, color }: { icon: 'search-outline'; title: string; body: string; color: ReturnType<typeof useAppTheme>['theme'] }) {
  return <View style={s.emptyState}><View style={[s.emptyIcon, { backgroundColor: color.brandSoft }]}><Ionicons name={icon} size={22} color={color.brand} /></View><Text style={[s.emptyTitle, { color: color.text }]}>{title}</Text><Text style={[s.emptyBody, { color: color.mutedText }]}>{body}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 28, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1 },
  input: { flex: 1, fontFamily: F.body, fontSize: 16, padding: 0 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  emptyState: { width: '100%', maxWidth: 300, paddingVertical: 24, alignItems: 'center' }, emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 18, textAlign: 'center', lineHeight: 24, fontWeight: '600' }, emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginTop: 6 },
  noResultHeader: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20 }, tryAnother: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 6 }, tryAnotherText: { fontSize: 14, fontWeight: '600' },
  recommendationsTitle: { alignSelf: 'flex-start', fontSize: 18, fontWeight: '600', paddingTop: 28, paddingBottom: 16 }, resultCountRow: { width: '100%', alignItems: 'flex-start', paddingHorizontal: 20 }, resultCount: { fontSize: 14, paddingTop: 8, paddingBottom: 16 },
  cardWrap: { flex: 1, paddingHorizontal: 20, marginBottom: 16 }, listBottom: { paddingBottom: 40 },
});

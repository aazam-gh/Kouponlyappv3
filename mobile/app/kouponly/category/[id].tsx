import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, FlatList, Keyboard, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CategoryHeader, FilterTabs, RestaurantCard, SubCategoryChips } from '@/components/category';
import SearchBar from '@/components/home/SearchBar';
import { CatalogueNotice, useCatalogue } from '@/lib/catalogue';
import { categories, deals, type Deal } from '@/lib/data';
import { useAppTheme } from '@/context/AppThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNearbyDistances } from '@/lib/nearby';
import { hasAvailableBranchCoupon, useBenefits } from '@/lib/benefits';
import { dealAtBranch } from '@/lib/vendor-branches';
import { sortVendors, type VendorSortMode } from '@/lib/vendor-sorting';

export default function KouponlyCategoryScreen() {
  const { id, name, englishName } = useLocalSearchParams<{ id: string; name?: string; englishName?: string }>();
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { status, revision, refresh } = useCatalogue();
  const { distanceByVendor } = useNearbyDistances();
  const { benefits } = useBenefits();
  const [filter, setFilter] = React.useState('all');
  const [sortMode, setSortMode] = React.useState<VendorSortMode>('alphabetical');
  const [subcategory, setSubcategory] = React.useState('all');
  const [input, setInput] = React.useState('');
  const [query, setQuery] = React.useState('');
  const category = categories.find(item => item.id === String(id) || item.slug === String(id));
  const title = englishName || category?.name || name || 'Category';
  const isCategoryActive = Boolean(category);
  const subcategories = React.useMemo(() => [
    { id: 'all', name: t('all'), icon: 'apps-outline' },
    ...(category?.subcategories.filter(item => item.id).map(item => ({ id: item.id!, name: item.label, icon: item.image || '' })) || []),
  ], [category, t]);
  const rows = React.useMemo(() => {
    const matching = deals.map(deal => dealAtBranch(deal, distanceByVendor.get(String(deal.vendorId || deal.id))?.location.locationId)).filter(deal => {
      if (deal.categoryId !== category?.id && !deal.categoryIds?.includes(String(category?.id || ''))) return false;
      if (filter === 'top' && !(deal.trend > 0)) return false;
      if (subcategory !== 'all' && !deal.subcategoryIds?.includes(subcategory)) return false;
      const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const text = `${deal.name} ${deal.category} ${deal.keywords || ''} ${deal.offer} ${deal.description} ${deal.place}`.toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    });
    if (filter === 'nearest') return matching.sort((a, b) =>
      (distanceByVendor.get(String(a.vendorId || a.id))?.distanceKm ?? Infinity)
      - (distanceByVendor.get(String(b.vendorId || b.id))?.distanceKm ?? Infinity));
    if (filter === 'top') return matching.sort((a, b) => b.trend - a.trend);
    return sortVendors(matching, sortMode, vendor => !benefits?.subscription || hasAvailableBranchCoupon(vendor, benefits));
  }, [benefits, category?.id, distanceByVendor, filter, query, revision, sortMode, subcategory]);
  const cardWidth = width - 40;
  const submitSearch = () => { setQuery(input.trim()); setSubcategory('all'); Keyboard.dismiss(); };

  return <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <FlatList
      data={rows}
      numColumns={1}
      keyExtractor={item => String(item.vendorId || item.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? Math.max(110, insets.bottom + 92) : 24 }}
      ListHeaderComponent={<>
        <CategoryHeader onBackPress={() => router.back()} accessory={<SearchBar compact placeholder={t('search_placeholder_category', { category: String(title).toLocaleLowerCase() })} value={input} onChangeText={setInput} onSubmit={submitSearch} />} />
        {isCategoryActive ? <>
          <FilterTabs selectedFilter={filter} onFilterChange={setFilter} sortMode={sortMode} onSortModeChange={setSortMode} />
          {subcategories.length > 1 ? <SubCategoryChips subCategories={subcategories} selectedId={subcategory} onSelect={item => setSubcategory(item.id)} /> : null}
        </> : null}
        {status === 'offline' ? <View style={{ paddingHorizontal: 20 }}><CatalogueNotice /></View> : null}
      </>}
      renderItem={({ item }: { item: Deal }) => <RestaurantCard
        id={String(item.vendorId || item.id)}
        name={item.name}
        imageUri={item.image}
        logoUri={item.logo}
        imageHeight={Math.round(cardWidth * 0.38)}
        logoBottom={-40}
        logoSize={80}
        distance={distanceByVendor.get(String(item.vendorId || item.id))?.label}
        xcardEnabled={item.xcard}
        badgeLabel={item.cardLabel}
        offerBadgeLabel={item.offers?.[0]?.badgeLabel?.trim()}
        distanceOnImage
        overlapLogo
        titleCaseName
        contentStyle={{ minHeight: 56, justifyContent: 'center', paddingVertical: 6, paddingRight: 100 }}
        style={{ width: cardWidth, marginHorizontal: 20, marginBottom: 14, borderWidth: 1, borderColor: theme.border, borderRadius: 20, overflow: 'hidden' }}
        onPress={() => router.push({ pathname: '/kouponly/vendor/[id]', params: { id: String(item.vendorId || item.id) } } as any)}
      />}
      ListEmptyComponent={status === 'loading' ? <ActivityIndicator color={theme.brand} style={{ marginTop: 30 }} /> : <View style={styles.empty}><Text style={[styles.emptyTitle, { color: theme.text }]}>{t('state_filtered_empty_title')}</Text><Text style={{ color: theme.mutedText }}>{t('state_filtered_empty_message')}</Text></View>}
      onRefresh={() => void refresh()}
      refreshing={status === 'loading'}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, empty: { padding: 28, alignItems: 'center', gap: 8 }, emptyTitle: { fontSize: 18, fontWeight: '700' } });

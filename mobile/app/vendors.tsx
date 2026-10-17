import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppHeader from '@/components/navigation/AppHeader';
import RestaurantCard from '@/components/category/RestaurantCard';
import { StateSurface } from '@/components/StateSurface';
import { useAppTheme } from '@/context/AppThemeContext';
import { useCatalogue } from '@/lib/catalogue';
import { deals } from '@/lib/data';
import { useNearby, useNearbyDistances } from '@/lib/nearby';
import { homeQueryOptions } from '@/utils/homeQueries';
import FilterTabs from '@/components/category/FilterTabs';
import { isCouponOfferUsed, useBenefits } from '@/lib/benefits';
import { sortVendors, type VendorSortMode } from '@/lib/vendor-sorting';
import TrendingOfferListCard from '@/components/opportunities/TrendingOfferListCard';
import NewDealListCard from '@/components/opportunities/NewDealListCard';
import NearbyOfferListCard from '@/components/opportunities/NearbyOfferListCard';

export default function VendorsScreen() {
  const { section = 'top' } = useLocalSearchParams<{ section?: string }>();
  const { theme } = useAppTheme();
  const { status, error: catalogueError, revision, refresh } = useCatalogue();
  const nearby = useNearby();
  const { distanceByVendor } = useNearbyDistances();
  const { benefits } = useBenefits();
  const [filter, setFilter] = React.useState('top');
  const [sortMode, setSortMode] = React.useState<VendorSortMode>('alphabetical');
  const brands = useQuery({ ...homeQueryOptions.brands(), enabled: section === 'brands' });
  const trending = useQuery({ ...homeQueryOptions.offers(), enabled: section === 'trending' });
  const items = React.useMemo(() => {
    if (section === 'nearby') return nearby.position ? [...distanceByVendor.values()].sort((a, b) => a.distanceKm - b.distanceKm).map(row => row.location) : [];
    if (section === 'brands') return (brands.data || []).map(brand => ({ id: brand.vendorId, vendorId: brand.vendorId, name: brand.name, logo: brand.logoUrl, image: deals.find(deal => deal.vendorId === brand.vendorId)?.image }));
    if (section === 'trending') return (trending.data || []).map(card => ({ id: card.id, vendorId: card.vendorId, name: card.vendorName || card.nameEn || '', image: card.coverImage, logo: card.profilePicture }));
    if (section === 'new') return [...deals].filter(deal => deal.newest > 0).sort((a, b) => a.newest - b.newest || a.name.localeCompare(b.name));
    return [...deals].sort((a, b) => b.trend - a.trend);
  }, [section, revision, distanceByVendor, nearby.position, brands.data, trending.data]);
  const query = section === 'brands' ? brands : section === 'trending' ? trending : null;
  const visibleItems = React.useMemo(() => {
    const available = (item: (typeof items)[number]) => {
      if (!benefits?.subscription) return true;
      const vendorId = String(item.vendorId || item.id);
      const offers = deals.find(deal => String(deal.vendorId || deal.id) === vendorId)?.offers ?? [];
      return offers.some(offer => !isCouponOfferUsed(benefits, offer.id, vendorId));
    };
    if (filter === 'nearest') return [...items].sort((a, b) => (distanceByVendor.get(String(a.vendorId || a.id))?.distanceKm ?? Infinity) - (distanceByVendor.get(String(b.vendorId || b.id))?.distanceKm ?? Infinity));
    if (filter === 'top') return [...items].sort((a, b) => Number((b as any).trend || 0) - Number((a as any).trend || 0));
    return sortVendors(items, sortMode, available);
  }, [items, benefits, distanceByVendor, filter, sortMode]);
  const loading = query ? query.isLoading : status === 'loading';
  const error = query?.error || (section === 'nearby' ? nearby.error : catalogueError || null);
  const retry = () => query ? void query.refetch() : section === 'nearby' ? void nearby.load({ askForPermission: true, force: true }) : void refresh();
  const title = ({ nearby: 'Offers Near You', new: 'New Deals', trending: 'Trending Offers', brands: 'Brands', top: 'Top Brands' } as Record<string, string>)[section] || 'Vendors';
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
    <AppHeader title={title} onBackPress={() => router.back()} />
    {loading && !items.length ? <StateSurface kind="loading" /> : error && !items.length ? <StateSurface kind="error" message={String(error)} onRetry={retry} /> : <FlatList
      data={visibleItems} keyExtractor={item => String(item.vendorId || item.id)}
      contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      refreshing={loading} onRefresh={retry}
      ListHeaderComponent={<FilterTabs selectedFilter={filter} onFilterChange={setFilter} sortMode={sortMode} onSortModeChange={setSortMode} horizontalPadding={0} />}
      ListEmptyComponent={<StateSurface kind="empty" title={section === 'nearby' && !nearby.position ? 'Enable location on Home to see nearby offers' : 'No vendors yet'} />}
      renderItem={({ item }) => {
        const openVendor = () => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(item.vendorId || item.id) } });
        return <View>
          {section === 'trending' ? <TrendingOfferListCard name={item.name} imageUri={item.image} logoUri={item.logo} onPress={openVendor} />
            : section === 'new' ? <NewDealListCard name={item.name} imageUri={item.image} logoUri={item.logo} onPress={openVendor} />
              : section === 'nearby' ? <NearbyOfferListCard name={item.name} imageUri={item.image} logoUri={item.logo} onPress={openVendor} />
                : <RestaurantCard id={String(item.vendorId || item.id)} name={item.name} imageUri={item.image} logoUri={item.logo} borderColor={theme.border} imageHeight={136} contentStyle={{ minHeight: 56, justifyContent: 'center', paddingVertical: 6 }} onPress={openVendor} />}
        </View>;
      }}
    />}
  </SafeAreaView>;
}

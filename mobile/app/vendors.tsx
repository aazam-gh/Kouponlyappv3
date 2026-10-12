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

export default function VendorsScreen() {
  const { section = 'top' } = useLocalSearchParams<{ section?: string }>();
  const { theme } = useAppTheme();
  const { status, error: catalogueError, revision, refresh } = useCatalogue();
  const nearby = useNearby();
  const { distanceByVendor } = useNearbyDistances();
  const brands = useQuery({ ...homeQueryOptions.brands(), enabled: section === 'brands' });
  const trending = useQuery({ ...homeQueryOptions.offers(), enabled: section === 'trending' });
  const items = React.useMemo(() => {
    if (section === 'nearby') return nearby.position ? [...distanceByVendor.values()].sort((a, b) => a.distanceKm - b.distanceKm).map(row => row.location) : [];
    if (section === 'brands') return (brands.data || []).map(brand => ({ id: brand.vendorId, vendorId: brand.vendorId, name: brand.name, logo: brand.logoUrl, image: deals.find(deal => deal.vendorId === brand.vendorId)?.image }));
    if (section === 'trending') return (trending.data || []).map(card => ({ id: card.id, vendorId: card.vendorId, name: card.vendorName || card.nameEn || '', image: card.coverImage, logo: card.profilePicture }));
    return [...deals].sort((a, b) => section === 'new' ? b.newest - a.newest : b.trend - a.trend);
  }, [section, revision, distanceByVendor, nearby.position, brands.data, trending.data]);
  const query = section === 'brands' ? brands : section === 'trending' ? trending : null;
  const loading = query ? query.isLoading : status === 'loading';
  const error = query?.error || (section === 'nearby' ? nearby.error : catalogueError || null);
  const retry = () => query ? void query.refetch() : section === 'nearby' ? void nearby.load({ askForPermission: true, force: true }) : void refresh();
  const title = ({ nearby: 'Offers Near You', new: 'New Deals', trending: 'Trending Offers', brands: 'Brands', top: 'Top Vendors' } as Record<string, string>)[section] || 'Vendors';
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
    <AppHeader title={title} onBackPress={() => router.back()} />
    {loading && !items.length ? <StateSurface kind="loading" /> : error && !items.length ? <StateSurface kind="error" message={String(error)} onRetry={retry} /> : <FlatList
      data={items} keyExtractor={item => String(item.vendorId || item.id)}
      contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}
      keyboardShouldPersistTaps="handled"
      refreshing={loading} onRefresh={retry}
      ListEmptyComponent={<StateSurface kind="empty" title={section === 'nearby' && !nearby.position ? 'Enable location on Home to see nearby offers' : 'No vendors yet'} />}
      renderItem={({ item }) => <View><RestaurantCard id={String(item.vendorId || item.id)} name={item.name} imageUri={item.image} logoUri={item.logo} borderColor={theme.border} onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(item.vendorId || item.id) } })} /></View>}
    />}
  </SafeAreaView>;
}

import { Colors as BorderPalette } from '@/constants/Colors';
import React from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Platform, RefreshControl, StatusBar as NativeStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/Colors';
import { BrandGrid, CategoryGrid, HomeBackgroundIcons, HomeBannerCarousel, NewDeals, NewDealsSection, OpportunityHighlights, PartnerBannerCarousel, TrendingOffers } from '@/components/home';
import RestaurantCard from '@/components/category/RestaurantCard';
import HomeSectionHeading from '@/components/home/HomeSectionHeading';
import VerificationStatusBanner from '@/components/onboarding/VerificationStatusBanner';
import GreetingHeader from '@/components/home/GreetingHeader';
import { useAuth } from '@/lib/auth';
import { useCatalogue } from '@/lib/catalogue';
import { deals } from '@/lib/data';
import { useNearby, useNearbyDistances } from '@/lib/nearby';
import { useAppTheme } from '@/context/AppThemeContext';
import { useTabBarScrollVisibility } from '@/components/TabBarScrollVisibility';
import { queryClient } from '@/utils/queryClient';
import { triggerSubtleHaptic } from '@/utils/haptics';

const VENDOR_PAGE_SIZE = 6;

export default function HomeScreen() {
  const { user } = useAuth();
  const { revision } = useCatalogue();
  const { load: loadNearby } = useNearby();
  const { distanceByVendor } = useNearbyDistances();
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [visibleVendorCount, setVisibleVendorCount] = React.useState(VENDOR_PAGE_SIZE);
  const vendors = React.useMemo(() => [...deals], [revision]);
  const visibleVendors = React.useMemo(() => vendors.slice(0, visibleVendorCount), [vendors, visibleVendorCount]);
  const top = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 24 : insets.top;
  const userName = user?.user_metadata?.full_name
    ? String(user.user_metadata.full_name).split(' ')[0]
    : t('guest_home_name');
  const refreshHome = React.useCallback(() => Promise.all([
    queryClient.refetchQueries({
      predicate: query => ['catalogue-home', 'categories', 'cmsDocument', 'trendingOffers', 'vendor', 'opportunities'].includes(String(query.queryKey[0])),
      type: 'active',
    }),
    loadNearby({ force: true }),
  ]), [loadNearby]);
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await refreshHome(); } finally { setRefreshing(false); } }} tintColor="transparent" colors={["transparent"]} progressBackgroundColor="transparent" />;
  const tabBarScrollVisibility = useTabBarScrollVisibility();
  const search = () => {
    const query = searchQuery.trim();
    if (!query) return;
    triggerSubtleHaptic();
    router.push({ pathname: '/realx/search', params: { q: query } });
  };
  const openVendor = (vendorId?: string) => {
    if (vendorId) router.push({ pathname: '/realx/vendor/[id]', params: { id: vendorId } });
  };
  const loadMoreVendors = () => {
    setVisibleVendorCount(current => Math.min(current + VENDOR_PAGE_SIZE, vendors.length));
  };

  return <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]} edges={Platform.OS === 'ios' ? [] : ['bottom']}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <View style={{ height: top, backgroundColor: theme.background }} />
    <View style={s.wrapper}>
      <FlatList
        style={{ backgroundColor: theme.background }}
        data={visibleVendors}
        keyExtractor={vendor => String(vendor.vendorId || vendor.id)}
        renderItem={({ item: vendor }) => <View style={s.vendorItem}>
          <RestaurantCard
            id={String(vendor.vendorId || vendor.id)}
            name={vendor.name}
            imageUri={vendor.image}
            logoUri={vendor.logo}
            distance={distanceByVendor.get(String(vendor.vendorId || vendor.id))?.label}
            xcardEnabled={vendor.xcard}
            imageHeight={150}
            logoSize={80}
            logoBottom={-38}
            contentStyle={{ minHeight: 50, paddingRight: 104, paddingTop: 14, paddingBottom: 12 }}
            borderColor={BorderPalette.border}
            distanceOnImage
            overlapLogo
            badgeLabels={vendor.cardLabels}
            stackBadgeLabels
            titleCaseName
            onPress={() => openVendor(String(vendor.vendorId || vendor.id))}
            style={{ borderRadius: 20, borderColor: BorderPalette.border, overflow: 'hidden' }}
          />
        </View>}
        onEndReached={loadMoreVendors}
        onEndReachedThreshold={0.5}
        initialNumToRender={VENDOR_PAGE_SIZE}
        maxToRenderPerBatch={VENDOR_PAGE_SIZE}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: 64 + insets.bottom + 16 }]}
        refreshControl={refreshControl}
        {...tabBarScrollVisibility}
        ListHeaderComponent={<>
          <HomeBackgroundIcons />
          <VerificationStatusBanner />
          <PartnerBannerCarousel onBannerPress={banner => openVendor(banner.vendorId)} />
          <CategoryGrid />
          <NewDeals onVendorPress={vendor => openVendor(vendor.vendorId || String(vendor.id))} />
          <NewDealsSection />
          <HomeBannerCarousel />
          <TrendingOffers onVendorPress={vendor => openVendor(vendor.vendorId || vendor.id)} />
          <BrandGrid />
          <OpportunityHighlights />
          {vendors.length > 0 ? <View style={s.vendorHeading}>
            <HomeSectionHeading prefix="" highlight={t('all_vendors')} />
          </View> : null}
        </>}
        ListFooterComponent={<View style={{ height: 22 }} />}
      />
      <View style={[s.header, { backgroundColor: theme.background }]}>
        <GreetingHeader testID="home-search" userName={userName} searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={search} />
      </View>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  wrapper: { flex: 1, position: 'relative' },
  content: { paddingTop: 68 },
  vendorHeading: { paddingTop: 24 },
  vendorItem: { paddingHorizontal: 20, marginBottom: 14 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingVertical: 7 },
});

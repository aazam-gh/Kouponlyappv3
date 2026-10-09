import React from 'react';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, RefreshControl, ScrollView, StatusBar as NativeStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BrandGrid, CategoryGrid, HomeBackgroundIcons, HomeBannerCarousel, NewDeals, NewDealsSection, OpportunityHighlights, PartnerBannerCarousel, TrendingOffers } from '@/components/home';
import VerificationStatusBanner from '@/components/onboarding/VerificationStatusBanner';
import GreetingHeader from '@/components/home/GreetingHeader';
import { useAuth } from '@/lib/auth';
import { useNearby } from '@/lib/nearby';
import { useAppTheme } from '@/context/AppThemeContext';
import { useTabBarScrollVisibility } from '@/components/TabBarScrollVisibility';
import { queryClient } from '@/utils/queryClient';
import { triggerSubtleHaptic } from '@/utils/haptics';

export default function HomeScreen() {
  const { user } = useAuth();
  const { load: loadNearby } = useNearby();
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
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

  return <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]} edges={Platform.OS === 'ios' ? [] : ['bottom']}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <View style={{ height: top, backgroundColor: theme.background }} />
    <View style={s.wrapper}>
      <ScrollView
        style={{ backgroundColor: theme.background }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: 64 + insets.bottom + 16 }]}
        refreshControl={refreshControl}
        {...tabBarScrollVisibility}
      >
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
        <View style={{ height: 22 }} />
      </ScrollView>
      <View style={[s.header, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <GreetingHeader testID="home-search" userName={userName} searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={search} />
      </View>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  wrapper: { flex: 1, position: 'relative' },
  content: { paddingTop: 68 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
});

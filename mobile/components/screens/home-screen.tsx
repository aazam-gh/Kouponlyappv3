import React from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import ScrollCrunchSection from '@/components/home/ScrollCrunchSection';
import { router, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, Keyboard, Platform, Text, RefreshControl, StatusBar as NativeStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BrandGrid, CategoryGrid, HomeBackgroundIcons, HomeBannerCarousel, NewDeals, NewDealsSection, PartnerBannerCarousel, TrendingOffers } from '@/components/home';
import ScalePressable from '@/components/ScalePressable';
import { RemoteImage } from '@/components/RemoteImage';
import { searchVendors } from '@/lib/vendor-search';
import { Typography } from '@/constants/Typography';
import HomeSectionHeading from '@/components/home/HomeSectionHeading';
import VerificationStatusBanner from '@/components/onboarding/VerificationStatusBanner';
import GreetingHeader from '@/components/home/GreetingHeader';
import { useAuth } from '@/lib/auth';
import { useCatalogue } from '@/lib/catalogue';
import { deals } from '@/lib/data';
import { useNearby } from '@/lib/nearby';
import { useAppTheme } from '@/context/AppThemeContext';
import { useTabBarScrollVisibility } from '@/components/TabBarScrollVisibility';
import { queryClient } from '@/utils/queryClient';
import { triggerSubtleHaptic } from '@/utils/haptics';

const VENDOR_PAGE_SIZE = 10;

export default function HomeScreen() {
  const { user } = useAuth();
  const { revision, refresh: refreshCatalogue, homeSectionOrder } = useCatalogue();
  const { load: loadNearby } = useNearby();
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const vendors = React.useMemo(() => [...deals], [revision]);
  const visibleVendors = React.useMemo(() => [...vendors].sort((a, b) => b.trend - a.trend).slice(0, VENDOR_PAGE_SIZE), [vendors]);
  const suggestions = React.useMemo(() => {
    const matches = searchVendors(vendors, searchQuery);
    return (matches.length ? matches : visibleVendors).slice(0, 5);
  }, [vendors, searchQuery, visibleVendors]);
  const scrollY = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const searchHeaderHeight = useSharedValue(68);
  const scrollHandler = useAnimatedScrollHandler(event => { scrollY.set(Math.max(0, event.contentOffset.y)); });
  const listRef = React.useRef<ScrollView>(null);
  const navigation = useNavigation();
  React.useEffect(() => navigation.addListener('tabPress' as any, () => { Keyboard.dismiss(); setSearchQuery(''); listRef.current?.scrollTo({ y: 0, animated: true }); }), [navigation]);
  const top = Platform.OS === 'android' ? NativeStatusBar.currentHeight ?? 24 : insets.top;
  const userName = user?.user_metadata?.full_name
    ? String(user.user_metadata.full_name).split(' ')[0]
    : t('guest_home_name');
  const refreshHome = React.useCallback(() => Promise.all([
    refreshCatalogue(),
    queryClient.refetchQueries({
      predicate: query => ['catalogue-home', 'categories', 'cmsDocument', 'trendingOffers', 'vendor'].includes(String(query.queryKey[0])),
      type: 'active',
    }),
    loadNearby({ force: true }),
  ]), [loadNearby, refreshCatalogue]);
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await Promise.all([refreshHome(), new Promise(resolve => setTimeout(resolve, 800))]); } finally { setRefreshing(false); } }} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />;
  const tabBarScrollVisibility = useTabBarScrollVisibility();
  const search = () => {
    Keyboard.dismiss();
    const query = searchQuery.trim();
    if (!query) return;
    triggerSubtleHaptic();
    router.push({ pathname: '/realx/search', params: { q: query } });
  };
  const openVendor = (vendorId?: string) => {
    Keyboard.dismiss();
    if (vendorId) router.push({ pathname: '/realx/vendor/[id]', params: { id: vendorId } });
  };

  const sections = {
    'partner-banners': <PartnerBannerCarousel onBannerPress={banner => openVendor(banner.vendorId)} />,
    'categories': <ScrollCrunchSection testID="category-scroll-crunch" scrollY={scrollY} viewportHeight={viewportHeight} bottomInset={64 + insets.bottom} pinBelowHeader={searchHeaderHeight}><CategoryGrid /></ScrollCrunchSection>,
    'nearby-vendors': <NewDeals onVendorPress={vendor => openVendor(vendor.vendorId || String(vendor.id))} />,
    'new-deals': <NewDealsSection scrollY={scrollY} viewportHeight={viewportHeight} bottomInset={64 + insets.bottom} searchHeaderHeight={searchHeaderHeight} />,
    'featured-showcase': <HomeBannerCarousel />,
    'trending-offers': <TrendingOffers onVendorPress={vendor => openVendor(vendor.vendorId || vendor.id)} />,
    'brand-logos': <BrandGrid />,
    'top-brands': <View testID="home-section-top-brands">{vendors.length > 0 ? <View style={s.vendorHeading}><HomeSectionHeading prefix="Top Brands" highlight="" onSeeMore={() => router.push('/vendors' as any)} /></View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 }}>{visibleVendors.map(vendor => <ScalePressable key={vendor.vendorId || vendor.id} accessibilityRole="button" accessibilityLabel={vendor.name} onPress={() => openVendor(String(vendor.vendorId || vendor.id))} style={{ width: '20%', paddingHorizontal: 4, marginBottom: 16 }}>
        <View style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.logoTile, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
          {vendor.logo ? <RemoteImage source={{ uri: vendor.logo }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text style={{ color: theme.brandText, fontSize: 28, ...Typography.getTextVariantStyle('bodyStrong') }}>{vendor.name.charAt(0)}</Text>}
        </View>
      </ScalePressable>)}</View></View>,
  };


  return <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]} edges={Platform.OS === 'ios' ? [] : ['bottom']}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <View style={{ height: top, backgroundColor: theme.background }} />
    <View style={s.wrapper}>
      <Animated.ScrollView ref={listRef} style={{ backgroundColor: theme.background }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={[s.content, { paddingBottom: 64 + insets.bottom + 16 }]} refreshControl={refreshControl} {...tabBarScrollVisibility} onScroll={scrollHandler} scrollEventThrottle={16} onLayout={event => viewportHeight.set(event.nativeEvent.layout.height)}>
        <HomeBackgroundIcons />
        <VerificationStatusBanner />
        {homeSectionOrder.map(id => <React.Fragment key={id}>{sections[id]}</React.Fragment>)}
      </Animated.ScrollView>
      {refreshing ? <View accessibilityRole="progressbar" accessibilityLabel={t('loading')} pointerEvents="none" style={s.refreshing}>
        <ActivityIndicator size="large" color={theme.brand} />
      </View> : null}
      <View onLayout={event => searchHeaderHeight.set(event.nativeEvent.layout.height)} style={[s.header, { backgroundColor: theme.background }]}>
        <GreetingHeader testID="home-search" userName={userName} searchQuery={searchQuery} onSearchChange={setSearchQuery} onSearchSubmit={search} />
        {searchQuery.trim() ? <View style={{ marginHorizontal: 20, marginTop: 8, padding: 12, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
          {suggestions.map(vendor => <ScalePressable key={vendor.id} accessibilityRole="button" onPress={() => openVendor(String(vendor.vendorId || vendor.id))} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.text, ...Typography.getTextVariantStyle('bodyStrong') }}>{vendor.name}</Text><Text style={{ color: theme.mutedText, fontSize: 12 }}>{vendor.category}</Text></ScalePressable>)}
          <ScalePressable accessibilityRole="button" onPress={search} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.brandText }}>View all search results</Text></ScalePressable>
        </View> : null}
      </View>
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  wrapper: { flex: 1, position: 'relative' },
  content: { paddingTop: 68 },
  refreshing: { position: 'absolute', top: 60, left: 0, right: 0, zIndex: 9, alignItems: 'center', justifyContent: 'center' },
  vendorHeading: { paddingTop: 16 },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingVertical: 7 },
});

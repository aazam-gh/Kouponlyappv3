import { useQuery } from '@tanstack/react-query';
import { homeQueryOptions } from '@/utils/homeQueries';
import React from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import ScrollCrunchSection from '@/components/home/ScrollCrunchSection';
import { router, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, ScrollView, Keyboard, Platform, Text, RefreshControl, StatusBar as NativeStatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { BrandGrid, CategoryGrid, HomeBannerCarousel, NewDeals, NewDealsSection, PartnerBannerCarousel, TrendingOffers } from '@/components/home';
import ScalePressable from '@/components/ScalePressable';
import { searchVendors } from '@/lib/vendor-search';
import { Typography } from '@/constants/Typography';
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
import { DEFAULT_HOME_SECTION_ORDER, type HomeSectionId } from '@/lib/home-layout';
import { useHomeContent } from '@/utils/useHomeContent';
import HomeLaunchPromotion from '@/components/home/HomeLaunchPromotion';

const VENDOR_PAGE_SIZE = 10;

export default function HomeScreen() {
  const { user } = useAuth();
  const { categories, editorial } = useHomeContent();
  const homeSectionOrder = editorial.data?.order ?? DEFAULT_HOME_SECTION_ORDER;
  const nearby = useNearby();
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [showLaterSections, setShowLaterSections] = React.useState(false);
  const visibleSections = editorial.isPending ? [] : showLaterSections ? homeSectionOrder : homeSectionOrder.slice(0, 2);
  const needsCatalogue = visibleSections.some(id => id === 'new-deals' || id === 'trending-offers' || id === 'brand-logos');
  const previews = useQuery({ ...homeQueryOptions.previews(), enabled: needsCatalogue });
  const useFullCatalogue = needsCatalogue && previews.isError && !previews.data;
  const { revision, refresh: refreshCatalogue } = useCatalogue(useFullCatalogue || Boolean(searchQuery.trim()));
  const trendingPreviews = React.useMemo(() => previews.data?.trending.map(card => ({
    ...card, nameEn: card.name, coverImage: card.image, profilePicture: card.logo,
  })), [previews.data]);
  const contentShown = React.useRef(false);
  const frame = React.useRef<number | undefined>(undefined);
  const onFirstContentLayout = React.useCallback(() => {
    if (contentShown.current) return;
    contentShown.current = true;
    frame.current = requestAnimationFrame(() => {
      performance.mark?.('kouponly.home.first-content');
      setShowLaterSections(true);
    });
  }, []);
  React.useEffect(() => () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);
  React.useEffect(() => {
    if (showLaterSections || editorial.isPending || (homeSectionOrder.includes('categories') && categories.isPending)) return;
    const fallback = setTimeout(() => setShowLaterSections(true), 400);
    return () => clearTimeout(fallback);
  }, [categories.isPending, editorial.isPending, homeSectionOrder, showLaterSections]);
  const partnerImageShown = React.useRef(false);
  const onFirstBannerDisplay = React.useCallback(() => {
    if (!partnerImageShown.current) performance.mark?.('kouponly.home.first-banner');
    partnerImageShown.current = true;
    onFirstContentLayout();
  }, [onFirstContentLayout]);
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
    useFullCatalogue || revision > 0 ? refreshCatalogue() : Promise.resolve(),
    queryClient.refetchQueries({
      predicate: ({ queryKey: [scope, id] }) => scope === 'home-previews' || scope === 'home-editorial' || scope === 'categories' || (scope === 'cmsDocument' && id !== 'brand'),
      type: 'active',
    }),
    nearby.status === 'ready' ? nearby.load({ force: true }) : Promise.resolve(),
  ]), [nearby.load, nearby.status, useFullCatalogue, refreshCatalogue, revision]);
  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); try { await refreshHome(); } finally { setRefreshing(false); } }} tintColor="transparent" colors={['transparent']} progressBackgroundColor="transparent" />;
  const tabBarScrollVisibility = useTabBarScrollVisibility();
  const search = () => {
    Keyboard.dismiss();
    const query = searchQuery.trim();
    if (!query) return;
    triggerSubtleHaptic();
    router.push({ pathname: '/kouponly/search', params: { q: query } } as any);
  };
  const openVendor = (vendorId?: string) => {
    Keyboard.dismiss();
    if (vendorId) router.push({ pathname: '/kouponly/vendor/[id]', params: { id: vendorId } } as any);
  };

  const sections: Record<HomeSectionId, React.ReactNode> = {
    'partner-banners': <PartnerBannerCarousel banners={editorial.data?.banners ?? []} onBannerPress={banner => openVendor(banner.vendorId)} onFirstImageDisplay={onFirstBannerDisplay} />,
    'categories': <ScrollCrunchSection testID="category-scroll-crunch" scrollY={scrollY} viewportHeight={viewportHeight} bottomInset={64 + insets.bottom} pinBelowHeader={searchHeaderHeight}><CategoryGrid categories={categories.data ?? []} loading={categories.isPending} error={categories.isError} onRetry={() => void categories.refetch()} onContentLayout={onFirstContentLayout} /></ScrollCrunchSection>,
    'nearby-vendors': <NewDeals onVendorPress={vendor => openVendor(vendor.vendorId || String(vendor.id))} />,
    'new-deals': <NewDealsSection previews={previews.data?.newDeals ?? (useFullCatalogue ? undefined : [])} scrollY={scrollY} viewportHeight={viewportHeight} bottomInset={64 + insets.bottom} searchHeaderHeight={searchHeaderHeight} />,
    'featured-showcase': <HomeBannerCarousel />,
    'trending-offers': <TrendingOffers previews={trendingPreviews ?? (useFullCatalogue ? undefined : [])} onVendorPress={vendor => openVendor(vendor.vendorId || vendor.id)} />,
    'brand-logos': <BrandGrid previews={previews.data?.brands ?? (useFullCatalogue ? undefined : [])} />,
  };

  return <SafeAreaView style={[s.screen, { backgroundColor: theme.background }]} edges={Platform.OS === 'ios' ? [] : ['bottom']}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <View style={{ height: top, backgroundColor: theme.background }} />
    <View style={s.wrapper}>
      <Animated.ScrollView ref={listRef} style={{ backgroundColor: theme.background }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} decelerationRate="fast" contentContainerStyle={[s.content, { paddingBottom: 64 + insets.bottom + 16 }]} refreshControl={refreshControl} {...tabBarScrollVisibility} onScroll={scrollHandler} scrollEventThrottle={16} onLayout={event => viewportHeight.set(event.nativeEvent.layout.height)}>
        <VerificationStatusBanner />
        {visibleSections.map(id => <React.Fragment key={id}>{sections[id]}</React.Fragment>)}
        {showLaterSections && user ? <HomeLaunchPromotion /> : null}
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
  refreshing: { position: 'absolute', top: 100, left: 0, right: 0, zIndex: 11, alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingVertical: 7 },
});

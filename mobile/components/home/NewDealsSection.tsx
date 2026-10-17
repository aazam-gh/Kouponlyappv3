import { Colors as BorderPalette } from '@/constants/Colors';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { useCatalogue } from '@/lib/catalogue';
import { useNearbyDistances } from '@/lib/nearby';
import { deals } from '@/lib/data';
import RestaurantCard from '../category/RestaurantCard';
import HomeSectionHeading from './HomeSectionHeading';
import ZigzagSection from './ZigzagSection';
import ScrollCrunchSection from './ScrollCrunchSection';
import type { SharedValue } from 'react-native-reanimated';
import { HOME_CAROUSEL_GAP, HOME_HORIZONTAL_GUTTER } from './layout';

export default function NewDealsSection({ scrollY, viewportHeight, bottomInset, searchHeaderHeight }: {
  scrollY: SharedValue<number>; viewportHeight: SharedValue<number>; bottomInset: number; searchHeaderHeight: SharedValue<number>;
}) {
  const { t } = useTranslation();
  const { isRTL } = useAppLocale();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const { revision } = useCatalogue();
  const { distanceByVendor } = useNearbyDistances();
  const router = useRouter();
  const newestDeals = useMemo(() => [...deals].filter(deal => deal.newest > 0).sort((a, b) => a.newest - b.newest || a.name.localeCompare(b.name)), [revision]);

  if (!newestDeals.length) return null;

  return (
    <>
      <HomeSectionHeading prefix={t('new_deals_label_prefix')} highlight={t('new_deals_label_highlight')} onSeeMore={() => router.push({ pathname: '/vendors', params: { section: 'new' } } as any)} />
      <ScrollCrunchSection testID="new-deals-scroll-crunch" scrollY={scrollY} viewportHeight={viewportHeight} bottomInset={bottomInset} pinBelowHeader={searchHeaderHeight}>
      <ZigzagSection width={width} cutoutColor={theme.background} collapseCompletely contentStyle={{ paddingTop: 11, paddingBottom: 12 }}>
          <ScrollView snapToInterval={width * 0.6 + HOME_CAROUSEL_GAP} decelerationRate="fast" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }]}>
            {newestDeals.map(deal => (
              <RestaurantCard
                key={deal.vendorId || deal.id}
                id={String(deal.vendorId || deal.id)}
                name={deal.name}
                imageUri={deal.image}
                logoUri={deal.logo}
                imageHeight={89.2}
                logoBottom={-35.6}
                distance={distanceByVendor.get(String(deal.vendorId || deal.id))?.label}
                xcardEnabled={deal.xcard}
                distanceOnImage
                overlapLogo
                badgeLabel={deal.cardLabel}
                borderColor={BorderPalette.cardOutline}
                titleCaseName
                contentStyle={{ minHeight: 48, justifyContent: 'center', paddingTop: 10, paddingBottom: 10 }}
                style={{ width: width * 0.6, borderWidth: 1, borderColor: BorderPalette.cardOutline, borderRadius: 20, overflow: 'hidden' }}
                onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(deal.vendorId || deal.id) } } as any)}
              />
            ))}
          </ScrollView>
      </ZigzagSection>
      </ScrollCrunchSection>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: HOME_HORIZONTAL_GUTTER, gap: HOME_CAROUSEL_GAP },
});

import { Colors as BorderPalette } from '@/constants/Colors';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
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
  const newestDeals = useMemo(() => [...deals].sort((a, b) => b.newest - a.newest).slice(0, 10), [revision]);

  if (!newestDeals.length) return null;

  return (
    <>
      <HomeSectionHeading prefix={t('new_deals_label_prefix')} highlight={t('new_deals_label_highlight')} onSeeMore={() => router.push({ pathname: '/vendors', params: { section: 'new' } } as any)} />
      <ScrollCrunchSection testID="new-deals-scroll-crunch" scrollY={scrollY} viewportHeight={viewportHeight} bottomInset={bottomInset} pinBelowHeader={searchHeaderHeight}>
      <ZigzagSection width={width} cutoutColor={theme.background} collapseCompletely contentStyle={{ paddingTop: 11, paddingBottom: 12 }}>
        <>
          <Svg accessible={false} pointerEvents="none" width={24} height={72} style={styles.leftSprite} viewBox="0 0 24 72">
            <Path d="M12 1.5 14.1 9l7.4 2.1-7.4 2.1-2.1 7.3L9.9 13.2l-7.4-2.1L9.9 9z" fill="#159646" opacity={0.62} />
            <Circle cx="19" cy="53" r="2" fill="#159646" opacity={0.55} />
            <Circle cx="11" cy="59" r="1.4" fill="#159646" opacity={0.4} />
          </Svg>
          <Svg accessible={false} pointerEvents="none" width={24} height={24} style={styles.rightSprite} viewBox="0 0 24 24">
            <Path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5m6.4 6.4 3.5 3.5m0-13.4-3.5 3.5m-6.4 6.4-3.5 3.5" stroke="#159646" strokeWidth={2.2} strokeLinecap="round" opacity={0.65} />
            <Circle cx="12" cy="12" r="2.2" fill="#159646" opacity={0.7} />
          </Svg>
          <Svg accessible={false} pointerEvents="none" width={24} height={20} style={styles.ticketSprite} viewBox="0 0 24 20">
            <Path d="M2 3h20v4a3 3 0 0 0 0 6v4H2v-4a3 3 0 0 0 0-6z" fill="#159646" opacity={0.58} />
            <Path d="M12 5.5v9" stroke={BorderPalette.brandGreen} strokeWidth={1.5} strokeDasharray="1.5 1.5" />
          </Svg>
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
                badgeLabel={deal.cardLabels?.[0] ?? deal.cardLabel}
                borderColor={BorderPalette.border}
                titleCaseName
                contentStyle={{ minHeight: 48, justifyContent: 'flex-start', paddingTop: 8, paddingBottom: 0 }}
                style={{ width: width * 0.6, borderWidth: 1, borderColor: BorderPalette.border, borderRadius: 20, overflow: 'hidden' }}
                onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(deal.vendorId || deal.id) } } as any)}
              />
            ))}
          </ScrollView>
        </>
      </ZigzagSection>
      </ScrollCrunchSection>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: HOME_HORIZONTAL_GUTTER, gap: HOME_CAROUSEL_GAP },
  leftSprite: { position: 'absolute', top: 12, left: 0 },
  rightSprite: { position: 'absolute', top: 35, right: 1 },
  ticketSprite: { position: 'absolute', bottom: 2, right: 2 },
});

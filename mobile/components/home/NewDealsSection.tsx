import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { useCatalogue } from '@/lib/catalogue';
import { deals } from '@/lib/data';
import RestaurantCard from '../category/RestaurantCard';
import HomeSectionHeading from './HomeSectionHeading';
import { HOME_CAROUSEL_GAP, HOME_HORIZONTAL_GUTTER, HOME_SECTION_TOP_SPACING } from './layout';

export default function NewDealsSection() {
  const { t } = useTranslation();
  const { isRTL } = useAppLocale();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const { revision } = useCatalogue();
  const router = useRouter();
  const newestDeals = useMemo(() => [...deals].sort((a, b) => b.newest - a.newest).slice(0, 10), [revision]);

  if (!newestDeals.length) return null;

  return (
    <View style={styles.container}>
      <HomeSectionHeading prefix={t('new_deals_label_prefix')} highlight={t('new_deals_label_highlight')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {newestDeals.map(deal => (
          <RestaurantCard
            key={deal.vendorId || deal.id}
            id={String(deal.vendorId || deal.id)}
            name={deal.name}
            imageUri={deal.image}
            logoUri={deal.logo}
            imageHeight={89.2}
            logoBottom={-35.6}
            distance={deal.distanceKm > 0 ? deal.distance : undefined}
            xcardEnabled={deal.xcard}
            distanceOnImage
            overlapLogo
            titleCaseName
            contentStyle={{ minHeight: 48, justifyContent: 'flex-start', paddingTop: 8, paddingBottom: 0 }}
            style={{ width: width * 0.6, borderWidth: 1, borderColor: theme.border, borderRadius: 20, overflow: 'hidden' }}
            onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: String(deal.vendorId || deal.id) } } as any)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: HOME_SECTION_TOP_SPACING },
  scrollContent: { paddingHorizontal: HOME_HORIZONTAL_GUTTER, gap: HOME_CAROUSEL_GAP },
});

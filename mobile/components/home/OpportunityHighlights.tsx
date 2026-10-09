import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Typography } from '../../constants/Typography';
import { useAppLocale } from '../../context/LocaleContext';
import { useAppTheme } from '../../context/AppThemeContext';
import { homeQueryOptions } from '../../utils/homeQueries';
import { OpportunityCard } from '../opportunities/OpportunityCard';
import {
  HOME_CAROUSEL_GAP,
  HOME_HORIZONTAL_GUTTER,
  HOME_SECTION_HEADER_GAP,
  HOME_SECTION_TOP_SPACING,
} from './layout';

export function OpportunityHighlights() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isRTL } = useAppLocale();
  const { theme } = useAppTheme();
  const { data = [] } = useQuery(homeQueryOptions.opportunities());
  const highlights = data.filter((item) => item.featured).slice(0, 5);
  const items = highlights.length > 0 ? highlights : data.slice(0, 5);

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <View style={styles.headingCopy}>
          <Text
            style={[
              styles.eyebrow,
              { color: '#000000', textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {t('student_life_unlocked')}
          </Text>
          <Text
            style={[
              styles.title,
              { color: '#000000', textAlign: isRTL ? 'right' : 'left' },
            ]}
          >
            {t('opportunities_for_you')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/explore')}
          activeOpacity={0.7}
        >
          <Text style={[styles.seeAll, { color: theme.brandText }]}>{t('see_all')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, isRTL && styles.rowReverse]}
      >
        {items.map((item) => (
          <OpportunityCard
            key={item.id}
            opportunity={item}
            compact
            onPress={() => router.push({ pathname: '/realx/opportunity/[id]', params: { id: item.id } })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: HOME_SECTION_TOP_SPACING,
    paddingBottom: HOME_SECTION_TOP_SPACING,
    gap: HOME_SECTION_HEADER_GAP,
  },
  header: {
    paddingHorizontal: HOME_HORIZONTAL_GUTTER,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowReverse: { flexDirection: 'row-reverse' },
  headingCopy: { flex: 1, gap: 2 },
  eyebrow: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  title: { fontSize: 21, ...Typography.getTextVariantStyle('bodyStrong') },
  seeAll: { fontSize: 13, ...Typography.getTextVariantStyle('bodyStrong') },
  row: {
    paddingHorizontal: HOME_HORIZONTAL_GUTTER,
    gap: HOME_CAROUSEL_GAP,
  },
});

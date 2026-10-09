import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Typography } from '../../constants/Typography';
import { useAppLocale } from '../../context/LocaleContext';
import { useAppTheme } from '../../context/AppThemeContext';
import type { Opportunity } from '../../types/opportunities';
import { toDate } from '../../utils/opportunities';

type OpportunityCardProps = {
  opportunity: Opportunity;
  onPress: () => void;
  compact?: boolean;
};

export function OpportunityCard({
  opportunity,
  onPress,
  compact = false,
}: OpportunityCardProps) {
  const { t } = useTranslation();
  const { isRTL } = useAppLocale();
  const { theme } = useAppTheme();
  const title = opportunity.titleEn;
  const summary = opportunity.summaryEn;
  const deadline = toDate(opportunity.deadline || opportunity.startsAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Opens opportunity details"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compactCard,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      {opportunity.imageUrl ? (
        <Image
          source={{ uri: opportunity.imageUrl }}
          style={[styles.image, compact && styles.compactImage]}
          contentFit="cover"
          transition={180}
        />
      ) : (
        <View
          style={[
            styles.image,
            compact && styles.compactImage,
            styles.imageFallback,
            { backgroundColor: theme.brandSoft },
          ]}
        >
          <Ionicons
            name={opportunity.kind === 'career' ? 'briefcase-outline' : 'sparkles-outline'}
            size={30}
            color={theme.brandText}
          />
        </View>
      )}
      <View style={styles.content}>
        <View style={[styles.metaRow, isRTL && styles.rowReverse]}>
          <View style={[styles.kindPill, { backgroundColor: theme.brandSoft }]}>
            <Text style={[styles.kindText, { color: theme.brandText }]}>
              {t(`opportunity_kind_${opportunity.kind}`)}
            </Text>
          </View>
          {opportunity.featured ? (
            <Text style={[styles.featured, { color: theme.warning }]}>
              {t('featured')}
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.title,
            { color: theme.text, textAlign: isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {summary && !compact ? (
          <Text
            style={[
              styles.summary,
              { color: theme.mutedText, textAlign: isRTL ? 'right' : 'left' },
            ]}
            numberOfLines={2}
          >
            {summary}
          </Text>
        ) : null}
        <View style={[styles.footer, isRTL && styles.rowReverse]}>
          <Text style={[styles.provider, { color: theme.subtleText }]} numberOfLines={1}>
            {opportunity.providerName || t('realx')}
          </Text>
          {deadline ? (
            <Text style={[styles.deadline, { color: theme.mutedText }]}>
              {deadline.toLocaleDateString('en-QA', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
  },
  compactCard: {
    width: '100%',
    maxWidth: 320,
  },
  image: {
    width: '100%',
    height: 152,
  },
  compactImage: {
    height: 116,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  kindPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  kindText: {
    fontSize: 11,
    textTransform: 'uppercase',
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  featured: {
    fontSize: 12,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    ...Typography.getTextVariantStyle('body'),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  provider: {
    flex: 1,
    fontSize: 12,
    ...Typography.getTextVariantStyle('body'),
  },
  deadline: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
});

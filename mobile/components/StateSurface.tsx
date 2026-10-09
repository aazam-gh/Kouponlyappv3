import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Typography } from '../constants/Typography';
import { useAppTheme } from '../context/AppThemeContext';
import { useAppLocale } from '../context/LocaleContext';

type StateSurfaceKind = 'loading' | 'empty' | 'filtered-empty' | 'error' | 'offline' | 'not-found';

type Props = {
  kind: StateSurfaceKind;
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
  colors?: {
    primary: string;
    text: string;
    mutedText: string;
    surface: string;
    danger: string;
    onPrimary: string;
  };
};

const details: Record<StateSurfaceKind, { icon: keyof typeof Ionicons.glyphMap; titleKey: string; messageKey: string }> = {
  loading: { icon: 'hourglass-outline', titleKey: 'state_loading_title', messageKey: 'state_loading_message' },
  empty: { icon: 'folder-open-outline', titleKey: 'state_empty_title', messageKey: 'state_empty_message' },
  'filtered-empty': { icon: 'search-outline', titleKey: 'state_filtered_empty_title', messageKey: 'state_filtered_empty_message' },
  error: { icon: 'alert-circle-outline', titleKey: 'state_error_title', messageKey: 'state_error_message' },
  offline: { icon: 'cloud-offline-outline', titleKey: 'state_offline_title', messageKey: 'state_offline_message' },
  'not-found': { icon: 'compass-outline', titleKey: 'state_not_found_title', messageKey: 'state_not_found_message' },
};

export function StateSurface({ kind, title, message, onRetry, compact = false, colors: colorOverrides }: Props) {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  const detail = details[kind];
  const colors = colorOverrides ?? {
    primary: theme.brand,
    text: theme.text,
    mutedText: theme.mutedText,
    surface: theme.brandSoft,
    danger: theme.danger,
    onPrimary: theme.onActionSolid,
  };

  if (kind === 'loading') {
    return (
      <View style={[styles.container, compact && styles.compact]} accessibilityRole="progressbar" accessibilityLiveRegion="polite" accessibilityLabel={t(detail.titleKey)}>
        <ActivityIndicator size={compact ? 'small' : 'large'} color={colors.primary} />
        {!compact && <Text allowFontScaling style={[styles.message, { color: colors.mutedText }, isRTL && styles.rtl]}>{message || t(detail.messageKey)}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.container, compact && styles.compact]} accessibilityLiveRegion="polite">
      <View style={[styles.icon, { backgroundColor: colors.surface }]}>
        <Ionicons name={detail.icon} size={compact ? 23 : 30} color={kind === 'error' ? colors.danger : colors.primary} />
      </View>
      <Text accessibilityRole="header" allowFontScaling selectable style={[styles.title, { color: colors.text }, isRTL && styles.rtl]}>{title || t(detail.titleKey)}</Text>
      <Text allowFontScaling selectable style={[styles.message, { color: colors.mutedText }, isRTL && styles.rtl]}>{message || t(detail.messageKey)}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={[styles.retry, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={t('retry')}>
          <Ionicons name="refresh-outline" size={17} color={colors.onPrimary} />
          <Text allowFontScaling style={[styles.retryText, { color: colors.onPrimary }]}>{t('retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 32, gap: 10 },
  compact: { flex: 0, minHeight: 96, paddingVertical: 20 },
  icon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 17, textAlign: 'center' },
  message: { ...Typography.getTextVariantStyle('body'), fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  rtl: { writingDirection: 'rtl' },
  retry: { flexDirection: 'row', gap: 7, alignItems: 'center', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, marginTop: 6 },
  retryText: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 14 },
});

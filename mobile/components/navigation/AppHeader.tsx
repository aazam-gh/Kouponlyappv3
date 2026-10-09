import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Typography, type TextVariant } from '../../constants/Typography';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAppLocale } from '../../context/LocaleContext';
import { triggerSubtleHaptic } from '../../utils/haptics';
import ResponsiveText from '../ResponsiveText';

type HeaderVariant = 'root' | 'navigation';

type AppHeaderProps = {
  title: ReactNode;
  variant?: HeaderVariant;
  onBackPress?: () => void;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  titleVariant?: TextVariant;
  backAccessibilityLabel?: string;
  backButtonStyle?: StyleProp<ViewStyle>;
  backIconColor?: string;
};

type HeaderIconButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  color?: string;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  color,
  selected = false,
  style,
}: HeaderIconButtonProps) {
  const { theme } = useAppTheme();

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      activeOpacity={0.72}
      hitSlop={6}
      onPress={() => {
        triggerSubtleHaptic();
        onPress();
      }}
      style={[
        styles.iconButton,
        {
          backgroundColor: selected ? theme.brandSoft : theme.cardMuted,
          borderColor: selected ? theme.brand : theme.border,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={21} color={color ?? (selected ? theme.brand : theme.icon)} />
    </TouchableOpacity>
  );
}

export default function AppHeader({
  title,
  variant = 'navigation',
  onBackPress,
  trailing,
  style,
  titleStyle,
  titleVariant = 'bodyStrong',
  backAccessibilityLabel,
  backButtonStyle,
  backIconColor,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  const isRoot = variant === 'root';

  return (
    <View
      style={[
        styles.container,
        isRoot ? styles.rootContainer : styles.navigationContainer,
        style,
      ]}
    >
      {onBackPress ? (
        <HeaderIconButton
          icon={isRTL ? 'arrow-forward' : 'arrow-back'}
          onPress={onBackPress}
          accessibilityLabel={backAccessibilityLabel ?? t('back')}
          color={backIconColor}
          style={backButtonStyle}
        />
      ) : null}

      <View style={styles.titleContainer}>
        {title ? (
          <ResponsiveText
            accessibilityRole="header"
            variant={isRoot ? 'display' : titleVariant}
            minimumFontScale={0.78}
            style={[
              isRoot ? styles.rootTitle : styles.navigationTitle,
              {
                color: theme.text,
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
              titleStyle,
            ]}
          >
            {title}
          </ResponsiveText>
        ) : null}
      </View>

      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rootContainer: {
    minHeight: 52,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 8,
  },
  navigationContainer: {
    minHeight: 56,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
  },
  rootTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 0.2,
  },
  navigationTitle: {
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: 0.1,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  trailing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

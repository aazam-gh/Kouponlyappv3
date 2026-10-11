import { Colors as BorderPalette } from '@/constants/Colors';
import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Typography } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerSubtleHaptic } from '../../utils/haptics';

type ImageSource = ComponentProps<typeof Image>['source'];

type RewardSuccessRowTone = 'savings' | 'points' | 'default';

type RewardSuccessRow = {
  icon: keyof typeof Ionicons.glyphMap;
  iconBorderColor: string;
  label: string;
  value: string;
  tone?: RewardSuccessRowTone;
  accessibilityLabel?: string;
};

type RewardSuccessScreenProps = {
  mascotSource: ImageSource;
  badgeText: string;
  badgeFinalPercent?: number;
  badgeCountUpSuffix?: string;
  animateBadgeCountUp?: boolean;
  merchantLabel: string;
  merchantName?: string;
  rows: RewardSuccessRow[];
  metaLines?: string[];
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onClose: () => void;
  isRTL?: boolean;
};

const receiptPerforationDots = Array.from({ length: 9 }, (_, index) => index);
const receiptDivider = '#E6ECE4';
const receiptLabelColor = '#5E675F';
const receiptPrimaryTextColor = '#1D271E';
const receiptSavingsColor = '#08784F';
const receiptPointsColor = '#C87A20';

export default function RewardSuccessScreen({
  mascotSource,
  badgeText,
  badgeFinalPercent,
  badgeCountUpSuffix = '',
  animateBadgeCountUp = false,
  merchantLabel,
  merchantName,
  rows,
  metaLines = [],
  primaryActionLabel,
  onPrimaryAction,
  onClose,
  isRTL = false,
}: RewardSuccessScreenProps) {
  const { theme } = useAppTheme();
  const safeArea = useSafeAreaInsets();
  const { reduceMotion: prefersReducedMotion } = useMotionPreferences();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [animatedDiscountPercent, setAnimatedDiscountPercent] = useState(0);

  const heroProgress = useSharedValue(0);
  const mascotProgress = useSharedValue(0);
  const discountProgress = useSharedValue(0);
  const discountCounterProgress = useSharedValue(0);
  const discountColorProgress = useSharedValue(0);
  const discountScaleProgress = useSharedValue(1);
  const receiptProgress = useSharedValue(0);
  const rowProgress = useSharedValue(0);

  const shouldAnimateBadgeCount = animateBadgeCountUp && typeof badgeFinalPercent === 'number' && badgeFinalPercent > 0;
  const discountBadgeAnimationDelay = 80;
  const discountBadgeAnimationDuration = 240;

  useEffect(() => {
    if (prefersReducedMotion) {
      heroProgress.value = 1;
      mascotProgress.value = 1;
      discountProgress.value = 1;
      discountCounterProgress.value = badgeFinalPercent ?? 0;
      discountColorProgress.value = 1;
      discountScaleProgress.value = 1;
      receiptProgress.value = 1;
      rowProgress.value = rows.length;
      setAnimatedDiscountPercent(badgeFinalPercent ?? 0);
      return;
    }

    heroProgress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    mascotProgress.value = withDelay(40, withTiming(1, { duration: 220, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    discountProgress.value = withDelay(80, withTiming(1, { duration: 220, easing: Easing.bezier(0.23, 1, 0.32, 1) }));

    if (shouldAnimateBadgeCount) {
      discountCounterProgress.value = 0;
      discountColorProgress.value = 0;
      discountScaleProgress.value = withDelay(
        discountBadgeAnimationDelay + discountBadgeAnimationDuration + 20,
        withSequence(
          withTiming(1.02, { duration: 100, easing: Easing.out(Easing.quad) }),
          withSpring(1, { damping: 14, stiffness: 240, mass: 0.8 })
        )
      );
      discountCounterProgress.value = withDelay(
        discountBadgeAnimationDelay,
        withTiming(badgeFinalPercent, {
          duration: discountBadgeAnimationDuration,
          easing: Easing.out(Easing.quad),
        })
      );
      discountColorProgress.value = withDelay(
        discountBadgeAnimationDelay,
        withTiming(1, {
          duration: discountBadgeAnimationDuration,
          easing: Easing.out(Easing.quad),
        })
      );
      setAnimatedDiscountPercent(0);
    } else {
      discountCounterProgress.value = badgeFinalPercent ?? 0;
      discountColorProgress.value = 1;
      discountScaleProgress.value = 1;
      setAnimatedDiscountPercent(badgeFinalPercent ?? 0);
    }

    receiptProgress.value = withDelay(120, withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) }));
    rowProgress.value = 0;
    rowProgress.value = withDelay(
      160,
      withTiming(rows.length, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [
    badgeFinalPercent,
    discountColorProgress,
    discountCounterProgress,
    discountProgress,
    discountScaleProgress,
    heroProgress,
    mascotProgress,
    prefersReducedMotion,
    receiptProgress,
    rowProgress,
    rows.length,
    shouldAnimateBadgeCount,
  ]);

  useAnimatedReaction(
    () => Math.round(discountCounterProgress.value),
    (value, previous) => {
      if (!shouldAnimateBadgeCount || value === previous) {
        return;
      }
      runOnJS(setAnimatedDiscountPercent)(Math.round(value));
    },
    [shouldAnimateBadgeCount]
  );

  const entryStyle = useAnimatedStyle(() => ({
    opacity: heroProgress.value,
    transform: [
      { translateY: (1 - heroProgress.value) * 16 },
      { scale: 0.985 + heroProgress.value * 0.015 },
    ],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    opacity: mascotProgress.value,
    transform: [
      { translateY: (1 - mascotProgress.value) * 8 },
      { scale: 0.96 + mascotProgress.value * 0.04 },
    ],
  }));

  const discountBadgeStyle = useAnimatedStyle(() => ({
    opacity: discountProgress.value,
    transform: [{ scale: (0.92 + discountProgress.value * 0.08) * discountScaleProgress.value }],
  }));

  const discountTextStyle = useAnimatedStyle(() => ({
    color: shouldAnimateBadgeCount
      ? interpolateColor(discountColorProgress.value, [0, 1], ['#1A1F24', '#0A0F0C'])
      : '#0A0F0C',
  }));

  const receiptStyle = useAnimatedStyle(() => ({
    opacity: receiptProgress.value,
    transform: [{ translateY: (1 - receiptProgress.value) * 8 }],
  }));

  const successTopOffset = safeArea.top + 12;
  const mascotSize = Math.round(Math.min(screenWidth * 0.8, Math.min(screenHeight * 0.42, 430)));
  const receiptBottomPadding = Math.max(safeArea.bottom + 20, 24);
  const badgeDisplayText = shouldAnimateBadgeCount ? `${animatedDiscountPercent}${badgeCountUpSuffix}` : badgeText;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.brand }]}>
      <StatusBar style="dark" />

      <ScalePressable
        style={[
          styles.headerButton,
          { backgroundColor: theme.logoTile, top: successTopOffset },
          styles.closeButton,
        ]}
        onPress={() => {
          triggerSubtleHaptic();
          onClose();
        }}
      >
        <Ionicons name="close" size={22} color={theme.logoTileText} />
      </ScalePressable>

      <Animated.View
        style={[
          styles.wrapper,
          entryStyle,
          {
            paddingTop: successTopOffset + 4,
            paddingBottom: receiptBottomPadding,
          },
        ]}
      >
        <View style={styles.topSection}>
          <Animated.View style={[styles.celebrationArea, entryStyle]}>
            <Animated.View style={[styles.mascotWrap, mascotStyle]}>
              <Image
                source={mascotSource}
                style={[
                  styles.mascot,
                  {
                    width: mascotSize,
                    height: mascotSize,
                    borderRadius: mascotSize / 2,
                  },
                ]}
                contentFit="contain"
              />
            </Animated.View>

            <Animated.View style={[styles.discountBadge, { backgroundColor: '#FFFFFF' }, discountBadgeStyle]}>
              <Animated.Text style={[styles.discountText, discountTextStyle]}>
                {badgeDisplayText}
              </Animated.Text>
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.receiptContainer, receiptStyle]}>
          <View style={[styles.receiptCard, { backgroundColor: '#FFFFFF', borderColor: BorderPalette.border }]}>
            <View pointerEvents="none" style={styles.receiptPerforation}>
              {receiptPerforationDots.map((dot) => (
                <View key={dot} style={styles.receiptPerforationDot} />
              ))}
            </View>

            {merchantName ? (
              <View style={[styles.receiptMerchantRow, { borderBottomColor: receiptDivider }]}>
                <Text style={[styles.receiptMerchantLabel, { color: receiptLabelColor }]}>
                  {merchantLabel}
                </Text>
                <Text
                  style={[styles.receiptMerchantValue, { color: receiptPrimaryTextColor }]}
                  numberOfLines={1}
                >
                  {merchantName}
                </Text>
              </View>
            ) : null}

            {rows.map((row, index) => (
              <RewardSuccessReceiptRow
                key={`${row.label}-${row.value}`}
                row={row}
                index={index}
                isRTL={isRTL}
                rowProgress={rowProgress}
              />
            ))}

            {metaLines.length > 0 ? (
              <View style={styles.footerStrip}>
                {metaLines.map((line) => (
                  <Text key={line} style={[styles.metaText, { color: theme.subtleText }]}>
                    {line}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.primaryButtonWrap}>
              <ScalePressable
                accessibilityRole="button"
                onPress={() => {
                  triggerSubtleHaptic();
                  onPrimaryAction();
                }}
                style={[styles.primaryButton, isRTL && styles.primaryButtonRTL]}
              >
                <Ionicons name="checkmark" size={18} color="#0A0F0C" style={isRTL ? styles.primaryButtonIconRTL : styles.primaryButtonIcon} />
                <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
              </ScalePressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

type RewardSuccessReceiptRowProps = {
  row: RewardSuccessRow;
  index: number;
  isRTL: boolean;
  rowProgress: SharedValue<number>;
};

function RewardSuccessReceiptRow({
  row,
  index,
  isRTL,
  rowProgress,
}: RewardSuccessReceiptRowProps) {
  const rowAnimatedStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.max(rowProgress.value - index, 0), 1);

    return {
      opacity: progress,
      transform: [{ translateY: (1 - progress) * 12 }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.receiptRow,
        rowAnimatedStyle,
        index > 0 && { borderTopColor: receiptDivider, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.receiptIconWrap, { borderColor: row.iconBorderColor }]}>
        <Ionicons name={row.icon} size={16} color={getRowColor(row.tone)} />
      </View>
      <View style={styles.receiptTextWrap}>
        <Text style={[getRowLabelStyle(row.tone), { textAlign: isRTL ? 'right' : 'left' }]}>
          {row.label}
        </Text>
        <Text
          style={[styles.receiptAmount, { color: getRowColor(row.tone) }]}
          accessibilityLabel={row.accessibilityLabel}
        >
          {row.value}
        </Text>
      </View>
    </Animated.View>
  );
}

function getRowColor(tone: RewardSuccessRowTone = 'default') {
  if (tone === 'savings') return receiptSavingsColor;
  if (tone === 'points') return receiptPointsColor;
  return receiptPrimaryTextColor;
}

function getRowLabelStyle(tone: RewardSuccessRowTone = 'default') {
  if (tone === 'savings') {
    return [styles.savedLabel, { color: receiptLabelColor }];
  }
  if (tone === 'points') {
    return [styles.receiptRowLabel, { color: receiptPointsColor }];
  }
  return [styles.receiptRowLabel, { color: receiptLabelColor }];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButton: {
    right: 24,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 0,
    zIndex: 1,
  },
  topSection: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  celebrationArea: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 4,
    paddingBottom: 0,
  },
  discountBadge: {
    borderRadius: 999,
    minHeight: 74,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 14px rgba(3,43,18,0.20)',
  },
  discountText: {
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: 0.5,
    ...Typography.getTextVariantStyle('display'),
  },
  mascotWrap: {
    marginTop: 0,
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  mascot: {
    width: 270,
    height: 270,
    borderRadius: 135,
  },
  receiptContainer: {
    marginTop: 8,
    width: '100%',
  },
  receiptCard: {
    position: 'relative',
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 6,
    gap: 0,
    boxShadow: '0 8px 14px rgba(0,0,0,0.06)',
  },
  receiptPerforation: {
    position: 'absolute',
    top: -7,
    left: 22,
    right: 22,
    height: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptPerforationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.brandGreen,
  },
  receiptMerchantRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 8,
    marginBottom: 4,
  },
  receiptMerchantLabel: {
    fontSize: 13,
    ...Typography.getTextVariantStyle('body'),
  },
  receiptMerchantValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    ...Typography.getTextVariantStyle('bodyStrong'),
  },
  receiptRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 0,
  },
  receiptIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  receiptTextWrap: {
    flex: 1,
  },
  savedLabel: {
    fontSize: 13,
    ...Typography.getTextVariantStyle('body'),
    lineHeight: 16,
  },
  receiptAmount: {
    marginTop: 1,
    fontSize: 17,
    ...Typography.getTextVariantStyle('bodyStrong'),
    letterSpacing: -0.2,
  },
  receiptRowLabel: {
    fontSize: 12,
    ...Typography.getTextVariantStyle('body'),
    lineHeight: 15,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 15,
    ...Typography.getTextVariantStyle('body'),
  },
  footerStrip: {
    marginTop: 4,
    gap: 2,
  },
  primaryButtonWrap: {
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: Colors.brandGreen,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.10)',
  },
  primaryButtonRTL: { flexDirection: 'row-reverse' },
  primaryButtonIcon: { marginRight: 8 },
  primaryButtonIconRTL: { marginLeft: 8 },
  primaryButtonText: {
    fontSize: 17,
    letterSpacing: 0.3,
    ...Typography.getTextVariantStyle('display'),
    color: '#0A0F0C',
  },
});

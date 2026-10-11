import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, cancelAnimation, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { Colors } from '../../constants/Colors';
import { useAppLocale } from '../../context/LocaleContext';
import { Typography } from '../../constants/Typography';
import { triggerSubtleHaptic } from '../../utils/haptics';
import { openWaktiStore } from '../../utils/wakti';

const waktiBannerImage = require('../../assets/images/waktilogo.webp');
const gridUnit = 60;
const gridVerticalOffsets = Array.from({ length: 40 }, (_, index) => index * gridUnit - gridUnit * 12);
const gridHorizontalOffsets = Array.from({ length: 64 }, (_, index) => index * gridUnit - gridUnit * 14.5);
const gridIntersections = gridVerticalOffsets.flatMap((left) =>
    gridHorizontalOffsets.map((top) => ({ left, top })),
);
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type WaktiSheetContentProps = {
    isDark?: boolean;
    onClose?: () => void;
    onStoreOpened?: () => void;
    fitToContent?: boolean;
};

type FeatureChipProps = {
    feature: string;
    index: number;
    featureCardMinHeight: number;
    featureFontSize: number;
    featureLineHeight: number;
    isCompactWidth: boolean;
    isDark: boolean;
    isRTL: boolean;
};

function FeatureChip({
    feature,
    index,
    featureCardMinHeight,
    featureFontSize,
    featureLineHeight,
    isCompactWidth,
    isDark,
    isRTL,
}: FeatureChipProps) {
    const { reduceMotion } = useMotionPreferences();
    const pulseProgress = useSharedValue(0);

    useEffect(() => {
        if (reduceMotion) { pulseProgress.value = 0; return; }
        pulseProgress.value = withDelay(
            index * 260,
            withRepeat(
                withSequence(
                    withTiming(1, { duration: 1900 }),
                    withTiming(0, { duration: 1900 }),
                ),
                -1,
                false,
            ),
        );
        return () => cancelAnimation(pulseProgress);
    }, [index, pulseProgress, reduceMotion]);

    const chipAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: pulseProgress.value * -2 },
            { scale: 1 + pulseProgress.value * 0.01 },
        ],
    }));
    const chipHighlightStyle = useAnimatedStyle(() => ({
        opacity: pulseProgress.value * (isDark ? 0.18 : 0.28),
    }));

    return (
        <Animated.View
            style={[
                styles.featureChipWrap,
                chipAnimatedStyle,
            ]}
            accessibilityRole="text"
        >
            <View
                style={[
                    styles.featureCard,
                    {
                        minHeight: featureCardMinHeight,
                        paddingHorizontal: isCompactWidth ? 12 : 14,
                        paddingVertical: isCompactWidth ? 9 : 10,
                    },
                    isDark ? styles.featureCardDark : styles.featureCardLight,
                ]}
            >
                {Platform.OS !== 'android' ? (
                    <GlassView
                        style={StyleSheet.absoluteFill}
                        glassEffectStyle="regular"
                        colorScheme={isDark ? 'dark' : 'light'}
                        tintColor={isDark ? 'rgba(255,255,255,0.20)' : 'rgba(58,145,255,0.26)'}
                    />
                ) : null}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.featureCardHighlight,
                        isDark ? styles.featureCardHighlightDark : styles.featureCardHighlightLight,
                        chipHighlightStyle,
                    ]}
                />
                <Text
                    style={[
                        styles.featureTitle,
                        {
                            fontSize: featureFontSize,
                            lineHeight: featureLineHeight,
                        },
                        isDark ? styles.featureTitleDark : styles.featureTitleLight,
                        isRTL && styles.featureTitleRTL,
                    ]}
                >
                    {feature}
                </Text>
            </View>
        </Animated.View>
    );
}

export default function WaktiSheetContent({ isDark = true, onStoreOpened, fitToContent = false }: WaktiSheetContentProps) {
    const { height, width } = useWindowDimensions();
    const { reduceMotion } = useMotionPreferences();
    const { t } = useTranslation();
    const { isRTL } = useAppLocale();
    const ctaLabel = t('wakti_sheet_cta');
    const sheetBackgroundColor = isDark ? '#050B14' : '#EEF7FF';
    const featureCategories = [
        t('wakti_feature_hub_chat'),
        t('wakti_feature_hub_text'),
        t('wakti_feature_hub_coder'),
        t('wakti_feature_hub_slides'),
    ];
    const sheetMinHeight = fitToContent ? undefined : Math.round(height * 0.5);
    const isCompactWidth = width < 360;
    const isShortScreen = height < 760;
    const contentWidth = clamp(width - (isCompactWidth ? 32 : 40), 280, 420);
    const containerTopPadding = fitToContent ? 0 : (isShortScreen ? 12 : 18);
    const containerBottomPadding = fitToContent ? (isShortScreen ? 8 : 12) : (isShortScreen ? 12 : 16);
    const contentGap = isShortScreen ? 12 : 16;
    const headlineFontSize = isCompactWidth ? 22 : 24;
    const headlineLineHeight = isCompactWidth ? 27 : 29;
    const featureFontSize = isCompactWidth ? 12 : 13;
    const featureLineHeight = isCompactWidth ? 15 : 16;
    const featureCardMinHeight = isCompactWidth ? 48 : 52;
    const ctaFontSize = isCompactWidth ? 18 : 20;
    const ctaLineHeight = isCompactWidth ? 22 : 24;
    const ctaHorizontalPadding = isCompactWidth ? 18 : 24;
    const logoSize = clamp(width * 0.28, 92, 112);
    const logoGlowRadius = clamp(logoSize * 0.26, 24, 29);
    const ctaLabelMaxWidth = contentWidth - ctaHorizontalPadding * 2 - 56;
    const backgroundWidth = width * 5;
    const backgroundHeight = height * 4;
    const logoGlow = useSharedValue(0);
    const logoGlowAnimatedStyle = useAnimatedStyle(() => ({
        opacity: logoGlow.value,
        transform: [{ scale: 0.94 + logoGlow.value * 0.08 }],
    }));
    const handleStorePress = async () => {
        const didOpenStore = await openWaktiStore();
        if (didOpenStore) {
            onStoreOpened?.();
        }
    };

    const handleLogoPressIn = () => {
        triggerSubtleHaptic();
        if (!reduceMotion) logoGlow.value = withTiming(isDark ? 0.52 : 0.42, { duration: 120 });
    };
    const handleLogoPressOut = () => { logoGlow.value = withTiming(0, { duration: 120 }); };

    return (
        <View
            style={[
                styles.container,
                fitToContent && styles.containerFitToContent,
                {
                    ...(sheetMinHeight != null ? { minHeight: sheetMinHeight } : null),
                    paddingTop: containerTopPadding,
                    paddingBottom: containerBottomPadding,
                    rowGap: contentGap,
                },
                isDark ? styles.containerDark : styles.containerLight,
                isRTL && styles.containerRTL,
            ]}
        >
            <View
                pointerEvents="none"
                style={[
                    styles.gridLayer,
                    {
                        height: backgroundHeight,
                        left: -width * 2,
                        top: -height * 1.5,
                        width: backgroundWidth,
                    },
                ]}
            >
                <View style={[styles.gridVignette, isDark ? styles.gridVignetteDark : styles.gridVignetteLight]} />
                {gridVerticalOffsets.map((offset) => (
                    <View
                        key={`v-${offset}`}
                        style={[
                            styles.gridLineVertical,
                            { left: offset },
                            isDark ? styles.gridLineVerticalDark : styles.gridLineVerticalLight,
                        ]}
                    />
                ))}
                {gridHorizontalOffsets.map((offset) => (
                    <View
                        key={`h-${offset}`}
                        style={[
                            styles.gridLineHorizontal,
                            { top: offset, width: backgroundWidth },
                            isDark ? styles.gridLineDark : styles.gridLineLight,
                        ]}
                    />
                ))}
                {gridIntersections.map(({ left, top }) => (
                    <View
                        key={`dot-${left}-${top}`}
                        style={[
                            styles.gridIntersection,
                            { left: left - 2, top: top - 2 },
                            isDark ? styles.gridIntersectionDark : styles.gridIntersectionLight,
                        ]}
                    />
                ))}
            </View>
            <View style={[styles.contentColumn, { width: contentWidth, rowGap: contentGap }]}>
                <ScalePressable
                    activeOpacity={1}
                    onPressIn={handleLogoPressIn}
                    onPressOut={handleLogoPressOut}
                    pressedScale={1}
                    style={[styles.logoTapTarget, { marginTop: isShortScreen ? 4 : 8, width: logoSize, height: logoSize }]}
                    accessibilityRole="button"
                    accessibilityLabel="Wakti AI logo"
                >
                    <Animated.View
                        style={[
                            styles.logoGlow,
                            {
                                width: logoSize,
                                height: logoSize,
                                borderRadius: logoGlowRadius,
                            },
                            logoGlowAnimatedStyle,
                        ]}
                    />
                    <Animated.View style={[styles.logoWrap, { width: logoSize, height: logoSize }]}>
                        <Image
                            source={waktiBannerImage}
                            style={[styles.logo, { width: logoSize, height: logoSize }]}
                            contentFit="contain"
                            accessibilityLabel="Wakti AI logo"
                        />
                    </Animated.View>
                </ScalePressable>

                <View style={[styles.copy, { rowGap: contentGap }, isRTL && styles.copyRTL]}>
                    <Text
                        style={[
                            styles.headline,
                            {
                                fontSize: headlineFontSize,
                                lineHeight: headlineLineHeight,
                                maxWidth: contentWidth - 8,
                            },
                            isDark ? styles.headlineDark : styles.headlineLight,
                            isRTL && styles.headlineRTL,
                        ]}
                        numberOfLines={2}
                    >
                        {t('wakti_sheet_title')}
                    </Text>
                    <View style={[styles.featureGrid, { rowGap: isCompactWidth ? 7 : 8 }, isRTL && styles.featureGridRTL]}>
                        {featureCategories.map((feature, index) => (
                            <FeatureChip
                                key={feature}
                                index={index}
                                feature={feature}
                                featureCardMinHeight={featureCardMinHeight}
                                featureFontSize={featureFontSize}
                                featureLineHeight={featureLineHeight}
                                isCompactWidth={isCompactWidth}
                                isDark={isDark}
                                isRTL={isRTL}
                            />
                        ))}
                    </View>
                    <View style={styles.ctaMotionWrap}>
                        <ScalePressable
                            activeOpacity={0.9}
                            onPress={handleStorePress}
                            style={[
                                styles.cta,
                                {
                                    minHeight: isCompactWidth ? 60 : 64,
                                    paddingHorizontal: ctaHorizontalPadding,
                                    paddingVertical: isCompactWidth ? 12 : 14,
                                },
                                isRTL && styles.ctaRTL,
                            ]}
                            accessibilityRole="link"
                            accessibilityLabel={ctaLabel}
                        >
                            <View style={styles.ctaIconWrap}>
                                <Ionicons name="arrow-down" size={25} color="#0A0F0C" />
                            </View>
                            <Text
                                style={[
                                    styles.ctaText,
                                    {
                                        fontSize: ctaFontSize,
                                        lineHeight: ctaLineHeight,
                                        maxWidth: ctaLabelMaxWidth,
                                    },
                                    isRTL && styles.ctaTextRTL,
                                ]}
                            >
                                {ctaLabel}
                            </Text>
                        </ScalePressable>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        flex: 1,
        overflow: 'visible',
        alignItems: 'center',
    },
    containerLight: {
        backgroundColor: '#EEF7FF',
    },
    containerDark: {
        backgroundColor: '#050B14',
    },
    containerRTL: {
        direction: 'rtl',
    },
    containerFitToContent: {
        flex: 0,
        overflow: 'hidden',
        width: '100%',
    },
    contentColumn: {
        alignItems: 'center',
        maxWidth: 420,
        alignSelf: 'center',
    },
    logoWrap: {
        width: 112,
        height: 112,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    logoTapTarget: {
        alignSelf: 'center',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    logoGlow: {
        position: 'absolute',
        width: 112,
        height: 112,
        borderRadius: 29,
        backgroundColor: '#FFFFFF',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.48,
        shadowRadius: 12,
    },
    logo: {
        width: 112,
        height: 112,
    },
    copy: {
        alignItems: 'center',
        zIndex: 2,
        width: '100%',
    },
    copyRTL: {
        direction: 'rtl',
    },
    headline: {
        fontSize: 24,
        lineHeight: 29,
        ...Typography.getTextVariantStyle('body'),
        textAlign: 'center',
    },
    headlineLight: {
        color: '#102B62',
    },
    headlineDark: {
        color: '#FFFFFF',
    },
    headlineRTL: {
        textAlign: 'center',
        writingDirection: 'rtl',
    },
    featureGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: 8,
    },
    featureGridRTL: {
        flexDirection: 'row-reverse',
    },
    featureChipWrap: {
        width: '48%',
    },
    featureCard: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 13,
        borderWidth: 1.4,
        overflow: 'hidden',
    },
    featureCardLight: {
        backgroundColor: 'rgba(58, 145, 255, 0.14)',
        borderColor: 'rgba(58, 145, 255, 0.44)',
    },
    featureCardDark: {
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        borderColor: 'rgba(255, 255, 255, 0.34)',
    },
    featureCardHighlight: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        borderRadius: 13,
    },
    featureCardHighlightLight: {
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    featureCardHighlightDark: {
        backgroundColor: 'rgba(163, 215, 255, 0.40)',
    },
    featureTitle: {
        fontSize: 13,
        lineHeight: 16,
        ...Typography.getTextVariantStyle('bodyStrong'),
        textAlign: 'center',
    },
    featureTitleRTL: {
        alignSelf: 'stretch',
        textAlign: 'center',
        writingDirection: 'rtl',
    },
    featureTitleLight: {
        color: '#102B62',
    },
    featureTitleDark: {
        color: '#FFFFFF',
    },
    ctaMotionWrap: {
        width: '100%',
    },
    cta: {
        alignSelf: 'stretch',
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        borderRadius: 34,
        backgroundColor: Colors.brandGreen,
        paddingVertical: 14,
        paddingHorizontal: 24,
        marginTop: 0,
        boxShadow: '0 16px 32px rgba(24, 184, 82, 0.30)',
    },
    ctaRTL: {
        flexDirection: 'row-reverse',
    },
    ctaIconWrap: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
    },
    ctaText: {
        color: '#0A0F0C',
        fontSize: 20,
        lineHeight: 24,
        ...Typography.getTextVariantStyle('bodyStrong'),
        textAlign: 'center',
    },
    ctaTextRTL: {
        textAlign: 'center',
        writingDirection: 'rtl',
    },
    gridLayer: {
        position: 'absolute',
        opacity: 1,
        zIndex: 1,
    },
    gridVignette: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    gridVignetteLight: {
        backgroundColor: 'rgba(223, 241, 255, 0.42)',
    },
    gridVignetteDark: {
        backgroundColor: 'rgba(7, 20, 34, 0.22)',
    },
    gridLineVertical: {
        position: 'absolute',
        top: -960,
        height: 4200,
        width: 1.2,
    },
    gridLineHorizontal: {
        position: 'absolute',
        left: 0,
        height: 1.2,
    },
    gridLineLight: {
        backgroundColor: 'rgba(56, 139, 252, 0.42)',
        boxShadow: '0 0 11px rgba(56, 139, 252, 0.30)',
    },
    gridLineDark: {
        backgroundColor: 'rgba(126, 187, 255, 0.38)',
        boxShadow: '0 0 12px rgba(126, 187, 255, 0.32)',
    },
    gridLineVerticalLight: {
        backgroundColor: 'rgba(56, 139, 252, 0.44)',
        boxShadow: '0 0 12px rgba(56, 139, 252, 0.30)',
    },
    gridLineVerticalDark: {
        backgroundColor: 'rgba(139, 190, 255, 0.40)',
        boxShadow: '0 0 14px rgba(139, 190, 255, 0.34)',
    },
    gridIntersection: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    gridIntersectionLight: {
        backgroundColor: 'rgba(69, 148, 255, 0.30)',
        boxShadow: '0 0 10px rgba(69, 148, 255, 0.28)',
    },
    gridIntersectionDark: {
        backgroundColor: 'rgba(149, 201, 255, 0.30)',
        boxShadow: '0 0 12px rgba(149, 201, 255, 0.30)',
    },
});

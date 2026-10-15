import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { Typography } from '@/constants/Typography';
import { OnboardingFlowSectionMotion } from '../onboarding/OnboardingMotion';

type Props = {
    title: string;
    step: number;
    totalSteps: number;
    onBack?: () => void;
    onClose?: () => void;
    children: ReactNode;
    footer?: ReactNode;
    scroll?: boolean;
    contentContainerStyle?: StyleProp<ViewStyle>;
};

export default function GiftCardFlowScaffold({
    title,
    step,
    totalSteps,
    onBack,
    onClose,
    children,
    footer,
    scroll = true,
    contentContainerStyle,
}: Props) {
    const insets = useSafeAreaInsets();
    const { theme } = useAppTheme();
    const { isRTL } = useAppLocale();
    const { t } = useTranslation();
    const progress = Math.max(0, Math.min(1, step / totalSteps));

    const body = (
        <OnboardingFlowSectionMotion delay={70} style={!scroll ? styles.bodyMotion : undefined}>
            {children}
        </OnboardingFlowSectionMotion>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View
                style={[
                    styles.header,
                    { height: insets.top + styles.headerContent.height, paddingTop: insets.top },
                    isRTL && styles.headerRTL,
                ]}
            >
                <ScalePressable
                    style={[styles.iconButton, { backgroundColor: theme.cardMuted }]}
                    onPress={onBack}
                    disabled={!onBack}
                    accessibilityRole="button"
                    accessibilityLabel={t('back')}
                >
                    <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={theme.text} />
                </ScalePressable>
                <View
                    style={[
                        styles.logoContainer,
                        { top: insets.top, height: styles.headerContent.height },
                        isRTL && styles.logoContainerRTL,
                    ]}
                    pointerEvents="none"
                />
                <ScalePressable
                    style={[styles.iconButton, { backgroundColor: theme.cardMuted }]}
                    onPress={onClose}
                    disabled={!onClose}
                    accessibilityRole="button"
                    accessibilityLabel={t('close')}
                >
                    <Ionicons name="close" size={22} color={theme.text} />
                </ScalePressable>
            </View>

            <View style={styles.progressSection} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: totalSteps, now: step }}>
                <View style={[styles.progressTrack, { backgroundColor: theme.cardMuted }]}>
                    <View style={[styles.progressFill, { backgroundColor: theme.brand, width: `${progress * 100}%` }]} />
                </View>
                <Text style={[styles.stepLabel, { color: theme.mutedText }, isRTL && styles.textRTL]}>
                    {t('gift_card_flow_step', { current: step, total: totalSteps })}
                </Text>
            </View>

            <View style={[styles.heading, isRTL && styles.headingRTL]}>
                <Text style={[styles.title, Typography.getTextVariantStyle('display'), { color: theme.text }, isRTL && styles.textRTL]}>{title}</Text>
            </View>

            {scroll ? (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {body}
                </ScrollView>
            ) : (
                <View style={styles.flexBody}>{body}</View>
            )}

            {footer ? (
                <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
                    {footer}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        position: 'relative',
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerContent: {
        height: 64,
    },
    headerRTL: {
        flexDirection: 'row-reverse',
    },
    iconButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoContainerRTL: {
        flexDirection: 'row-reverse',
    },
    progressSection: {
        paddingHorizontal: 24,
        paddingTop: 8,
        paddingBottom: 4,
    },
    progressTrack: {
        height: 5,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    stepLabel: {
        marginTop: 8,
        fontSize: 12,
        ...Typography.getTextVariantStyle('bodyStrong'),
    },
    heading: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headingRTL: {
        alignItems: 'flex-end',
    },
    title: {
        fontSize: 20,
        lineHeight: 28,
        ...Typography.getTextVariantStyle('display'),
    },
    textRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 16,
        // Keep the final controls clear of the pinned footer when scrolling.
        paddingBottom: 140,
    },
    flexBody: {
        flex: 1,
    },
    bodyMotion: {
        flex: 1,
    },
    footer: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 1,
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: 24,
        paddingTop: 12,
    },
});

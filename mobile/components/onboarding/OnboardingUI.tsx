import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode, RefObject, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Typography } from '../../constants/Typography';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAppLocale } from '../../context/LocaleContext';
import { useTranslation } from 'react-i18next';
import { OnboardingFlowSectionMotion } from './OnboardingMotion';
import ResponsiveText from '../ResponsiveText';

type ScaffoldProps = {
  children: ReactNode;
  title?: string;
  headerTitle?: string;
  subtitle?: string;
  onBack?: () => void;
  onClose?: () => void;
  headerAction?: { label: string; onPress: () => void; disabled?: boolean };
  progress?: { current: number; total: number };
  footer?: ReactNode;
};

export function OnboardingScaffold({ children, title, headerTitle, subtitle, onBack, onClose, headerAction, progress, footer }: ScaffoldProps) {
  const { theme, isDark } = useAppTheme();
  const { locale, isRTL } = useAppLocale();
  const { t } = useTranslation();

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style={isDark ? 'light' : 'dark'} hidden={false} animated />
        <OnboardingFlowSectionMotion offset={-6} style={[styles.header, isRTL && styles.rowReverse]}>
          {onBack ? (
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.cardMuted }]} onPress={onBack} accessibilityRole="button" accessibilityLabel={t('back')}>
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={theme.text} />
            </TouchableOpacity>
          ) : <View style={styles.iconButton} accessible={false} />}
          {headerTitle ? <ResponsiveText accessibilityRole="header" minimumFontScale={0.72} style={[styles.headerTitle, { color: theme.text }, isRTL && styles.textRTL]}>{headerTitle}</ResponsiveText> : null}
          {headerAction ? (
            <TouchableOpacity
              style={[styles.headerAction, { borderColor: theme.brand, opacity: headerAction.disabled ? 0.45 : 1 }]}
              onPress={headerAction.onPress}
              disabled={headerAction.disabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(headerAction.disabled) }}
            >
              <Text style={[styles.headerActionText, { color: theme.brandText }, isRTL && styles.textRTL]}>{headerAction.label}</Text>
            </TouchableOpacity>
          ) : onClose ? (
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: theme.cardMuted }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}>
              <Ionicons name="close" size={22} color={theme.text} />
            </TouchableOpacity>
          ) : <View style={styles.iconButton} accessible={false} />}
        </OnboardingFlowSectionMotion>
        {progress ? <OnboardingFlowSectionMotion delay={25} offset={-4}><OnboardingProgress {...progress} /></OnboardingFlowSectionMotion> : null}
        <OnboardingFlowSectionMotion delay={45} style={styles.scroll}>
          <ScrollView
            style={styles.scroll}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {title ? <Text accessibilityRole="header" style={[styles.title, Typography.getLocalizedTextVariantStyle('display', locale), { color: theme.text }, isRTL && styles.textRTL]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.subtitle, { color: theme.mutedText }, isRTL && styles.textRTL]}>{subtitle}</Text> : null}
            <View style={styles.body}>{children}</View>
          </ScrollView>
        </OnboardingFlowSectionMotion>
        {footer ? <OnboardingFlowSectionMotion delay={80} offset={8}><View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border }]}>{footer}</View></OnboardingFlowSectionMotion> : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function OnboardingProgress({ current, total }: { current: number; total: number }) {
  const { theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  const { t } = useTranslation();
  const percent = Math.max(0, Math.min(1, current / total));
  const previousPercent = Math.max(0, Math.min(1, (current - 1) / total));
  const progress = useSharedValue(previousPercent);

  useEffect(() => {
    progress.value = withTiming(percent, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [percent, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
    transformOrigin: isRTL ? 'right' : 'left',
  }));

  return <View style={styles.progressWrap} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current }} accessibilityLabel={t('onboarding_step_progress', { current, total })}>
    <Text style={[styles.progressLabel, { color: theme.mutedText }, isRTL && styles.textRTL]}>{t('onboarding_step_progress', { current, total })}</Text>
    <View style={[styles.progressTrack, { backgroundColor: theme.cardMuted }]}><Animated.View style={[styles.progressFill, { backgroundColor: theme.brand }, fillStyle]} /></View>
  </View>;
}

export function OnboardingField({ label, error, inputRef, ...props }: TextInputProps & { label: string; error?: string | null; inputRef?: RefObject<TextInput | null> }) {
  const { theme } = useAppTheme();
  return <View style={styles.fieldWrap}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <TextInput
      ref={inputRef}
      {...props}
      style={[styles.field, { color: theme.text, backgroundColor: theme.cardMuted, borderColor: error ? theme.danger : theme.border }, props.style]}
      placeholderTextColor={theme.inputPlaceholder}
      accessibilityLabel={label}
      accessibilityState={{ disabled: props.editable === false }}
    />
    {error ? <Text selectable accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[styles.fieldError, { color: theme.danger }]}>{error}</Text> : null}
  </View>;
}

export function OnboardingPrimaryButton({ label, loadingLabel, loading, disabled, onPress }: { label: string; loadingLabel?: string; loading?: boolean; disabled?: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  const inactive = Boolean(disabled || loading);
  return <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
    disabled={inactive}
    onPress={onPress}
    activeOpacity={0.86}
    style={[styles.primaryButton, { backgroundColor: theme.actionSolid, opacity: disabled ? 0.45 : 1 }]}
  >
    {loading ? <ActivityIndicator color={theme.onActionSolid} /> : null}
    <Text style={[styles.primaryLabel, { color: theme.onActionSolid }]}>{loading && loadingLabel ? loadingLabel : label}</Text>
  </TouchableOpacity>;
}

export function OnboardingSecondaryButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    activeOpacity={0.86}
    style={[styles.secondaryButton, { borderColor: theme.brand, opacity: disabled ? 0.45 : 1 }]}
  >
    <Text style={[styles.secondaryLabel, { color: theme.brandText }]}>{label}</Text>
  </TouchableOpacity>;
}

export function OnboardingTextButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const { theme } = useAppTheme();
  return <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ disabled: Boolean(disabled) }}
    disabled={disabled}
    onPress={onPress}
    activeOpacity={0.75}
    style={[styles.textButton, { opacity: disabled ? 0.45 : 1 }]}
  >
    <Text style={[styles.textButtonLabel, { color: theme.brandText }]}>{label}</Text>
  </TouchableOpacity>;
}

export function InlineNotice({ tone = 'info', children, actionLabel, onAction }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode; actionLabel?: string; onAction?: () => void }) {
  const { theme } = useAppTheme();
  const color = tone === 'error' ? theme.danger : tone === 'warning' ? theme.warning : tone === 'success' ? theme.brand : theme.info;
  const icon = tone === 'error' ? 'alert-circle-outline' : tone === 'warning' ? 'warning-outline' : tone === 'success' ? 'checkmark-circle-outline' : 'information-circle-outline';
  return <View accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: theme.cardMuted, borderColor: color }]}>
    {tone === 'success' ? null : <Ionicons name={icon} size={21} color={color} />}
    <View style={styles.noticeCopy}><Text style={[styles.noticeText, { color: theme.text }]}>{children}</Text>{actionLabel && onAction ? <TouchableOpacity onPress={onAction} accessibilityRole="button" style={styles.noticeAction}><Text style={[styles.noticeActionText, { color }]}>{actionLabel}</Text></TouchableOpacity> : null}</View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, safeArea: { flex: 1 }, scroll: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTitle: { flex: 1, fontSize: 22, lineHeight: 30 },
  rowReverse: { flexDirection: 'row-reverse' }, iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headerAction: { minWidth: 64, minHeight: 40, borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  headerActionText: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 15 },
  progressWrap: { paddingHorizontal: 24, paddingBottom: 8, gap: 7 }, progressLabel: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 12 }, progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 3 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  title: { fontSize: 30, lineHeight: 38 },
  subtitle: { ...Typography.getTextVariantStyle('body'), fontSize: 16, lineHeight: 24, paddingTop: 10 },
  textRTL: { textAlign: 'right', writingDirection: 'rtl' }, body: { paddingTop: 28, gap: 16 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
  fieldWrap: { gap: 8 }, label: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 14 },
  field: { minHeight: 56, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, ...Typography.getTextVariantStyle('body') },
  fieldError: { ...Typography.getTextVariantStyle('body'), fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 56, borderRadius: 28, paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 17 },
  secondaryButton: { minHeight: 52, borderRadius: 26, borderWidth: 1.5, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  secondaryLabel: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 16 },
  textButton: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 14, textDecorationLine: 'underline' },
  notice: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeCopy: { flex: 1, gap: 6 }, noticeText: { ...Typography.getTextVariantStyle('body'), fontSize: 14, lineHeight: 20 },
  noticeAction: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }, noticeActionText: { ...Typography.getTextVariantStyle('bodyStrong'), fontSize: 14 },
});

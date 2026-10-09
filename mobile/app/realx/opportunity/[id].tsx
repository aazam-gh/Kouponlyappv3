import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { StateSurface } from '@/components/StateSurface';
import AppHeader, { HeaderIconButton } from '@/components/navigation/AppHeader';
import { Typography } from '@/constants/Typography';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/lib/auth';
import { getCouponlyOpportunityAction, trackCouponlyOpportunityEvent } from '@/lib/couponlyBackend';
import { getSupabase } from '@/lib/supabase';

type OpportunityRow = { id: string; title?: string | null; starts_at?: string | null; ends_at?: string | null; payload?: Record<string, unknown> | null };
const textValue = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.length > 0);

function MetaRow({ icon, text, isRTL, iconColor, textColor }: { icon: keyof typeof Ionicons.glyphMap; text: string; isRTL: boolean; iconColor: string; textColor: string }) {
  return <View style={[styles.metaRow, isRTL && styles.rowReverse]}><Ionicons name={icon} size={19} color={iconColor} /><Text selectable style={[styles.metaText, { color: textColor }]}>{text}</Text></View>;
}

export default function RealXOpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { isRTL } = useAppLocale();
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const userId = user?.id;
  const [row, setRow] = React.useState<OpportunityRow | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isOpening, setIsOpening] = React.useState(false);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = getSupabase();
        const [opportunity, savedItem] = await Promise.all([
          client.from('realx_opportunities').select('*').eq('id', String(id || '')).eq('published', true).maybeSingle(),
          userId ? client.from('realx_student_saved_items').select('id').eq('student_id', userId).eq('item_type', 'opportunity').eq('item_id', String(id || '')).maybeSingle() : Promise.resolve(null),
        ]);
        if (opportunity.error) throw opportunity.error;
        if (savedItem?.error) throw savedItem.error;
        if (active) { setRow(opportunity.data as OpportunityRow | null); setSaved(Boolean(savedItem?.data)); }
        if (opportunity.data && userId) void trackCouponlyOpportunityEvent(String(id), 'view').catch(() => {});
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load this opportunity.');
      } finally { if (active) setIsLoading(false); }
    })();
    return () => { active = false; };
  }, [id, retry, userId]);

  const payload = row?.payload || {};
  const title = textValue(payload.titleEn, row?.title);
  const description = textValue(payload.descriptionEn, payload.summaryEn, payload.description);
  const location = textValue(payload.locationEn, payload.location);
  const provider = textValue(payload.providerNameEn, payload.providerName);
  const kind = textValue(payload.kind, payload.type) || 'opportunity';
  const imageUri = textValue(payload.imageUrl, payload.image_url);
  const startsAt = textValue(payload.startsAt, row?.starts_at);
  const deadline = textValue(payload.deadline, row?.ends_at);
  const dateText = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-QA', { dateStyle: 'medium' });
  };

  const toggleSave = async () => {
    if (!user) { router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } }); return; }
    try {
      const client = getSupabase();
      if (saved) {
        const { error: deleteError } = await client.from('realx_student_saved_items').delete().eq('student_id', user.id).eq('item_type', 'opportunity').eq('item_id', String(id));
        if (deleteError) throw deleteError;
        await trackCouponlyOpportunityEvent(String(id), 'unsave');
        setSaved(false);
      } else {
        const { error: saveError } = await client.from('realx_student_saved_items').upsert({ student_id: user.id, item_type: 'opportunity', item_id: String(id), payload: { title, opportunityId: id, type: 'opportunity' } }, { onConflict: 'student_id,item_type,item_id' });
        if (saveError) throw saveError;
        await trackCouponlyOpportunityEvent(String(id), 'save');
        setSaved(true);
      }
    } catch (cause) { Alert.alert(t('error'), cause instanceof Error ? cause.message : t('error')); }
  };

  const openOpportunity = async () => {
    if (!user) { router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } }); return; }
    setIsOpening(true);
    try {
      const action = await getCouponlyOpportunityAction(String(id), Crypto.randomUUID());
      await Linking.openURL(action.actionUrl);
    } catch { Alert.alert(t('error'), t('opportunity_action_failed')); }
    finally { setIsOpening(false); }
  };

  if (isLoading) return <StateSurface kind="loading" />;
  if (error || !row) return <StateSurface kind="error" onRetry={() => { setIsLoading(true); setError(''); setRetry(value => value + 1); }} />;

  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top']}>
    <AppHeader title={t(`opportunity_kind_${kind}`)} onBackPress={() => router.back()} trailing={<HeaderIconButton icon={saved ? 'bookmark' : 'bookmark-outline'} accessibilityLabel={saved ? t('saved') : t('save')} selected={saved} onPress={() => void toggleSave()} />} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {imageUri ? <Image source={{ uri: imageUri }} alt={title || 'Opportunity'} accessibilityLabel={title || 'Opportunity'} style={styles.hero} contentFit="cover" transition={180} /> : null}
      <View style={styles.body}>
        <View style={[styles.kindPill, { backgroundColor: theme.brandSoft }]}><Text style={[styles.kindText, { color: theme.brandText }]}>{t(`opportunity_kind_${kind}`)}</Text></View>
        <Text selectable style={[styles.title, { color: theme.text, textAlign: isRTL ? 'right' : 'left' }]}>{title || 'Opportunity'}</Text>
        <Text selectable style={[styles.provider, { color: theme.mutedText, textAlign: isRTL ? 'right' : 'left' }]}>{provider || t('realx')}</Text>
        <View style={styles.metaList}>
          {dateText(startsAt) ? <MetaRow icon="calendar-outline" iconColor={theme.brandText} isRTL={isRTL} text={dateText(startsAt)!} textColor={theme.mutedText} /> : null}
          {dateText(deadline) ? <MetaRow icon="hourglass-outline" iconColor={theme.brandText} isRTL={isRTL} text={t('apply_by_date', { date: dateText(deadline) })} textColor={theme.mutedText} /> : null}
          {location ? <MetaRow icon="location-outline" iconColor={theme.brandText} isRTL={isRTL} text={location} textColor={theme.mutedText} /> : null}
        </View>
        {description ? <Text selectable style={[styles.description, { color: theme.text, textAlign: isRTL ? 'right' : 'left' }]}>{description}</Text> : null}
        <Pressable onPress={() => void openOpportunity()} disabled={isOpening} style={({ pressed }) => [styles.primaryButton, { backgroundColor: theme.actionSolid, opacity: isOpening || pressed ? 0.72 : 1 }]}>
          <Text style={[styles.primaryButtonText, { color: theme.onActionSolid }]}>{isOpening ? t('opening') : t('view_opportunity')}</Text><Ionicons name="open-outline" size={18} color={theme.onActionSolid} />
        </Pressable>
        <Text style={[styles.handoff, { color: theme.subtleText }]}>{t('external_handoff_notice')}</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, rowReverse: { flexDirection: 'row-reverse' }, content: { paddingBottom: 44 },
  hero: { width: '100%', aspectRatio: 1.65 }, body: { padding: 20, gap: 14 },
  kindPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  kindText: { fontSize: 11, textTransform: 'uppercase', ...Typography.getTextVariantStyle('bodyStrong') },
  title: { fontSize: 30, lineHeight: 36, ...Typography.getTextVariantStyle('bodyStrong') },
  provider: { fontSize: 15, ...Typography.getTextVariantStyle('bodyStrong') }, metaList: { gap: 10, paddingVertical: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, metaText: { flex: 1, fontSize: 14, ...Typography.getTextVariantStyle('body') },
  description: { fontSize: 16, lineHeight: 25, ...Typography.getTextVariantStyle('body') },
  primaryButton: { minHeight: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButtonText: { fontSize: 15, ...Typography.getTextVariantStyle('bodyStrong') },
  handoff: { fontSize: 12, lineHeight: 17, textAlign: 'center', ...Typography.getTextVariantStyle('body') },
});

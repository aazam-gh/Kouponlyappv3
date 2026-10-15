import ScalePressable from '@/components/ScalePressable';
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { OnboardingScaffold, InlineNotice } from '@/components/onboarding/OnboardingUI';
import { OnboardingFlowSectionMotion } from '@/components/onboarding/OnboardingMotion';
import UserAvatar from '@/components/UserAvatar';
import ResponsiveText from '@/components/ResponsiveText';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/profile';

function InfoRow({ label, value, isRTL }: { label: string; value: string; isRTL: boolean }) {
  const { theme } = useAppTheme();
  return <View style={[styles.infoRow, { backgroundColor: theme.cardMuted, borderColor: theme.border }, isRTL && styles.infoRowRTL]}>
    <Text style={[styles.infoLabel, { color: theme.mutedText }, isRTL && styles.textRTL]}>{label}</Text>
    <Text selectable style={[styles.infoValue, { color: theme.text }, isRTL && styles.textRTL]}>{value}</Text>
  </View>;
}

export default function ProfileDetailsScreen() {
  const { user, deleteAccount } = useAuth();
  const { profile, avatarUrl, uploading, refresh } = useProfile();
  const { theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  const { t } = useTranslation();
  const { updated } = useLocalSearchParams<{ updated?: string }>();
  const [deleting, setDeleting] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let active = true;
    void refresh().catch(() => {
      if (active) Alert.alert(t('error'), t('profile_load_failed'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, t]);
  const names = profile.full_name.trim().split(/\s+/);
  const firstName = names[0] || '';
  const lastName = names.slice(1).join(' ');
  const rawDob = profile.date_of_birth || '';
  const dobDate = rawDob && /^\d{4}-\d{2}-\d{2}$/.test(rawDob) ? new Date(`${rawDob}T12:00:00`) : null;
  const dateOfBirth = dobDate ? dobDate.toLocaleDateString('en-GB') : 'DD/MM/YYYY';
  const confirmDelete = () => Alert.alert(t('delete_account'), t('delete_account_confirmation'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete_account_permanently'), style: 'destructive', onPress: () => {
      setDeleting(true);
      void deleteAccount().then((result) => {
        if (result.error) Alert.alert(t('error'), result.error);
        else router.replace({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any);
      }).finally(() => setDeleting(false));
    } },
  ]);
  return <OnboardingScaffold headerTitle={t('profile_details_title')} onBack={() => router.back()} headerAction={{ label: t('edit'), onPress: () => router.push('/edit-profile-details' as any), disabled: loading || deleting }}>
    <OnboardingFlowSectionMotion delay={65} style={[styles.identityCard, isRTL && styles.identityCardRTL]}>
      <View style={[styles.avatarRing, { backgroundColor: theme.brandSoft, borderColor: theme.border }]}>
        <UserAvatar firstName={firstName} lastName={lastName} email={profile.email || user?.email} photoURL={avatarUrl} seed={user?.id} size={112} style={styles.avatarMain} />
      </View>
      <View style={[styles.identityCopy, isRTL && styles.identityCopyRTL]}>
        <ResponsiveText selectable style={[styles.identityName, { color: theme.text }, isRTL && styles.textRTL]}>{profile.full_name || t('user')}</ResponsiveText>
        <Text selectable style={[styles.identityEmail, { color: theme.mutedText }, isRTL && styles.textRTL]}>{uploading ? 'Uploading photo…' : profile.email || user?.email || t('email_address_placeholder')}</Text>
      </View>
    </OnboardingFlowSectionMotion>
    {updated === '1' ? <InlineNotice tone="success">{t('profile_update_success')}</InlineNotice> : null}
    {loading ? <ActivityIndicator size="large" color={theme.brand} style={styles.loader} /> : <OnboardingFlowSectionMotion delay={110} style={styles.content}>
      <ResponsiveText variant="bodyStrong" style={[styles.sectionTitle, { color: theme.text }, isRTL && styles.textRTL]}>{t('personal_information')}</ResponsiveText>
      <View style={styles.infoList}>
        <InfoRow label={t('first_name')} value={firstName || t('first_name_placeholder')} isRTL={isRTL} />
        <InfoRow label={t('last_name')} value={lastName || t('last_name_placeholder')} isRTL={isRTL} />
        <InfoRow label={t('date_of_birth')} value={dateOfBirth} isRTL={isRTL} />
        <InfoRow label={t('phone_number')} value={profile.mobile || t('phone_number_empty')} isRTL={isRTL} />
      </View>
      <ResponsiveText variant="bodyStrong" style={[styles.sectionTitle, { color: theme.text }, isRTL && styles.textRTL]}>{t('account_information')}</ResponsiveText>
      <InfoRow label={t('email_address')} value={profile.email || user?.email || t('email_address_placeholder')} isRTL={isRTL} />
      <View style={[styles.dangerZone, { borderTopColor: theme.border }]}>
        <ScalePressable accessibilityRole="button" accessibilityState={{ disabled: deleting }} disabled={deleting} onPress={confirmDelete} activeOpacity={0.75} style={[styles.deleteButton, { borderColor: theme.danger, opacity: deleting ? 0.45 : 1 }]}>
          {deleting ? <ActivityIndicator color={theme.danger} /> : <Text style={[styles.deleteButtonText, { color: theme.danger }]}>{t('delete_account')}</Text>}
        </ScalePressable>
      </View>
    </OnboardingFlowSectionMotion>}
  </OnboardingScaffold>;
}

const styles = StyleSheet.create({
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: -18 }, identityCardRTL: { flexDirection: 'row-reverse' },
  avatarRing: { width: 104, height: 104, borderRadius: 52, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, avatarMain: { borderWidth: 3, borderColor: '#FFFFFF' },
  identityCopy: { flex: 1, alignItems: 'flex-start', gap: 4 }, identityCopyRTL: { alignItems: 'flex-end' }, identityName: { fontSize: 18, lineHeight: 25 }, identityEmail: { fontSize: 13, lineHeight: 19, fontFamily: 'Outfit_400Regular' },
  loader: { marginVertical: 40 }, content: { gap: 12 }, sectionTitle: { fontSize: 15, lineHeight: 22 }, infoList: { gap: 8 }, infoRow: { minHeight: 66, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11, gap: 3 }, infoRowRTL: { alignItems: 'flex-end' }, infoLabel: { fontSize: 12, lineHeight: 18, fontFamily: 'Outfit_400Regular' }, infoValue: { fontSize: 16, lineHeight: 23, fontFamily: 'Outfit_400Regular' },
  dangerZone: { marginTop: 16, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth }, deleteButton: { minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, deleteButtonText: { fontSize: 13, lineHeight: 19, fontFamily: 'Outfit_400Regular' }, textRTL: { textAlign: 'right', writingDirection: 'rtl' },
});

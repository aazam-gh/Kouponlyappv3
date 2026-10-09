import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { OnboardingField, OnboardingPrimaryButton, OnboardingScaffold } from '@/components/onboarding/OnboardingUI';
import { OnboardingFlowSectionMotion } from '@/components/onboarding/OnboardingMotion';
import ResponsiveText from '@/components/ResponsiveText';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { useProfile } from '@/lib/profile';

const DEFAULT_DATE = new Date(2000, 0, 1);
const dateValue = (value: Date | null) => value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` : '';
const parseDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;
const formatDate = (value: Date | null) => value ? new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(value) : '';

export default function EditProfileDetailsScreen() {
  const { user } = useAuth();
  const { profile, saveProfile, refresh } = useProfile();
  const { theme, isDark } = useAppTheme();
  const { isRTL } = useAppLocale();
  const { t } = useTranslation();
  const names = profile.full_name.trim().split(/\s+/);
  const [firstName, setFirstName] = React.useState(names[0] || '');
  const [lastName, setLastName] = React.useState(names.slice(1).join(' '));
  const [dob, setDob] = React.useState<Date | null>(parseDate(user?.user_metadata?.dob));
  const [dateDraft, setDateDraft] = React.useState<Date>(dob || DEFAULT_DATE);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [initialDraft, setInitialDraft] = React.useState<{ firstName: string; lastName: string; dob: Date | null } | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{ firstName?: string; lastName?: string }>({});
  React.useEffect(() => {
    let active = true;
    void refresh().catch(() => {
      if (active) Alert.alert(t('error'), t('profile_load_failed'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh, t]);
  React.useEffect(() => {
    if (loading || initialDraft) return;
    const currentNames = profile.full_name.trim().split(/\s+/);
    const next = { firstName: currentNames[0] || '', lastName: currentNames.slice(1).join(' '), dob: parseDate(user?.user_metadata?.dob) };
    setFirstName(next.firstName);
    setLastName(next.lastName);
    setDob(next.dob);
    setInitialDraft(next);
  }, [initialDraft, loading, profile.full_name, user?.user_metadata?.dob]);
  const openDatePicker = () => { setDateDraft(dob || DEFAULT_DATE); setShowDatePicker(true); };
  const exitEditor = () => router.canGoBack() ? router.back() : router.replace('/profile-details' as any);
  const confirmDiscard = () => {
    const changed = initialDraft && (firstName.trim() !== initialDraft.firstName.trim() || lastName.trim() !== initialDraft.lastName.trim() || dateValue(dob) !== dateValue(initialDraft.dob));
    if (saving) return;
    if (!changed) { exitEditor(); return; }
    Alert.alert(t('discard_changes_title'), t('discard_changes_message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('discard_changes'), style: 'destructive', onPress: exitEditor },
    ]);
  };
  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) { if (Platform.OS === 'android') setShowDatePicker(false); return; }
    if (Platform.OS === 'android') { setShowDatePicker(false); setDob(selected); }
    else setDateDraft(selected);
  };
  const save = async () => {
    const errors = { firstName: firstName.trim() ? undefined : t('first_name_required'), lastName: lastName.trim() ? undefined : t('last_name_required') };
    setFieldErrors(errors);
    if (errors.firstName || errors.lastName) return;
    setSaving(true);
    try {
      if (!user) throw new Error('Sign in to edit your profile.');
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const { error } = await getSupabase().auth.updateUser({ data: { ...user.user_metadata, full_name: fullName, dob: dateValue(dob) || null } });
      if (error) throw error;
      await saveProfile({ ...profile, full_name: fullName });
      router.replace({ pathname: '/profile-details', params: { updated: '1' } } as any);
    } catch (error) { Alert.alert(t('error'), error instanceof Error ? error.message : t('profile_update_failure')); }
    finally { setSaving(false); }
  };
  return <>
    <OnboardingScaffold headerTitle={t('edit_profile_title')} onBack={confirmDiscard} headerAction={{ label: t('cancel'), onPress: confirmDiscard, disabled: saving }} footer={<OnboardingPrimaryButton label={t('save')} loadingLabel={t('save')} loading={saving} disabled={!user || loading} onPress={() => void save()} />}>
      {loading ? <ActivityIndicator size="large" color={theme.brand} style={styles.loader} /> : <OnboardingFlowSectionMotion delay={80} style={styles.form}>
        <OnboardingField label={t('first_name')} value={firstName} onChangeText={(value) => { setFirstName(value); setFieldErrors((current) => ({ ...current, firstName: undefined })); }} placeholder={t('first_name_placeholder')} autoComplete="given-name" textContentType="givenName" editable={!saving} error={fieldErrors.firstName} textAlign={isRTL ? 'right' : 'left'} />
        <OnboardingField label={t('last_name')} value={lastName} onChangeText={(value) => { setLastName(value); setFieldErrors((current) => ({ ...current, lastName: undefined })); }} placeholder={t('last_name_placeholder')} autoComplete="family-name" textContentType="familyName" editable={!saving} error={fieldErrors.lastName} textAlign={isRTL ? 'right' : 'left'} />
        <View style={styles.fieldWrap}>
          <Text style={[styles.fieldLabel, { color: theme.text }, isRTL && styles.textRTL]}>{t('date_of_birth')}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('date_of_birth')} onPress={openDatePicker} disabled={saving} activeOpacity={0.82} style={[styles.dateInput, { backgroundColor: theme.cardMuted, borderColor: theme.border, opacity: saving ? 0.58 : 1 }]}>
            <Text style={[styles.dateValue, { color: dob ? theme.text : theme.inputPlaceholder, textAlign: isRTL ? 'right' : 'left' }]}>{formatDate(dob) || 'DD/MM/YYYY'}</Text>
            <Text style={[styles.dateAction, { color: theme.brandText }]}>{t('edit')}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.emailNotice, { backgroundColor: theme.cardMuted, borderColor: theme.border }, isRTL && styles.emailNoticeRTL]}>
          <Text style={[styles.emailNoticeLabel, { color: theme.mutedText }, isRTL && styles.textRTL]}>{t('account_information')}</Text>
          <Text selectable style={[styles.emailNoticeValue, { color: theme.text }, isRTL && styles.textRTL]}>{profile.email || user?.email || t('email_address_placeholder')}</Text>
        </View>
      </OnboardingFlowSectionMotion>}
    </OnboardingScaffold>
    {Platform.OS === 'ios' ? <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowDatePicker(false)} accessibilityRole="button" accessibilityLabel={t('cancel')} />
        <View style={[styles.dateSheet, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
          <View style={[styles.dateSheetHeader, isRTL && styles.dateSheetHeaderRTL]}>
            <ResponsiveText variant="bodyStrong" style={[styles.dateSheetTitle, { color: theme.text }, isRTL && styles.textRTL]}>{t('date_picker_title')}</ResponsiveText>
            <TouchableOpacity onPress={() => setShowDatePicker(false)} accessibilityRole="button" style={styles.sheetAction}><Text style={[styles.sheetActionText, { color: theme.mutedText }]}>{t('cancel')}</Text></TouchableOpacity>
          </View>
          <DateTimePicker value={dateDraft} mode="date" display="spinner" onChange={onDateChange} maximumDate={new Date()} textColor={theme.text} />
          <TouchableOpacity onPress={() => { setDob(dateDraft); setShowDatePicker(false); }} accessibilityRole="button" style={[styles.doneButton, { backgroundColor: theme.actionSolid }]}><Text style={[styles.doneButtonText, { color: theme.onActionSolid }]}>{t('done')}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal> : showDatePicker ? <DateTimePicker value={dateDraft} mode="date" display="default" onChange={onDateChange} maximumDate={new Date()} /> : null}
  </>;
}

const styles = StyleSheet.create({
  loader: { marginVertical: 40 }, form: { gap: 16 }, fieldWrap: { gap: 8 }, fieldLabel: { fontSize: 14, lineHeight: 20, fontFamily: 'Poppins' },
  dateInput: { minHeight: 56, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, dateValue: { flex: 1, fontSize: 16, lineHeight: 24, fontFamily: 'Poppins' }, dateAction: { fontSize: 14, lineHeight: 20, fontFamily: 'Poppins' },
  emailNotice: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 }, emailNoticeRTL: { alignItems: 'flex-end' }, emailNoticeLabel: { fontSize: 12, lineHeight: 18, fontFamily: 'Poppins' }, emailNoticeValue: { fontSize: 15, lineHeight: 22, fontFamily: 'Poppins' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' }, dateSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, gap: 8 }, dateSheetHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dateSheetHeaderRTL: { flexDirection: 'row-reverse' }, dateSheetTitle: { fontSize: 17, lineHeight: 24 }, sheetAction: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' }, sheetActionText: { fontSize: 15, lineHeight: 22, fontFamily: 'Poppins' }, doneButton: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, doneButtonText: { fontSize: 16, lineHeight: 23, fontFamily: 'Poppins' }, textRTL: { textAlign: 'right', writingDirection: 'rtl' },
});

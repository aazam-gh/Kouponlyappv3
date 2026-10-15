import ScalePressable from '@/components/ScalePressable';
import { isSchoolEmail, SCHOOL_EMAIL_MESSAGE } from '@/lib/school-email';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { InlineNotice, OnboardingField, OnboardingPrimaryButton, OnboardingScaffold, OnboardingTextButton } from '@/components/onboarding/OnboardingUI';
import { benefitsRpc, makeMutationId } from '@/lib/benefits';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { cancelCouponlyVerificationRequest, completeCouponlySignup, getCouponlyVerificationStatus, sendCouponlyEmailCode, submitCouponlyVerificationRequest, verifyCouponlyEmailCode, type CouponlyVerificationStatus, type VerificationRole } from '@/lib/couponlyBackend';
import { type ThemeColors, useAppTheme } from '@/lib/theme';
import { syncCouponlyPushToken } from '@/lib/couponlyPush';
import { clearPendingVerification, savePendingVerification } from '@/lib/verification-pending';

type Flow = 'signup' | 'login' | 'verification';
type Step = 'email' | 'code' | 'document' | 'status' | 'done';
type PickedImage = { base64: string; uri: string; extension: string; contentType: string };
const MAX_ID_BYTES = 3 * 1024 * 1024;

export default function RealXOnboardingScreen() {
  const params = useLocalSearchParams<{ flow?: Flow; step?: Step; email?: string; requestId?: string; statusToken?: string }>();
  const theme = useAppTheme(); const { colors: C } = theme;
  const { t } = useTranslation();
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user, refreshStudentAccess } = useAuth();
  const [flow, setFlow] = React.useState<Flow>(params.flow === 'login' ? 'login' : 'signup');
  const [step, setStep] = React.useState<Step>(params.step === 'status' ? 'status' : 'email');
  const [email, setEmail] = React.useState(user?.email || (typeof params.email === 'string' ? params.email : ''));
  const [code, setCode] = React.useState('');
  const [inviteCode, setInviteCode] = React.useState('');
  const inviteRequest = React.useRef({code: '', id: ''});
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const role: VerificationRole = 'student';
  const [image, setImage] = React.useState<PickedImage | null>(null);
  const [request, setRequest] = React.useState<{ requestId: string; statusToken: string } | null>(typeof params.requestId === 'string' && typeof params.statusToken === 'string' ? { requestId: params.requestId, statusToken: params.statusToken } : null);
  const [status, setStatus] = React.useState<CouponlyVerificationStatus | null>(params.step === 'status' ? 'pending' : null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const autoSubmitted = React.useRef('');
  const verificationInFlight = React.useRef(false);

  React.useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);
  React.useEffect(() => {
    if (step !== 'status' || !request) return;
    let active = true;
    const refresh = async () => {
      try { const result = await getCouponlyVerificationStatus(request.requestId, request.statusToken); if (active) setStatus(result.status); }
      catch { /* Keep showing the last request state if a poll is temporarily unavailable. */ }
    };
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [step, request]);
  React.useEffect(() => {
    if (step === 'status' && status && status !== 'pending' && status !== 'approving') void clearPendingVerification();
  }, [step, status]);
  React.useEffect(() => {
    if (flow === 'signup' && message.toLowerCase().includes('use your @rajagiri.edu.in email address')) setMessage('');
  }, [flow, message]);

  const sendCode = async () => {
    if (flow === 'verification' && !isSchoolEmail(email)) { Alert.alert('School email required', SCHOOL_EMAIL_MESSAGE); return; }
    setBusy(true); setMessage('');
    try {
      await sendCouponlyEmailCode(email.trim().toLowerCase(), flow);
      setStep('code');
      setResendCooldown(60);
      autoSubmitted.current = '';
      setMessage(flow === 'verification' ? 'We sent a code to confirm your email before ID review.' : flow === 'signup' ? 'Enter the verification code from your email.' : 'Enter the sign-in code from your email.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to send the email code.';
      setMessage(flow === 'signup' && detail.toLowerCase().includes('@rajagiri.edu.in')
        ? 'Unable to send the verification code right now. Please try again later.'
        : detail);
    } finally { setBusy(false); }
  };
  const verifyCode = async () => {
    if (code.trim().length < 6 || verificationInFlight.current) return;
    verificationInFlight.current = true;
    setBusy(true); setMessage('');
    try {
      await verifyCouponlyEmailCode(email.trim().toLowerCase(), flow, code.trim());
      if (flow === 'verification') setStep('document');
      else if (flow === 'login') {
        const current = getSupabase().auth.getUser ? await getSupabase().auth.getUser() : null;
        const uid = current?.data.user?.id;
        if (uid) {
          const { data: profile } = await getSupabase().from('realx_students').select('id').eq('id', uid).maybeSingle();
          if (profile) { setStep('done'); router.replace('/realx' as any); return; }
        }
        setFlow('signup');
        setStep('email');
        setCode('');
        setMessage('Complete your name to finish creating your student profile.');
      } else await finishProfile();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The code could not be verified.'); }
    finally { verificationInFlight.current = false; setBusy(false); }
  };
  React.useEffect(() => {
    if (step === 'code' && code.length === 6 && code !== autoSubmitted.current) {
      autoSubmitted.current = code;
      void verifyCode();
    }
  }, [code, step]);
  const resendCode = async () => {
    if (resendCooldown > 0 || busy) return;
    setBusy(true); setMessage(''); setCode(''); autoSubmitted.current = '';
    try { await sendCouponlyEmailCode(email.trim().toLowerCase(), flow); setResendCooldown(60); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to send a new code.'); }
    finally { setBusy(false); }
  };
  const finishProfile = async () => {
    setBusy(true); setMessage('');
    try {
      await completeCouponlySignup({ email: user?.email || email.trim().toLowerCase(), firstName: firstName.trim(), lastName: lastName.trim(), accountRole: role });
      if (inviteCode.trim()) {
        const normalized = inviteCode.trim().toUpperCase();
        if (inviteRequest.current.code !== normalized) inviteRequest.current = {code: normalized, id: makeMutationId()};
        await benefitsRpc('kouponly_claim_code', {p_code: normalized, p_mutation_id: inviteRequest.current.id});
      }
      await refreshStudentAccess();
      const current = await getSupabase().auth.getUser();
      if (current.data.user) void syncCouponlyPushToken(current.data.user.id, true);
      setStep('done');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save your student profile.'); }
    finally { setBusy(false); }
  };
  const pickImage = async () => {
    setMessage('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.7 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.mimeType && !['image/jpeg', 'image/png'].includes(asset.mimeType)) setMessage(t('onboarding_upload_unsupported'));
      else if (!asset.width || !asset.height || Math.min(asset.width, asset.height) < 480) setMessage(t('onboarding_upload_too_small'));
      else if (!asset.base64) setMessage(t('onboarding_upload_unreadable'));
      else if (Math.ceil((asset.base64.length * 3) / 4) > MAX_ID_BYTES) setMessage(t('onboarding_upload_image_too_large'));
      else setImage({ base64: asset.base64, uri: asset.uri, extension: asset.mimeType?.split('/')[1] || 'jpg', contentType: asset.mimeType || 'image/jpeg' });
    } catch {
      setMessage(t('onboarding_upload_picker_failed'));
    }
  };
  const submitId = async () => {
    if (!image) { setMessage('Choose a clear photo of your student ID first.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await submitCouponlyVerificationRequest({ email: email.trim().toLowerCase(), role, idImageBase64: image.base64, imageExtension: image.extension, contentType: image.contentType, details: { firstName: firstName.trim(), lastName: lastName.trim() } });
      await savePendingVerification({ email: email.trim().toLowerCase(), role, requestId: result.requestId, statusToken: result.statusToken });
      setRequest({ requestId: result.requestId, statusToken: result.statusToken }); setStatus('pending'); setStep('status');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit your student ID.'); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!request) return;
    setBusy(true); setMessage('');
    try { await cancelCouponlyVerificationRequest(request.requestId, request.statusToken); setStatus('cancelled'); await clearPendingVerification(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to cancel the request.'); }
    finally { setBusy(false); }
  };

  const heading = step === 'email' ? flow === 'login' ? t('onboarding_v2_login_title') : flow === 'verification' ? t('onboarding_v2_manual_email_title') : t('onboarding_v2_email_title')
    : step === 'code' ? t('onboarding_v2_code_title') : step === 'document' ? `${t('onboarding_upload_id_title_prefix')} ${t('onboarding_upload_id_title_suffix')}` : step === 'status' ? 'Verification status' : t('onboarding_v2_success_title', { firstName });
  const subtitle = step === 'email' ? flow === 'login' ? t('onboarding_v2_login_subtitle') : flow === 'verification' ? t('onboarding_v2_manual_email_subtitle') : undefined
    : step === 'code' ? t('onboarding_v2_code_subtitle') : step === 'document' ? t('onboarding_upload_id_description') : undefined;
  const primaryLabel = step === 'email' ? flow === 'login' ? t('onboarding_v2_send_signin_code') : t('onboarding_email_continue')
    : step === 'code' ? t('onboarding_otp_verify_button') : step === 'document' ? t('onboarding_upload_continue') : step === 'status' ? status === 'rejected' || status === 'cancelled' ? 'Start again' : 'Back to Kouponly' : 'Back to Kouponly';
  const onBack = () => {
    if (step === 'code') { setStep('email'); setCode(''); }
    else if (step === 'document') setStep('code');
    else if (step === 'status') setStep('document');
    else router.back();
  };
  const progress = flow === 'login' || step === 'done' ? undefined : flow === 'verification'
    ? { current: step === 'email' ? 2 : step === 'code' ? 3 : step === 'document' ? 4 : 5, total: 5 }
    : { current: step === 'email' ? 1 : 2, total: 2 };
  const disabled = step === 'email' ? !email.trim() || (flow === 'signup' && (!firstName.trim() || !lastName.trim())) : step === 'code' ? code.trim().length < 6 : step === 'document' ? !image : false;
  const onSubmit = step === 'email' ? sendCode : step === 'code' ? verifyCode : step === 'document' ? submitId : step === 'status' && (status === 'rejected' || status === 'cancelled') ? () => { setFlow('verification'); setStep('email'); setMessage(''); } : () => router.replace('/realx' as any);

  return <OnboardingScaffold
    transitionKey={`${flow}:${step}`}
    title={heading}
    subtitle={subtitle}
    onBack={onBack}
    onClose={() => router.replace('/realx' as any)}
    progress={progress}
    footer={<OnboardingPrimaryButton label={primaryLabel} loadingLabel={step === 'code' && flow === 'signup' ? t('onboarding_v2_creating_account') : undefined} loading={busy} disabled={disabled} onPress={() => void onSubmit()} />}
  >
    {step === 'email' ? <>
      <OnboardingField label={flow === 'login' ? t('onboarding_login_email_placeholder') : t('onboarding_email_placeholder')} value={email} onChangeText={value => { setEmail(value); setMessage(''); }} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!busy && !user} style={{ writingDirection: 'ltr', textAlign: 'left' }} />
      {flow === 'verification' ? <OnboardingTextButton label="School email domain not available? Suggest your institute" disabled={busy} onPress={() => router.push({ pathname: '/student-request', params: { kind: 'school', email } } as any)} /> : null}
      {flow === 'signup' ? <>
        <OnboardingField label={t('first_name_placeholder')} value={firstName} onChangeText={setFirstName} autoComplete="given-name" autoCapitalize="words" editable={!busy} />
        <OnboardingField label={t('last_name_placeholder')} value={lastName} onChangeText={setLastName} autoComplete="family-name" autoCapitalize="words" editable={!busy} />
        <OnboardingField label="Invite code (optional)" value={inviteCode} onChangeText={text => setInviteCode(text.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={5} editable={!busy} />
      </> : null}
      {flow === 'signup' ? <Text style={styles.legal}>{t('onboarding_v2_legal')}</Text> : null}
      {flow !== 'verification' ? <OnboardingTextButton label={flow === 'signup' ? t('onboarding_login_action') : t('onboarding_v2_create_account')} disabled={busy} onPress={() => { setFlow(flow === 'signup' ? 'login' : 'signup'); setMessage(''); }} /> : null}
    </> : null}
    {step === 'code' ? <>
      <Text style={styles.intro}>{email}</Text>
      <OtpField value={code} onChangeText={value => { setCode(value); if (value.length < 6) autoSubmitted.current = ''; }} disabled={busy} />
      <OnboardingTextButton label={t('onboarding_otp_change_email')} onPress={() => { setStep('email'); setCode(''); }} />
      {resendCooldown > 0 ? <Text style={styles.legal}>{t('onboarding_otp_resend_in', { seconds: resendCooldown })}</Text> : <OnboardingTextButton label={t('onboarding_otp_resend')} disabled={busy} onPress={() => void resendCode()} />}
      <Text style={styles.legal}>{t('onboarding_v2_code_delay')}</Text>
    </> : null}
    {step === 'document' ? <>
      <ScalePressable accessibilityLabel={image ? t('onboarding_upload_replace') : t('onboarding_upload_id_single')} accessibilityRole="button" activeOpacity={0.82} disabled={busy} onPress={() => void pickImage()} style={[styles.uploadZone, { backgroundColor: image ? C.soft : C.card, borderColor: image ? C.lime : C.line }]}>
        {image ? <><ExpoImage source={{ uri: image.uri }} style={styles.previewImage} contentFit="contain" /><View style={[styles.replaceBadge, { backgroundColor: C.ink }]}><Text style={[styles.replaceText, { color: C.onDark }]}>{t('onboarding_upload_replace')}</Text></View></> : <View style={styles.uploadPlaceholder}><Ionicons name="images-outline" size={36} color={C.muted} /><Text style={[styles.uploadLabel, { color: C.ink }]}>{t('onboarding_upload_id_single')}</Text><Text style={[styles.uploadInfo, { color: C.muted }]}>{t('onboarding_upload_id_info')}</Text></View>}
      </ScalePressable>
      <View style={styles.qualityList}>{(['corners', 'readable', 'glare'] as const).map(item => <View key={item} style={styles.qualityItem}><Ionicons name="checkmark-circle" size={18} color={C.lime} /><Text style={[styles.qualityText, { color: C.muted }]}>{t(`onboarding_upload_quality_${item}`)}</Text></View>)}</View>
      <View style={[styles.privacy, { backgroundColor: C.soft }]}><Text style={[styles.privacyText, { color: C.muted }]}>{t('onboarding_upload_privacy_explanation')}</Text><View style={styles.privacyLinks}><ScalePressable accessibilityRole="link" onPress={() => router.push('/privacy' as any)}><Text style={[styles.privacyLink, { color: C.lime }]}>{t('privacy_policy')}</Text></ScalePressable><ScalePressable accessibilityRole="link" onPress={() => router.push('/terms' as any)}><Text style={[styles.privacyLink, { color: C.lime }]}>{t('terms_and_conditions')}</Text></ScalePressable></View></View>
      {message ? <View><Text selectable accessibilityLiveRegion="polite" style={[styles.inlineError, { color: C.danger }]}>{message}</Text>{message === t('onboarding_upload_picker_failed') ? <ScalePressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.settingsButton}><Text style={[styles.privacyLink, { color: C.lime }]}>{t('onboarding_v2_open_settings')}</Text></ScalePressable> : null}</View> : null}
    </> : null}
    {step === 'status' ? <>
      <InlineNotice tone={status === 'rejected' ? 'error' : status === 'approved' ? 'success' : 'info'}>{status === 'approved' ? 'Your student status is approved.' : status === 'rejected' ? 'The uploaded document could not be verified. Submit a clearer photo to try again.' : status === 'cancelled' ? 'This request was cancelled.' : 'Your request is waiting for review. This page checks for updates automatically.'}</InlineNotice>
      {request && status === 'pending' ? <OnboardingTextButton label="Cancel request" disabled={busy} onPress={() => void cancel()} /> : null}
      {(status === 'approved' || status === 'rejected' || status === 'cancelled') ? <OnboardingTextButton label={status === 'approved' ? 'Continue to sign in' : 'Start again'} onPress={() => { setFlow(status === 'approved' ? 'login' : 'verification'); setStep('email'); }} /> : null}
    </> : null}
    {step === 'done' ? <InlineNotice tone="success">{t('onboarding_v2_success_preview')}</InlineNotice> : null}
    {message && step !== 'document' ? <InlineNotice tone={step === 'done' ? 'info' : 'error'}>{message}</InlineNotice> : null}
  </OnboardingScaffold>;
}

function OtpField({ value, onChangeText, disabled }: { value: string; onChangeText: (value: string) => void; disabled: boolean }) {
  const { colors: C } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(C), [C]);
  const input = React.useRef<TextInput>(null);
  return <View style={styles.otpWrap}>
    <ScalePressable activeOpacity={1} onPress={() => input.current?.focus()} style={styles.otpCells}>
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.otpCell, index === value.length && styles.otpCellActive]}><Text style={styles.otpDigit}>{value[index] || ''}</Text></View>)}
    </ScalePressable>
    <TextInput ref={input} value={value} onChangeText={text => onChangeText(text.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} editable={!disabled} autoFocus style={styles.hiddenInput} accessibilityLabel="Six-digit verification code" />
  </View>;
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  intro: { fontSize: 15, lineHeight: 22, color: C.muted, textAlign: 'center' },
  legal: { fontSize: 13, lineHeight: 19, color: C.muted, textAlign: 'center' },
  preview: { width: '100%', height: 210, borderRadius: 18, backgroundColor: C.soft },
  uploadZone: { height: 230, borderWidth: 1.5, borderRadius: 20, borderStyle: 'dashed', overflow: 'hidden' },
  uploadPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 24 },
  uploadLabel: { fontSize: 16, lineHeight: 23, fontFamily: 'Outfit_400Regular' },
  uploadInfo: { fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: 'Outfit_400Regular' },
  previewImage: { width: '100%', height: '100%' },
  replaceBadge: { position: 'absolute', right: 12, bottom: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  replaceText: { fontSize: 13, lineHeight: 19, fontFamily: 'Outfit_400Regular' },
  qualityList: { gap: 10 },
  qualityItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qualityText: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: 'Outfit_400Regular' },
  privacy: { borderRadius: 16, padding: 16, gap: 12 },
  privacyText: { fontSize: 13, lineHeight: 19, fontFamily: 'Outfit_400Regular' },
  privacyLinks: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  privacyLink: { fontSize: 13, lineHeight: 19, fontFamily: 'Outfit_400Regular', textDecorationLine: 'underline' },
  inlineError: { fontSize: 13, lineHeight: 19, fontFamily: 'Outfit_400Regular' },
  settingsButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  otpWrap: { width: '100%' },
  otpCells: { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  otpCell: { flex: 1, maxWidth: 52, minWidth: 38, height: 58, borderRadius: 14, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  otpCellActive: { borderColor: C.lime },
  otpDigit: { color: C.ink, fontSize: 24, fontWeight: '700' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

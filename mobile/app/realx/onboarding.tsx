import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { AccessiblePressable, AppHeader, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { cancelRealXVerificationRequest, completeRealXSignup, getRealXVerificationStatus, sendRealXEmailCode, submitRealXVerificationRequest, verifyRealXEmailCode, type RealXVerificationStatus, type VerificationRole } from '@/lib/realxBackend';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';
import { syncRealXPushToken } from '@/lib/realxPush';

type Flow = 'signup' | 'login' | 'verification';
type Step = 'email' | 'code' | 'profile' | 'document' | 'status' | 'done';
type PickedImage = { base64: string; uri: string; extension: string; contentType: string };

export default function RealXOnboardingScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [flow, setFlow] = React.useState<Flow>('signup');
  const [step, setStep] = React.useState<Step>('email');
  const [email, setEmail] = React.useState(user?.email || '');
  const [code, setCode] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [role, setRole] = React.useState<VerificationRole>('student');
  const [image, setImage] = React.useState<PickedImage | null>(null);
  const [request, setRequest] = React.useState<{ requestId: string; statusToken: string } | null>(null);
  const [status, setStatus] = React.useState<RealXVerificationStatus | null>(null);
  const [creatorCode, setCreatorCode] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');

  React.useEffect(() => { if (user?.email) setEmail(user.email); }, [user?.email]);
  React.useEffect(() => {
    if (step !== 'status' || !request) return;
    let active = true;
    const refresh = async () => {
      try { const result = await getRealXVerificationStatus(request.requestId, request.statusToken); if (active) setStatus(result.status); }
      catch { /* Keep showing the last request state if a poll is temporarily unavailable. */ }
    };
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 15000);
    return () => { active = false; clearInterval(interval); };
  }, [step, request]);

  const sendCode = async () => {
    setBusy(true); setMessage('');
    try {
      await sendRealXEmailCode(email.trim().toLowerCase(), flow);
      setStep('code');
      setMessage(flow === 'verification' ? 'We sent a code to confirm your email before ID review.' : 'Enter the sign-in code from your email.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unable to send the email code.';
      setMessage(detail);
      if (flow === 'signup' && detail.toLowerCase().includes('school email')) setFlow('verification');
    } finally { setBusy(false); }
  };
  const verifyCode = async () => {
    setBusy(true); setMessage('');
    try {
      await verifyRealXEmailCode(email.trim().toLowerCase(), flow, code.trim());
      if (flow === 'verification') setStep('document');
      else if (flow === 'login') {
        const current = getSupabase().auth.getUser ? await getSupabase().auth.getUser() : null;
        const uid = current?.data.user?.id;
        if (uid) {
          const { data: profile } = await getSupabase().from('realx_students').select('id').eq('id', uid).maybeSingle();
          if (profile) { setStep('done'); router.replace('/realx' as any); return; }
        }
        setStep('profile');
      } else setStep('profile');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The code could not be verified.'); }
    finally { setBusy(false); }
  };
  const finishProfile = async () => {
    setBusy(true); setMessage('');
    try {
      const result = await completeRealXSignup({ email: user?.email || email.trim().toLowerCase(), firstName: firstName.trim(), lastName: lastName.trim(), accountRole: role });
      const current = await getSupabase().auth.getUser();
      if (current.data.user) void syncRealXPushToken(current.data.user.id, true);
      setCreatorCode(result.creatorCode || null); setStep('done');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save your student profile.'); }
    finally { setBusy(false); }
  };
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setMessage('Allow photo library access to attach your student ID.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, base64: true, quality: 0.72 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    const extension = asset.mimeType?.split('/')[1] || 'jpg';
    setImage({ base64: asset.base64, uri: asset.uri, extension, contentType: asset.mimeType || 'image/jpeg' });
    setMessage('');
  };
  const submitId = async () => {
    if (!image) { setMessage('Choose a clear photo of your student ID first.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await submitRealXVerificationRequest({ email: email.trim().toLowerCase(), role, idImageBase64: image.base64, imageExtension: image.extension, contentType: image.contentType, details: { firstName: firstName.trim(), lastName: lastName.trim() } });
      setRequest({ requestId: result.requestId, statusToken: result.statusToken }); setStatus('pending'); setStep('status');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to submit your student ID.'); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!request) return;
    setBusy(true); setMessage('');
    try { await cancelRealXVerificationRequest(request.requestId, request.statusToken); setStatus('cancelled'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to cancel the request.'); }
    finally { setBusy(false); }
  };

  const heading = step === 'email' ? flow === 'login' ? 'Sign in' : flow === 'verification' ? 'Verify your student ID' : 'Create a student account'
    : step === 'code' ? 'Check your email' : step === 'profile' ? 'Your student profile' : step === 'document' ? 'Upload your ID' : step === 'status' ? 'Verification status' : 'You’re ready';
  const primaryLabel = step === 'email' ? flow === 'login' ? 'Send sign-in code' : 'Send email code' : step === 'code' ? 'Verify code' : step === 'profile' ? 'Finish account setup' : step === 'document' ? 'Submit for review' : 'Back to RealX';
  const submit = step === 'email' ? sendCode : step === 'code' ? verifyCode : step === 'profile' ? finishProfile : step === 'document' ? submitId : () => router.replace('/realx' as any);

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
    <Screen testID="realx-onboarding-screen">
      <AppHeader eyebrow="REALX · ACCOUNT" title={heading} back />
      {step === 'email' ? <>
        <Text style={styles.intro}>Use your school email for instant student signup. If you do not have an approved school email, submit a student ID for manual review.</Text>
        <Field label="EMAIL ADDRESS" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!busy && !user} />
        {flow === 'verification' ? <RoleChoice role={role} setRole={setRole} /> : null}
      </> : null}
      {step === 'code' ? <>
        <Text style={styles.intro}>We sent a 6 digit code to {email}. The code expires after a short time.</Text>
        <Field label="EMAIL CODE" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
        <AccessiblePressable onPress={() => { setStep('email'); setCode(''); }} style={styles.textButton}><Text style={styles.link}>Change email</Text></AccessiblePressable>
      </> : null}
      {step === 'profile' ? <>
        <Text style={styles.intro}>Complete the RealX profile tied to your verified Supabase account.</Text>
        <Field label="FIRST NAME" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <Field label="LAST NAME" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <RoleChoice role={role} setRole={setRole} />
      </> : null}
      {step === 'document' ? <>
        <Text style={styles.intro}>Upload a clear image with your name and school visible. An admin will review it and send an update to your email.</Text>
        <Field label="FIRST NAME" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <Field label="LAST NAME" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <RoleChoice role={role} setRole={setRole} />
        <AccessiblePressable onPress={() => void pickImage()} style={styles.upload}><Text style={styles.link}>{image ? 'Replace student ID photo' : 'Choose student ID photo'}</Text></AccessiblePressable>
        {image ? <Image source={{ uri: image.uri }} style={styles.preview} /> : null}
      </> : null}
      {step === 'status' ? <View style={styles.statusCard}>
        <Text style={styles.status}>{status?.replaceAll('_', ' ').toUpperCase() || 'CHECKING'}</Text>
        <Text style={styles.intro}>{status === 'approved' ? 'Your school status is approved. Use sign in to finish your student profile.' : status === 'rejected' ? 'The uploaded document could not be verified. You can submit another request with a clearer image.' : status === 'cancelled' ? 'This request was cancelled.' : 'Your request is waiting for admin review. We will refresh this status automatically.'}</Text>
        {request && status === 'pending' ? <AccessiblePressable disabled={busy} onPress={() => void cancel()} style={styles.textButton}><Text style={styles.link}>Cancel request</Text></AccessiblePressable> : null}
        {status === 'approved' || status === 'rejected' || status === 'cancelled' ? <AccessiblePressable onPress={() => { setFlow(status === 'approved' ? 'login' : 'verification'); setStep('email'); }} style={styles.textButton}><Text style={styles.link}>{status === 'approved' ? 'Continue to sign in' : 'Start again'}</Text></AccessiblePressable> : null}
      </View> : null}
      {step === 'done' ? <View style={styles.statusCard}>
        <Text style={styles.status}>STUDENT PROFILE READY</Text>
        <Text style={styles.intro}>{creatorCode ? `Your creator code is ${creatorCode}.` : 'Your RealX student profile is connected to this account.'}</Text>
      </View> : null}
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      <View style={styles.action}><PrimaryButton label={primaryLabel} loading={busy} disabled={step === 'email' ? !email.includes('@') : step === 'code' ? code.trim().length < 6 : step === 'profile' ? !firstName.trim() || !lastName.trim() : step === 'document' ? !image : false} onPress={() => void submit()} /></View>
      {step === 'email' && flow !== 'verification' ? <AccessiblePressable onPress={() => { setFlow(flow === 'signup' ? 'login' : 'signup'); setMessage(''); }} style={styles.textButton}><Text style={styles.link}>{flow === 'signup' ? 'Already a student? Sign in' : 'New student? Create an account'}</Text></AccessiblePressable> : null}
      {step === 'email' && flow === 'verification' ? <AccessiblePressable onPress={() => { setFlow('signup'); setMessage(''); }} style={styles.textButton}><Text style={styles.link}>I have an approved school email</Text></AccessiblePressable> : null}
    </Screen>
  </KeyboardAvoidingView>;
}

function Field({ label, ...props }: any) {
  const { colors: C } = useAppTheme(); const styles = React.useMemo(() => makeStyles(C), [C]);
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholder={label === 'EMAIL ADDRESS' ? 'name@school.edu.qa' : ''} placeholderTextColor={C.muted} style={styles.input} /></View>;
}
function RoleChoice({ role, setRole }: { role: VerificationRole; setRole: (role: VerificationRole) => void }) {
  const { colors: C } = useAppTheme(); const styles = React.useMemo(() => makeStyles(C), [C]);
  return <View><Text style={styles.label}>ACCOUNT TYPE</Text><View style={styles.roles}>{(['student', 'creator'] as const).map((value) => <AccessiblePressable key={value} accessibilityState={{ selected: role === value }} onPress={() => setRole(value)} style={[styles.role, role === value && styles.roleSelected]}><Text style={[styles.roleText, role === value && styles.roleTextSelected]}>{value === 'student' ? 'Student' : 'Creator'}</Text></AccessiblePressable>)}</View></View>;
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  intro: { fontFamily: F.body, fontSize: 14, lineHeight: 21, color: C.muted, marginBottom: 17 },
  field: { marginBottom: 14 }, label: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 7 },
  input: { minHeight: 52, borderRadius: 15, paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, color: C.ink, fontFamily: F.body, fontSize: 15 },
  roles: { flexDirection: 'row', gap: 9, marginBottom: 17 }, role: { minHeight: 44, minWidth: 110, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  roleSelected: { backgroundColor: C.ink, borderColor: C.ink }, roleText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 13 }, roleTextSelected: { color: C.onDark },
  upload: { minHeight: 48, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, link: { fontFamily: F.bodyBold, color: C.ink, fontSize: 13 }, textButton: { minHeight: 43, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: 210, borderRadius: 18, backgroundColor: C.soft, marginBottom: 12 }, statusCard: { backgroundColor: C.soft, padding: 19, borderRadius: 21, marginBottom: 16 }, status: { fontFamily: F.headingSemi, fontSize: 15, color: C.ink, letterSpacing: .5, marginBottom: 10 },
  error: { color: C.danger, fontFamily: F.bodySemi, fontSize: 13, lineHeight: 19, marginBottom: 12 }, action: { marginTop: 8 },
});

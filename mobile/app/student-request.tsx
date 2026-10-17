import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Keyboard, TextInput, View } from 'react-native';
import { AppHeader, AppText, PrimaryButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { makeMutationId } from '@/lib/backend';
import { submitStudentRequest, type StudentRequest } from '@/lib/student-community';

export default function StudentRequestScreen() {
  const params = useLocalSearchParams<{ kind?: string; email?: string; name?: string }>();
  const kind = params.kind === 'restaurant' ? 'restaurant' : 'school';
  const suggestedEmail = typeof params.email === 'string' ? params.email : '';
  const { user } = useAuth();
  const { colors: C } = useAppTheme();
  const [draft, setDraft] = React.useState<StudentRequest>({ kind, location: '', name: typeof params.name === 'string' ? params.name : '', domain: suggestedEmail.split('@')[1] || '', email: user?.email || suggestedEmail, contact: '', phone: '' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(false);
  const attempt = React.useRef({ fingerprint: '', id: '' });
  const inFlight = React.useRef(false);
  const owner = React.useRef(user?.id); owner.current = user?.id;
  const draftOwner = React.useRef(user?.id);
  React.useEffect(() => {
    if (draftOwner.current === user?.id) return;
    draftOwner.current = user?.id;
    setDraft({ kind, location: '', name: typeof params.name === 'string' ? params.name : '', domain: '', email: user?.email || '', contact: '', phone: '' });
    setError(''); setDone(false); attempt.current = { fingerprint: '', id: '' };
  }, [user?.id, kind]);
  const submit = async () => {
    if (inFlight.current) return;
    if (kind === 'restaurant' && !user) { router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } }); return; }
    const fingerprint = JSON.stringify(draft);
    if (attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, id: makeMutationId() };
    inFlight.current = true; setBusy(true); setError(''); Keyboard.dismiss();
    const uid = user?.id;
    try { await submitStudentRequest(draft, attempt.current.id); if (owner.current === uid) setDone(true); }
    catch (e) { if (owner.current === uid) setError(e instanceof Error ? e.message : 'Unable to submit. Please try again.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const field = (key: keyof Omit<StudentRequest, 'kind'>, label: string, keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default') => <View key={key} style={{ gap: 8 }}>
    <AppText variant="callout">{label}</AppText>
    <TextInput accessibilityLabel={label} value={draft[key] || ''} editable={!busy} onChangeText={value => { setDraft(current => ({ ...current, [key]: value })); setError(''); }} keyboardType={keyboardType} autoCapitalize={key === 'email' || key === 'domain' ? 'none' : 'words'} autoCorrect={false} maxLength={key === 'phone' ? 40 : key === 'domain' || key === 'email' ? 254 : 160} returnKeyType="done" style={{ minHeight: 54, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 16, color: C.ink, backgroundColor: C.card, fontFamily: 'Outfit_400Regular', fontSize: 16 }} />
  </View>;
  return <Screen testID="student-request-screen">
    <AppHeader title={kind === 'school' ? 'Suggest a school' : 'Request a restaurant'} back />
    <View style={{ gap: 20, paddingTop: 16 }}>
      {done ? <><AppText variant="title">Request submitted</AppText><AppText color="muted">Thanks! The Kouponly team will review your suggestion. {kind === 'school' ? 'Your school’s eligibility will be confirmed separately.' : 'We’ll use these details to contact the restaurant.'}</AppText><PrimaryButton label="Done" onPress={() => router.back()} /></> : <>
        <AppText color="muted">{kind === 'school' ? 'Can’t find your institute? Tell us its name and student email domain.' : 'Tell us where you’d like to use Kouponly. Manager details are optional.'}</AppText>
        {field('name', kind === 'school' ? 'Institute name (required)' : 'Restaurant name (required)')}
        {kind === 'school' ? field('domain', 'Student email domain (required)', 'email-address') : null}
        {kind === 'school' ? field('email', 'Your contact email (required)', 'email-address') : null}
        {kind === 'school' ? <>{field('contact', 'Your name (required)')}{field('phone', 'Your phone number (required)', 'phone-pad')}</> : null}
        {kind === 'restaurant' ? <>{field('location', 'Enter location (required)')}{field('contact', 'Manager or contact name (optional)')}{field('phone', 'Contact phone (optional)', 'phone-pad')}</> : null}
        {error ? <AppText accessibilityRole="alert" color="danger">{error}</AppText> : null}
        <PrimaryButton label={kind === 'restaurant' && !user ? 'Sign in to submit' : 'Submit request'} loading={busy} onPress={() => void submit()} />
      </>}
    </View>
  </Screen>;
}

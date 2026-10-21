import React from 'react';
import { Keyboard, TextInput, View } from 'react-native';
import { AppHeader, AppText, PrimaryButton, Screen } from '@/components/ui';
import { useAppTheme } from '@/lib/theme';
import { sendContactMessage, type ContactMessage } from '@/lib/contact';

export default function ContactUsScreen() {
  const { colors: C } = useAppTheme();
  const [draft, setDraft] = React.useState<ContactMessage>({ name: '', email: '', message: '' });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const inFlight = React.useRef(false);
  const submit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    Keyboard.dismiss();
    try {
      await sendContactMessage(draft);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send your message. Please try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const field = (key: keyof ContactMessage, label: string, multiline = false) => <View key={key} style={{ gap: 8 }}>
    <AppText variant="callout">{label}</AppText>
    <TextInput accessibilityLabel={label} value={draft[key]} onChangeText={value => { setDraft(current => ({ ...current, [key]: value })); setError(''); }} editable={!busy} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} keyboardType={key === 'email' ? 'email-address' : 'default'} autoCapitalize={key === 'email' ? 'none' : 'sentences'} autoCorrect={key === 'email' ? false : undefined} maxLength={key === 'name' ? 100 : key === 'email' ? 254 : 4000} placeholder={label} placeholderTextColor={C.muted} style={{ minHeight: multiline ? 150 : 54, padding: 14, borderWidth: 1, borderColor: C.line, borderRadius: 16, color: C.ink, backgroundColor: C.card, fontFamily: 'Outfit_400Regular', fontSize: 16 }} />
  </View>;
  return <Screen testID="contact-us-screen">
    <AppHeader title="Contact Us" back />
    {sent ? <View style={{ gap: 18 }}><AppText variant="title">Message sent</AppText><AppText color="muted">Thanks for reaching out. The Kouponly team will get back to you.</AppText><PrimaryButton label="Done" onPress={() => setSent(false)} /></View> : <View style={{ gap: 20, paddingTop: 16 }}>
      <AppText color="muted">Send a message to the Kouponly team and we’ll reply to your email.</AppText>
      {field('name', 'Your name')}
      {field('email', 'Your email address')}
      {field('message', 'Message', true)}
      {error ? <AppText accessibilityRole="alert" color="danger">{error}</AppText> : null}
      <PrimaryButton label="Send message" loading={busy} onPress={() => void submit()} />
    </View>}
  </Screen>;
}

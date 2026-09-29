import { router } from 'expo-router';
import { CheckCircle2, GraduationCap, XCircle } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { checkRealXWaktiStudent } from '@/lib/realxBackend';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXWaktiScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [isStudent, setIsStudent] = React.useState<boolean | null>(null);
  const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState('');
  const check = async () => {
    if (!user?.email) { router.push('/auth' as any); return; }
    setBusy(true); setMessage(''); setIsStudent(null);
    try { const result = await checkRealXWaktiStudent(user.email); setIsStudent(result.isStudent); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to check student status.'); }
    finally { setBusy(false); }
  };
  return <Screen testID="realx-wakti-screen">
    <AppHeader eyebrow="REALX · PARTNER" title="Wakti student access" back />
    <View style={styles.card}>
      <View style={styles.icon}><GraduationCap size={23} color={C.ink} /></View>
      <Text style={styles.title}>Check your student account</Text>
      <Text style={styles.body}>RealX checks whether the signed-in email belongs to a verified student profile. Your email is sent to the Supabase function over your authenticated session.</Text>
      {user?.email ? <Text style={styles.email}>{user.email}</Text> : <Text style={styles.email}>Sign in to check eligibility</Text>}
      {isStudent === true ? <View style={styles.result}><CheckCircle2 size={19} color="#218A50" /><Text style={styles.resultText}>Student profile verified</Text></View> : null}
      {isStudent === false ? <View style={styles.result}><XCircle size={19} color={C.danger} /><Text style={styles.resultText}>No RealX student profile found for this email</Text></View> : null}
      {busy ? <ActivityIndicator color={C.ink} /> : <PrimaryButton label={isStudent === null ? 'Check student status' : 'Check again'} onPress={() => void check()} />}
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      {!user ? <AccessiblePressable onPress={() => router.push('/auth' as any)} style={styles.login}><Text style={styles.loginText}>Sign in</Text></AccessiblePressable> : null}
    </View>
  </Screen>;
}
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 24, borderWidth: 1, borderColor: C.line, padding: 19 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  title: { fontFamily: F.headingSemi, color: C.ink, fontSize: 21 }, body: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  email: { fontFamily: F.bodySemi, color: C.ink, fontSize: 12, backgroundColor: C.soft, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, marginTop: 13, marginBottom: 14 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 }, resultText: { flex: 1, fontFamily: F.bodyBold, color: C.ink, fontSize: 12 },
  error: { fontFamily: F.body, color: C.danger, fontSize: 12, marginTop: 12 }, login: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, loginText: { fontFamily: F.bodyBold, color: C.ink },
});

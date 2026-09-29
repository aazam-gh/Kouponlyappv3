import { router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { claimBadrgoVoucher, getRealXBadrgoVoucherProgram } from '@/lib/realxBackend';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXBadrgoScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [program, setProgram] = React.useState<Record<string, any> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const load = React.useCallback(async () => {
    setLoading(true);
    try { setProgram(await getRealXBadrgoVoucherProgram()); setMessage(''); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load the ride program.'); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load, user?.id]);
  const claim = async () => {
    if (!user) { router.push('/auth' as any); return; }
    setBusy(true); setMessage('');
    try { await claimBadrgoVoucher(); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to claim a ride code.'); }
    finally { setBusy(false); }
  };
  const current = program?.claim || program?.currentClaim;
  const eligibility = program?.eligibility;
  return <Screen testID="realx-badrgo-screen">
    <AppHeader eyebrow="REALX · RIDES" title="Badrgo" back />
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 45 }} /> : program?.exists ? <>
      <View style={styles.hero}>
        <Text style={styles.kicker}>BADRGO · STUDENT RIDE</Text>
        <Text style={styles.title}>{program.title || 'Your next ride is on us'}</Text>
        <Text style={styles.body}>{program.description || 'Claim a ride code when you are eligible.'}</Text>
        <View style={styles.status}><View style={[styles.dot, { backgroundColor: program.status === 'active' ? '#3DBB74' : C.muted }]} /><Text style={styles.statusText}>{String(program.status || 'unavailable').replaceAll('_', ' ')}</Text></View>
      </View>
      {current?.code ? <View style={styles.codeCard}><Text style={styles.kicker}>YOUR RIDE CODE · {current.periodKey || current.week}</Text><Text selectable style={styles.code}>{current.code}</Text><Text style={styles.body}>{current.status === 'redeemed' ? 'This code has been redeemed.' : 'Use this code before requesting another.'}</Text></View> : null}
      <View style={styles.info}><Text style={styles.infoTitle}>How claiming works</Text><Text style={styles.infoText}>{program.instructions || 'One code is available each Qatar week. Use your current code before requesting a new one.'}</Text>{eligibility?.nextEligibleAt ? <Text style={styles.infoText}>Next eligible: {new Date(eligibility.nextEligibleAt).toLocaleString()}</Text> : null}</View>
      {!current?.code ? <PrimaryButton label="Claim ride code" loading={busy} disabled={!eligibility?.canClaim} onPress={() => void claim()} /> : null}
      {!user ? <AccessiblePressable onPress={() => router.push('/auth' as any)} style={styles.login}><Text style={styles.loginText}>Sign in to check eligibility</Text></AccessiblePressable> : null}
    </> : <View style={styles.info}><Text style={styles.infoTitle}>Ride program unavailable</Text><Text style={styles.infoText}>The Badrgo voucher program has not been configured yet.</Text></View>}
    {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
  </Screen>;
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  hero: { backgroundColor: C.ink, borderRadius: 26, padding: 21, marginBottom: 15 },
  kicker: { fontFamily: F.bodyBold, color: C.lime, fontSize: 10, letterSpacing: 1.1 },
  title: { fontFamily: F.heading, color: C.onDark, fontSize: 25, lineHeight: 31, marginTop: 8 },
  body: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 17 },
  dot: { width: 8, height: 8, borderRadius: 4 }, statusText: { fontFamily: F.bodySemi, color: C.onDark, fontSize: 12, textTransform: 'capitalize' },
  codeCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 22, padding: 19, marginBottom: 13 },
  code: { fontFamily: F.heading, color: C.ink, fontSize: 31, letterSpacing: 3, marginTop: 11 },
  info: { backgroundColor: C.soft, borderRadius: 20, padding: 17, marginBottom: 17 },
  infoTitle: { fontFamily: F.headingSemi, color: C.ink, fontSize: 16 }, infoText: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  login: { marginTop: 8, alignItems: 'center' }, loginText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 13 },
  error: { color: C.danger, fontFamily: F.bodySemi, marginTop: 12, fontSize: 13 },
});

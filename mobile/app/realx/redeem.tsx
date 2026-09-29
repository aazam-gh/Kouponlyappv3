import { useLocalSearchParams, router } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, PrimaryButton, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { redeemRealXGiftCard, redeemRealXOffer } from '@/lib/realxBackend';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXRedeemScreen() {
  const params = useLocalSearchParams<{ vendorId?: string; offerIndex?: string; vendorName?: string; offerTitle?: string }>();
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [mode, setMode] = React.useState<'offer'|'giftcard'>('offer');
  const [amount, setAmount] = React.useState(''); const [giftCardAmount, setGiftCardAmount] = React.useState('');
  const [pin, setPin] = React.useState(''); const [creatorCode, setCreatorCode] = React.useState('');
  const [loyalty, setLoyalty] = React.useState<number[]>([]); const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState(''); const [success, setSuccess] = React.useState<Record<string, any>|null>(null);
  React.useEffect(() => {
    let active = true;
    if (!params.vendorId) return;
    void (async () => {
      try {
        const { data } = await getSupabase().from('realx_vendors').select('payload').eq('id', params.vendorId).maybeSingle();
        if (!active) return;
        const values = data?.payload?.loyalty;
        setLoyalty(Array.isArray(values) ? values.map(Number).filter(Number.isFinite) : []);
        setLoading(false);
      } catch {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [params.vendorId]);
  const submit = async () => {
    if (!user) { router.push('/auth' as any); return; }
    const total = Number(amount);
    if (!Number.isFinite(total) || total <= 0) { setMessage('Enter a valid purchase amount.'); return; }
    if (!/^\d{4}$/.test(pin)) { setMessage('Enter the 4 digit vendor PIN.'); return; }
    setBusy(true); setMessage('');
    try {
      const result = mode === 'offer'
        ? await redeemRealXOffer({ vendorId: String(params.vendorId), offerIndex: Number(params.offerIndex), totalAmount: total, pin, creatorCode: creatorCode.trim() || undefined })
        : await redeemRealXGiftCard({ vendorId: String(params.vendorId), totalAmount: total, giftCardAmount: Number(giftCardAmount), pin });
      setSuccess(result as Record<string, any>);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The redemption could not be completed.'); }
    finally { setBusy(false); }
  };
  return <Screen testID="realx-redeem-screen">
    <AppHeader eyebrow="REALX · CHECKOUT" title="Redeem securely" back />
    <View style={styles.vendorCard}><Text style={styles.vendor}>{params.vendorName || 'RealX partner'}</Text><Text style={styles.offer}>{params.offerTitle || 'Vendor reward'}</Text></View>
    {success ? <View style={styles.success}><Text style={styles.successTitle}>Redemption complete</Text><Text style={styles.successText}>Final amount: QAR {Number(success.finalAmount || 0).toFixed(2)}</Text><Text style={styles.successText}>Saved: QAR {Number(success.savedAmount || 0).toFixed(2)}</Text><Text style={styles.successText}>Transaction: {String(success.transactionId || '').slice(0, 8)}</Text></View> : <>
      <View style={styles.modeRow}>{(['offer','giftcard'] as const).map((value) => <Text key={value} onPress={() => setMode(value)} style={[styles.mode, mode === value && styles.modeActive]}>{value === 'offer' ? 'Offer' : 'Gift card'}</Text>)}</View>
      <Field label="PURCHASE TOTAL · QAR" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {mode === 'giftcard' ? <><Text style={styles.label}>GIFT CARD VALUE</Text><View style={styles.values}>{(loyalty.length ? loyalty : [25,50,75]).map((value) => <Text key={value} onPress={() => setGiftCardAmount(String(value))} style={[styles.value, giftCardAmount === String(value) && styles.valueSelected]}>QAR {value}</Text>)}</View></> : <Field label="CREATOR CODE · OPTIONAL" value={creatorCode} onChangeText={setCreatorCode} autoCapitalize="characters" />}
      <Field label="VENDOR SECURITY PIN" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry />
      <Text style={styles.note}>The PIN is checked on the server and is never stored in this app.</Text>
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
      {loading ? <ActivityIndicator color={C.ink} /> : <PrimaryButton label={mode === 'offer' ? 'Redeem offer' : 'Use gift card'} loading={busy} onPress={() => void submit()} />}
    </>}
  </Screen>;
}

function Field({ label, ...props }: any) { const { colors: C } = useAppTheme(); const styles = React.useMemo(() => makeStyles(C), [C]); return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} placeholderTextColor={C.muted} style={styles.input} /></View>; }
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  vendorCard: { backgroundColor: C.soft, borderRadius: 19, padding: 16, marginBottom: 16 }, vendor: { fontFamily: F.bodyBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: C.muted }, offer: { fontFamily: F.headingSemi, fontSize: 17, color: C.ink, marginTop: 4 },
  modeRow: { flexDirection: 'row', gap: 9, marginBottom: 14 }, mode: { overflow: 'hidden', borderRadius: 13, paddingVertical: 10, paddingHorizontal: 17, color: C.ink, backgroundColor: C.soft, fontFamily: F.bodyBold }, modeActive: { backgroundColor: C.ink, color: C.onDark },
  field: { marginBottom: 13 }, label: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1, color: C.muted, marginBottom: 7 }, input: { minHeight: 51, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 14, color: C.ink, fontFamily: F.body, fontSize: 15 },
  values: { flexDirection: 'row', gap: 8, marginBottom: 15 }, value: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.soft, color: C.ink, fontFamily: F.bodyBold, fontSize: 12 }, valueSelected: { backgroundColor: C.lime }, note: { fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: -4, marginBottom: 14 },
  error: { color: C.danger, fontFamily: F.bodySemi, fontSize: 13, marginBottom: 12 }, success: { padding: 20, backgroundColor: C.soft, borderRadius: 21, gap: 8 }, successTitle: { fontFamily: F.headingSemi, fontSize: 19, color: C.ink }, successText: { fontFamily: F.body, fontSize: 13, color: C.muted },
});

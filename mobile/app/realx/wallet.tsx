import { router } from 'expo-router';
import { History, WalletCards } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

type WalletData = { cashback: number; savings: number; points: number; transactions: any[]; profileExists: boolean };
export default function RealXWalletScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [data, setData] = React.useState<WalletData | null>(null); const [loading, setLoading] = React.useState(true); const [message, setMessage] = React.useState('');
  const load = React.useCallback(async () => {
    setLoading(true); setMessage('');
    if (!user) { setData(null); setLoading(false); return; }
    try {
      const client = getSupabase();
      const { data: profile, error } = await client.from('realx_students').select('cashback,savings').eq('id', user.id).maybeSingle();
      if (error) throw error;
      if (!profile) { setData({ cashback: 0, savings: 0, points: 0, transactions: [], profileExists: false }); return; }
      const [{ data: rewards, error: rewardError }, { data: transactions, error: transactionError }] = await Promise.all([
        client.from('realx_reward_accounts').select('balance,status_points,redemption_count').eq('student_id', user.id).maybeSingle(),
        client.from('realx_transactions').select('id,vendor_id,transaction_type,status,amount,discount_amount,created_at').eq('student_id', user.id).order('created_at', { ascending: false }).limit(25),
      ]);
      if (rewardError) throw rewardError; if (transactionError) throw transactionError;
      setData({ cashback: Number(profile.cashback || rewards?.balance || 0), savings: Number(profile.savings || 0), points: Number(rewards?.status_points || 0), transactions: transactions || [], profileExists: true });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load your wallet.'); }
    finally { setLoading(false); }
  }, [user?.id]);
  React.useEffect(() => { void load(); }, [load]);
  return <Screen testID="realx-wallet-screen">
    <AppHeader eyebrow="REALX · WALLET" title="Your rewards" back />
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 42 }} /> : data?.profileExists ? <>
      <View style={styles.hero}><View style={styles.heroIcon}><WalletCards size={22} color={C.ink} /></View><Text style={styles.label}>AVAILABLE CASHBACK</Text><Text style={styles.balance}>QAR {data.cashback.toFixed(2)}</Text><Text style={styles.heroNote}>Rewards are recorded with your RealX account.</Text></View>
      <View style={styles.metrics}><Metric label="TOTAL SAVED" value={`QAR ${data.savings.toFixed(2)}`} /><Metric label="STATUS POINTS" value={String(data.points)} /></View>
      <View style={styles.sectionHead}><History size={17} color={C.ink} /><Text style={styles.section}>RECENT REDEMPTIONS</Text></View>
      {data.transactions.length ? data.transactions.map((item) => <View key={item.id} style={styles.row}><View style={styles.rowIcon}><Text style={styles.rowIconText}>Q</Text></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.transaction_type === 'giftcard' ? 'Gift card redemption' : item.transaction_type === 'online' ? 'Online offer' : 'Offer redemption'}</Text><Text style={styles.rowNote}>{new Date(item.created_at).toLocaleDateString()} · {item.status}</Text></View><Text style={styles.rowAmount}>− QAR {Number(item.amount || 0).toFixed(2)}</Text></View>) : <Empty title="No redemptions yet" body="Your completed RealX offer and gift card transactions will show here." />}
      <AccessiblePressable onPress={() => void load()} style={styles.refresh}><Text style={styles.refreshText}>Refresh wallet</Text></AccessiblePressable>
    </> : <View style={styles.setup}><Text style={styles.setupTitle}>Set up your student account</Text><Text style={styles.setupBody}>{message || 'Create a RealX student profile to use your wallet and view rewards.'}</Text><AccessiblePressable onPress={() => router.push('/realx/onboarding' as any)} style={styles.setupButton}><Text style={styles.setupButtonText}>Set up account</Text></AccessiblePressable></View>}
  </Screen>;
}
function Metric({ label, value }: { label: string; value: string }) { const { colors: C } = useAppTheme(); const styles = React.useMemo(() => makeStyles(C), [C]); return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  hero: { backgroundColor: C.ink, borderRadius: 25, padding: 20 }, heroIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  label: { fontFamily: F.bodyBold, color: C.muted, fontSize: 10, letterSpacing: 1 }, balance: { fontFamily: F.heading, color: C.onDark, fontSize: 31, marginTop: 5 }, heroNote: { fontFamily: F.body, color: '#DDD', fontSize: 12, marginTop: 8 },
  metrics: { flexDirection: 'row', gap: 10, marginTop: 11 }, metric: { flex: 1, backgroundColor: C.soft, padding: 15, borderRadius: 18, minHeight: 84, justifyContent: 'center' }, metricLabel: { fontFamily: F.bodyBold, fontSize: 9, letterSpacing: .8, color: C.muted }, metricValue: { fontFamily: F.headingSemi, color: C.ink, fontSize: 16, marginTop: 6 },
  sectionHead: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 25, marginBottom: 10 }, section: { fontFamily: F.bodyBold, fontSize: 10, color: C.ink, letterSpacing: 1 },
  row: { minHeight: 68, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 }, rowIcon: { width: 38, height: 38, backgroundColor: C.soft, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, rowIconText: { fontFamily: F.headingSemi, color: C.ink }, rowTitle: { fontFamily: F.bodySemi, color: C.ink, fontSize: 13 }, rowNote: { fontFamily: F.body, color: C.muted, fontSize: 10, marginTop: 3 }, rowAmount: { fontFamily: F.bodyBold, color: C.ink, fontSize: 11 },
  refresh: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 7 }, refreshText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 12 },
  setup: { padding: 19, borderRadius: 20, backgroundColor: C.soft }, setupTitle: { fontFamily: F.headingSemi, fontSize: 17, color: C.ink }, setupBody: { fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 19, marginTop: 6 }, setupButton: { minHeight: 46, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginTop: 13 }, setupButtonText: { fontFamily: F.bodyBold, color: C.onDark, fontSize: 13 },
});

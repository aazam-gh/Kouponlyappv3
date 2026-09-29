import { router } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXHistoryScreen() {
  const theme = useAppTheme(); const { colors: C } = theme; const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]); const { user } = useAuth();
  const [rows, setRows] = React.useState<any[]>([]); const [loading, setLoading] = React.useState(true); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      if (!user) { setRows([]); setLoading(false); return; }
      try {
        const { data, error } = await getSupabase().from('realx_transactions').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        if (active) { setRows(data || []); setMessage(''); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load transaction history.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user?.id]);
  return <Screen testID="realx-history-screen"><AppHeader eyebrow="REALX · WALLET" title="Redemption history" back />
    {!user ? <AccessiblePressable onPress={() => router.push('/auth' as any)} style={styles.signin}><Text style={styles.signinText}>Sign in to view your history</Text></AccessiblePressable> : null}
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : rows.length ? rows.map((row) => <View key={row.id} style={styles.card}><View style={styles.icon}><ReceiptText size={17} color={C.ink} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{row.vendor_name || row.vendor_id_snapshot || row.payload?.vendorName || 'RealX partner'}</Text><Text style={styles.detail}>{String(row.transaction_type || row.type || 'offer').toUpperCase()} · {new Date(row.created_at).toLocaleDateString()}</Text><Text style={styles.detail}>{String(row.status || '').toUpperCase()}</Text></View><Text style={styles.amount}>QAR {Number(row.final_amount ?? row.total_amount ?? 0).toFixed(2)}</Text></View>) : <Empty title="No redemptions yet" body={message || 'Completed RealX redemptions will appear here.'} />}
  </Screen>;
}
const makeStyles = (C: ThemeColors) => StyleSheet.create({ signin: { backgroundColor: C.soft, borderRadius: 14, padding: 13, alignItems: 'center', marginBottom: 12 }, signinText: { color: C.ink, fontFamily: F.bodyBold, fontSize: 12 }, card: { borderWidth: 1, borderColor: C.line, borderRadius: 17, backgroundColor: C.card, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, name: { fontFamily: F.headingSemi, fontSize: 13, color: C.ink }, detail: { fontFamily: F.body, fontSize: 10, color: C.muted, marginTop: 3 }, amount: { fontFamily: F.bodyBold, fontSize: 12, color: C.ink } });

import { router } from 'expo-router';
import { ArrowUpRight, Bookmark } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { trackRealXOpportunityEvent } from '@/lib/realxBackend';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXOpportunitiesScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [rows, setRows] = React.useState<any[]>([]); const [loading, setLoading] = React.useState(true); const [busy, setBusy] = React.useState(''); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().from('realx_opportunities').select('*').eq('published', true).order('starts_at', { ascending: true, nullsFirst: false });
        if (!active) return;
        if (error) setMessage(error.message); setRows(data || []); setLoading(false);
      } catch (error) {
        if (active) { setMessage(error instanceof Error ? error.message : 'Unable to load opportunities.'); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);
  const open = (id: string) => router.push({ pathname: '/realx/opportunity/[id]', params: { id } } as any);
  const save = async (row: any) => {
    if (!user) { router.push('/auth' as any); return; }
    setBusy(row.id); setMessage('');
    try {
      const { error } = await getSupabase().from('realx_student_saved_items').upsert({ student_id: user.id, item_type: 'opportunity', item_id: row.id, payload: { title: row.title, opportunityId: row.id, type: 'opportunity' } }, { onConflict: 'student_id,item_type,item_id' });
      if (error) throw error;
      await trackRealXOpportunityEvent(row.id, 'save');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save this opportunity.'); }
    finally { setBusy(''); }
  };
  return <Screen testID="realx-opportunities-screen">
    <AppHeader eyebrow="REALX · CAREER" title="Opportunities" back />
    <Text style={styles.intro}>Student and creator opportunities published by RealX.</Text>
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : rows.length ? rows.map((row) => <View key={row.id} style={styles.card}>
      <Text style={styles.kind}>{String(row.payload?.kind || row.payload?.type || 'OPPORTUNITY').toUpperCase()}</Text>
      <Text style={styles.title}>{row.payload?.titleEn || row.title || 'Opportunity'}</Text>
      <Text style={styles.body}>{row.payload?.descriptionEn || row.payload?.summaryEn || row.payload?.description || 'Open this opportunity for details and application instructions.'}</Text>
      {row.ends_at ? <Text style={styles.deadline}>Closes {new Date(row.ends_at).toLocaleDateString()}</Text> : null}
      <View style={styles.actions}>
        <AccessiblePressable disabled={Boolean(busy)} onPress={() => open(row.id)} style={styles.action}><Text style={styles.actionText}>View details</Text><ArrowUpRight size={15} color={C.onDark} /></AccessiblePressable>
        <AccessiblePressable disabled={Boolean(busy)} accessibilityLabel="Save opportunity" onPress={() => void save(row)} style={styles.save}><Bookmark size={17} color={C.ink} /></AccessiblePressable>
      </View>
    </View>) : <Empty title="No open opportunities" body={message || 'New opportunities will appear here when they are published.'} />}
    {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
  </Screen>;
}
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  intro: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 }, card: { backgroundColor: C.card, borderRadius: 21, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 11 },
  kind: { fontFamily: F.bodyBold, color: C.muted, fontSize: 10, letterSpacing: 1 }, title: { fontFamily: F.headingSemi, color: C.ink, fontSize: 19, marginTop: 5 }, body: { fontFamily: F.body, color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 6 }, deadline: { fontFamily: F.bodySemi, color: C.ink, fontSize: 11, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 }, action: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: C.ink, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, actionText: { fontFamily: F.bodyBold, color: C.onDark, fontSize: 12 }, save: { width: 46, minHeight: 44, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  error: { color: C.danger, fontFamily: F.bodySemi, fontSize: 12, marginTop: 10 },
});

import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, Bookmark } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getCouponlyOpportunityAction, trackCouponlyOpportunityEvent } from '@/mobile/lib/couponlyBackend';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXOpportunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]); const { user } = useAuth();
  const [row, setRow] = React.useState<any>(null); const [saved, setSaved] = React.useState(false); const [loading, setLoading] = React.useState(true); const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = getSupabase();
        const [opportunity, savedItem] = await Promise.all([
          client.from('couponly_opportunities').select('*').eq('id', String(id || '')).eq('published', true).maybeSingle(),
          user ? client.from('couponly_student_saved_items').select('id').eq('student_id', user.id).eq('item_type', 'opportunity').eq('item_id', String(id || '')).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
        ]);
        if (opportunity.error) throw opportunity.error; if (savedItem.error) throw savedItem.error;
        if (active) { setRow(opportunity.data); setSaved(Boolean(savedItem.data)); }
        if (opportunity.data && user) void trackCouponlyOpportunityEvent(String(id), 'view').catch(() => {});
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load this opportunity.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, user?.id]);
  const payload = row?.payload || {};
  const save = async () => {
    if (!user) { router.push('/auth' as any); return; }
    setBusy(true); setMessage('');
    try {
      const client = getSupabase();
      if (saved) {
        const { error } = await client.from('couponly_student_saved_items').delete().eq('student_id', user.id).eq('item_type', 'opportunity').eq('item_id', String(id));
        if (error) throw error;
        await trackCouponlyOpportunityEvent(String(id), 'unsave'); setSaved(false);
      } else {
        const { error } = await client.from('couponly_student_saved_items').upsert({ student_id: user.id, item_type: 'opportunity', item_id: String(id), payload: { title: payload.titleEn || row.title, opportunityId: id, type: 'opportunity' } }, { onConflict: 'student_id,item_type,item_id' });
        if (error) throw error;
        await trackCouponlyOpportunityEvent(String(id), 'save'); setSaved(true);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save this opportunity.'); }
    finally { setBusy(false); }
  };
  const open = async () => {
    if (!user) { router.push('/auth' as any); return; }
    setBusy(true); setMessage('');
    try { const action = await getCouponlyOpportunityAction(String(id), Crypto.randomUUID()); await Linking.openURL(action.actionUrl); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'This opportunity is not available right now.'); }
    finally { setBusy(false); }
  };
  return <Screen testID="couponly-opportunity-detail-screen"><AppHeader eyebrow="REALX · OPPORTUNITY" title={payload.titleEn || row?.title || 'Details'} back />
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : row ? <>
      <View style={styles.card}><Text style={styles.kind}>{String(payload.kind || payload.type || 'OPPORTUNITY').toUpperCase()}</Text><Text style={styles.title}>{payload.titleEn || row.title || 'Opportunity'}</Text><Text style={styles.body}>{payload.descriptionEn || payload.summaryEn || payload.description || 'Review the opportunity details and application instructions.'}</Text>
        {row.starts_at ? <Text style={styles.meta}>Opens {new Date(row.starts_at).toLocaleDateString()}</Text> : null}{row.ends_at ? <Text style={styles.meta}>Closes {new Date(row.ends_at).toLocaleDateString()}</Text> : null}
        {payload.instructionsEn || payload.instructions ? <Text style={styles.instructions}>{payload.instructionsEn || payload.instructions}</Text> : null}
      </View>
      <View style={styles.actions}><AccessiblePressable disabled={busy} onPress={() => void open()} style={styles.open}><Text style={styles.openText}>{busy ? 'Opening…' : 'Continue to opportunity'}</Text><ArrowUpRight size={16} color={C.onDark} /></AccessiblePressable><AccessiblePressable disabled={busy} accessibilityLabel={saved ? 'Remove from saved items' : 'Save opportunity'} onPress={() => void save()} style={styles.save}><Bookmark size={18} color={C.ink} fill={saved ? C.lime : 'transparent'} /></AccessiblePressable></View>
    </> : <Empty title="Opportunity unavailable" body={message || 'This opportunity is unpublished or could not be found.'} />}
    {message && row ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
  </Screen>;
}
const makeStyles = (C: ThemeColors) => StyleSheet.create({ card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 21, padding: 17 }, kind: { fontFamily: F.bodyBold, fontSize: 10, color: C.muted, letterSpacing: 1 }, title: { fontFamily: F.heading, fontSize: 22, color: C.ink, marginTop: 6 }, body: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }, meta: { fontFamily: F.bodyBold, color: C.ink, fontSize: 11, marginTop: 10 }, instructions: { fontFamily: F.body, color: C.ink, fontSize: 12, lineHeight: 18, marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: C.line }, actions: { flexDirection: 'row', gap: 8, marginTop: 12 }, open: { flex: 1, minHeight: 45, backgroundColor: C.ink, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, openText: { fontFamily: F.bodyBold, fontSize: 12, color: C.onDark }, save: { width: 47, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, error: { color: C.danger, fontFamily: F.bodySemi, fontSize: 12, marginTop: 10 } });

import { router } from 'expo-router';
import { Bookmark, Store } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXSavedScreen() {
  const theme = useAppTheme(); const { colors: C } = theme; const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]); const { user } = useAuth();
  const [rows, setRows] = React.useState<any[]>([]); const [loading, setLoading] = React.useState(true); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      if (!user) { setRows([]); setLoading(false); return; }
      try {
        const { data: saved, error } = await getSupabase().from('realx_student_saved_items').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        const items = saved || []; const vendorIds = items.filter((item: any) => item.item_type === 'vendor').map((item: any) => item.item_id); const opportunityIds = items.filter((item: any) => item.item_type === 'opportunity').map((item: any) => item.item_id); const offerIds = items.filter((item: any) => item.item_type === 'offer').map((item: any) => item.item_id);
        const [vendors, opportunities] = await Promise.all([
          vendorIds.length ? getSupabase().from('realx_vendors').select('id,name,payload').in('id', vendorIds) : Promise.resolve({ data: [], error: null } as any),
          opportunityIds.length ? getSupabase().from('realx_opportunities').select('id,title,payload').in('id', opportunityIds) : Promise.resolve({ data: [], error: null } as any),
        ]);
        if (vendors.error) throw vendors.error; if (opportunities.error) throw opportunities.error;
        const lookup = new Map<string, any>(); for (const row of vendors.data || []) lookup.set(`vendor:${row.id}`, row); for (const row of opportunities.data || []) lookup.set(`opportunity:${row.id}`, row);
        if (offerIds.length) {
          const { data: offers, error: offerError } = await getSupabase().from('realx_offers').select('id,vendor_id,title,payload').in('id', offerIds);
          if (offerError) throw offerError;
          for (const row of offers || []) lookup.set(`offer:${row.id}`, row);
        }
        if (active) { setRows(items.map((item: any) => ({ ...item, record: lookup.get(`${item.item_type}:${item.item_id}`) })).filter((item: any) => item.record)); setMessage(''); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load saved items.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user?.id]);
  return <Screen testID="realx-saved-screen"><AppHeader eyebrow="REALX · YOUR LIST" title="Saved items" back />
    {!user ? <AccessiblePressable onPress={() => router.push('/auth' as any)} style={styles.signin}><Text style={styles.signinText}>Sign in to view saved items</Text></AccessiblePressable> : null}
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : rows.length ? rows.map((item) => {
      const record = item.record; const title = record.name || record.payload?.titleEn || record.payload?.title || record.title || item.payload?.title || 'Saved item';
      const destination = item.item_type === 'vendor' ? { pathname: '/realx/vendor/[id]', params: { id: item.item_id } } : item.item_type === 'offer' ? { pathname: '/realx/vendor/[id]', params: { id: item.payload?.vendorId || record.vendor_id } } : { pathname: '/realx/opportunity/[id]', params: { id: item.item_id } };
      return <AccessiblePressable key={item.id} onPress={() => router.push(destination as any)} style={styles.card}>
        <View style={styles.icon}>{item.item_type === 'vendor' ? <Store size={17} color={C.ink} /> : <Bookmark size={17} color={C.ink} />}</View><View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.note}>{item.item_type === 'vendor' ? record.payload?.mainCategory || 'Partner' : item.item_type === 'offer' ? 'Offer' : 'Opportunity'}</Text></View>
      </AccessiblePressable>;
    }) : <Empty title="Nothing saved yet" body={message || 'Save a partner or opportunity and it will be listed here.'} />}
  </Screen>;
}
const makeStyles = (C: ThemeColors) => StyleSheet.create({ signin: { backgroundColor: C.soft, borderRadius: 14, padding: 13, alignItems: 'center', marginBottom: 12 }, signinText: { color: C.ink, fontFamily: F.bodyBold, fontSize: 12 }, card: { minHeight: 68, borderWidth: 1, borderColor: C.line, borderRadius: 16, backgroundColor: C.card, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 39, height: 39, borderRadius: 13, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: F.headingSemi, fontSize: 13, color: C.ink }, note: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 3 } });

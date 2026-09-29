import { router, useLocalSearchParams } from 'expo-router';
import { Store } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

type Vendor = { id: string; name: string; category_id: string | null; payload: Record<string, any> };
export default function RealXCategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const [title, setTitle] = React.useState('Campus category'); const [rows, setRows] = React.useState<Vendor[]>([]); const [loading, setLoading] = React.useState(true); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = getSupabase();
        const [category, vendors] = await Promise.all([
          client.from('realx_categories').select('id,name,slug,payload').eq('id', String(id || '')).maybeSingle(),
          client.from('realx_vendors').select('id,name,category_id,payload').eq('status', 'Active').order('name').limit(500),
        ]);
        if (category.error) throw category.error; if (vendors.error) throw vendors.error;
        const categoryName = category.data?.name || category.data?.payload?.nameEn || 'Campus category';
        const categoryValue = String(category.data?.slug || category.data?.name || id || '').toLocaleLowerCase();
        if (active) { setTitle(categoryName); setRows(((vendors.data || []) as Vendor[]).filter((row) => row.category_id === id || String(row.payload?.mainCategory || '').toLocaleLowerCase() === categoryValue)); setMessage(''); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load this category.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id]);
  return <Screen testID="realx-category-screen"><AppHeader eyebrow="REALX · CATEGORY" title={title} back />
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : rows.length ? rows.map((row) => <AccessiblePressable key={row.id} onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: row.id } } as any)} style={styles.card}>
      <View style={styles.icon}><Store size={18} color={C.ink} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{row.name || row.payload?.name || 'RealX partner'}</Text><Text style={styles.body}>{(row.payload?.offers || []).length ? `${row.payload.offers.length} offer${row.payload.offers.length === 1 ? '' : 's'}` : row.payload?.description || 'View partner offers and details.'}</Text></View>
    </AccessiblePressable>) : <Empty icon="%" title="No partners in this category" body={message || 'Active partners will appear here.'} />}
  </Screen>;
}
const makeStyles = (C: ThemeColors) => StyleSheet.create({ card: { minHeight: 70, borderWidth: 1, borderColor: C.line, borderRadius: 17, backgroundColor: C.card, padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11 }, icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: C.soft }, name: { fontFamily: F.headingSemi, color: C.ink, fontSize: 14 }, body: { fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 3 } });

import { router } from 'expo-router';
import { Search as SearchIcon, Store } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

type Vendor = { id: string; name: string; category_id: string | null; vendor_type: string; payload: Record<string, any> };
export default function RealXSearchScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const [query, setQuery] = React.useState(''); const [rows, setRows] = React.useState<Vendor[]>([]); const [loading, setLoading] = React.useState(true); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().from('realx_vendors').select('id,name,category_id,vendor_type,payload').eq('status', 'Active').order('name').limit(500);
        if (error) throw error;
        if (active) { setRows((data || []) as Vendor[]); setMessage(''); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load partners.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const normalized = query.trim().toLocaleLowerCase();
  const results = rows.filter((row) => {
    if (!normalized) return true;
    const p = row.payload || {};
    const offers = Array.isArray(p.offers) ? p.offers : [];
    return [row.name, p.nameAr, p.mainCategory, p.description, ...(p.searchTokens || []), ...offers.flatMap((offer: any) => [offer.titleEn, offer.titleAr, offer.descriptionEn, offer.descriptionAr])]
      .filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized));
  });
  return <Screen testID="realx-search-screen">
    <AppHeader eyebrow="REALX · EXPLORE" title="Search partners" back />
    <View style={styles.search}><SearchIcon size={17} color={C.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Vendor, offer, category" placeholderTextColor={C.muted} style={styles.input} returnKeyType="search" accessibilityLabel="Search RealX partners" /></View>
    <Text style={styles.count}>{query ? `${results.length} MATCHES` : `${results.length} PARTNERS`}</Text>
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : results.length ? results.map((row) => <AccessiblePressable key={row.id} onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: row.id } } as any)} style={styles.card}>
      <View style={styles.icon}><Store size={18} color={C.ink} /></View><View style={{ flex: 1 }}><Text style={styles.title}>{row.name || row.payload?.name || 'RealX partner'}</Text><Text style={styles.meta}>{row.payload?.mainCategory || row.vendor_type || 'Partner'}</Text><Text numberOfLines={1} style={styles.description}>{(row.payload?.offers || []).map((offer: any) => offer.titleEn || offer.title).filter(Boolean).slice(0, 3).join(' · ') || row.payload?.description || 'Explore partner details and offers.'}</Text></View>
    </AccessiblePressable>) : <Empty icon="⌕" title={query ? 'No matches found' : 'No partners yet'} body={message || (query ? 'Try a vendor name or a different search.' : 'Active RealX partners will appear here.')} />}
  </Screen>;
}
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  search: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 17 },
  input: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.ink, paddingVertical: 10 }, count: { fontFamily: F.bodyBold, fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 9 },
  card: { minHeight: 78, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, padding: 12, flexDirection: 'row', gap: 11, alignItems: 'center', marginBottom: 9 },
  icon: { width: 41, height: 41, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, title: { fontFamily: F.headingSemi, color: C.ink, fontSize: 14 }, meta: { fontFamily: F.bodyBold, color: C.muted, fontSize: 10, marginTop: 2 }, description: { fontFamily: F.body, color: C.muted, fontSize: 11, marginTop: 3 },
});

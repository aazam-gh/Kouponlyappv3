import { router } from 'expo-router';
import { ExternalLink, MapPin, Store } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

type Location = { id: string; vendor_id: string; latitude: number; longitude: number; payload: Record<string, any> };

export default function RealXMapScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const [rows, setRows] = React.useState<Location[]>([]); const [loading, setLoading] = React.useState(true); const [message, setMessage] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().from('realx_map_locations').select('id,vendor_id,latitude,longitude,payload').order('vendor_id').limit(500);
        if (error) throw error;
        if (active) { setRows((data || []) as Location[]); setMessage(''); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load partner locations.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  const openMap = (row: Location) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${row.latitude},${row.longitude}`)}`;
    void Linking.openURL(url);
  };
  return <Screen testID="realx-map-screen">
    <AppHeader eyebrow="REALX · EXPLORE" title="Partner map" back />
    <Text style={styles.intro}>Active RealX locations with directions in your map app.</Text>
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : rows.length ? rows.map((row) => {
      const p = row.payload || {};
      return <View key={row.id} style={styles.card}>
        <View style={styles.icon}><MapPin size={19} color={C.ink} /></View>
        <Text style={styles.vendor}>{p.vendorName || p.name || 'RealX partner'}</Text>
        <Text style={styles.name}>{p.branchName || p.name || p.address || 'Partner location'}</Text>
        <Text style={styles.address}>{p.address || p.addressAr || 'Qatar'}</Text>
        <View style={styles.actions}>
          <AccessiblePressable onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: row.vendor_id } } as any)} style={styles.secondary}><Store size={15} color={C.ink} /><Text style={styles.secondaryText}>Partner details</Text></AccessiblePressable>
          <AccessiblePressable accessibilityLabel="Open directions" onPress={() => openMap(row)} style={styles.primary}><ExternalLink size={15} color={C.onDark} /><Text style={styles.primaryText}>Directions</Text></AccessiblePressable>
        </View>
      </View>;
    }) : <Empty icon="⌖" title="No partner locations yet" body={message || 'Partner locations will appear when active vendors add their branches.'} />}
  </Screen>;
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  intro: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 20, padding: 15, marginBottom: 10 },
  icon: { width: 39, height: 39, borderRadius: 13, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  vendor: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: .8, color: C.muted, textTransform: 'uppercase' },
  name: { fontFamily: F.headingSemi, fontSize: 16, color: C.ink, marginTop: 4 },
  address: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondary: { minHeight: 40, flex: 1, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  secondaryText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 11 },
  primary: { minHeight: 40, flex: 1, borderRadius: 12, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  primaryText: { fontFamily: F.bodyBold, color: C.onDark, fontSize: 11 },
});

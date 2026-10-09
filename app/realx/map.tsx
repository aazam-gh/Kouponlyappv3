import { router } from 'expo-router';
import { LocateFixed, MapPin, Search, Store, X } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchVendorMapLocations, type VendorMapLocation } from '@/lib/nearby-vendors';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

const DOHA = { latitude: 25.2854, longitude: 51.531 };
const FILTERS = ['All', 'Food', 'Cafe', 'Fitness', 'Beauty'];

export default function RealXMapScreen() {
  const { colors: C } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [locations, setLocations] = React.useState<VendorMapLocation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  const [selected, setSelected] = React.useState<VendorMapLocation | null>(null);
  React.useEffect(() => {
    let active = true;
    void fetchVendorMapLocations().then(rows => { if (active) { setLocations(rows); setMessage(''); } }).catch(error => {
      if (active) setMessage(error instanceof Error ? error.message : 'Partner locations could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const visible = React.useMemo(() => locations.filter(item => {
    const category = item.category.toLocaleLowerCase();
    const matchesFilter = filter === 'All' || (filter === 'Food' ? /food|restaurant|cafe|coffee|dining/.test(category) : filter === 'Cafe' ? /cafe|coffee/.test(category) : filter === 'Fitness' ? /fitness|gym|sport/.test(category) : /beauty|salon/.test(category));
    const text = `${item.name} ${item.category} ${item.place} ${item.description}`.toLocaleLowerCase();
    return matchesFilter && (!query.trim() || text.includes(query.trim().toLocaleLowerCase()));
  }), [locations, filter, query]);
  const openDirections = (item: VendorMapLocation) => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.latitude},${item.longitude}`)}`);
  return <View testID="couponly-map-screen" style={[s.root, { backgroundColor: C.paper }]}>
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...DOHA, latitudeDelta: 0.12, longitudeDelta: 0.12 }}
      showsUserLocation
      showsCompass={false}
      accessibilityLabel="Map of RealX partners"
    >
      {visible.map(item => <Marker key={`${item.vendorId}:${item.locationId}`} coordinate={{ latitude: item.latitude, longitude: item.longitude }} onPress={() => setSelected(item)} accessibilityLabel={`View ${item.name}`}>
        <View style={[s.pin, { backgroundColor: C.lime, borderColor: C.paper }]}><MapPin size={16} color="#FFFFFF" /></View>
      </Marker>)}
    </MapView>
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={s.overlay}>
      <View style={[s.search, { backgroundColor: C.card, borderColor: C.line }]}>
        <Search size={18} color={C.muted} />
        <TextInput testID="map-search" accessibilityLabel="Search partners on map" value={query} onChangeText={setQuery} placeholder="Search partners and offers" placeholderTextColor={C.muted} returnKeyType="search" style={[s.input, { color: C.ink }]} />
        {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}><X size={18} color={C.muted} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
        {FILTERS.map(item => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Filter ${item}`} accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[s.filter, { backgroundColor: filter === item ? C.ink : C.card, borderColor: C.line }]}><Text style={[s.filterText, { color: filter === item ? C.onDark : C.ink }]}>{item}</Text></Pressable>)}
      </ScrollView>
    </SafeAreaView>
    <Pressable accessibilityLabel="Recenter map" onPress={() => undefined} style={[s.locate, { bottom: Math.max(insets.bottom, 10) + (selected ? 148 : 18), backgroundColor: C.card }]}><LocateFixed size={20} color={C.ink} /></Pressable>
    {loading ? <View style={[s.status, { backgroundColor: C.card }]}><ActivityIndicator color={C.lime} /><Text style={[s.statusText, { color: C.ink }]}>Finding partners…</Text></View> : null}
    {!loading && !visible.length ? <View style={[s.empty, { backgroundColor: C.card }]}><Text style={[s.emptyTitle, { color: C.ink }]}>{message ? 'Map unavailable' : 'No partners found'}</Text><Text style={[s.statusText, { color: C.muted }]}>{message || 'Try a different search or category.'}</Text></View> : null}
    {selected ? <View style={[s.placeCard, { backgroundColor: C.card, borderColor: C.line, bottom: Math.max(insets.bottom, 10) + 12 }]}>
      {selected.image ? <Image source={{ uri: selected.image }} style={s.photo} /> : <View style={[s.photo, s.placeholder, { backgroundColor: C.soft }]}><Store size={20} color={C.ink} /></View>}
      <View style={s.placeCopy}><Text numberOfLines={1} style={[s.placeName, { color: C.ink }]}>{selected.name}</Text><Text numberOfLines={1} style={[s.placeInfo, { color: C.muted }]}>{selected.place} · {selected.category}</Text><View style={s.actions}><Pressable onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: selected.vendorId } } as any)}><Text style={[s.action, { color: C.lime }]}>Partner details</Text></Pressable><Pressable onPress={() => openDirections(selected)}><Text style={[s.action, { color: C.ink }]}>Directions</Text></Pressable></View></View>
      <Pressable accessibilityLabel="Close partner details" onPress={() => setSelected(null)} style={s.close}><X size={17} color={C.muted} /></Pressable>
    </View> : null}
  </View>;
}
const s = StyleSheet.create({ root: { flex: 1 }, overlay: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16 }, search: { minHeight: 50, borderWidth: 1, borderRadius: 17, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 4 }, input: { flex: 1, fontFamily: F.body, fontSize: 14, paddingVertical: 10 }, filters: { gap: 8, paddingVertical: 12, paddingRight: 16 }, filter: { minHeight: 38, borderWidth: 1, borderRadius: 20, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' }, filterText: { fontFamily: F.bodySemi, fontSize: 12 }, locate: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: .15, shadowRadius: 8 }, status: { position: 'absolute', top: 125, left: 25, right: 25, minHeight: 55, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, elevation: 3 }, statusText: { fontFamily: F.body, fontSize: 12 }, empty: { position: 'absolute', top: 124, left: 16, right: 16, padding: 14, borderRadius: 16, elevation: 3 }, emptyTitle: { fontFamily: F.headingSemi, fontSize: 14, marginBottom: 3 }, placeCard: { position: 'absolute', left: 14, right: 14, minHeight: 108, borderWidth: 1, borderRadius: 20, padding: 11, flexDirection: 'row', gap: 11, elevation: 5, shadowColor: '#000', shadowOpacity: .16, shadowRadius: 10 }, photo: { width: 68, height: 68, borderRadius: 13 }, placeholder: { alignItems: 'center', justifyContent: 'center' }, placeCopy: { flex: 1, paddingTop: 2 }, placeName: { fontFamily: F.headingSemi, fontSize: 15 }, placeInfo: { fontFamily: F.body, fontSize: 11, marginTop: 4 }, actions: { flexDirection: 'row', gap: 17, marginTop: 10 }, action: { fontFamily: F.bodyBold, fontSize: 11 }, close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' } });

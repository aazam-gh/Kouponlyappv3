import { Colors as BorderPalette } from '@/constants/Colors';
import Animated from 'react-native-reanimated';
import { CONTENT_ENTER, CONTENT_EXIT } from '@/utils/motion';
import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Keyboard, Linking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker, type Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Supercluster from 'supercluster';
import type { ClusterFeature, PointFeature } from 'supercluster';
import { fetchVendorMapLocations, type VendorMapLocation } from '@/lib/nearby-vendors';
import { getCurrentPosition } from '@/lib/location';
import { F, useAppTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/context/LocaleContext';
import { Colors } from '@/constants/Colors';
import { MAP_PANEL_TAB_BAR_GAP, TAB_BAR_BASE_HEIGHT } from '@/constants/Layout';
import { distanceBetweenKm } from '@/lib/vendor-distance';

const DEFAULT_LOCATION = { latitude: 9.9932, longitude: 76.3576 };
const FILTERS = [{ label: 'Cafe', key: 'map_filter_cafe', icon: 'cafe-outline' }, { label: 'Gym', key: 'map_filter_gym', icon: 'barbell-outline' }, { label: 'Food', key: 'map_filter_restaurant', icon: 'restaurant-outline' }, { label: 'Salon', key: 'map_filter_salon', icon: 'cut-outline' }];
const MARKER_COLORS = { food: '#FF7A00', cafe: '#A66A2C', gym: '#246BFE', salon: '#D93D8B', services: '#5856D6', other: '#6C63FF', deal: '#111111', xcard: Colors.brandGreen };
type LocatedVendor = VendorMapLocation & { latitude: number; longitude: number };
type MapPointProps = { id: string };

function matchesCategory(item: LocatedVendor, filter: string) {
  const category = item.category.toLocaleLowerCase();
  return filter === 'All' || (filter === 'Food' ? /food|restaurant|cafe|coffee|dining/.test(category) : filter === 'Cafe' ? /cafe|coffee/.test(category) : filter === 'Gym' ? /fitness|gym|sport/.test(category) : /beauty|salon/.test(category));
}

function markerColor(item: LocatedVendor) {
  if (item.offers?.some(offer => offer.discountType === 'buy1get1')) return MARKER_COLORS.deal;
  if (item.xcard) return MARKER_COLORS.xcard;
  const category = item.category.toLocaleLowerCase();
  if (/cafe|coffee/.test(category)) return MARKER_COLORS.cafe;
  if (/gym|fitness|sport/.test(category)) return MARKER_COLORS.gym;
  if (/salon|beauty/.test(category)) return MARKER_COLORS.salon;
  if (/service/.test(category)) return MARKER_COLORS.services;
  if (/food|restaurant|dining/.test(category)) return MARKER_COLORS.food;
  return MARKER_COLORS.other;
}

export default function RealXMapScreen() {
  const { colors: C } = useAppTheme();
  const { reduceMotion } = useMotionPreferences();
  const { isRTL } = useAppLocale();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const mapRef = React.useRef<MapView | null>(null);
  const mapReady = React.useRef(false);
  const pendingInitialRegion = React.useRef<Region | null>(null);
  const [region, setRegion] = React.useState<Region>({ ...DEFAULT_LOCATION, latitudeDelta: 0.03, longitudeDelta: 0.03 });
  const [userLocation, setUserLocation] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [locations, setLocations] = React.useState<LocatedVendor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState('All');
  const [selected, setSelected] = React.useState<LocatedVendor | null>(null);
  const [clusterPreview, setClusterPreview] = React.useState<LocatedVendor[]>([]);
  const [bottomPanelHeight, setBottomPanelHeight] = React.useState(0);
  const [savedVendorIds, setSavedVendorIds] = React.useState<string[]>([]);
  const fetchedMapKey = React.useRef('');
  const fetchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusInitialized = React.useRef(false);
  const boundsFor = (mapRegion: Region) => ({
    south: mapRegion.latitude - mapRegion.latitudeDelta / 2,
    north: mapRegion.latitude + mapRegion.latitudeDelta / 2,
    west: mapRegion.longitude - mapRegion.longitudeDelta / 2,
    east: mapRegion.longitude + mapRegion.longitudeDelta / 2,
  });
  const fetchMap = React.useCallback(async (nextRegion: Region): Promise<LocatedVendor[]> => {
    const key = `${query.trim().toLowerCase()}:${nextRegion.latitude.toFixed(2)}:${nextRegion.longitude.toFixed(2)}:${nextRegion.latitudeDelta.toFixed(2)}`;
    if (fetchedMapKey.current === key) return [];
    fetchedMapKey.current = key;
    try {
      const rows = await fetchVendorMapLocations(query.trim() || undefined, query.trim() ? undefined : boundsFor(nextRegion));
      const valid = rows.filter((row): row is LocatedVendor => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
      setLocations(previous => Array.from(new Map([...previous, ...valid].map(item => [`${item.vendorId}:${item.locationId}`, item])).values()));
      setMessage('');
      return valid;
    } catch (error) {
      fetchedMapKey.current = '';
      setMessage(error instanceof Error ? error.message : 'Partner locations could not be loaded.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [query]);
  React.useEffect(() => {
    let active = true;
    if (focusInitialized.current) return;
    focusInitialized.current = true;
    void (async () => {
      let initialRegion = region;
      let permission = await Location.getForegroundPermissionsAsync();
      if (permission.status !== 'granted' && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        try {
          const position = await getCurrentPosition();
          initialRegion = { latitude: position.coords.latitude, longitude: position.coords.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 };
          setRegion(initialRegion);
          setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          if (mapReady.current) mapRef.current?.animateToRegion(initialRegion, reduceMotion ? 0 : 300);
          else pendingInitialRegion.current = initialRegion;
        } catch { /* Keep Rajagiri as the initial region when location is unavailable. */ }
      }
      if (active) void fetchMap(initialRegion);
    })();
    return () => { active = false; };
  }, [fetchMap]);
  React.useEffect(() => {
    let active = true;
    if (!user) { setSavedVendorIds([]); return () => { active = false; }; }
    void getSupabase().from('realx_student_saved_items').select('item_id').eq('student_id', user.id).eq('item_type', 'vendor').then(({ data }) => {
      if (active) setSavedVendorIds((data || []).map(row => row.item_id));
    });
    return () => { active = false; };
  }, [user?.id]);
  const visible = React.useMemo(() => locations.filter(item => {
    const text = `${item.name} ${item.category} ${item.place} ${item.description}`.toLocaleLowerCase();
    return matchesCategory(item, filter) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase()));
  }), [locations, filter, query]);
  const refreshSearch = React.useCallback(async () => {
    fetchedMapKey.current = '';
    setLoading(true);
    const fresh = await fetchMap(region);
    fitLocations([...locations, ...fresh].filter(item => `${item.name} ${item.category} ${item.place} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase())));
  }, [fetchMap, locations, query, region]);
  const vendorsById = React.useMemo(() => new Map(visible.map(item => [`${item.vendorId}:${item.locationId}`, item])), [visible]);
  const points = React.useMemo<PointFeature<MapPointProps>[]>(() => visible.map(item => ({
    type: 'Feature', id: `${item.vendorId}:${item.locationId}`, properties: { id: `${item.vendorId}:${item.locationId}` },
    geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
  })), [visible]);
  const clusterIndex = React.useMemo(() => { const index = new Supercluster<MapPointProps>({ radius: 52, maxZoom: 14 }); index.load(points); return index; }, [points]);
  const clusters = React.useMemo(() => {
    const delta = Math.max(region.longitudeDelta, 0.005);
    const bounds: [number, number, number, number] = [region.longitude - delta / 2, region.latitude - region.latitudeDelta / 2, region.longitude + delta / 2, region.latitude + region.latitudeDelta / 2];
    return clusterIndex.getClusters(bounds, Math.max(0, Math.min(20, Math.round(Math.log2(360 / delta)))));
  }, [clusterIndex, region]);
  const fitLocations = (rows: LocatedVendor[]) => {
    if (rows.length) mapRef.current?.fitToCoordinates?.(rows.map(item => ({ latitude: item.latitude, longitude: item.longitude })), { edgePadding: { top: 150, right: 40, bottom: 120, left: 40 }, animated: !reduceMotion });
  };
  const submitSearch = () => {
    Keyboard.dismiss();
    fitLocations(visible);
  };
  const selectFilter = (label: string) => {
    const next = filter === label ? 'All' : label;
    setFilter(next); setSelected(null); setClusterPreview([]);
    fitLocations(locations.filter(item => matchesCategory(item, next)));
  };
  const selectCluster = (cluster: ClusterFeature<MapPointProps>) => {
    const leaves = clusterIndex.getLeaves(cluster.properties.cluster_id, 4).map(point => vendorsById.get(point.properties.id)).filter((item): item is LocatedVendor => !!item);
    setSelected(null); setClusterPreview(leaves);
    const coords = clusterIndex.getLeaves(cluster.properties.cluster_id, Infinity).map(point => ({ latitude: point.geometry.coordinates[1], longitude: point.geometry.coordinates[0] }));
    if (coords.length) mapRef.current?.fitToCoordinates?.(coords, { edgePadding: { top: 100, right: 40, bottom: 220, left: 40 }, animated: !reduceMotion });
  };
  const toggleSaved = async (item: LocatedVendor) => {
    if (!user) { router.push({ pathname: '/realx/onboarding', params: { flow: 'login' } } as any); return; }
    const removing = savedVendorIds.includes(item.vendorId);
    const result = removing
      ? await getSupabase().from('realx_student_saved_items').delete().eq('student_id', user.id).eq('item_type', 'vendor').eq('item_id', item.vendorId)
      : await getSupabase().from('realx_student_saved_items').upsert({ student_id: user.id, item_type: 'vendor', item_id: item.vendorId, payload: { name: item.name, source: 'map', locationId: item.locationId } }, { onConflict: 'student_id,item_type,item_id' });
    if (!result.error) setSavedVendorIds(ids => removing ? ids.filter(id => id !== item.vendorId) : [...ids, item.vendorId]);
  };
  const recenter = async () => {
    let permission = await Location.getForegroundPermissionsAsync();
    if (permission.status !== 'granted' && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return;
    try {
      const position = await getCurrentPosition();
      setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      mapRef.current?.animateToRegion({ latitude: position.coords.latitude, longitude: position.coords.longitude, latitudeDelta: 0.035, longitudeDelta: 0.035 }, reduceMotion ? 0 : 300);
    } catch { /* Leave the current map region in place if location is unavailable. */ }
  };
  const onRegionChange = (next: Region) => {
    setRegion(next);
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(() => void fetchMap(next), 450);
  };
  const hasBottomPanel = Boolean(selected || clusterPreview.length);
  const bottomPanelOffset = TAB_BAR_BASE_HEIGHT + insets.bottom + MAP_PANEL_TAB_BAR_GAP;
  const locationButtonBottom = hasBottomPanel && bottomPanelHeight > 0
    ? bottomPanelOffset + bottomPanelHeight + 12
    : Platform.OS === 'ios' ? insets.bottom + 92 : 16;
  return <View testID="couponly-map-screen" style={[s.root, { backgroundColor: '#8DDCF0' }]}>
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
          initialRegion={region}
      onMapReady={() => {
        mapReady.current = true;
        const initialUserRegion = pendingInitialRegion.current;
        if (initialUserRegion) {
          pendingInitialRegion.current = null;
          mapRef.current?.animateToRegion(initialUserRegion, reduceMotion ? 0 : 300);
        }
      }}
      onRegionChangeComplete={onRegionChange}
      showsUserLocation={false}
      showsCompass={false}
      accessibilityLabel="Map of Kouponly partners"
    >
      {clusters.map(feature => {
        const [longitude, latitude] = feature.geometry.coordinates;
        const properties = feature.properties as typeof feature.properties & { cluster?: boolean; cluster_id?: number; point_count?: number };
        if (properties.cluster) return <Marker key={`cluster-${properties.cluster_id}`} coordinate={{ latitude, longitude }} accessibilityRole="button" accessibilityLabel={`${properties.point_count} nearby places`} onPress={() => selectCluster(feature as ClusterFeature<MapPointProps>)}><View style={[s.cluster, { backgroundColor: (properties.point_count || 0) >= 40 ? '#111' : (properties.point_count || 0) >= 15 ? '#FF7A00' : C.lime }, (properties.point_count || 0) > 20 && s.clusterLarge]}><Text style={[s.clusterCount, { color: (properties.point_count || 0) >= 15 ? '#FFFFFF' : C.inkOnAccent }]}>{properties.point_count}</Text></View></Marker>;
        const item = vendorsById.get(properties.id);
        if (!item) return null;
        const color = markerColor(item); const highlighted = filter !== 'All'; const dealPin = item.xcard || item.offers?.some(offer => offer.discountType === 'buy1get1');
        return <Marker key={properties.id} coordinate={{ latitude, longitude }} onPress={() => { setClusterPreview([]); setSelected(item); }} accessibilityLabel={`View ${item.name}`}><View style={[s.pin, highlighted && s.pinHighlighted, { borderColor: color }]}>{dealPin ? <View style={[s.pinCore, { backgroundColor: color }]} /> : null}</View></Marker>;
      })}
    </MapView>
    <SafeAreaView edges={['top']} pointerEvents="box-none" style={s.overlay}>
      <View style={[s.search, { backgroundColor: C.card, borderColor: BorderPalette.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="search" size={20} color={C.muted} />
        <TextInput testID="map-search" accessibilityLabel={'Search partners on map'} value={query} onChangeText={setQuery} onSubmitEditing={() => { submitSearch(); void refreshSearch(); }} placeholder={t('search_placeholder')} placeholderTextColor={C.muted} returnKeyType="search" style={[s.input, { color: C.ink, textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }]} />
        {query ? <ScalePressable accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={18} color={C.muted} /></ScalePressable> : null}
      </View>
      <View style={[s.filters, isRTL && { flexDirection: 'row-reverse' }]}>
        {FILTERS.map(({ label, key, icon }) => { const active = filter === label; return <ScalePressable key={label} accessibilityRole="button" accessibilityLabel={`Filter ${label}`} accessibilityState={{ selected: active }} onPress={() => selectFilter(label)} style={[s.filter, { backgroundColor: active ? C.lime : C.card, borderColor: BorderPalette.border }]}><Ionicons name={icon as any} size={16} color={active ? C.inkOnAccent : C.muted} /><Text style={[s.filterText, { color: active ? C.inkOnAccent : C.ink }]}>{t(key)}</Text></ScalePressable>; })}
      </View>
      {!loading && !message && !visible.length && query.trim() ? <View style={[s.searchEmpty, { backgroundColor: C.card }]}><Ionicons name="search-outline" size={18} color={C.muted} /><Text style={[s.statusText, { color: C.ink }]}>{t('no_search_results')}</Text></View> : null}
    </SafeAreaView>
    <ScalePressable accessibilityLabel="Recenter map" onPress={() => void recenter()} style={[s.locate, { bottom: locationButtonBottom, backgroundColor: C.card }]}><Ionicons name="locate" size={18} color={C.lime} /></ScalePressable>
    {loading ? <View style={[s.status, { top: insets.top + 14, backgroundColor: C.card }]}><ActivityIndicator color={C.lime} /><Text style={[s.statusText, { color: C.ink }]}>{t('map_loading')}</Text></View> : null}
    {!loading && message ? <View style={[s.empty, { top: insets.top + 14, backgroundColor: C.card }]}><Text style={[s.emptyTitle, { color: C.ink }]}>{'Map unavailable'}</Text><Text style={[s.statusText, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>{message}</Text></View> : null}
    {clusterPreview.length > 0 && !selected ? <Animated.View testID="map-cluster-preview" entering={CONTENT_ENTER} exiting={CONTENT_EXIT} onLayout={(event) => setBottomPanelHeight(Math.ceil(event.nativeEvent.layout.height))} style={[s.clusterPreview, { backgroundColor: C.card, bottom: bottomPanelOffset }]}>
      <View style={s.clusterHeader}><Text style={[s.clusterTitle, { color: C.ink }]}>{t('map_nearby_places_count', { count: clusterPreview.length })}</Text><ScalePressable accessibilityLabel="Close nearby places" onPress={() => setClusterPreview([])}><Ionicons name="close" size={18} color={C.muted} /></ScalePressable></View>
      {clusterPreview.map(item => <ScalePressable pressedScale={1} key={`${item.vendorId}:${item.locationId}`} accessibilityRole="button" accessibilityLabel={`Open ${item.name}${item.branchName ? ` ${item.branchName}` : ''}`} style={s.clusterRow} onPress={() => { setClusterPreview([]); setSelected(item); }}><View style={[s.clusterDot, { backgroundColor: markerColor(item) }]} /><Text numberOfLines={1} style={[s.clusterName, { color: C.ink }]}>{item.name}{item.branchName ? ` · ${item.branchName}` : ''}</Text><Text style={[s.clusterDistance, { color: C.ink }]}>{userLocation ? `${distanceBetweenKm(userLocation, item).toFixed(2)} km` : ''}</Text></ScalePressable>)}
    </Animated.View> : null}
    {selected ? <Animated.View testID="map-vendor-callout" key={`${selected.vendorId}:${selected.locationId}`} entering={CONTENT_ENTER} exiting={CONTENT_EXIT} onLayout={(event) => setBottomPanelHeight(Math.ceil(event.nativeEvent.layout.height))} style={[s.calloutCard, { backgroundColor: C.card, bottom: bottomPanelOffset }]}>
      <View style={[s.calloutHeader, isRTL && { flexDirection: 'row-reverse' }]}><View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}><Text numberOfLines={1} style={[s.placeName, { color: C.ink, textAlign: isRTL ? 'right' : 'left' }]}>{selected.name}</Text><Text numberOfLines={1} style={[s.placeInfo, { color: C.muted, textAlign: isRTL ? 'right' : 'left' }]}>{selected.branchName ? `${selected.branchName} · ` : ''}{selected.place}</Text></View><ScalePressable accessibilityLabel={'Close partner details'} onPress={() => setSelected(null)} style={s.close}><Ionicons name="close" size={20} color={C.muted} /></ScalePressable></View>
      <View style={s.offerPill}><Ionicons name="pricetag" size={14} color={C.lime}/><Text numberOfLines={1} style={[s.offerText,{color:C.ink}]}>{selected.offer}</Text></View>
      {userLocation ? <View style={s.distanceRow}><Ionicons name="navigate-outline" size={14} color={C.muted}/><Text style={[s.placeInfo,{color:C.muted,marginTop:0}]}>{distanceBetweenKm(userLocation, selected).toFixed(2)} km</Text></View> : null}
      {selected.phoneNumber ? <ScalePressable onPress={() => void Linking.openURL(`tel:${selected.phoneNumber!.replace(/[^\d+]/g,'')}`)} style={s.phonePill}><Ionicons name="call-outline" size={14} color={C.lime}/><Text style={[s.placeInfo,{color:C.ink}]}>{selected.phoneNumber}</Text></ScalePressable>:null}
      <View style={s.calloutActions}><ScalePressable accessibilityLabel={savedVendorIds.includes(selected.vendorId) ? 'Remove saved partner' : 'Save partner'} onPress={() => void toggleSaved(selected)} style={[s.calloutIcon, savedVendorIds.includes(selected.vendorId) && { backgroundColor: C.lime }]}><Ionicons name={savedVendorIds.includes(selected.vendorId) ? 'bookmark' : 'bookmark-outline'} size={18} color={savedVendorIds.includes(selected.vendorId) ? C.inkOnAccent : C.lime}/></ScalePressable><ScalePressable onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: selected.vendorId } } as any)} style={s.viewButton}><Ionicons name="storefront-outline" size={16} color={C.ink}/><Text style={[s.action,{color:C.ink}]}>{t('map_callout_view')}</Text></ScalePressable><ScalePressable onPress={() => void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`)} style={s.directionsButton}><Ionicons name="navigate" size={16} color={C.inkOnAccent}/><Text style={[s.action,{color:C.inkOnAccent}]}>{t('map_callout_directions')}</Text></ScalePressable></View>
    </Animated.View> : null}
  </View>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, overlay: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 20, zIndex: 10 }, search: { minHeight: 56, marginTop: 10, borderWidth: 1, borderRadius: 28, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, shadowColor: '#000', shadowOpacity: .1, shadowRadius: 9, shadowOffset: { width: 0, height: 3 }, elevation: 4 }, input: { flex: 1, fontFamily: F.body, fontSize: 15, padding: 0 }, filters: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }, filter: { minHeight: 38, flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 6, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, filterText: { fontFamily: F.bodySemi, fontSize: 13 }, searchEmpty: { minHeight: 46, marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: BorderPalette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 14, elevation: 3 }, locate: { position: 'absolute', right: 16, width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: BorderPalette.border, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: .15, shadowRadius: 8 }, status: { position: 'absolute', top: 14, left: 14, right: 14, minHeight: 55, borderRadius: 12, borderWidth: 1, borderColor: BorderPalette.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 12, paddingVertical: 10, elevation: 3, zIndex: 11 }, statusText: { fontFamily: F.body, fontSize: 12 }, empty: { position: 'absolute', top: 14, left: 14, right: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: BorderPalette.border, elevation: 3, zIndex: 11 }, emptyTitle: { fontFamily: F.headingSemi, fontSize: 14, marginBottom: 3 },
  cluster: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: 0.88 }, clusterLarge: { width: 52, height: 52, borderRadius: 26 }, clusterCount: { color: '#fff', fontFamily: F.bodyBold, fontSize: 14 }, clusterPreview: { position: 'absolute', left: 14, right: 14, borderRadius: 20, borderWidth: 1, borderColor: BorderPalette.border, padding: 14, gap: 8, elevation: 8, shadowColor: '#000', shadowOpacity: .1, shadowRadius: 8 }, clusterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, clusterTitle: { fontFamily: F.bodyBold, fontSize: 14 }, clusterRow: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 10 }, clusterDot: { width: 10, height: 10, borderRadius: 5 }, clusterName: { flex: 1, fontFamily: F.body, fontSize: 13 }, clusterDistance: { fontFamily: F.bodyBold, fontSize: 12 },
  calloutCard: { position: 'absolute', left: 14, right: 14, borderRadius: 24, borderWidth: 1, borderColor: BorderPalette.border, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 10, elevation: 8, shadowColor: '#000', shadowOpacity: .15, shadowRadius: 10 }, calloutHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, offerPill: { minHeight: 34, alignSelf: 'flex-start', borderRadius: 17, borderWidth: 1, borderColor: BorderPalette.border, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 }, offerText: { fontFamily: F.bodySemi, fontSize: 14, flex: 1 }, distanceRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 24, marginBottom: 2 }, phonePill: { alignSelf: 'flex-start', minHeight: 34, borderRadius: 16, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }, calloutActions: { flexDirection: 'row', alignItems: 'center', gap: 8 }, calloutIcon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: BorderPalette.border, alignItems: 'center', justifyContent: 'center' }, viewButton: { flex: 1, minHeight: 44, borderRadius: 24, borderWidth: 1, borderColor: BorderPalette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, directionsButton: { flex: 1, minHeight: 44, borderRadius: 24, backgroundColor: Colors.brandGreen, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, pin: { width: 24, height: 24, borderRadius: 12, borderWidth: 4, alignItems: 'center', justifyContent: 'center', elevation: 4, backgroundColor: 'transparent' }, pinHighlighted: { width: 32, height: 32, borderRadius: 16, borderWidth: 5 }, pinCore: { width: 8, height: 8, borderRadius: 4 }, placeName: { fontFamily: F.headingSemi, fontSize: 20, lineHeight: 26 }, placeInfo: { fontFamily: F.body, fontSize: 13, lineHeight: 18, marginTop: 3 }, action: { fontFamily: F.bodyBold, fontSize: 14 }, close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }
});

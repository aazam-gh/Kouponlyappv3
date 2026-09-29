import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, Bookmark, ExternalLink, MapPin, Store } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getRealXOnlineVendorOffer, trackRealXOutboundClick } from '@/lib/realxBackend';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

export default function RealXVendorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]); const { user } = useAuth();
  const [vendor, setVendor] = React.useState<any>(null); const [saved, setSaved] = React.useState(false); const [loading, setLoading] = React.useState(true); const [busy, setBusy] = React.useState(false); const [message, setMessage] = React.useState('');
  const [onlineOffer, setOnlineOffer] = React.useState<any>(null);
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const client = getSupabase();
        const [vendorResult, savedResult] = await Promise.all([
          client.from('realx_vendors').select('*').eq('id', String(id || '')).eq('status', 'Active').maybeSingle(),
          user ? client.from('realx_student_saved_items').select('id').eq('student_id', user.id).eq('item_type', 'vendor').eq('item_id', String(id || '')).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
        ]);
        if (vendorResult.error) throw vendorResult.error; if (savedResult.error) throw savedResult.error;
        if (active) { setVendor(vendorResult.data); setSaved(Boolean(savedResult.data)); setMessage(''); }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load this partner.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, user?.id]);
  const save = async () => {
    if (!user) { router.push('/auth' as any); return; }
    setBusy(true); setMessage('');
    try {
      const client = getSupabase();
      if (saved) {
        const { error } = await client.from('realx_student_saved_items').delete().eq('student_id', user.id).eq('item_type', 'vendor').eq('item_id', String(id));
        if (error) throw error;
        setSaved(false);
      } else {
        const { error } = await client.from('realx_student_saved_items').upsert({ student_id: user.id, item_type: 'vendor', item_id: String(id), payload: { vendorId: id, name: vendor.name || vendor.payload?.name, type: 'vendor' } }, { onConflict: 'student_id,item_type,item_id' });
        if (error) throw error;
        setSaved(true);
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update saved partners.'); }
    finally { setBusy(false); }
  };
  const openOffer = async (offer: any, index: number) => {
    if (!user) { router.push('/auth' as any); return; }
    if (vendor.vendor_type === 'online') {
      setBusy(true); setMessage('');
      try {
        setOnlineOffer(await getRealXOnlineVendorOffer(String(id)));
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open this partner offer.'); }
      finally { setBusy(false); }
      return;
    }
    router.push({ pathname: '/realx/redeem', params: { vendorId: String(id), offerIndex: String(index), vendorName: vendor.name || vendor.payload?.name, offerTitle: offer.titleEn || offer.title || `Offer ${index + 1}` } } as any);
  };
  const visitPartner = async () => {
    if (!user || !onlineOffer) return;
    setBusy(true); setMessage('');
    try {
      const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
      const click = await trackRealXOutboundClick({ vendorId: String(id), platform, requestId: Crypto.randomUUID() });
      const url = String(click.purchaseUrl || (platform === 'ios' ? onlineOffer.iosUrl : onlineOffer.androidUrl) || onlineOffer.purchaseUrl || '');
      if (!url.startsWith('https://')) throw new Error('This partner does not have a valid purchase link.');
      await Linking.openURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open this partner offer.'); }
    finally { setBusy(false); }
  };
  const p = vendor?.payload || {}; const offers = Array.isArray(p.offers) ? p.offers.filter((offer: any) => offer.isActive !== false) : [];
  return <Screen testID="realx-vendor-screen"><AppHeader eyebrow="REALX · PARTNER" title={vendor?.name || 'Partner details'} back />
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : vendor ? <>
      <View style={styles.hero}><View style={styles.icon}><Store size={22} color={C.ink} /></View><Text style={styles.category}>{p.mainCategory || vendor.vendor_type || 'REALX PARTNER'}</Text><Text style={styles.name}>{vendor.name || p.name || 'RealX partner'}</Text><Text style={styles.description}>{p.descriptionEn || p.description || 'Student offers and partner details.'}</Text>
        <AccessiblePressable disabled={busy} onPress={() => void save()} style={styles.save}><Bookmark size={16} color={C.ink} fill={saved ? C.lime : 'transparent'} /><Text style={styles.saveText}>{saved ? 'Saved' : 'Save partner'}</Text></AccessiblePressable>
      </View>
      {Array.isArray(vendor.locations) && vendor.locations.length ? <><Text style={styles.section}>LOCATIONS</Text>{vendor.locations.map((location: any, index: number) => <View key={String(location.id || index)} style={styles.location}><MapPin size={16} color={C.ink} /><View style={{ flex: 1 }}><Text style={styles.locationName}>{location.name || location.nameAr || vendor.name}</Text><Text style={styles.locationAddress}>{location.address || location.addressAr || 'Qatar'}</Text></View><AccessiblePressable onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location.latitude},${location.longitude}`)}`)} style={styles.directions}><ExternalLink size={15} color={C.ink} /></AccessiblePressable></View>)}</> : null}
      <Text style={styles.section}>OFFERS</Text>
      {onlineOffer ? <View style={styles.online}><Text style={styles.offerType}>ONLINE OFFER</Text>{onlineOffer.discountCode ? <><Text style={styles.onlineCode}>{onlineOffer.discountCode}</Text><AccessiblePressable onPress={() => void Clipboard.setStringAsync(onlineOffer.discountCode)} style={styles.copy}><Text style={styles.copyText}>Copy code</Text></AccessiblePressable></> : null}<Text style={styles.offerDescription}>{onlineOffer.instructions || onlineOffer.vendorData?.description || 'Use this offer at the partner online store.'}</Text><AccessiblePressable disabled={busy} onPress={() => void visitPartner()} style={styles.action}><Text style={styles.actionText}>{busy ? 'Opening…' : onlineOffer.ctaLabel || 'Visit partner'}</Text><ArrowUpRight size={15} color={C.onDark} /></AccessiblePressable></View> : null}
      {offers.length ? offers.map((offer: any, index: number) => <View key={`${id}-${index}`} style={styles.offer}><Text style={styles.offerType}>{String(offer.discountType || 'STUDENT OFFER').toUpperCase()}</Text><Text style={styles.offerTitle}>{offer.titleEn || offer.title || offer.name || `Offer ${index + 1}`}</Text><Text style={styles.offerDescription}>{offer.descriptionEn || offer.description || 'Available to eligible RealX students.'}</Text><AccessiblePressable disabled={busy} onPress={() => void openOffer(offer, index)} style={styles.action}><Text style={styles.actionText}>{busy ? 'Opening…' : vendor.vendor_type === 'online' ? 'Visit partner' : 'Redeem offer'}</Text><ArrowUpRight size={15} color={C.onDark} /></AccessiblePressable></View>) : <Empty title="No offers available" body="This partner has not published any current offers." />}
      {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
    </> : <Empty title="Partner unavailable" body={message || 'This partner could not be found or is no longer active.'} />}
  </Screen>;
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  hero: { backgroundColor: C.ink, borderRadius: 24, padding: 18, marginBottom: 22 }, icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginBottom: 13 }, category: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1, color: C.lime, textTransform: 'uppercase' }, name: { fontFamily: F.heading, fontSize: 23, color: C.onDark, marginTop: 4 }, description: { fontFamily: F.body, fontSize: 12, lineHeight: 18, color: '#E0E0E0', marginTop: 7 },
  save: { minHeight: 39, alignSelf: 'flex-start', paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.lime, flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 14 }, saveText: { fontFamily: F.bodyBold, fontSize: 12, color: C.ink }, section: { fontFamily: F.bodyBold, fontSize: 10, letterSpacing: 1.1, color: C.muted, marginBottom: 9 },
  location: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 12, borderRadius: 15, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, marginBottom: 8 }, locationName: { fontFamily: F.bodyBold, fontSize: 12, color: C.ink }, locationAddress: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 3 }, directions: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  offer: { borderRadius: 19, padding: 14, marginBottom: 10, backgroundColor: C.card, borderWidth: 1, borderColor: C.line }, offerType: { fontFamily: F.bodyBold, fontSize: 9, letterSpacing: .9, color: C.muted }, offerTitle: { fontFamily: F.headingSemi, fontSize: 16, color: C.ink, marginTop: 4 }, offerDescription: { fontFamily: F.body, color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 4 }, action: { minHeight: 42, borderRadius: 13, backgroundColor: C.ink, marginTop: 11, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, actionText: { fontFamily: F.bodyBold, fontSize: 12, color: C.onDark }, online: { borderRadius: 19, padding: 14, marginBottom: 10, backgroundColor: C.soft }, onlineCode: { fontFamily: F.heading, color: C.ink, fontSize: 22, letterSpacing: 1.3, marginTop: 8 }, copy: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11, backgroundColor: C.lime, marginTop: 7 }, copyText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 11 }, error: { color: C.danger, fontFamily: F.bodySemi, fontSize: 12, marginTop: 10 },
});

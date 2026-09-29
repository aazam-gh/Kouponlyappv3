import { router } from 'expo-router';
import { ArrowUpRight, BadgePercent, Bookmark, Store } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessiblePressable, AppHeader, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';

type Offer = { vendorId: string; vendorName: string; vendorType: string; index: number; title: string; description: string; discountType: string; discountValue: number; payload: Record<string, any> };

export default function RealXOffersScreen() {
  const theme = useAppTheme(); const { colors: C } = theme;
  const styles = React.useMemo(() => makeStyles(C), [theme.mode, theme.highContrast]);
  const { user } = useAuth();
  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState('');
  const [saving, setSaving] = React.useState('');
  const save = async (offer: Offer) => {
    if (!user) { router.push('/auth' as any); return; }
    const itemId = `${offer.vendorId}:embedded:${offer.index + 1}`;
    setSaving(itemId); setMessage('');
    try {
      const { error } = await getSupabase().from('realx_student_saved_items').upsert({ student_id: user.id, item_type: 'offer', item_id: itemId, payload: { vendorId: offer.vendorId, offerIndex: offer.index, title: offer.title, type: 'offer' } }, { onConflict: 'student_id,item_type,item_id' });
      if (error) throw error;
      setMessage('Offer saved to your list.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save this offer.'); }
    finally { setSaving(''); }
  };
  React.useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().from('realx_vendors').select('*').eq('status', 'Active').order('name');
        if (!active) return;
        if (error) { setMessage(error.message); setOffers([]); setLoading(false); return; }
        const mapped = (data || []).flatMap((row: any) => {
          const vendor = row.payload || {};
          const list = Array.isArray(vendor.offers) ? vendor.offers : [];
          return list.map((item: any, index: number) => ({
            vendorId: row.id, vendorName: row.name || vendor.name || 'RealX partner', vendorType: row.vendor_type,
            index, title: item.titleEn || item.title || item.name || `Offer ${index + 1}`,
            description: item.descriptionEn || item.description || '', discountType: item.discountType || '',
            discountValue: Number(item.discountValue || 0), payload: item,
          })).filter((offer: Offer) => offer.payload.isActive !== false);
        });
        setOffers(mapped); setLoading(false);
      } catch (error) {
        if (active) { setMessage(error instanceof Error ? error.message : 'Unable to load offers.'); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, []);
  return <Screen testID="realx-offers-screen">
    <AppHeader eyebrow="REALX · EXPLORE" title="Campus offers" back />
    <Text style={styles.intro}>Student offers from active RealX partners. Redemptions require the vendor’s PIN.</Text>
    {!user ? <AccessiblePressable onPress={() => router.push('/auth' as any)} style={styles.signIn}><Text style={styles.signInText}>Sign in to redeem offers</Text></AccessiblePressable> : null}
    {loading ? <ActivityIndicator color={C.ink} style={{ marginTop: 40 }} /> : offers.length ? offers.map((offer) => <View key={`${offer.vendorId}-${offer.index}`} style={styles.card}>
      <View style={styles.cardIcon}><Store size={20} color={C.ink} /></View>
      <Text style={styles.vendor}>{offer.vendorName}</Text>
      <Text style={styles.title}>{offer.title}</Text>
      {offer.description ? <Text style={styles.body}>{offer.description}</Text> : null}
      <View style={styles.meta}><BadgePercent size={15} color={C.ink} /><Text style={styles.metaText}>{offer.discountType === 'percentage' ? `${offer.discountValue}% off` : offer.discountType === 'amount' ? `QAR ${offer.discountValue} off` : offer.discountType === 'buy1get1' ? 'Buy one, get one' : 'Partner offer'}</Text></View>
      <View style={styles.actions}><AccessiblePressable onPress={() => router.push({ pathname: '/realx/vendor/[id]', params: { id: offer.vendorId } } as any)} style={styles.detail}><Text style={styles.detailText}>Partner details</Text></AccessiblePressable><AccessiblePressable disabled={!user} onPress={() => router.push({ pathname: '/realx/redeem', params: { vendorId: offer.vendorId, offerIndex: String(offer.index), vendorName: offer.vendorName, offerTitle: offer.title } } as any)} style={styles.action}><Text style={styles.actionText}>Redeem</Text><ArrowUpRight size={15} color={C.onDark} /></AccessiblePressable><AccessiblePressable accessibilityLabel="Save offer" disabled={Boolean(saving)} onPress={() => void save(offer)} style={styles.save}><Bookmark size={16} color={saving === `${offer.vendorId}:embedded:${offer.index + 1}` ? C.muted : C.ink} /></AccessiblePressable></View>
    </View>) : <Empty icon="%" title="No campus offers yet" body={message || 'Active RealX partner offers will appear here.'} />}
    {message ? <Text accessibilityRole="alert" style={styles.error}>{message}</Text> : null}
  </Screen>;
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  intro: { fontFamily: F.body, color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  signIn: { backgroundColor: C.soft, borderRadius: 14, padding: 13, alignItems: 'center', marginBottom: 12 }, signInText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 13 },
  card: { backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 11 },
  cardIcon: { width: 41, height: 41, borderRadius: 14, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  vendor: { fontFamily: F.bodyBold, fontSize: 10, color: C.muted, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontFamily: F.headingSemi, fontSize: 18, color: C.ink, marginTop: 5 }, body: { fontFamily: F.body, fontSize: 12, lineHeight: 18, color: C.muted, marginTop: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }, metaText: { fontFamily: F.bodyBold, fontSize: 12, color: C.ink },
  actions: { flexDirection: 'row', gap: 7, marginTop: 13 }, detail: { minHeight: 42, borderRadius: 13, backgroundColor: C.soft, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }, detailText: { fontFamily: F.bodyBold, color: C.ink, fontSize: 10 },
  action: { minHeight: 42, flex: 1, borderRadius: 13, backgroundColor: C.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, actionText: { fontFamily: F.bodyBold, color: C.onDark, fontSize: 11 }, save: { width: 42, minHeight: 42, borderRadius: 13, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' }, error: { color: C.danger, fontFamily: F.bodySemi, fontSize: 12, marginTop: 10 },
});

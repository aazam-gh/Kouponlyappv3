import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { AppState, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AccessiblePressable, Empty, Screen, safeGoBack } from '@/components/ui';
import { CatalogueNotice, useCatalogue } from '@/lib/catalogue';
import { dealById } from '@/lib/data';
import { getSupabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';
import { useBenefits } from '@/lib/benefits';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '@/lib/auth';
import { useAppLocale } from '@/context/LocaleContext';
import { StatusBar } from 'expo-status-bar';

export default function DealDetail({ dealId }: { dealId?: string } = {}) {
  const posthog = usePostHog();
  const {status} = useCatalogue();
  const router = useRouter();
  const { colors: C } = useAppTheme();
  const { isRTL } = useAppLocale();
  const { t } = useTranslation();
  const s = useMemo(() => styles(C), [C]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; offer?: string }>();
  const id = dealId || params.id;
  const offerParam = params.offer;
  const selectedIndex = Number(offerParam ?? 0);
  const [vendorLookup, setVendorLookup] = useState<{ id: string; resolvedId?: string; failed: boolean } | null>(null);
  React.useEffect(() => {
    let active = true;
    if (!id || /^\d+$/.test(id)) return () => { active = false; };
    void (async () => {
      try { const {data,error}=await getSupabase().from('realx_vendors').select('catalogue_deal_id').eq('id', id).maybeSingle(); if(active)setVendorLookup({id,resolvedId:data?.catalogue_deal_id?String(data.catalogue_deal_id):undefined,failed:!!error||!data}); }
      catch { if(active)setVendorLookup({id,failed:true}); }
    })();
    return () => { active = false; };
  }, [id]);
  const resolvedId = vendorLookup?.id === id ? vendorLookup.resolvedId : undefined;
  const lookupFailed = vendorLookup?.id === id && vendorLookup.failed;
  const deal = dealById(id) ?? (resolvedId ? dealById(resolvedId) : undefined);
  const { state, notify } = useStore();
  const { user } = useAuth();
  const { benefits } = useBenefits();
  const [savedOfferIds, setSavedOfferIds] = useState<string[]>([]);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const carouselRef = React.useRef<ScrollView>(null);
  const carouselIndex = React.useRef(0);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const headerImages = deal?.galleryImages?.length ? deal.galleryImages.slice(0, 12) : deal ? [deal.image] : [];
  React.useEffect(() => {
    carouselIndex.current = 0;
    setActiveGalleryIndex(0);
    carouselRef.current?.scrollTo({x:0,animated:false});
  }, [deal?.id, width]);
  useFocusEffect(React.useCallback(() => {
    if (headerImages.length < 2) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const next = (carouselIndex.current + 1) % headerImages.length;
      carouselIndex.current = next;
      setActiveGalleryIndex(next);
      carouselRef.current?.scrollTo({x:next * width,animated:true});
    }, 4500);
    return () => clearInterval(timer);
  }, [deal?.id, headerImages.length, width]));

  React.useEffect(() => {
    let active = true;
    if (!user || !deal?.vendorId) { setSavedOfferIds([]); return () => { active = false; }; }
    void getSupabase().from('realx_student_saved_items').select('item_id').eq('student_id', user.id).eq('item_type', 'offer')
      .then(({ data, error }) => { if (active && !error) setSavedOfferIds((data || []).map(row => row.item_id)); });
    return () => { active = false; };
  }, [user?.id, deal?.vendorId]);
  if (!deal) return <Screen>{status==='loading' || (id && !/^\d+$/.test(id) && !resolvedId && !lookupFailed) ? <CatalogueNotice/> : status==='cloud' ? <Empty icon="?" title="Offer not found" body="This offer may no longer be available." /> : <CatalogueNotice/>}</Screen>;
  const saved = state.saved.includes(deal.id);
  const selectedOffer = deal.offers?.find(offer => offer.index === selectedIndex) ?? deal.offers?.[0];
  const offerKey = `${deal.id}-${selectedOffer?.index ?? 0}`;
  const branch = deal.locations?.[0];
  const phone = branch?.phoneNumber || deal.phoneNumber;
  const hours = branch?.openingHours || deal.openingHours;
  const openLocation = (location = branch) => {
    const query = location?.latitude != null && location.longitude != null ? `${location.latitude},${location.longitude}` : `${deal.name}, ${location?.address || deal.place}`;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
  };
  const formattedHours = formatOpeningHours(hours, isRTL, t('closed'));
  return <>
    <StatusBar style="light" />
    <Screen testID="deal-detail" style={s.screen}>
      <View style={[s.imageWrap, { marginTop: -insets.top, height: 250 + insets.top }]}>
        <ScrollView
          ref={carouselRef}
          testID="vendor-header-carousel"
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={event => { const index = Math.round(event.nativeEvent.contentOffset.x / width); carouselIndex.current = index; setActiveGalleryIndex(index); }}
        >
          {headerImages.map((uri, index) => <View key={`${uri}-${index}`} style={{ width, height: '100%' }}>
            <Image testID={index === 0 ? 'offer-image' : undefined} accessible={false} source={{ uri }} style={s.image} />
          </View>)}
        </ScrollView>
        <View style={[s.topbar, { top: insets.top + 8 }]}>
          <AccessiblePressable accessibilityLabel="Go back" onPress={() => safeGoBack()} style={s.imageAction}><Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={C.ink} /></AccessiblePressable>
        </View>
        {headerImages.length > 1 ? <View pointerEvents="none" style={s.imageCounter}><Ionicons name="images-outline" size={14} color={C.ink}/><Text style={s.galleryCount}>{activeGalleryIndex + 1} / {headerImages.length}</Text></View> : null}
      </View>
      <View style={s.content}>
        <View style={s.vendorNameRow}>
          <Text accessibilityRole="header" style={s.title}>{deal.name.toUpperCase()}</Text>
          {deal.logo ? <View style={s.logoWrap}><Image source={{uri:deal.logo}} resizeMode="contain" style={s.logo}/></View> : null}
        </View>
        <View style={s.metaStack}>
          <View style={[s.metaLine, s.metaLineSpread, isRTL && s.rowReverse]}>
            <AccessiblePressable accessibilityLabel="Choose or open vendor locations" onPress={()=>deal.locations && deal.locations.length>1?setLocationsOpen(value=>!value):openLocation()} style={[s.locationButton,isRTL&&s.rowReverse]}><Ionicons name="location-outline" size={18} color={C.lime}/><Text numberOfLines={1} style={s.locationButtonText}>Location{deal.locations?.length ? ` (${deal.locations.length})`:''}</Text></AccessiblePressable>
            {deal.distanceKm > 0 ? <View style={[s.nearestBranchChip,isRTL&&s.rowReverse]}><Ionicons name="navigate-outline" size={13} color={C.lime}/><Text numberOfLines={1} style={s.nearestBranchText}>{deal.distance}</Text></View>:null}
          </View>
          <View style={[s.metaLine, s.metaLineSpread, isRTL&&s.rowReverse]}>
            {phone ? <AccessiblePressable accessibilityLabel={`Call ${phone}`} onPress={()=>void Linking.openURL(`tel:${phone.replace(/[^\d+]/g,'')}`)} style={[s.phoneButton,isRTL&&s.rowReverse]}><Ionicons name="call-outline" size={15} color={C.lime}/><Text numberOfLines={1} style={s.phoneButtonText}>{phone}</Text></AccessiblePressable>:<View/>}
            <View style={[s.tagsRow,isRTL&&s.rowReverse]}>
              {deal.trend > 0 ? <View style={s.tagChip}><Ionicons name="trending-up" size={14} color="#fff"/><Text style={s.tagText}>{t('trending')}</Text></View> : null}
              {deal.xcard ? <View style={[s.tagChip,{backgroundColor:C.lime}]}><Ionicons name="cash-outline" size={14} color={C.inkOnAccent}/><Text style={[s.tagText,{color:C.inkOnAccent}]}>{t('cashback')}</Text></View> : null}
            </View>
          </View>
        </View>
        {deal.vendorInformation?.message ? <View style={s.vendorInfo}><View style={s.infoHeading}><Ionicons name="information-circle-outline" size={22} color={C.lime}/><Text style={s.infoTitle}>{deal.vendorInformation.title || 'Information'}</Text></View><Text style={[s.hours, isRTL && s.textRtl]}>{deal.vendorInformation.message}</Text></View>:null}
        {formattedHours ? <View style={s.infoCard}><View style={s.infoHeading}><Ionicons name="time-outline" size={20} color={C.lime}/><Text style={s.infoTitle}>Opening hours</Text></View><Text style={[s.hours, isRTL && s.textRtl]}>{formattedHours}</Text></View>:null}
        <View style={s.offersList}>{(deal.offers?.length ? deal.offers : [{id:offerKey,index:0,title:deal.offer,description:deal.description,saving:deal.saving,redemption:deal.redemption??'inStore'}]).map(offer=>{
          const key=`${deal.id}-${offer.index}`, isSaved=savedOfferIds.includes(offer.id), count=deal.vendorId && benefits?.usedVendorIds.includes(deal.vendorId) ? 1 : 0;
          const toggleOfferSave = async () => {
            if (!user) { notify('Sign in to save offers'); return; }
            const removing = savedOfferIds.includes(offer.id);
            const result = removing
              ? await getSupabase().from('realx_student_saved_items').delete().eq('student_id', user.id).eq('item_type', 'offer').eq('item_id', offer.id)
              : await getSupabase().from('realx_student_saved_items').upsert({ student_id: user.id, item_type: 'offer', item_id: offer.id, payload: { vendorId: deal.vendorId, title: offer.title } }, { onConflict: 'student_id,item_type,item_id' });
            if (result.error) { notify(result.error.message); return; }
            setSavedOfferIds(ids => removing ? ids.filter(id => id !== offer.id) : [...ids, offer.id]);
            posthog.capture(removing ? 'offer_unsaved' : 'offer_saved', { offer_id: offer.id, category: deal.category });
            notify(removing ? 'Offer removed from saved' : 'Offer saved');
          };
          return <View key={offer.id} style={s.offerCard}>
            {deal.xcard ? <Image source={require('../../assets/images/cashback.webp')} style={s.xcardBadge} /> : null}
            <AccessiblePressable accessibilityLabel={isSaved?'Remove saved offer':'Save this offer'} accessibilityState={{selected:isSaved}} onPress={()=>void toggleOfferSave()} style={[s.offerSaveButton,isSaved&&{backgroundColor:C.lime}]}><Ionicons name={isSaved?'bookmark':'bookmark-outline'} size={22} color={isSaved?C.inkOnAccent:C.lime}/></AccessiblePressable>
            <View style={s.offerInfoContainer}><Text style={[s.offerTitle, isRTL && s.textRtl]}>{offer.title.toUpperCase()}</Text>{offer.description ? <Text style={[s.offerDescription, isRTL && s.textRtl]}>{offer.description}</Text> : null}</View>
            <View style={s.offerActionsRow}><AccessiblePressable testID={`redeem-offer-${offer.index}`} disabled={count>0} onPress={()=>router.push({pathname:'/redeem/[id]',params:{id:String(deal.id),vendorId:deal.vendorId,offerIndex:String(offer.index)}} as any)} style={[s.redeem,count>0&&s.disabled]}><Ionicons name="flash" size={18} color={C.inkOnAccent}/><Text style={s.redeemText}>{count?'USED UP':'REDEEM'}</Text></AccessiblePressable></View>
          </View>;
        })}</View>
      </View>
    </Screen>
    <Modal visible={locationsOpen && Boolean(deal.locations?.length)} transparent animationType="slide" onRequestClose={()=>setLocationsOpen(false)}><Pressable style={s.modalOverlay} onPress={()=>setLocationsOpen(false)}><Pressable style={[s.branchSheet,{paddingBottom:Math.max(insets.bottom,20)}]} onPress={event=>event.stopPropagation()}><View style={s.handle}/><View style={s.branchHeader}><Text style={s.sectionTitle}>Branches</Text><AccessiblePressable accessibilityLabel="Close branches" onPress={()=>setLocationsOpen(false)} style={s.imageAction}><Ionicons name="close-circle" size={25} color={C.ink}/></AccessiblePressable></View><ScrollView showsVerticalScrollIndicator={false}>{deal.locations?.map((location,index)=><AccessiblePressable key={location.id} accessibilityLabel={`Directions to ${location.name || location.address}`} onPress={()=>{setLocationsOpen(false);openLocation(location)}} style={[s.branchRow, isRTL && s.rowReverse]}><View style={s.branchIcon}><Ionicons name="location-outline" size={19} color={C.lime}/></View><View style={{flex:1}}><Text style={[s.locationText, isRTL && s.textRtl]}>{location.name || `Branch ${index+1}`}</Text>{location.address ? <Text style={[s.branchAddress, isRTL && s.textRtl]}>{location.address}</Text>:null}{location.phoneNumber ? <Text style={[s.branchAddress, isRTL && s.textRtl]}>{location.phoneNumber}</Text>:null}</View><Ionicons name="navigate-outline" size={17} color={C.lime}/></AccessiblePressable>)}</ScrollView></Pressable></Pressable></Modal>
  </>;
}

function formatOpeningHours(value: unknown, isRTL: boolean, closedLabel: string) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const dayNames: Record<string, string> = {
    monday: 'Monday', tuesday: 'Tuesday',
    wednesday: 'Wednesday', thursday: 'Thursday',
    friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
  };
  return Object.entries(value as Record<string, unknown>).map(([day, hours]) => {
    const label = dayNames[day.toLowerCase()] || day;
    if (typeof hours === 'string') return `${label}: ${hours}`;
    if (Array.isArray(hours)) return `${label}: ${hours.join(' - ')}`;
    if (hours && typeof hours === 'object') {
      const row = hours as Record<string, unknown>;
      if (row.closed === true) return `${label}: ${closedLabel}`;
      const open = row.open ?? row.opens ?? '';
      const close = row.close ?? row.closes ?? '';
      if (open || close) return `${label}: ${open}${open && close ? ' - ' : ''}${close}`;
    }
    return `${label}: ${closedLabel}`;
  }).join('\n');
}

const styles = (C: ThemeColors) => StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  imageWrap: { height: 250, marginBottom: 12 },
  image: { width: '100%', height: '100%', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  topbar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  imageAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  logoWrap: { width: 72, height: 72, flexShrink: 0, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  logo: { width: '100%', height: '100%', borderRadius: 16 },
  rowReverse: { flexDirection: 'row-reverse' },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  vendorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: F.heading, fontSize: 26, letterSpacing: .5, textTransform:'uppercase', color: C.ink },
  metaStack:{marginTop:12,gap:10}, metaLine:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:10}, metaLineSpread:{justifyContent:'space-between'},
  locationButton:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:C.soft,maxWidth:'58%'}, locationButtonText:{fontFamily:F.body,fontSize:14,color:C.ink,flexShrink:1},
  nearestBranchChip:{flexDirection:'row',alignItems:'center',gap:4,minWidth:110,paddingHorizontal:10,paddingVertical:7,borderRadius:18,backgroundColor:C.soft}, nearestBranchText:{fontFamily:F.bodySemi,fontSize:14,color:C.ink},
  phoneButton:{flexDirection:'row',alignItems:'center',gap:5,maxWidth:'48%',paddingHorizontal:10,paddingVertical:7,borderRadius:18,backgroundColor:C.soft}, phoneButtonText:{fontFamily:F.bodySemi,fontSize:14,color:C.ink,flexShrink:1},
  tagsRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8,flex:1,justifyContent:'flex-end'},
  tagChip: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:10, paddingVertical:6, borderRadius:20, backgroundColor:'#000000' },
  trendingTag: { backgroundColor:'#000000' },
  tagText: { color:'#FFFFFF', fontFamily:F.bodyBold, fontSize:12, textTransform:'uppercase', letterSpacing:.3 },
  pill: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, minHeight:36, borderRadius:18, backgroundColor:C.card, borderWidth:1, borderColor:C.line },
  pillText: { fontFamily:F.bodySemi, fontSize:12, color:C.ink },
  sectionTitle: { fontFamily: F.headingSemi, fontSize: 21, color: C.ink },
  infoTitle:{flex:1,fontFamily:F.bodyBold,fontSize:16,color:C.ink},
  directions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  directionsText: { fontFamily: F.bodySemi, fontSize: 12, color: C.ink },
  imageCounter:{position:'absolute',right:12,bottom:12,minHeight:32,paddingHorizontal:11,borderRadius:16,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.card}, galleryCount: { fontFamily:F.body, fontSize:13, color:C.muted },
  vendorInfo:{ padding:16, marginTop:18, borderRadius:20, borderWidth:1, borderColor:C.lime, backgroundColor:C.soft, gap:8 },
  offersList: { marginTop:24, gap:20 },
  infoCard: { padding:16, marginTop:20, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:C.line, backgroundColor:C.soft, gap:12 },
  infoHeading: { flexDirection:'row', alignItems:'center', gap:8 },
  hours: { fontFamily:F.body, fontSize:13, lineHeight:20, color:C.muted },
  locationRow: { minHeight:42, flexDirection:'row', alignItems:'center', gap:8 },
  locationText: { flex:1, fontFamily:F.body, fontSize:13, color:C.ink },
  modalOverlay:{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,.42)' }, branchSheet:{ maxHeight:'80%', borderTopLeftRadius:32, borderTopRightRadius:32, paddingHorizontal:24, backgroundColor:C.paper }, handle:{ width:40, height:5, borderRadius:3, backgroundColor:C.line, alignSelf:'center', marginTop:12, marginBottom:12 }, branchHeader:{ minHeight:52, flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }, branchRow:{ minHeight:76, flexDirection:'row', alignItems:'center', gap:12, padding:12, marginBottom:8, borderRadius:18, backgroundColor:C.soft }, branchIcon:{ width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:C.card }, branchAddress:{ fontFamily:F.body,fontSize:12,lineHeight:17,color:C.muted,marginTop:3 },
  offerCard: { marginBottom: 8, position: 'relative', gap: 0 },
  xcardBadge: { position: 'absolute', top: 0, right: 0, width: 58, height: 58, zIndex: 10 },
  offerSaveButton: { position: 'absolute', top: 12, right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', zIndex: 40, elevation: 8 },
  offerInfoContainer: { minHeight: 82, position: 'relative', borderRadius: 30, paddingHorizontal: 24, paddingVertical: 16, paddingEnd: 72, backgroundColor: C.soft, gap: 4 },
  offerTitle: { fontFamily: F.heading, fontSize: 20, letterSpacing: -0.5, textTransform: 'uppercase', color: C.ink },
  offerDescription: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: C.muted },
  offerActionsRow: { flexDirection: 'row', borderRadius: 30, paddingHorizontal: 8, paddingVertical: 8, backgroundColor: C.soft },
  redeem: { flex: 1, height: 56, borderRadius: 30, backgroundColor: C.lime, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .45 },
  unavailable: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.muted, alignSelf: 'center' },
  redeemText: { fontFamily: F.bodyBold, fontSize: 14, color: C.paper, textTransform: 'uppercase', letterSpacing: 0.5 },
});

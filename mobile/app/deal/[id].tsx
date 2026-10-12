import { Colors as BorderPalette } from '@/constants/Colors';
import ScalePressable from '@/components/ScalePressable';
import { useMotionPreferences } from '@/lib/theme';
import Animated, { Easing, FadeInDown, FadeOutUp, LinearTransition, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { AppState, Image, Linking, Share, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AccessiblePressable, Empty, Screen, safeGoBack } from '@/components/ui';
import { CatalogueNotice, useCatalogue } from '@/lib/catalogue';
import { dealById } from '@/lib/data';
import { getSupabase } from '@/lib/supabase';
import { useNearbyDistances } from '@/lib/nearby';
import { useStore } from '@/lib/store';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';
import { useBenefits } from '@/lib/benefits';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '@/lib/auth';
import { useAppLocale } from '@/context/LocaleContext';
import { StatusBar } from 'expo-status-bar';
import { safeWebUrl } from '@/lib/vendor-links';
import { Colors } from '@/constants/Colors';
import ProfileSprites from '@/components/profile/ProfileSprites';

const OFFER_LAYOUT = LinearTransition.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1)).reduceMotion(ReduceMotion.System);
const OFFER_DETAILS_EXIT_MS = 180;

export default function DealDetail({ dealId }: { dealId?: string } = {}) {
  const posthog = usePostHog();
  const {status} = useCatalogue();
  const { distanceByVendor } = useNearbyDistances();
  const router = useRouter();
  const { colors: C } = useAppTheme();
  const { isRTL } = useAppLocale();
  const { t } = useTranslation();
  const s = useMemo(() => styles(C), [C]);
  const insets = useSafeAreaInsets();
  const { reduceMotion } = useMotionPreferences();
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
  const { state, notify, toggleSaved } = useStore();
  const { user } = useAuth();
  const { benefits } = useBenefits();
  const [savedVendor, setSavedVendor] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const vendorId = String(deal?.vendorId || deal?.id || '');
  React.useEffect(() => {
    let active = true;
    setSavedVendor(false);
    if (user && vendorId) void (async () => {
      try {
        const { data, error } = await getSupabase().from('realx_student_saved_items').select('id').eq('student_id', user.id).eq('item_type', 'vendor').eq('item_id', vendorId).maybeSingle();
        if (!active) return;
        if (error) notify(error.message);
        else setSavedVendor(!!data);
      } catch (error) {
        if (active) notify(error instanceof Error ? error.message : 'Unable to load saved vendor.');
      }
    })();
    return () => { active = false; };
  }, [user?.id, vendorId]);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [closingOfferId, setClosingOfferId] = useState<string | null>(null);
  const [offerDetailsHeights, setOfferDetailsHeights] = useState<Record<string, number>>({});
  const [locationsOpen, setLocationsOpen] = useState(false);
  React.useEffect(() => {
    if (!closingOfferId) return;
    const offerId = closingOfferId;
    const timeout = setTimeout(() => {
      setExpandedOfferId(current => current === offerId ? null : current);
      setClosingOfferId(current => current === offerId ? null : current);
    }, reduceMotion ? 0 : OFFER_DETAILS_EXIT_MS);
    return () => clearTimeout(timeout);
  }, [closingOfferId, reduceMotion]);
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
    if (reduceMotion || headerImages.length < 2) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      const next = (carouselIndex.current + 1) % headerImages.length;
      carouselIndex.current = next;
      setActiveGalleryIndex(next);
      carouselRef.current?.scrollTo({x:next * width,animated:true});
    }, 4500);
    return () => clearInterval(timer);
  }, [deal?.id, headerImages.length, reduceMotion, width]));

  if (!deal) return <Screen>{status==='loading' || (id && !/^\d+$/.test(id) && !resolvedId && !lookupFailed) ? <CatalogueNotice/> : status==='cloud' ? <Empty icon="?" title="Offer not found" body="This offer may no longer be available." /> : <CatalogueNotice/>}</Screen>;
  const saved = user ? savedVendor : state.saved.includes(deal.id);
  const toggleVendorSave = async () => {
    if (!user) {
      toggleSaved(deal.id);
      return;
    }
    if (savingVendor) return;
    setSavingVendor(true);
    try {
      const result = savedVendor
        ? await getSupabase().from('realx_student_saved_items').delete().eq('student_id', user.id).eq('item_type', 'vendor').eq('item_id', vendorId)
        : await getSupabase().from('realx_student_saved_items').upsert({ student_id: user.id, item_type: 'vendor', item_id: vendorId, payload: { name: deal.name, source: 'vendor-detail' } }, { onConflict: 'student_id,item_type,item_id' });
      if (result.error) { notify(result.error.message); return; }
      setSavedVendor(!savedVendor);
      notify(savedVendor ? 'Vendor removed from saved' : 'Vendor saved');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to save vendor. Please try again.');
    } finally {
      setSavingVendor(false);
    }
  };
  const selectedOffer = deal.offers?.find(offer => offer.index === selectedIndex) ?? deal.offers?.[0];
  const offerKey = `${deal.id}-${selectedOffer?.index ?? 0}`;
  const branch = deal.locations?.[0];
  const website = safeWebUrl(deal.externalUrl);
  const instagram = safeWebUrl(deal.instagramUrl, true);
  const openLink = async (url: string) => { try { await Linking.openURL(url); } catch { notify('Unable to open this link. Please try again.'); } };
  const share = async () => { try { await Share.share({ message: `${deal.name} on Kouponly\nkouponly://realx/vendor/${encodeURIComponent(String(deal.vendorId || deal.id))}` }); } catch { notify('Unable to share this vendor. Please try again.'); } };
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
      <ProfileSprites />
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
        <AccessiblePressable accessibilityLabel="Go back" onPress={() => safeGoBack()} style={[s.imageAction, { position: 'absolute', left: 16, top: insets.top + 10 }]}><Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={C.ink} /></AccessiblePressable>
        <View style={[s.topbar, { top: insets.top + 10 }]}>
          <AccessiblePressable accessibilityLabel="Share vendor" onPress={() => void share()} style={s.imageAction}><Ionicons name="share-outline" size={22} color={C.ink} /></AccessiblePressable>
        </View>
        {headerImages.length > 1 ? <View pointerEvents="none" style={s.imageCounter}><Ionicons name="images-outline" size={14} color={C.ink}/><Text style={s.galleryCount}>{activeGalleryIndex + 1} / {headerImages.length}</Text></View> : null}
      </View>
      <View style={s.content}>
        <View style={s.vendorNameRow}>
          {deal.logo ? <View style={s.logoWrap}><Image accessibilityLabel={`${deal.name} logo`} source={{uri:deal.logo}} resizeMode="cover" style={s.logo}/></View> : null}
          <Text accessibilityRole="header" style={s.title}>{deal.name}</Text>
          <AccessiblePressable accessibilityLabel={saved ? "Remove saved vendor" : "Save vendor"} accessibilityState={{ selected: saved }} disabled={savingVendor} onPress={() => void toggleVendorSave()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", opacity: savingVendor ? 0.6 : 1 }}><Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={C.ink}/></AccessiblePressable>
        </View>
        <View style={[s.actionMetaRow, isRTL && s.rowReverse]}>
          <View style={s.categoryPill}><Text numberOfLines={1} style={s.metaPillText}>{deal.category}</Text></View>
          <AccessiblePressable accessibilityLabel="Locate vendor" onPress={()=>deal.locations && deal.locations.length>1?setLocationsOpen(true):openLocation()} style={s.locatePill}><Ionicons name="location-outline" size={16} color={C.inkOnAccent}/><Text style={s.locatePillText}>Locate</Text></AccessiblePressable>
          {distanceByVendor.get(String(deal.vendorId || deal.id))?.label ? <View style={s.distancePill}><Ionicons name="navigate-outline" size={14} color={C.ink}/><Text numberOfLines={1} style={s.metaPillText}>{distanceByVendor.get(String(deal.vendorId || deal.id))?.label}</Text></View> : null}
          {phone ? <AccessiblePressable accessibilityLabel={`Call ${phone}`} onPress={()=>void Linking.openURL(`tel:${phone.replace(/[^\d+]/g,'')}`)} style={s.callPill}><Ionicons name="call-outline" size={17} color={C.ink}/><Text style={s.callPillText}>Call</Text></AccessiblePressable> : null}
        </View>
        <View style={[s.actionMetaRow, { flexWrap: 'wrap' }]}>
          {website ? <AccessiblePressable accessibilityLabel="Vendor website" onPress={() => void openLink(website)} style={s.callPill}><Ionicons name="globe-outline" size={18} color={C.ink}/><Text style={s.callPillText}>Website</Text></AccessiblePressable> : null}
          {instagram ? <AccessiblePressable accessibilityLabel="Vendor Instagram" onPress={() => void openLink(instagram)} style={s.callPill}><Ionicons name="logo-instagram" size={18} color={C.ink}/><Text style={s.callPillText}>Instagram</Text></AccessiblePressable> : null}
        </View>
        <Text accessibilityRole="header" style={s.promosHeading}>Available Promos</Text>
        <View style={s.offersList}>{(deal.offers?.length ? deal.offers : [{id:offerKey,index:0,title:deal.offer,description:deal.description,saving:deal.saving,redemption:deal.redemption??'inStore'}]).map(offer=>{
          const count=deal.vendorId && benefits?.usedVendorIds.includes(deal.vendorId) ? 1 : 0;
          const expanded = expandedOfferId === offer.id;
          const closing = closingOfferId === offer.id;
          const showDetails = expanded && !closing;
          const saving = offer.saving || (offer.discountType === 'percentage' && Number.isFinite(offer.discountValue) ? `${offer.discountValue}% off` : '');
          return <Animated.View key={offer.id} layout={OFFER_LAYOUT} style={s.offerCard}>
            <View style={[s.offerSummary, isRTL && s.rowReverse]}>
              <View style={s.offerCopy}>
                <ScalePressable pressedScale={1} accessibilityRole="button" accessibilityLabel={`${showDetails ? 'Hide' : 'Show'} details for ${offer.title}`} accessibilityState={{ expanded: showDetails }} onPress={()=>{
                  if (closing) { setClosingOfferId(null); return; }
                  if (expanded) { setClosingOfferId(offer.id); return; }
                  setClosingOfferId(null);
                  setExpandedOfferId(offer.id);
                }} style={[s.offerTitleRow, isRTL && s.rowReverse]}>
                  <Text style={[s.offerTitle, isRTL && s.textRtl]}>{offer.title}</Text>
                  <OfferDisclosureArrow expanded={showDetails} reduceMotion={reduceMotion} color={C.ink}/>
                </ScalePressable>
                <View style={[s.offerTags, isRTL && s.rowReverse]}>
                  {saving ? <View style={s.offerTag}><Ionicons name="pricetag-outline" size={14} color={C.success}/><Text selectable style={[s.offerTagText,{color:C.success}]}>{saving}</Text></View> : null}
                  <View style={s.offerTag}><Ionicons name={offer.redemption === 'online' ? 'globe-outline' : 'storefront-outline'} size={15} color={C.muted}/><Text style={s.offerTagText}>{offer.redemption === 'online' ? 'Online' : 'In-store'}</Text></View>
                  {deal.locations?.length ? <View style={s.offerTag}><Ionicons name="location-outline" size={15} color={C.muted}/><Text style={s.offerTagText}>{deal.locations.length === 1 ? '1 branch' : `${deal.locations.length} branches`}</Text></View> : null}
                  {deal.xcard ? <View style={s.offerTag}><Ionicons name="cash-outline" size={14} color={C.success}/><Text style={s.offerTagText}>Cashback</Text></View> : null}
                </View>
              </View>
            </View>
            {expanded || closing ? <View style={closing && offerDetailsHeights[offer.id] ? { height: offerDetailsHeights[offer.id] } : undefined}>
              {showDetails ? <Animated.View onLayout={event => { const height = event?.nativeEvent?.layout?.height; if (height) setOfferDetailsHeights(heights => ({ ...heights, [offer.id]: height })); }} entering={FadeInDown.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1)).reduceMotion(ReduceMotion.System)} exiting={FadeOutUp.duration(OFFER_DETAILS_EXIT_MS).easing(Easing.bezier(0.4, 0, 1, 1)).reduceMotion(ReduceMotion.System)} style={s.offerDetails}><Text style={s.offerDetailsTitle}>Offer details</Text>{offer.description ? <Text selectable style={s.offerDetailsText}>{offer.description}</Text> : null}{offer.terms ? <><Text style={s.offerDetailsTitle}>Terms and exclusions</Text><Text selectable style={s.offerDetailsText}>{offer.terms}</Text></> : null}{offer.redemptionInstructions ? <><Text style={s.offerDetailsTitle}>How to redeem</Text><Text selectable style={s.offerDetailsText}>{offer.redemptionInstructions}</Text></> : null}</Animated.View> : null}
            </View> : null}
            <Text style={s.offerDetailsText}>Coupon limit: 1 per vendor per month. Referral refreshes start a new round.{benefits?.subscription ? ` ${count ? 0 : 1} remaining.` : user ? ' Availability appears when your membership loads.' : ' Sign in to view availability.'}{benefits?.subscription ? ` · Resets ${new Date(benefits.subscription.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</Text>
            <View style={[s.offerActionsRow, isRTL && s.rowReverse]}>

              <AccessiblePressable testID={`redeem-offer-${offer.index}`} disabled={count>0} onPress={()=>router.push({pathname:'/redeem/[id]',params:{id:String(deal.id),vendorId:deal.vendorId,offerIndex:String(offer.index)}} as any)} style={[s.redeem,count>0&&s.disabled]}><Ionicons name="flash" size={18} color={C.inkOnAccent}/><Text style={s.redeemText}>{count?'Used up':'Redeem offer'}</Text></AccessiblePressable>
            </View>
          </Animated.View>;
        })}</View>
        {deal.vendorInformation?.message ? <View style={s.vendorInfo}><View style={s.infoHeading}><Ionicons name="information-circle-outline" size={22} color={C.lime}/><Text style={s.infoTitle}>{deal.vendorInformation.title || 'Information'}</Text></View><Text style={[s.hours, isRTL && s.textRtl]}>{deal.vendorInformation.message}</Text></View>:null}
        {formattedHours ? <View style={s.infoCard}><View style={s.infoHeading}><Ionicons name="time-outline" size={20} color={C.lime}/><Text style={s.infoTitle}>Opening hours</Text></View><Text style={[s.hours, isRTL && s.textRtl]}>{formattedHours}</Text></View>:null}
        {deal.description ? <View style={s.infoCard}><Text accessibilityRole="header" style={s.infoTitle}>About {deal.name}</Text><Text selectable style={s.offerDetailsText}>{deal.description}</Text></View> : null}
      </View>
    </Screen>
    <Modal visible={locationsOpen && Boolean(deal.locations?.length)} transparent animationType={reduceMotion ? "fade" : "slide"} onRequestClose={()=>setLocationsOpen(false)}><Pressable style={s.modalOverlay} onPress={()=>setLocationsOpen(false)}><Pressable style={[s.branchSheet,{paddingBottom:Math.max(insets.bottom,20)}]} onPress={event=>event.stopPropagation()}><View style={s.handle}/><View style={s.branchHeader}><Text style={s.sectionTitle}>Branches</Text><AccessiblePressable accessibilityLabel="Close branches" onPress={()=>setLocationsOpen(false)} style={s.imageAction}><Ionicons name="close-circle" size={25} color={C.ink}/></AccessiblePressable></View><ScrollView showsVerticalScrollIndicator={false}>{deal.locations?.map((location,index)=><AccessiblePressable key={location.id} accessibilityLabel={`Directions to ${location.name || location.address}`} onPress={()=>{setLocationsOpen(false);openLocation(location)}} pressedScale={1} style={[s.branchRow, isRTL && s.rowReverse]}><View style={s.branchIcon}><Ionicons name="location-outline" size={19} color={C.lime}/></View><View style={{flex:1}}><Text style={[s.locationText, isRTL && s.textRtl]}>{location.name || `Branch ${index+1}`}</Text>{location.address ? <Text style={[s.branchAddress, isRTL && s.textRtl]}>{location.address}</Text>:null}{location.phoneNumber ? <Text style={[s.branchAddress, isRTL && s.textRtl]}>{location.phoneNumber}</Text>:null}</View><Ionicons name="navigate-outline" size={17} color={C.lime}/></AccessiblePressable>)}</ScrollView></Pressable></Pressable></Modal>
  </>;
}

function OfferDisclosureArrow({ expanded, reduceMotion, color }: { expanded: boolean; reduceMotion: boolean; color: string }) {
  const rotation = useSharedValue(expanded ? 180 : 0);
  React.useEffect(() => {
    rotation.value = withTiming(expanded ? 180 : 0, {
      duration: reduceMotion ? 0 : 220,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      reduceMotion: ReduceMotion.System,
    });
  }, [expanded, reduceMotion, rotation]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Animated.View style={animatedStyle}><Ionicons name="chevron-down" size={22} color={color}/></Animated.View>;
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
  topbar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  imageAction: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  logoWrap: { width: 88, height: 88, flexShrink: 0, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logo: { width: '100%', height: '100%', borderRadius: 16 },
  rowReverse: { flexDirection: 'row-reverse' },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  vendorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontFamily: F.heading, fontSize: 26, letterSpacing: -.4, color: C.ink },
  actionMetaRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:16}, categoryPill:{flex:1,minWidth:0,minHeight:40,alignItems:'center',justifyContent:'center',paddingHorizontal:8,borderRadius:22,borderWidth:1,borderColor:BorderPalette.border,backgroundColor:C.soft}, metaPillText:{fontFamily:F.bodySemi,fontSize:13,color:C.ink,textAlign:'center'}, locatePill:{flex:1,minWidth:0,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:6,borderRadius:22,borderWidth:1,borderColor:BorderPalette.border,backgroundColor:Colors.brandGreen}, locatePillText:{fontFamily:F.bodyBold,fontSize:13,color:C.inkOnAccent}, distancePill:{flex:1,minWidth:0,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:6,borderRadius:22,borderWidth:1,borderColor:BorderPalette.border,backgroundColor:C.soft}, callPill:{flex:1,minWidth:0,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:6,borderRadius:22,borderWidth:1,borderColor:BorderPalette.border,backgroundColor:C.soft}, callPillText:{fontFamily:F.bodySemi,fontSize:13,color:C.ink},
  promosHeading:{fontFamily:F.headingSemi,fontSize:23,color:C.ink,marginTop:0,marginBottom:14},
  offerTagText:{fontFamily:F.body,fontSize:12,color:C.muted},
  sectionTitle: { fontFamily: F.headingSemi, fontSize: 21, color: C.ink },
  infoTitle:{flex:1,fontFamily:F.bodyBold,fontSize:16,color:C.ink},
  imageCounter:{position:'absolute',right:12,bottom:12,minHeight:32,paddingHorizontal:11,borderRadius:16,borderWidth:1,borderColor:BorderPalette.border,flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.card}, galleryCount: { fontFamily:F.body, fontSize:13, color:C.muted },
  vendorInfo:{ padding:16, marginTop:18, borderRadius:20, borderWidth:1, borderColor:BorderPalette.border, backgroundColor:C.soft, gap:8 },
  offersList: { gap:16 },
  infoCard: { padding:16, marginTop:20, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:C.line, backgroundColor:C.soft, gap:12 },
  infoHeading: { flexDirection:'row', alignItems:'center', gap:8 },
  hours: { fontFamily:F.body, fontSize:13, lineHeight:20, color:C.muted },
  locationText: { flex:1, fontFamily:F.body, fontSize:13, color:C.ink },
  modalOverlay:{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,.42)' }, branchSheet:{ maxHeight:'80%', borderTopLeftRadius:32, borderTopRightRadius:32, borderWidth:1, borderColor:BorderPalette.border, paddingHorizontal:24, backgroundColor:C.paper }, handle:{ width:40, height:5, borderRadius:3, backgroundColor:C.line, alignSelf:'center', marginTop:12, marginBottom:12 }, branchHeader:{ minHeight:52, flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }, branchRow:{ minHeight:76, flexDirection:'row', alignItems:'center', gap:12, padding:12, marginBottom:8, borderRadius:18, borderWidth:1, borderColor:BorderPalette.border, backgroundColor:C.soft }, branchIcon:{ width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:C.card }, branchAddress:{ fontFamily:F.body,fontSize:12,lineHeight:17,color:C.muted,marginTop:3 },
  offerCard: { borderRadius:24,borderWidth:1,borderColor:C.line,backgroundColor:C.card,padding:16,gap:18,overflow:'hidden' },
  offerSaveButton: { paddingHorizontal: 16, flexDirection: 'row', gap: 6, height: 56, borderRadius: 24,backgroundColor:C.soft,borderWidth:1,borderColor:C.line,alignItems: 'center', justifyContent: 'center' },
  offerSummary:{flexDirection:'row',alignItems:'flex-start'}, offerCopy:{flex:1,minWidth:0,gap:10},
  offerTitleRow:{flexDirection:'row',alignItems:'flex-start',gap:12}, offerTitle:{flex:1,fontFamily:F.headingSemi,fontSize:19,lineHeight:26,letterSpacing:-.3,color:C.ink}, offerTags:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:8}, offerTag:{minHeight:24,flexDirection:'row',alignItems:'center',gap:5},
  offerDetails:{gap:8,paddingTop:16,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.line}, offerDetailsTitle:{fontFamily:F.bodySemi,fontSize:13,color:C.ink}, offerDetailsText:{fontFamily:F.body,fontSize:14,lineHeight:21,color:C.muted},
  offerActionsRow: { flexDirection: 'row', gap:10, alignItems:'center' },
  redeem: { flex: 1, height: 56, borderRadius: 30, borderWidth: 1, borderColor: BorderPalette.border, backgroundColor: Colors.brandGreen, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .45 },
  unavailable: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.muted, alignSelf: 'center' },
  redeemText: { fontFamily: F.bodyBold, fontSize: 17, color: C.inkOnAccent },
});

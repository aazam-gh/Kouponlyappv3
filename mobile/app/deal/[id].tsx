import ScalePressable from '@/components/ScalePressable';
import { useMotionPreferences } from '@/lib/theme';
import Animated, { Easing, FadeInDown, FadeOutUp, LinearTransition, ReduceMotion, SlideInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Device from 'expo-device';
import React, { useMemo, useState } from 'react';
import { Alert, AppState, Image, Linking, Share, Modal, Platform, Pressable, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AccessiblePressable, Empty, Screen, safeGoBack } from '@/components/ui';
import { CatalogueNotice, useCatalogue } from '@/lib/catalogue';
import { dealById } from '@/lib/data';
import { getSupabase } from '@/lib/supabase';
import { useNearbyDistances } from '@/lib/nearby';
import { useStore } from '@/lib/store';
import { F, type ThemeColors, useAppTheme } from '@/lib/theme';
import { isCouponOfferUsed, useBenefits } from '@/lib/benefits';
import { useAppLocale } from '@/context/LocaleContext';
import { StatusBar } from 'expo-status-bar';
import { distanceBetweenKm } from '@/lib/vendor-distance';
import { dealAtBranch, isOfferExhausted, offerBranchLabel } from '@/lib/vendor-branches';
import { safeWebUrl } from '@/lib/vendor-links';
import { Colors } from '@/constants/Colors';
import ProfileSprites from '@/components/profile/ProfileSprites';

const OFFER_LAYOUT = LinearTransition.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1)).reduceMotion(ReduceMotion.System);
const OFFER_DETAILS_EXIT_MS = 180;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const INFO_SHEET_ENTER = SlideInDown.duration(260).reduceMotion(ReduceMotion.System);

export default function DealDetail({ dealId }: { dealId?: string } = {}) {
  const {status} = useCatalogue();
  const { distanceByVendor, position } = useNearbyDistances();
  const router = useRouter();
  const { colors: C } = useAppTheme();
  const { isRTL } = useAppLocale();
  const { t } = useTranslation();
  const s = useMemo(() => styles(C), [C]);
  const insets = useSafeAreaInsets();
  const headerTopInset = Math.max(insets.top, Platform.OS === 'android' ? NativeStatusBar.currentHeight || 40 : 0);
  const { reduceMotion } = useMotionPreferences();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ id: string; offer?: string; branch?: string }>();
  const id = dealId || params.id;
  const offerParam = params.offer;
  const selectedIndex = Number(offerParam ?? 0);
  const [vendorLookup, setVendorLookup] = useState<{ id: string; resolvedId?: string; failed: boolean } | null>(null);
  React.useEffect(() => {
    let active = true;
    if (!id || /^\d+$/.test(id)) return () => { active = false; };
    void (async () => {
      try { const {data,error}=await getSupabase().from('kouponly_vendors').select('catalogue_deal_id').eq('id', id).maybeSingle(); if(active)setVendorLookup({id,resolvedId:data?.catalogue_deal_id?String(data.catalogue_deal_id):undefined,failed:!!error||!data}); }
      catch { if(active)setVendorLookup({id,failed:true}); }
    })();
    return () => { active = false; };
  }, [id]);
  const resolvedId = vendorLookup?.id === id ? vendorLookup.resolvedId : undefined;
  const lookupFailed = vendorLookup?.id === id && vendorLookup.failed;
  const vendorDeal = dealById(id) ?? (resolvedId ? dealById(resolvedId) : undefined);
  const [chosenBranch, setChosenBranch] = useState<string>();
  const nearestBranch = vendorDeal ? distanceByVendor.get(String(vendorDeal.vendorId || vendorDeal.id))?.location.locationId : undefined;
  const branchId = chosenBranch || params.branch || nearestBranch || vendorDeal?.locations?.[0]?.id;
  const deal = vendorDeal ? dealAtBranch(vendorDeal, branchId) : undefined;
  React.useEffect(() => { setChosenBranch(undefined); }, [id]);
  const { state, notify, toggleSavedOffer } = useStore();
  const { benefits } = useBenefits();
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [closingOfferId, setClosingOfferId] = useState<string | null>(null);
  const [offerDetailsHeights, setOfferDetailsHeights] = useState<Record<string, number>>({});
  const [infoOpen, setInfoOpen] = useState(false);
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
  const selectedOffer = deal.offers?.find(offer => offer.index === selectedIndex) ?? deal.offers?.[0];
  const offerKey = `${deal.id}-${selectedOffer?.index ?? 0}`;
  const branch = deal.locations?.find(row => row.id === branchId || row.branchId === branchId) || deal.locations?.[0];
  const branchDistance = position && branch?.latitude != null && branch.longitude != null
    ? `${distanceBetweenKm(position, { latitude: branch.latitude, longitude: branch.longitude }).toFixed(2)} km`
    : !chosenBranch ? distanceByVendor.get(String(deal.vendorId || deal.id))?.label : undefined;
  const website = safeWebUrl(deal.externalUrl);
  const instagram = safeWebUrl(deal.instagramUrl, true);
  const openLink = async (url: string) => { try { await Linking.openURL(url); } catch { notify('Unable to open this link. Please try again.'); } };
  const share = async () => { try { await Share.share({ message: `${deal.name} on Kouponly\nhttps://kouponly.in/vendor/${encodeURIComponent(String(deal.vendorId || deal.id))}` }); } catch { notify('Unable to share this vendor. Please try again.'); } };
  const phone = branch?.phoneNumber || deal.phoneNumber;
  const branchAddresses = deal.locations?.filter(location => location.address) ?? [];
  const callVendor = () => {
    if (!phone) return;
    const dial = () => void Linking.openURL(`tel:${phone.replace(/[^\d+]/g,'')}`).catch(() => Alert.alert('Call unavailable', phone));
    if (Platform.OS === 'ios' && !Device.isDevice) return Alert.alert('Call', phone, [{ text: 'Cancel', style: 'cancel' }, { text: 'Call', onPress: dial }]);
    dial();
  };
  const hours = branch?.openingHours || deal.openingHours;
  const openLocation = (location = branch) => {
    const query = location?.latitude != null && location.longitude != null ? `${location.latitude},${location.longitude}` : `${deal.name}, ${location?.address || deal.place}`;
    void openLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
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
        <AccessiblePressable accessibilityLabel="Go back" onPress={() => safeGoBack()} style={[s.imageAction, { position: 'absolute', left: 16, top: insets.top + headerTopInset + 10 }]}><Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={C.ink} /></AccessiblePressable>
        <View style={[s.topbar, { top: insets.top + headerTopInset + 10 }]}>
          <AccessiblePressable accessibilityLabel="Share vendor" onPress={() => void share()} style={s.imageAction}><Ionicons name="share-outline" size={22} color={C.ink} /></AccessiblePressable>
        </View>
        {headerImages.length > 1 ? <View pointerEvents="none" style={s.imageCounter}><Text style={s.galleryCount}>{activeGalleryIndex + 1} / {headerImages.length}</Text></View> : null}
      </View>
      <View style={s.content}>
        <View style={[s.vendorNameRow, isRTL && s.rowReverse]}>
          {deal.logo ? <View style={s.logoWrap}><Image accessibilityLabel={`${deal.name} logo`} source={{uri:deal.logo}} resizeMode="cover" style={s.logo}/></View> : null}
          <Text accessibilityRole="header" style={[s.title, isRTL && s.textRtl]}>{deal.name}</Text>
        </View>
        <View style={[s.actionMetaRow, isRTL && s.rowReverse]}>
          {phone ? <AccessiblePressable accessibilityLabel={`Call ${phone}`} onPress={callVendor} style={s.actionPill}><Ionicons name="call-outline" size={17} color={C.ink}/><Text style={s.callPillText}>Call</Text></AccessiblePressable> : null}
          <AccessiblePressable accessibilityLabel={`Show vendor location${branchDistance ? `, ${branchDistance}` : ''}`} onPress={() => openLocation()} style={s.actionPill}><Ionicons name="navigate-outline" size={16} color={C.ink}/><Text numberOfLines={1} style={s.callPillText}>{branchDistance || 'Directions'}</Text></AccessiblePressable>
          <AccessiblePressable accessibilityRole="button" accessibilityLabel={`More information about ${deal.name}`} onPress={() => setInfoOpen(true)} style={[s.actionPill, s.infoPill]}><Ionicons name="information-circle-outline" size={18} color="#FFFFFF"/><Text style={s.infoPillText}>Info</Text></AccessiblePressable>
        </View>
        {(deal.locations?.length ?? 0) > 1 ? <View style={{ gap: 8 }}>
          <Text style={[s.infoTitle, { paddingTop: 8 }]}>Offers at {branch?.name || branch?.address || 'this branch'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {deal.locations?.map(location => <AccessiblePressable key={location.id} accessibilityRole="button" accessibilityState={{ selected: branch?.id === location.id }} accessibilityLabel={`Select ${location.name || location.address}`} onPress={() => setChosenBranch(location.id)} style={[s.actionPill, branch?.id === location.id && { borderColor: C.lime }]}><Text style={s.callPillText}>{location.name || location.address}</Text></AccessiblePressable>)}
          </ScrollView>
        </View> : null}
        {deal.offers && !deal.offers.length ? <Text style={s.offerDetailsText}>No coupons available at this branch. Choose another branch to see its offers.</Text> : null}
        <View style={[s.promosHeader, isRTL && s.rowReverse]}>
          <Text accessibilityRole="header" style={s.promosHeading}>Available Promos</Text>
        </View>
        <View style={s.offersList}>{(deal.offers ?? [{id:offerKey,index:0,title:deal.offer,description:deal.description,saving:deal.saving,redemption:deal.redemption??'inStore'}]).map(offer=>{
          const exhausted=isOfferExhausted(offer);
          const count=isCouponOfferUsed(benefits, offer.id, deal.vendorId, branch?.branchId || branch?.id || '') ? 1 : 0;
          const expanded = expandedOfferId === offer.id;
          const closing = closingOfferId === offer.id;
          const showDetails = expanded && !closing;
          const toggleOfferDetails = () => {
            if (closing) { setClosingOfferId(null); return; }
            if (expanded) { setClosingOfferId(offer.id); return; }
            setClosingOfferId(null);
            setExpandedOfferId(offer.id);
          };
          return <Animated.View key={offer.id} layout={OFFER_LAYOUT} style={s.offerCard}>
            <View style={[s.offerSummary, isRTL && s.rowReverse]}>
              <View style={s.offerCopy}>
                <ScalePressable pressedScale={1} accessibilityRole="button" accessibilityLabel={`${showDetails ? 'Hide' : 'Show'} details for ${offer.title}`} accessibilityState={{ expanded: showDetails }} onPress={toggleOfferDetails} style={[s.offerTitleRow, isRTL && s.rowReverse]}>
                  <Text style={[s.offerTitle, isRTL && s.textRtl]}>{offer.title}</Text>
                  <OfferDisclosureArrow expanded={showDetails} reduceMotion={reduceMotion} color={C.ink}/>
                </ScalePressable>
                <View style={[s.offerTags, isRTL && s.rowReverse]}>
                  {offer.saving ? <View style={s.offerTag}><Text style={s.offerTagText}>{offer.saving}</Text></View> : null}
                  <View style={s.offerTag}><Ionicons name={offer.redemption === 'online' ? 'globe-outline' : 'storefront-outline'} size={15} color={C.muted}/><Text style={s.offerTagText}>{offer.redemption === 'online' ? 'Online' : 'In-store'}</Text></View>
                  {(deal.locations?.length ?? 0) > 1 ? <View style={s.offerTag}><Ionicons name="location-outline" size={15} color={C.muted}/><Text style={s.offerTagText}>{offerBranchLabel(offer, deal.locations)}</Text></View> : null}
                  {deal.xcard ? <View style={s.offerTag}><Ionicons name="cash-outline" size={14} color={C.success}/><Text style={s.offerTagText}>Cashback</Text></View> : null}
                </View>
              </View>
            </View>
            {expanded || closing ? <View style={closing && offerDetailsHeights[offer.id] ? { height: offerDetailsHeights[offer.id] } : undefined}>
              {showDetails ? <Animated.View onLayout={event => { const height = event?.nativeEvent?.layout?.height; if (height) setOfferDetailsHeights(heights => ({ ...heights, [offer.id]: height })); }} entering={FadeInDown.duration(220).easing(Easing.bezier(0.22, 1, 0.36, 1)).reduceMotion(ReduceMotion.System)} exiting={FadeOutUp.duration(OFFER_DETAILS_EXIT_MS).easing(Easing.bezier(0.4, 0, 1, 1)).reduceMotion(ReduceMotion.System)} style={s.offerDetails}><Text style={s.offerDetailsTitle}>Offer details</Text>{offer.description ? <Text selectable style={s.offerDetailsText}>{offer.description}</Text> : null}{offer.terms ? <><Text style={s.offerDetailsTitle}>Terms and exclusions</Text><Text selectable style={s.offerDetailsText}>{offer.terms}</Text></> : null}{offer.redemptionInstructions ? <><Text style={s.offerDetailsTitle}>How to redeem</Text><Text selectable style={s.offerDetailsText}>{offer.redemptionInstructions}</Text></> : null}</Animated.View> : null}
            </View> : null}
            <View style={s.couponLimit}>
              {exhausted ? <Text style={s.offerDetailsText}>Fully redeemed · All available coupons have been used.</Text> : null}
              {benefits?.subscription && !exhausted ? <Text accessibilityLabel={`Coupons remaining: ${count ? 0 : 1} of 1`} style={s.couponCount}>{count ? '0/1' : '1/1'} coupon remaining</Text> : null}
              {count && benefits?.subscription && !exhausted ? <><Text style={s.offerDetailsText}>Available again {new Date(benefits.subscription.endsAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. {benefits.rewardedReferrals < benefits.referralLimit ? 'Invite friends to earn an earlier coupon refresh.' : 'Your referral refresh limit has been reached.'}</Text><AccessiblePressable accessibilityRole="button" onPress={() => router.push('/invite-code')}><Text style={s.offerDetailsTitle}>Invite friends</Text></AccessiblePressable></> : null}
            </View>
            <View style={[s.offerActionsRow, isRTL && s.rowReverse]}>
              <AccessiblePressable accessibilityRole="button" accessibilityLabel={`${state.savedOffers.includes(offer.id) ? 'Remove' : 'Save'} ${offer.title}`} accessibilityState={{ selected: state.savedOffers.includes(offer.id) }} onPress={() => toggleSavedOffer(offer.id)} style={s.saveOffer}><Ionicons name={state.savedOffers.includes(offer.id) ? 'bookmark' : 'bookmark-outline'} size={18} color={C.ink}/><Text style={s.saveOfferText}>{state.savedOffers.includes(offer.id) ? 'Saved' : 'Save'}</Text></AccessiblePressable>
              <AccessiblePressable testID={`redeem-offer-${offer.index}`} disabled={count>0 || exhausted} onPress={()=>router.push({pathname:'/redeem/[id]',params:{id:String(deal.id),vendorId:deal.vendorId,offerIndex:String(offer.index),branch:branch?.id}} as any)} style={[s.redeem,(count>0 || exhausted)&&s.disabled]}><Ionicons name="flash" size={18} color="#FFFFFF"/><Text style={s.redeemText}>{exhausted?'Fully redeemed':count?'Used up':'Redeem offer'}</Text></AccessiblePressable>
            </View>
          </Animated.View>;
        })}</View>
      </View>
    </Screen>
    <Modal testID="vendor-info-modal" visible={infoOpen} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setInfoOpen(false)}>
      <Pressable testID="vendor-info-backdrop" style={s.modalOverlay} onPress={() => setInfoOpen(false)}>
        <AnimatedPressable testID="vendor-info-sheet" entering={reduceMotion ? undefined : INFO_SHEET_ENTER} style={[s.branchSheet, { paddingBottom: Math.max(insets.bottom, 20) }]} onPress={event => event.stopPropagation()}>
          <View style={s.handle}/>
          <View style={s.branchHeader}>
            <Text style={s.sectionTitle}>{deal.name}</Text>
            <AccessiblePressable accessibilityLabel="Close store information" onPress={() => setInfoOpen(false)} style={s.imageAction}><Ionicons name="close-circle" size={25} color={C.ink}/></AccessiblePressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.infoContent}>
            {website ? <AccessiblePressable accessibilityLabel="Vendor website" onPress={() => void openLink(website)} style={s.infoLink}><Ionicons name="globe-outline" size={19} color={C.lime}/><Text style={s.locationText}>Website</Text><Ionicons name="open-outline" size={16} color={C.muted}/></AccessiblePressable> : null}
            {instagram ? <AccessiblePressable accessibilityLabel="Vendor Instagram" onPress={() => void openLink(instagram)} style={s.infoLink}><Ionicons name="logo-instagram" size={19} color={C.lime}/><Text style={s.locationText}>Instagram</Text><Ionicons name="open-outline" size={16} color={C.muted}/></AccessiblePressable> : null}
            {formattedHours ? <View style={s.infoCard}><View style={s.infoHeading}><Ionicons name="time-outline" size={20} color={C.lime}/><Text style={s.infoTitle}>Store timings</Text></View><Text style={[s.hours, isRTL && s.textRtl]}>{formattedHours}</Text></View> : null}
            {deal.vendorInformation?.message ? <View style={s.vendorInfo}><View style={s.infoHeading}><Ionicons name="information-circle-outline" size={22} color={C.lime}/><Text style={s.infoTitle}>{deal.vendorInformation.title || 'Store information'}</Text></View><Text style={[s.hours, isRTL && s.textRtl]}>{deal.vendorInformation.message}</Text></View> : null}
            {deal.description ? <View style={s.infoCard}><Text accessibilityRole="header" style={s.infoTitle}>About {deal.name}</Text><Text selectable style={s.offerDetailsText}>{deal.description}</Text></View> : null}
            {branchAddresses.length ? <View style={s.infoCard}><View style={s.infoHeading}><Ionicons name="location-outline" size={20} color={C.lime}/><Text style={s.infoTitle}>{branchAddresses.length > 1 ? 'Branch addresses' : 'Address'}</Text></View>{branchAddresses.map((location, index) => <View key={location.id} style={{ gap: 2 }}>{branchAddresses.length > 1 ? <Text style={s.offerDetailsTitle}>{location.name || `Branch ${index + 1}`}</Text> : null}<Text selectable style={[s.hours, isRTL && s.textRtl]}>{location.address}</Text></View>)}</View> : null}
            {!website && !instagram && !formattedHours && !deal.vendorInformation?.message && !deal.description && !branchAddresses.length ? <Text style={s.hours}>More store information will appear here when available.</Text> : null}
          </ScrollView>
        </AnimatedPressable>
      </Pressable>
    </Modal>
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

const styles = (C: ThemeColors) => {
  const outline = C.paper === '#FFFFFF' ? 'rgba(10,15,12,0.22)' : C.line;
  return StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  imageWrap: { height: 250, marginBottom: 12 },
  image: { width: '100%', height: '100%', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  topbar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  imageAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: outline },
  logoWrap: { width: 100, height: 100, flexShrink: 0, borderRadius: 16, backgroundColor: C.card, borderWidth: 1, borderColor: outline, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logo: { width: '100%', height: '100%', borderRadius: 16 },
  rowReverse: { flexDirection: 'row-reverse' },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  vendorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 128, paddingVertical: 14 },
  title: { flex: 1, minWidth: 0, fontFamily: F.heading, fontSize: 28, lineHeight: 34, letterSpacing: -.4, color: C.ink },
  actionMetaRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:16}, actionPill:{flex:1,minWidth:0,minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:8,borderRadius:22,borderWidth:1,borderColor:outline,backgroundColor:C.soft}, infoPill:{backgroundColor:Colors.brandGreen,borderColor:Colors.brandGreen}, callPillText:{flexShrink:1,textAlign:'center',fontFamily:F.bodySemi,fontSize:13,color:C.ink}, infoPillText:{flexShrink:1,textAlign:'center',fontFamily:F.bodySemi,fontSize:13,color:'#FFFFFF'},
  promosHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 20, marginBottom: 14 },
  promosHeading:{fontFamily:F.headingSemi,fontSize:23,color:C.ink},
  couponLimit: { gap: 4 },
  couponCount: { fontFamily: F.bodySemi, fontSize: 14, color: C.ink },
  offerTagText:{fontFamily:F.body,fontSize:12,color:C.muted},
  sectionTitle: { fontFamily: F.headingSemi, fontSize: 21, color: C.ink },
  infoTitle:{flex:1,fontFamily:F.bodyBold,fontSize:16,color:C.ink},
  infoContent:{gap:12,paddingBottom:12}, infoLink:{minHeight:52,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14,borderRadius:16,borderWidth:1,borderColor:outline,backgroundColor:C.soft},
  imageCounter:{position:'absolute',right:12,bottom:12,minHeight:32,paddingHorizontal:11,borderRadius:16,borderWidth:1,borderColor:outline,alignItems:'center',justifyContent:'center',backgroundColor:C.card}, galleryCount: { fontFamily:F.body, fontSize:13, color:C.muted },
  vendorInfo:{ padding:16, marginTop:18, borderRadius:20, borderWidth:1, borderColor:outline, backgroundColor:C.soft, gap:8 },
  offersList: { gap:16 },
  infoCard: { padding:16, marginTop:20, borderRadius:20, borderWidth:StyleSheet.hairlineWidth, borderColor:outline, backgroundColor:C.soft, gap:12 },
  infoHeading: { flexDirection:'row', alignItems:'center', gap:8 },
  hours: { fontFamily:F.body, fontSize:13, lineHeight:20, color:C.muted },
  locationText: { flex:1, fontFamily:F.body, fontSize:13, color:C.ink },
  modalOverlay:{ flex:1, justifyContent:'flex-end', backgroundColor:'rgba(0,0,0,.42)' }, branchSheet:{ maxHeight:'80%', borderTopLeftRadius:32, borderTopRightRadius:32, borderWidth:1, borderColor:outline, paddingHorizontal:24, backgroundColor:C.paper }, handle:{ width:40, height:5, borderRadius:3, backgroundColor:C.line, alignSelf:'center', marginTop:12, marginBottom:12 }, branchHeader:{ minHeight:52, flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }, branchRow:{ minHeight:76, flexDirection:'row', alignItems:'center', gap:12, padding:12, marginBottom:8, borderRadius:18, borderWidth:1, borderColor:outline, backgroundColor:C.soft }, branchIcon:{ width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:C.card }, branchAddress:{ fontFamily:F.body,fontSize:12,lineHeight:17,color:C.muted,marginTop:3 },
  offerCard: { borderRadius:24,borderWidth:1,borderColor:outline,backgroundColor:C.card,padding:16,gap:18,overflow:'hidden' },
  offerSaveButton: { paddingHorizontal: 16, flexDirection: 'row', gap: 6, height: 56, borderRadius: 24,backgroundColor:C.soft,borderWidth:1,borderColor:outline,alignItems: 'center', justifyContent: 'center' },
  offerSummary:{flexDirection:'row',alignItems:'flex-start'}, offerCopy:{flex:1,minWidth:0,gap:10},
  offerTitleRow:{flexDirection:'row',alignItems:'flex-start',gap:12}, offerTitle:{flex:1,fontFamily:F.headingSemi,fontSize:19,lineHeight:26,letterSpacing:-.3,color:C.ink}, offerTags:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:8}, offerTag:{minHeight:24,flexDirection:'row',alignItems:'center',gap:5},
  offerDetails:{gap:8,paddingTop:16,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:outline}, offerDetailsTitle:{fontFamily:F.bodySemi,fontSize:13,color:C.ink}, offerDetailsText:{fontFamily:F.body,fontSize:14,lineHeight:21,color:C.muted},
  offerActionsRow: { flexDirection: 'row', gap:10, alignItems:'center' },
  saveOffer: { minHeight: 56, flex: 1, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 28, borderWidth: 1, borderColor: outline, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveOfferText: { flexShrink: 1, textAlign: 'center', color: C.ink, fontSize: 14, fontFamily: F.bodyBold },
  redeem: { flex: 1.5, minHeight: 56, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 30, borderWidth: 1, borderColor: outline, backgroundColor: Colors.brandGreen, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: .45 },
  unavailable: { flex: 1, fontFamily: F.body, fontSize: 12, lineHeight: 17, color: C.muted, alignSelf: 'center' },
  redeemText: { flexShrink: 1, textAlign: 'center', fontFamily: F.bodyBold, fontSize: 17, color: '#FFFFFF' },
  });
};

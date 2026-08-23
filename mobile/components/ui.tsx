import { BlurView } from "expo-blur";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";
import { router } from "expo-router";
import { ArrowLeft, ChevronRight, Heart, MapPin, Star } from "lucide-react-native";
import React, { useEffect, useMemo } from "react";
import { AccessibilityInfo, Image, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextProps, TextStyle, View, ViewStyle, useWindowDimensions, type PressableProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Deal, DirectoryItem } from "@/lib/data";
import { F,layout,shadow,typography,type ThemeColors,type TypographyVariant,useAppTheme } from "@/lib/theme";
import { useStore } from "@/lib/store";

type GlassRole="navigation"|"control";
export function GlassSurface({children,style,intensity=64,interactive=false,role="navigation",forceFallback}:{children:React.ReactNode;style?:StyleProp<ViewStyle>;intensity?:number;interactive?:boolean;role?:GlassRole;forceFallback?:"blur"|"solid"}) {
  const {colors:C,dark,motion}=useAppTheme();
  const native = Platform.OS==="ios" && !motion.reduceTransparency && !forceFallback && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  if (native) return <GlassView isInteractive={interactive} glassEffectStyle={role==="control"?"clear":"regular"} style={style}>{children}</GlassView>;
  if (!motion.reduceTransparency && forceFallback!=="solid") return <BlurView intensity={intensity} tint={dark?"dark":"light"} style={[{overflow:"hidden",backgroundColor:C.glass},style]}>{children}</BlurView>;
  return <View style={[{overflow:"hidden",backgroundColor:C.glassSolid},style]}>{children}</View>;
}

type AppTextProps=TextProps&{variant?:TypographyVariant;color?:keyof ThemeColors};
const ramps:Record<TypographyVariant,TextProps["dynamicTypeRamp"]>={largeTitle:"largeTitle",title:"title1",headline:"headline",body:"body",callout:"callout",caption:"caption1",eyebrow:"caption2"};
export function AppText({variant="body",color="ink",style,children,...props}:AppTextProps){const {colors}=useAppTheme();return <Text {...props} allowFontScaling dynamicTypeRamp={ramps[variant]} maxFontSizeMultiplier={2.4} style={[typography[variant],{color:colors[color]},style]}>{children}</Text>}

export function AppIcon({sf,fallback,size=22,color}:{sf:SFSymbol;fallback:React.ReactNode;size?:number;color?:string}){const {colors}=useAppTheme();if(Platform.OS!=="ios")return <>{fallback}</>;return <SymbolView name={sf} size={size} tintColor={color??colors.ink} weight="semibold" fallback={fallback}/>}

type HapticKind="selection"|"light"|"success"|"warning"|"error"|"none";
async function playHaptic(kind:HapticKind){try{if(kind==="none")return;if(kind==="selection")return void await Haptics.selectionAsync();if(kind==="success")return void await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);if(kind==="warning")return void await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);if(kind==="error")return void await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}catch{}}

export function AccessiblePressable({style,onPress,haptic="light",accessibilityRole="button",disabled,...props}:PressableProps&{haptic?:HapticKind}){
  return <Pressable {...props} disabled={disabled} accessibilityRole={accessibilityRole} accessibilityState={{...props.accessibilityState,disabled:disabled||props.accessibilityState?.disabled}} onPress={event=>{void playHaptic(haptic);onPress?.(event)}} style={state=>[
    {minWidth:layout.minTarget,minHeight:layout.minTarget,alignItems:"center",justifyContent:"center"},
    typeof style==="function"?style(state):style,
    state.pressed&&!disabled&&{opacity:.72,transform:[{scale:.98}]},
  ]}/>;
}

export function Screen({children,scroll=true,style,testID,includeTopInset=false}:{children:React.ReactNode;scroll?:boolean;style?:StyleProp<ViewStyle>;testID?:string;includeTopInset?:boolean}) {
  const insets=useSafeAreaInsets(); const {width}=useWindowDimensions(); const {colors:C}=useAppTheme();
  // iOS ScrollView applies the top safe-area inset automatically. Only fixed
  // screens need the inset here; adding it to scrollable screens creates a
  // duplicate blank band above the header.
  const topPadding=!scroll||includeTopInset||Platform.OS!=="ios"?insets.top:0;
  const gutter=width<360?14:width>700?28:layout.gutter;
  const content=<View style={[{width:"100%",maxWidth:layout.maxWidth,alignSelf:"center",paddingHorizontal:gutter,minHeight:"100%",paddingTop:topPadding},style]} testID={testID}>{children}</View>;
  return scroll ? <ScrollView style={{flex:1,backgroundColor:C.paper}} contentContainerStyle={{paddingBottom:110,paddingHorizontal:width>layout.maxWidth?gutter:0}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{content}</ScrollView> : <View style={{flex:1,backgroundColor:C.paper}}>{content}</View>;
}

export function AppHeader({eyebrow,title,back,right}:{eyebrow?:string;title:string;back?:boolean;right?:React.ReactNode}) {
  const theme=useAppTheme(); const {colors:C}=theme; const styles=useMemo(()=>makeStyles(C),[theme.mode,theme.highContrast]);
  return <GlassSurface style={styles.header} intensity={70}>{back?<AccessiblePressable accessibilityLabel="Go back" accessibilityHint="Returns to the previous screen" onPress={()=>router.back()} style={styles.iconButton}><AppIcon sf="chevron.left" fallback={<ArrowLeft size={21} color={C.ink}/>}/></AccessiblePressable>:null}<View style={styles.headerCopy}>{eyebrow?<AppText variant="eyebrow">{eyebrow}</AppText>:null}<AppText accessibilityRole="header" variant="largeTitle" style={styles.headerTitle}>{title}</AppText></View>{right??<View style={{width:44}}/>}</GlassSurface>;
}

export function SectionTitle({eyebrow,title,action,onAction}:{eyebrow:string;title:string;action?:string;onAction?:()=>void}) {
  const theme=useAppTheme(); const {colors:C}=theme; const styles=useMemo(()=>makeStyles(C),[theme.mode,theme.highContrast]);
  return <View style={styles.sectionTitle}><View style={{flexShrink:1}}><AppText variant="eyebrow">{eyebrow}</AppText><AppText accessibilityRole="header" variant="title" style={styles.sectionHeading}>{title}</AppText></View>{action?<AccessiblePressable accessibilityLabel={action} haptic="selection" onPress={onAction} style={styles.sectionActionButton}><AppText variant="caption" style={styles.sectionAction}>{action}</AppText></AccessiblePressable>:null}</View>;
}

export function DealCard({deal,compact=false}:{deal:Deal;compact?:boolean}) {
  const {state,toggleSaved,notify}=useStore(); const theme=useAppTheme(); const {colors:C}=theme; const styles=useMemo(()=>makeStyles(C),[theme.mode,theme.highContrast]); const saved=state.saved.includes(deal.id);
  return <View style={[styles.dealCard,compact&&styles.dealCompact]}>
    <AccessiblePressable testID={`deal-${deal.id}`} accessibilityLabel={`${deal.name}. ${deal.offer}. ${deal.saving}. ${deal.distance}`} accessibilityHint="Opens partner details" onPress={()=>router.push(`/deal/${deal.id}`)} style={[styles.dealLink,compact&&styles.dealLinkCompact]}>
      <View><Image accessible={false} source={{uri:deal.image}} style={[styles.dealImage,compact&&styles.dealImageCompact]}/><View style={styles.distance}><MapPin size={12} color="white"/><AppText variant="caption" style={styles.distanceText}>{deal.distance}</AppText></View></View>
      <View style={styles.dealBody}><AppText variant="eyebrow">{deal.category.toUpperCase()}</AppText><AppText variant="headline" style={styles.dealName}>{deal.name}</AppText><AppText variant="caption" color="muted" numberOfLines={compact?3:2}>{deal.offer}</AppText><View style={styles.dealMeta}><AppText variant="caption" style={styles.saving}>{deal.saving}</AppText><AppText variant="caption" style={styles.rating}><Star size={13} color={C.ink} fill={C.ink}/> {deal.rating}</AppText></View></View>
    </AccessiblePressable>
    <AccessiblePressable accessibilityLabel={saved?`Remove ${deal.name} from saved`:`Save ${deal.name}`} accessibilityState={{selected:saved}} haptic="selection" onPress={()=>{toggleSaved(deal.id);notify(saved?"Removed from saved":"Saved for later")}} style={styles.heart}><AppIcon sf={saved?"heart.fill":"heart"} fallback={<Heart size={19} color={C.ink} fill={saved?C.lime:"transparent"}/>}/></AccessiblePressable>
  </View>;
}

export function ListingRow({item}:{item:DirectoryItem}) {
  const theme=useAppTheme(); const {colors:C}=theme; const styles=useMemo(()=>makeStyles(C),[theme.mode,theme.highContrast]);
  return <AccessiblePressable testID={`listing-${item.id}`} accessibilityLabel={`${item.title}. ${item.subtitle}. ${item.tag}`} accessibilityHint="Opens details" onPress={()=>item.dealId?router.push(`/deal/${item.dealId}`):router.push(`/listing/${item.id}`)} style={styles.listingRow}><Image accessible={false} source={{uri:item.image}} style={styles.listingImage}/><View style={{flex:1}}><AppText variant="eyebrow">{item.type.toUpperCase()}</AppText><AppText variant="headline" style={styles.listingTitle}>{item.title}</AppText><AppText variant="caption" color="muted" numberOfLines={2}>{item.subtitle}</AppText><AppText variant="caption" style={styles.listingTag}>{item.tag}</AppText></View><AppIcon sf="chevron.right" fallback={<ChevronRight size={18} color={C.muted}/>}/></AccessiblePressable>;
}

export function PrimaryButton({label,onPress,disabled=false,testID,loading=false}:{label:string;onPress:()=>void;disabled?:boolean;testID?:string;loading?:boolean}) { const theme=useAppTheme(); const {colors:C}=theme;const styles=useMemo(()=>makeStyles(C),[theme.mode,theme.highContrast]);return <AccessiblePressable testID={testID} disabled={disabled||loading} accessibilityLabel={label} accessibilityState={{disabled:disabled||loading,busy:loading}} haptic="light" onPress={onPress} style={[styles.primary,(disabled||loading)&&styles.disabled]}><AppText variant="callout" style={styles.primaryText}>{loading?"Working…":label}</AppText><AppIcon sf="chevron.right" color={C.onDark} fallback={<ChevronRight size={18} color={C.onDark}/>}/></AccessiblePressable>; }
export function Empty({icon="♡",title,body}:{icon?:string;title:string;body:string}) { const theme=useAppTheme(); const {colors:C}=theme;const styles=useMemo(()=>makeStyles(C),[theme.mode,theme.highContrast]);return <View style={styles.empty} accessibilityRole="summary"><AppText style={styles.emptyIcon}>{icon}</AppText><AppText variant="title" style={styles.emptyTitle}>{title}</AppText><AppText variant="body" color="muted" style={styles.emptyBody}>{body}</AppText></View>; }
export function Toast() { const {toast}=useStore();const theme=useAppTheme(); const {colors:C}=theme;const styles=useMemo(()=>makeStyles(C),[theme.mode,theme.highContrast]);useEffect(()=>{if(toast)AccessibilityInfo.announceForAccessibility(toast)},[toast]); if(!toast)return null; return <View pointerEvents="none" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}><Text style={styles.toastDot}>●</Text><AppText variant="callout" style={styles.toastText}>{toast}</AppText></View>; }
export const Txt=({children,style}:{children:React.ReactNode;style?:StyleProp<TextStyle>})=><AppText style={style}>{children}</AppText>;

const makeStyles=(C:ThemeColors)=>StyleSheet.create({
  header:{minHeight:72,flexDirection:"row",alignItems:"center",gap:12,marginBottom:18,borderRadius:24,paddingHorizontal:10,borderWidth:1,borderColor:C.line,overflow:"hidden"},headerCopy:{flex:1,paddingVertical:8},iconButton:{width:44,height:44,borderRadius:15,backgroundColor:C.glass,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:C.line},headerTitle:{letterSpacing:-1.1},
  sectionTitle:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-end",marginTop:30,marginBottom:14,gap:10},sectionHeading:{letterSpacing:-.5,marginTop:3},sectionActionButton:{minHeight:44,paddingHorizontal:2},sectionAction:{backgroundColor:C.soft,paddingHorizontal:12,paddingVertical:8,borderRadius:20,overflow:"hidden"},
  dealCard:{width:255,borderRadius:22,backgroundColor:C.card,borderWidth:1,borderColor:C.line,overflow:"hidden",...shadow},dealCompact:{width:"100%",marginBottom:12},dealLink:{width:"100%",alignItems:"stretch"},dealLinkCompact:{flexDirection:"row"},dealImage:{width:"100%",height:145},dealImageCompact:{width:112,height:154},distance:{position:"absolute",left:10,top:10,backgroundColor:"rgba(10,10,10,.75)",borderRadius:12,paddingHorizontal:8,paddingVertical:6,flexDirection:"row",alignItems:"center",gap:4},distanceText:{color:"white",fontFamily:F.bodyBold},heart:{position:"absolute",right:8,top:8,width:44,height:44,borderRadius:15,backgroundColor:C.glassSolid,borderWidth:1,borderColor:C.line},
  dealBody:{padding:14,flex:1,alignSelf:"stretch"},dealName:{marginTop:4},dealMeta:{marginTop:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},saving:{fontFamily:F.bodyBold,backgroundColor:C.soft,paddingHorizontal:8,paddingVertical:6,borderRadius:9,overflow:"hidden"},rating:{fontFamily:F.bodyBold,flexDirection:"row"},
  listingRow:{minHeight:116,flexDirection:"row",alignItems:"center",gap:12,backgroundColor:C.card,borderRadius:21,padding:11,marginBottom:10,borderWidth:1,borderColor:C.line,...shadow},listingImage:{width:82,height:88,borderRadius:16},listingTitle:{marginVertical:3},listingTag:{fontFamily:F.bodyBold,marginTop:7},
  primary:{minHeight:54,borderRadius:17,backgroundColor:C.ink,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,paddingHorizontal:18,...shadow},primaryText:{fontFamily:F.bodyBold,color:C.paper},disabled:{opacity:.48},
  empty:{alignItems:"center",paddingVertical:68,paddingHorizontal:24},emptyIcon:{width:64,height:64,textAlign:"center",textAlignVertical:"center",fontSize:30,backgroundColor:C.soft,borderRadius:21,overflow:"hidden"},emptyTitle:{marginTop:17,textAlign:"center"},emptyBody:{textAlign:"center",marginTop:7},
  toast:{position:"absolute",zIndex:100,bottom:92,alignSelf:"center",left:28,right:28,minHeight:52,borderRadius:17,backgroundColor:C.elevated,flexDirection:"row",alignItems:"center",justifyContent:"center",paddingHorizontal:16,gap:8,borderWidth:1,borderColor:C.line,...shadow},toastDot:{color:C.lime},toastText:{color:C.ink,fontFamily:F.bodyBold},
});

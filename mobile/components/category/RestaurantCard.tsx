import ScalePressable from '@/components/ScalePressable';
import { MapPin } from 'lucide-react-native';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Typography } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerSubtleHaptic } from '../../utils/haptics';
import { RemoteImage } from '../RemoteImage';

type Props = {
  id: string; name: string; imageUri?: string; logoUri?: string; onPress?: () => void;
  style?: StyleProp<ViewStyle>; loading?: boolean; contentStyle?: StyleProp<ViewStyle>; imageHeight?: number; logoBottom?: number; logoSize?: number; borderColor?: string;
  nameStyle?: StyleProp<TextStyle>; distance?: string; distanceStyle?: StyleProp<TextStyle>;
  xcardEnabled?: boolean; distanceOnImage?: boolean; overlapLogo?: boolean;
  offerCard?: boolean; discountLabel?: string; badgeLabel?: string;
  titleCaseName?: boolean;
};

export default function RestaurantCard({ name, imageUri, logoUri, onPress, style, loading = false,
  contentStyle, imageHeight = 120, logoBottom = -22, logoSize = 64, borderColor, nameStyle, distance, distanceStyle, xcardEnabled = false, offerCard = false, discountLabel, badgeLabel,
  distanceOnImage = true, overlapLogo = true, titleCaseName = false }: Props) {
  const { theme } = useAppTheme();
  const cardBorderColor = borderColor ?? theme.border;
  const displayName = titleCaseName ? name.toLowerCase().replace(/(^|\s)\S/g, letter => letter.toUpperCase()) : name;
  const offer = discountLabel;
  const label = badgeLabel?.trim();
  const accessibleName = [displayName, offerCard ? offer : undefined, !offerCard ? label : undefined, distance, !offerCard && xcardEnabled ? '5% cashback' : undefined].filter(Boolean).join('. ');
  return <ScalePressable
    style={[styles.container, { backgroundColor: theme.background, borderColor: cardBorderColor }, style]}
    onPress={() => { if (!loading) { triggerSubtleHaptic(); onPress?.(); } }}
    disabled={loading} accessibilityRole="button" accessibilityLabel={accessibleName}
    accessibilityHint={onPress ? 'Opens vendor details' : undefined} accessibilityState={{ disabled: loading }}>
    <View style={[styles.imageContainer, { height: imageHeight }]}>
      {loading ? <View style={styles.imagePlaceholder} /> : imageUri ? <RemoteImage source={{ uri: imageUri }} style={StyleSheet.absoluteFill} imageStyle={styles.image} contentFit="cover" /> : <View style={styles.imagePlaceholder}><Text style={styles.placeholderEmoji}>🏪</Text></View>}
      {offerCard ? offer ? <View style={styles.offerBadge}><Text numberOfLines={1} style={styles.offerBadgeText}>{offer}</Text></View> : null : (label || xcardEnabled) ? <View style={styles.pills}>
        {label ? <Text numberOfLines={1} style={styles.cardLabelPill}>{label}</Text> : null}
        {xcardEnabled ? <Text style={styles.cashbackPill}>5% CASHBACK!</Text> : null}
      </View> : null}
      {distanceOnImage && distance ? <View style={styles.distanceBadge}><MapPin size={13} color="#FFFFFF"/><Text style={[styles.distance, distanceStyle]}>{distance}</Text></View> : null}
      {overlapLogo ? <View style={[styles.logoFrame, { backgroundColor: theme.background, borderColor: cardBorderColor, bottom: logoBottom, width: logoSize, height: logoSize, borderRadius: logoSize * 0.25 }]}>
        {loading ? <View style={styles.logoImage} /> : logoUri ? <RemoteImage source={{ uri: logoUri }} style={styles.logoImage} imageStyle={styles.logoImageFill} contentFit="cover" /> : <Text style={[styles.logoEmoji, { color: theme.text }]}>🏪</Text>}
      </View> : null}
    </View>
    {offerCard && !overlapLogo ? <View style={styles.offerContent}>
      <View style={[styles.offerLogo, { backgroundColor: theme.background, borderColor: cardBorderColor }]}>
        {loading ? <View style={styles.logoImage} /> : logoUri ? <RemoteImage source={{ uri: logoUri }} style={styles.logoImage} imageStyle={styles.logoImageFill} contentFit="cover" /> : <Text style={[styles.logoEmoji, { color: theme.text }]}>🏪</Text>}
      </View>
      <View style={styles.offerCopy}>
        <Text allowFontScaling numberOfLines={1} style={[styles.offerName, { color: theme.text, ...Typography.getTextVariantStyle('bodyStrong'), writingDirection: 'ltr' }, nameStyle]}>{displayName}</Text>
        {distance ? <View style={styles.offerDistance}><MapPin size={14} color={theme.mutedText}/><Text style={styles.offerDistanceText}>{distance}</Text></View> : null}
      </View>
    </View> : <View style={[styles.content, contentStyle, !overlapLogo && { paddingRight: 12 }]}>
      {!overlapLogo && <View style={[styles.logoInline, { backgroundColor: theme.background, borderColor: cardBorderColor }]}>
        {loading ? <View style={styles.logoImage} /> : logoUri ? <RemoteImage source={{ uri: logoUri }} style={styles.logoImage} imageStyle={styles.logoImageFill} contentFit="cover" /> : <Text style={[styles.logoEmoji, { color: theme.text }]}>🏪</Text>}
      </View>}
      <Text allowFontScaling numberOfLines={1} style={[styles.name, { color: theme.text, ...Typography.getTextVariantStyle('bodyStrong'), writingDirection: 'ltr' }, nameStyle]}>{displayName}</Text>
      {!distanceOnImage && distance ? <View style={styles.distanceRow}><MapPin size={14} color={theme.mutedText}/><Text style={[styles.distanceText, distanceStyle]}>{distance}</Text></View> : null}
      {loading ? <View style={styles.loadingText} /> : null}
    </View>}
  </ScalePressable>;
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#FFFFFF', borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  imageContainer: { width: '100%', height: 120, overflow: 'visible' },
  imagePlaceholder: { width: '100%', height: '100%', backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center' },
  placeholderEmoji: { fontSize: 40, opacity: 0.3 },
  image: { width: '100%', height: '100%' },
  pills: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6, maxWidth: '85%' },
  cardLabelPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#F39A00', color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  cashbackPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: '#6E45D5', color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  offerBadge: { position: 'absolute', top: 10, left: 10, maxWidth: '82%', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: Colors.brandGreen },
  offerBadgeText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  distanceBadge: { position: 'absolute', top: 10, right: 10, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(20,20,20,0.72)', flexDirection: 'row', alignItems: 'center', gap: 4 },
  distance: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  logoFrame: { position: 'absolute', right: 12, bottom: -22, zIndex: 3, width: 64, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  logoInline: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  logoImageFill: { width: '110%', height: '110%', left: '-5%', top: '-5%' },
  logoEmoji: { fontSize: 20, alignSelf: 'center', marginTop: 12 },
  content: { minHeight: 76, justifyContent: 'center', paddingVertical: 10, paddingLeft: 12, paddingRight: 88, backgroundColor: '#FFFFFF' },
  offerContent: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  offerLogo: { width: 54, height: 54, borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  offerCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  offerName: { fontSize: 18, lineHeight: 22, fontWeight: '700' },
  offerDistance: { marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 },
  offerDistanceText: { color: '#444444', fontSize: 14, lineHeight: 18, fontWeight: '600' },
  name: { minWidth: 0, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  distanceRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceText: { color: '#444444', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  loadingText: { width: '72%', height: 14, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.1)' },
});

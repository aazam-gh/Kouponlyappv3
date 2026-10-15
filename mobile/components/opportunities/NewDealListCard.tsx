import ScalePressable from '@/components/ScalePressable';
import { RemoteImage } from '@/components/RemoteImage';
import { Typography } from '@/constants/Typography';
import { useAppTheme } from '@/context/AppThemeContext';
import { triggerSubtleHaptic } from '@/utils/haptics';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  imageUri?: string;
  logoUri?: string;
  onPress?: () => void;
};

export default function NewDealListCard({ name, imageUri, logoUri, onPress }: Props) {
  const { theme } = useAppTheme();

  return (
    <ScalePressable
      style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]}
      onPress={() => { triggerSubtleHaptic(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={onPress ? 'Opens vendor details' : undefined}
    >
      <View style={styles.imageContainer}>
        <RemoteImage source={imageUri ? { uri: imageUri } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[styles.logoFrame, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <RemoteImage source={logoUri ? { uri: logoUri } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      </View>
      <View style={styles.content}>
        <Text
          allowFontScaling
          numberOfLines={1}
          style={[styles.name, { color: theme.text, ...Typography.getTextVariantStyle('bodyStrong'), writingDirection: 'ltr' }]}
        >
          {name}
        </Text>
      </View>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 136,
    overflow: 'visible',
  },
  logoFrame: {
    position: 'absolute',
    right: 12,
    bottom: -40,
    zIndex: 3,
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  content: {
    minHeight: 56,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 100,
    backgroundColor: '#FFFFFF',
  },
  name: {
    minWidth: 0,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
});

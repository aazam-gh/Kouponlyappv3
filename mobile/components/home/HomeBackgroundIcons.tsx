import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAppTheme } from '../../context/AppThemeContext';

type BackgroundIcon = {
  name: keyof typeof Ionicons.glyphMap;
  top: number;
  left: number;
  size: number;
  rotation: string;
};

// This echoes the onboarding illustration system while keeping Home's offers
// and category artwork as the primary visual focus. Home content is denser
// than onboarding, so the ornaments use the same readable opacity as the
// onboarding field instead of disappearing against white cards.
const homeBackgroundIcons: BackgroundIcon[] = [
  { name: 'fast-food-outline', top: 0.03, left: 0.01, size: 31, rotation: '-14deg' },
  { name: 'pizza-outline', top: 0.06, left: 0.92, size: 34, rotation: '18deg' },
  { name: 'sparkles-outline', top: 0.10, left: 0.02, size: 28, rotation: '8deg' },
  { name: 'cafe-outline', top: 0.14, left: 0.93, size: 29, rotation: '-8deg' },
  { name: 'ice-cream-outline', top: 0.19, left: 0.01, size: 31, rotation: '10deg' },
  { name: 'pricetag-outline', top: 0.22, left: 0.91, size: 31, rotation: '12deg' },
  { name: 'ticket-outline', top: 0.27, left: 0.02, size: 34, rotation: '-16deg' },
  { name: 'musical-notes-outline', top: 0.32, left: 0.92, size: 31, rotation: '-8deg' },
  { name: 'game-controller-outline', top: 0.37, left: 0.01, size: 32, rotation: '8deg' },
  { name: 'film-outline', top: 0.42, left: 0.92, size: 30, rotation: '15deg' },
  { name: 'camera-outline', top: 0.46, left: 0.01, size: 29, rotation: '10deg' },
  { name: 'color-palette-outline', top: 0.51, left: 0.91, size: 31, rotation: '-12deg' },
  { name: 'heart-outline', top: 0.56, left: 0.01, size: 29, rotation: '-10deg' },
  { name: 'book-outline', top: 0.61, left: 0.92, size: 31, rotation: '-10deg' },
  { name: 'school-outline', top: 0.66, left: 0.01, size: 34, rotation: '8deg' },
  { name: 'map-outline', top: 0.71, left: 0.91, size: 31, rotation: '12deg' },
  { name: 'cash-outline', top: 0.76, left: 0.01, size: 31, rotation: '-10deg' },
  { name: 'gift-outline', top: 0.81, left: 0.91, size: 31, rotation: '8deg' },
  { name: 'cart-outline', top: 0.86, left: 0.01, size: 33, rotation: '-10deg' },
  { name: 'bag-handle-outline', top: 0.91, left: 0.91, size: 30, rotation: '12deg' },
  { name: 'shirt-outline', top: 0.96, left: 0.01, size: 30, rotation: '-12deg' },
];

export default function HomeBackgroundIcons() {
  const { height, width } = useWindowDimensions();
  const { isDark, theme } = useAppTheme();
  const canvasHeight = Math.max(height, 2200);

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.container, { height: canvasHeight, width }]}
    >
      {homeBackgroundIcons.map((icon, index) => (
        <View
          key={`${String(icon.name)}-${index}`}
          style={[
            styles.icon,
            {
              top: canvasHeight * icon.top,
              left: width * icon.left,
              opacity: isDark ? 0.34 : 0.30,
              transform: [{ rotate: icon.rotation }],
            },
          ]}
        >
          <Ionicons color={theme.brand} name={icon.name} size={icon.size} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  icon: {
    position: 'absolute',
  },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppLocale } from '../../context/LocaleContext';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerSubtleHaptic } from '../../utils/haptics';
import { TabBarVisibilityProvider } from '../TabBarScrollVisibility';

export default function TabNavigator() {
  return <TabBarVisibilityProvider><TabContent /></TabBarVisibilityProvider>;
}

function TabContent() {
  const { t } = useTranslation();
  const { isDark, theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  const insets = useSafeAreaInsets();
  const screens = [
    { name: 'index', title: t('home'), icon: 'home', outlineIcon: 'home-outline' },
    { name: 'explore', title: t('explore'), icon: 'compass', outlineIcon: 'compass-outline' },
    { name: 'profile', title: t('profile'), icon: 'person', outlineIcon: 'person-outline' },
  ];

  return <Tabs
    safeAreaInsets={{ top: 0, right: insets.right, bottom: insets.bottom, left: insets.left }}
    screenListeners={{ tabPress: () => requestAnimationFrame(triggerSubtleHaptic) }}
    screenOptions={{
      tabBarActiveTintColor: theme.brand,
      tabBarInactiveTintColor: theme.iconMuted,
      tabBarStyle: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        display: 'flex',
        backgroundColor: theme.surface,
        height: 64 + insets.bottom,
        paddingTop: 4,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: 8,
        boxShadow: isDark ? '0 -2px 8px rgba(0,0,0,0.28)' : '0 -2px 8px rgba(15,37,23,0.10)',
        borderTopColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 37, 23, 0.10)',
        borderTopWidth: StyleSheet.hairlineWidth,
      },
      tabBarHideOnKeyboard: false,
      tabBarLabelStyle: styles.label,
      tabBarItemStyle: styles.item,
      tabBarActiveBackgroundColor: 'transparent',
      tabBarInactiveBackgroundColor: 'transparent',
    }}
  >
    {(isRTL ? [...screens].reverse() : screens).map(screen => (
      <Tabs.Screen key={screen.name} name={screen.name} options={{
        title: screen.title,
        headerShown: false,
        tabBarIcon: ({ focused, color }) => <Ionicons name={(focused ? screen.icon : screen.outlineIcon) as any} size={24} color={color} />,
      }} />
    ))}
    <Tabs.Screen name="map" options={{ href: null, headerShown: false, tabBarItemStyle: styles.hidden }} />
    <Tabs.Screen name="search" options={{ href: null, headerShown: false, tabBarItemStyle: styles.hidden }} />
    <Tabs.Screen name="me" options={{ href: null, headerShown: false, tabBarItemStyle: styles.hidden }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  item: { flex: 1, marginHorizontal: 4, marginVertical: 2, borderRadius: 22 },
  label: { fontSize: 11, fontWeight: '600', lineHeight: 14, marginTop: 1 },
  hidden: { display: 'none' },
});

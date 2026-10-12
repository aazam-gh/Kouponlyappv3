import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '../../context/LocaleContext';
import { useAppTheme } from '../../context/AppThemeContext';
import { TabBarVisibilityProvider } from '../TabBarScrollVisibility';

export default function TabNavigator() {
  return <TabBarVisibilityProvider><NativeTabContent /></TabBarVisibilityProvider>;
}

function NativeTabContent() {
  const { t } = useTranslation();
  const { theme } = useAppTheme();
  const { isRTL } = useAppLocale();
  const screens = [
    { name: 'index', title: t('home'), icon: 'house' },
    { name: 'explore', title: t('explore'), icon: 'safari.fill' },
    { name: 'saved', title: t('saved'), icon: 'bookmark.fill' },
    { name: 'profile', title: t('profile'), icon: 'person.fill' },
  ];

  return <NativeTabs tintColor={theme.brand} minimizeBehavior="never">
    {(isRTL ? [...screens].reverse() : screens).map(screen => (
      <NativeTabs.Trigger key={screen.name} name={screen.name}>
        <NativeTabs.Trigger.Label>{screen.title}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={screen.icon as any} />
      </NativeTabs.Trigger>
    ))}
    <NativeTabs.Trigger name="map" hidden />
  </NativeTabs>;
}

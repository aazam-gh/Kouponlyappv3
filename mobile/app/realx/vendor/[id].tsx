import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { CatalogueNotice, useCatalogue } from '@/lib/catalogue';
import { deals } from '@/lib/data';
import DealDetail from '@/app/deal/[id]';
import { useAppTheme } from '@/lib/theme';
import { StateSurface } from '@/components/StateSurface';

export default function VendorRoute() {
  const { id } = useLocalSearchParams<{ id: string; offer?: string }>();
  const { status } = useCatalogue();
  const { colors } = useAppTheme();
  const deal = deals.find(item => item.vendorId === String(id));

  if (deal) return <DealDetail dealId={String(deal.id)} />;
  if (/^\d+$/.test(String(id || ''))) return <Redirect href={{ pathname: '/deal/[id]', params: { id: String(id) } }} />;
  if (status === 'loading') return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.lime} /></View>;
  if (status === 'offline') return <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}><CatalogueNotice /></View>;
  return <StateSurface kind="not-found" title="Partner unavailable" message="This vendor is no longer available. Return to Home to keep browsing." />;
}

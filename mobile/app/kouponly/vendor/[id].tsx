import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { fetchVendorDeal } from '@/lib/backend';
import { useCatalogue } from '@/lib/catalogue';
import { deals } from '@/lib/data';
import DealDetail from '@/app/deal/[id]';
import { StateSurface } from '@/components/StateSurface';

function VendorFromCloud({ id }: { id: string }) {
  const vendor = useQuery({
    queryKey: ['vendor-detail', id],
    queryFn: () => fetchVendorDeal(id),
    staleTime: 0,
    refetchOnMount: true,
  });
  if (vendor.data) return <DealDetail loadedDeal={vendor.data} />;
  if (vendor.isPending) return <StateSurface kind="loading" />;
  if (vendor.isError) return <StateSurface kind="error" onRetry={() => void vendor.refetch()} />;
  return <StateSurface kind="not-found" title="Partner unavailable" message="This vendor is no longer available. Return to Home to keep browsing." />;
}

export default function VendorRoute() {
  const { id } = useLocalSearchParams<{ id: string; offer?: string }>();
  useCatalogue(false);
  const deal = deals.find(item => item.vendorId === String(id));
  if (deal) return <DealDetail loadedDeal={deal} />;
  if (/^\d+$/.test(String(id || ''))) return <Redirect href={{ pathname: '/deal/[id]', params: { id: String(id) } }} />;
  return id ? <VendorFromCloud id={String(id)} /> : <StateSurface kind="not-found" title="Partner unavailable" />;
}

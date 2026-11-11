import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Linking, StyleSheet, useWindowDimensions } from 'react-native';
import ScalePressable from '@/components/ScalePressable';
import { getPublicSupabase } from '@/lib/supabase';
import { safeWebUrl } from '@/lib/vendor-links';
import { recordCmsClick } from '@/lib/cms-clicks';
import { queryKeys } from '@/utils/queryClient';

type LaunchPoster = { imageUrl: string; destinationType: 'vendor' | 'external'; vendorId: string; externalUrl: string };

function readPoster(payload: unknown): LaunchPoster | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (value.active !== true) return null;
  if (typeof value.imageUrl !== 'string') return null;
  try {
    const image = new URL(value.imageUrl);
    if (image.protocol !== 'https:' && image.protocol !== 'http:') return null;
  } catch { return null; }
  const destinationType = value.destinationType === 'external' ? 'external' : 'vendor';
  const vendorId = typeof value.vendorId === 'string' ? value.vendorId.trim() : '';
  const externalUrl = safeWebUrl(typeof value.externalUrl === 'string' ? value.externalUrl : '');
  if (destinationType === 'vendor' && !vendorId || destinationType === 'external' && !externalUrl) return null;
  return { imageUrl: value.imageUrl, destinationType, vendorId, externalUrl: externalUrl || '' };
}

async function fetchLaunchPromotion() {
  const { data, error } = await getPublicSupabase()
    .from('kouponly_cms_documents').select('payload').eq('id', 'appLaunchPoster').maybeSingle();
  if (error) throw error;
  return readPoster(data?.payload);
}

export default function HomeLaunchPromotion() {
  const { data: poster } = useQuery({
    queryKey: queryKeys.cmsDocument('appLaunchPoster'),
    queryFn: fetchLaunchPromotion,
  });
  const { width } = useWindowDimensions();
  if (!poster) return null;

  const open = () => {
    void recordCmsClick('appLaunchPoster', 'appLaunchPoster').catch(() => {});
    if (poster.destinationType === 'vendor') router.push({ pathname: '/kouponly/vendor/[id]', params: { id: poster.vendorId } });
    else void Linking.openURL(poster.externalUrl).catch(() => {});
  };

  return <ScalePressable
    accessibilityRole="button"
    accessibilityLabel="Featured promotion"
    onPress={open}
    style={[styles.card, { height: Math.min(width - 40, 340) }]}
  >
    <Image source={{ uri: poster.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" priority="low" />
  </ScalePressable>;
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginVertical: 12, borderRadius: 18, overflow: 'hidden' },
});

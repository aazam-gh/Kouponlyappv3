import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { X } from 'lucide-react-native';
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

export default function HomeLaunchPromotion({ enabled }: { enabled: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [imageRatio, setImageRatio] = useState(1);
  const { data: poster } = useQuery({
    queryKey: queryKeys.cmsDocument('appLaunchPoster'),
    queryFn: fetchLaunchPromotion,
    enabled: enabled && !dismissed,
  });
  const { width, height } = useWindowDimensions();
  if (!enabled || dismissed || !poster) return null;

  const dismiss = () => setDismissed(true);
  const open = () => {
    dismiss();
    void recordCmsClick('appLaunchPoster', 'appLaunchPoster').catch(() => {});
    if (poster.destinationType === 'vendor') router.push({ pathname: '/kouponly/vendor/[id]', params: { id: poster.vendorId } });
    else void Linking.openURL(poster.externalUrl).catch(() => {});
  };

  const posterWidth = Math.min(width - 40, 440, height * 0.78 * imageRatio, 680 * imageRatio);
  return <Modal transparent animationType="fade" onRequestClose={dismiss}>
    <View style={styles.backdrop} accessibilityViewIsModal>
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={dismiss} />
      <View style={[styles.frame, { width: posterWidth, height: posterWidth / imageRatio }]}>
        <ScalePressable accessibilityLabel="Featured promotion" onPress={open} style={styles.poster}>
          <Image source={{ uri: poster.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain"
            onLoad={({ source }) => { if (source.width > 0 && source.height > 0) setImageRatio(source.width / source.height); }} />
        </ScalePressable>
        <ScalePressable accessibilityLabel="Close poster" onPress={dismiss} style={styles.close}>
          <X color="#fff" size={22} />
        </ScalePressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center' },
  frame: { borderRadius: 24, overflow: 'hidden' },
  poster: { flex: 1 },
  close: { position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
});

import React from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { getSupabase } from '@/lib/supabase';
import { safeWebUrl } from '@/lib/vendor-links';
import { recordCmsClick } from '@/lib/cms-clicks';

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

export default function AppLaunchPosterModal({ userId, enabled }: { userId: string | null; enabled: boolean }) {
  const [poster, setPoster] = React.useState<LaunchPoster | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
  const [imageRatio, setImageRatio] = React.useState(1);
  const checked = React.useRef(false);
  const { width, height } = useWindowDimensions();

  React.useEffect(() => {
    if (!userId || checked.current) return;
    checked.current = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('realx_cms_documents')
          .select('payload')
          .eq('id', 'appLaunchPoster')
          .maybeSingle();
        if (error) throw error;
        setPoster(readPoster(data?.payload));
      } catch (error) {
        console.warn('Unable to load app launch poster:', error);
      }
    })();
  }, [userId]);

  const dismiss = () => setDismissed(true);
  const maxWidth = Math.min(width - 40, 440);
  const maxHeight = Math.min(height * 0.78, 680);
  const posterWidth = Math.min(maxWidth, maxHeight * imageRatio);
  const posterHeight = posterWidth / imageRatio;

  return <Modal transparent animationType="fade" visible={enabled && !!userId && !!poster && !dismissed} onRequestClose={dismiss}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss poster" onPress={dismiss} />
      <View style={[styles.posterFrame, { width: posterWidth, height: posterHeight }]}>
        {poster && <Pressable accessibilityRole="button" accessibilityLabel={poster.destinationType === 'vendor' ? 'Open featured vendor' : 'Open featured website'} style={styles.posterPressable} onPress={() => {
          dismiss();
          void recordCmsClick('appLaunchPoster', 'appLaunchPoster').catch(error => console.warn('Unable to record poster click:', error)).finally(() => {
            if (poster.destinationType === 'vendor') router.push(`/realx/vendor/${encodeURIComponent(poster.vendorId)}` as never);
            else if (poster.externalUrl) void Linking.openURL(poster.externalUrl).catch(error => console.warn('Unable to open poster link:', error));
          });
        }}>
          <Image source={{ uri: poster.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" onLoad={({ source }) => { if (source.width > 0 && source.height > 0) setImageRatio(source.width / source.height); }} accessibilityLabel="Featured promotion" />
        </Pressable>}
        <Pressable style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close poster" hitSlop={12} onPress={dismiss}>
          <X color="#fff" size={22} />
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  posterFrame: { overflow: 'hidden', borderRadius: 24, backgroundColor: 'transparent' },
  posterPressable: { flex: 1 },
  closeButton: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
});

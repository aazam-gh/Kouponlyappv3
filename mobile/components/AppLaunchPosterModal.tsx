import React from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { router } from 'expo-router';
import { getSupabase } from '@/lib/supabase';

type LaunchPoster = { imageUrl: string; vendorId: string };

function readPoster(payload: unknown): LaunchPoster | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (value.active !== true || typeof value.vendorId !== 'string' || !value.vendorId.trim()) return null;
  if (typeof value.imageUrl !== 'string') return null;
  try {
    const image = new URL(value.imageUrl);
    if (image.protocol !== 'https:' && image.protocol !== 'http:') return null;
  } catch { return null; }
  return { imageUrl: value.imageUrl, vendorId: value.vendorId };
}

export default function AppLaunchPosterModal({ userId, enabled }: { userId: string | null; enabled: boolean }) {
  const [poster, setPoster] = React.useState<LaunchPoster | null>(null);
  const [dismissed, setDismissed] = React.useState(false);
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
  const posterWidth = Math.min(width - 40, 440);
  const posterHeight = Math.min(height * 0.78, 680);

  return <Modal transparent animationType="fade" visible={enabled && !!userId && !!poster && !dismissed} onRequestClose={dismiss}>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss poster" onPress={dismiss} />
      <View style={[styles.posterFrame, { width: posterWidth, height: posterHeight }]}>
        {poster && <Pressable accessibilityRole="button" accessibilityLabel="Open featured vendor" style={styles.posterPressable} onPress={() => { dismiss(); router.push(`/realx/vendor/${poster.vendorId}` as never); }}>
          <Image source={{ uri: poster.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityLabel="Featured promotion" />
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
  posterFrame: { overflow: 'hidden', borderRadius: 24, backgroundColor: '#111', elevation: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  posterPressable: { flex: 1 },
  closeButton: { position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageProps, type ImageSource } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { useAppTheme } from '../context/AppThemeContext';

type RemoteImageProps = Omit<ImageProps, 'source' | 'style'> & {
  source?: ImageSource | string | number | null;
  style?: StyleProp<ImageStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
};

const MAX_AUTOMATIC_RETRIES = 1;

export function RemoteImage({ source, style, imageStyle, fallbackIcon = 'image-outline', ...props }: RemoteImageProps) {
  const { theme } = useAppTheme();
  const hasSource = Boolean(source);
  const sourceKey = useMemo(() => {
    if (typeof source === 'string' || typeof source === 'number') return String(source);
    if (source && typeof source === 'object' && 'uri' in source) return source.uri || '';
    return JSON.stringify(source ?? null);
  }, [source]);
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(hasSource);
  const [hasFailed, setHasFailed] = useState(!hasSource);

  useEffect(() => {
    setRetryCount(0);
    setIsLoading(hasSource);
    setHasFailed(!hasSource);
  }, [hasSource, sourceKey]);

  if (!source || hasFailed) {
    return (
      <View style={[styles.fallback, style]}>
        <Ionicons name={fallbackIcon} size={24} color={theme.iconMuted} />
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, style]}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]} pointerEvents="none">
          <ActivityIndicator size="small" color={theme.subtleText} />
        </View>
      )}
      <Image
        {...props}
        key={`${sourceKey}:${retryCount}`}
        source={source}
        style={[StyleSheet.absoluteFill, imageStyle]}
        cachePolicy={props.cachePolicy ?? 'memory-disk'}
        transition={props.transition ?? 180}
        onLoadStart={() => {
          setIsLoading(true);
          props.onLoadStart?.();
        }}
        onLoad={(event) => {
          setIsLoading(false);
          setHasFailed(false);
          props.onLoad?.(event);
        }}
        onError={(event) => {
          if (retryCount < MAX_AUTOMATIC_RETRIES) {
            setRetryCount((current) => current + 1);
            setIsLoading(true);
          } else {
            setIsLoading(false);
            setHasFailed(true);
          }
          props.onError?.(event);
        }}
        onLoadEnd={props.onLoadEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  loadingOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

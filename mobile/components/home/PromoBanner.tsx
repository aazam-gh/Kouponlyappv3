import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, ScrollView, StyleSheet, useWindowDimensions, View, type AlertButton } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { triggerSubtleHaptic } from '../../utils/haptics';
import { fetchBannerVendorNames, type HomeBannerItem } from '../../utils/homeQueries';
import { logger } from '../../utils/logger';
import { HOME_HORIZONTAL_GUTTER } from './layout';
import { recordCmsClick } from '@/lib/cms-clicks';

const BANNER_HEIGHT = 240;
const BANNER_RADIUS = 30;
const BANNER_SIDE_PADDING = HOME_HORIZONTAL_GUTTER;
const BANNER_GAP = BANNER_SIDE_PADDING;
const BANNER_AUTO_SCROLL_MS = 4000;

export type BannerItem = HomeBannerItem;

type PromoBannerProps = {
    banners: BannerItem[];
    onBannerPress?: (banner: BannerItem) => void;
    onFirstImageDisplay?: () => void;
};

export default function PromoBanner({ banners, onBannerPress, onFirstImageDisplay }: PromoBannerProps) {
    const { reduceMotion } = useMotionPreferences();
    const firstSlide = banners.length > 1 ? 1 : 0;
    const [visibleSlide, setVisibleSlide] = useState(firstSlide);
    const [firstImageReady, setFirstImageReady] = useState(false);
    const [choosing, setChoosing] = useState(false);
    const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
    const currentIndexRef = useRef(1);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const isUserInteractingRef = useRef(false);
    const { width: screenWidth } = useWindowDimensions();
    const router = useRouter();
    const bannerWidth = screenWidth - (BANNER_SIDE_PADDING * 2);
    const bannerScrollInterval = bannerWidth + BANNER_GAP;
    const loopItems = banners.length > 1 ? [banners[banners.length - 1], ...banners, banners[0]] : banners;

    useEffect(() => {
        if (reduceMotion || banners.length <= 1) {
            return;
        }

        const interval = setInterval(() => {
            if (isUserInteractingRef.current) {
                return;
            }

            const nextIndex = currentIndexRef.current + 1;
            currentIndexRef.current = nextIndex;
            setVisibleSlide(nextIndex);
            scrollViewRef.current?.scrollTo({ x: nextIndex * bannerScrollInterval, animated: true });
        }, BANNER_AUTO_SCROLL_MS);

        return () => clearInterval(interval);
    }, [banners.length, bannerScrollInterval, reduceMotion]);

    useEffect(() => {
        currentIndexRef.current = firstSlide;
        setVisibleSlide(firstSlide);
        scrollViewRef.current?.scrollTo({ x: currentIndexRef.current * bannerScrollInterval, animated: false });
    }, [bannerScrollInterval, firstSlide, banners.length]);

    const handleScrollBegin = () => {
        isUserInteractingRef.current = true;
    };

    const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (banners.length <= 1) {
            isUserInteractingRef.current = false;
            return;
        }

        const index = Math.round(event.nativeEvent.contentOffset.x / bannerScrollInterval);
        const next = index === 0 ? banners.length : index >= banners.length + 1 ? 1 : index;
        currentIndexRef.current = next;
        setVisibleSlide(next);
        if (next !== index) scrollViewRef.current?.scrollTo({ x: next * bannerScrollInterval, animated: false });
        isUserInteractingRef.current = false;
    };

    const handlePress = async (banner: BannerItem) => {
        if (choosing) return;
        const vendorIds = [...new Set((Array.isArray(banner.vendorIds) && banner.vendorIds.length ? banner.vendorIds : [banner.vendorId || banner.id])
            .flatMap(id => typeof id === 'string' && id.trim() ? [id.trim()] : []))];
        if (!vendorIds.length) {
            logger.warn('Promo banner is missing a linked vendorId:', banner.bannerId);
            return;
        }
        void recordCmsClick('banner', banner.bannerId).catch(error => logger.warn('Unable to record banner click:', error));
        triggerSubtleHaptic();
        const open = (vendorId: string) => onBannerPress ? onBannerPress({ ...banner, vendorId }) : router.push({ pathname: '/kouponly/vendor/[id]', params: { id: vendorId } } as any);
        if (vendorIds.length === 1) { open(vendorIds[0]); return; }
        setChoosing(true);
        try {
            const names = await fetchBannerVendorNames(vendorIds);
            const options: AlertButton[] = vendorIds.flatMap(vendorId => names[vendorId] ? [{ text: names[vendorId], onPress: () => open(vendorId) }] : []);
            if (options.length === 1) options[0].onPress?.();
            else if (options.length) Alert.alert('Choose a vendor', 'Select where you would like to go.', [...options, { text: 'Cancel', style: 'cancel' }]);
            else Alert.alert('No vendors available');
        } catch {
            Alert.alert('Could not load vendors', 'Tap the banner again to retry.');
        } finally { setChoosing(false); }
    };

    if (banners.length === 0) return null;

    return (
        <View style={styles.container}>
            <Animated.ScrollView
                testID="home-promo-carousel"
                ref={scrollViewRef}
                horizontal
                style={styles.carousel}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                canCancelContentTouches
                keyboardShouldPersistTaps="always"
                contentOffset={{ x: banners.length > 1 ? bannerScrollInterval : 0, y: 0 }}
                snapToInterval={bannerScrollInterval}
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={event => setVisibleSlide(Math.round(event.nativeEvent.contentOffset.x / bannerScrollInterval))}
                onScrollBeginDrag={handleScrollBegin}
                onMomentumScrollBegin={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                contentContainerStyle={styles.scrollContent}
            >
                {loopItems.map((banner, index) => {
                    const imageUri = banner.images.mobile || banner.images.desktop;
                    const dimensions = banner.mobileDimensions;
                    const imageRatio = dimensions && banner.images.mobile
                        ? dimensions.width / dimensions.height
                        : imageUri ? imageRatios[imageUri] : undefined;

                    return (
                        <ScalePressable
                            key={`${banner.bannerId || banner.vendorId || banner.id}-${index}`}
                            style={({ pressed }) => [
                                styles.bannerColumn,
                                { width: bannerWidth },
                                pressed && styles.bannerPressed,
                            ]}
                            onPress={() => void handlePress(banner)}
                            accessibilityRole="button"
                            accessibilityState={{ busy: choosing }}
                            accessibilityLabel={banner.altText || 'Open vendor'}
                        >
                            <View style={styles.bannerPill}>
                                {imageUri && (index === visibleSlide || (firstImageReady && Math.abs(index - visibleSlide) <= 1)) ? <Image
                                    source={{ uri: imageUri }}
                                    style={[styles.bannerImage, imageRatio ? {
                                        width: Math.min(bannerWidth, BANNER_HEIGHT * imageRatio),
                                        height: Math.min(BANNER_HEIGHT, bannerWidth / imageRatio),
                                    } : undefined]}
                                    onLoad={({ source }) => {
                                        if (imageUri && source.width > 0 && source.height > 0) {
                                            const ratio = source.width / source.height;
                                            setImageRatios(previous => previous[imageUri] === ratio ? previous : { ...previous, [imageUri]: ratio });
                                        }
                                    }}
                                    contentFit="contain"
                                    cachePolicy="memory-disk"
                                    priority={index === visibleSlide ? 'high' : 'low'}
                                    onDisplay={() => {
                                        if (index === firstSlide) onFirstImageDisplay?.();
                                        setFirstImageReady(true);
                                    }}
                                    onError={() => setFirstImageReady(true)}
                                    accessibilityLabel={banner.altText || 'Banner Image'}
                                /> : null}
                            </View>
                        </ScalePressable>
                    );
                })}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
    },
    loaderContainer: {
        height: BANNER_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    carousel: {
        height: BANNER_HEIGHT,
    },
    scrollContent: {
        paddingHorizontal: BANNER_SIDE_PADDING,
        gap: BANNER_GAP,
    },
    bannerColumn: {
        height: BANNER_HEIGHT,
    },
    bannerPressed: {
        opacity: 0.9,
    },
    bannerPill: {
        width: '100%',
        height: BANNER_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BANNER_RADIUS,
        borderCurve: 'circular',
        overflow: 'hidden',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
        borderRadius: BANNER_RADIUS,
    },
});

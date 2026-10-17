import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, ScrollView, StyleSheet, useWindowDimensions, View, type AlertButton } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useAppTheme } from '../../context/AppThemeContext';
import { StateSurface } from '../StateSurface';
import { triggerSubtleHaptic } from '../../utils/haptics';
import { homeQueryOptions, type HomeBannerItem } from '../../utils/homeQueries';
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
    banners?: BannerItem[];
    onBannerPress?: (banner: BannerItem) => void;
};

export default function PromoBanner({ banners: bannersOverride, onBannerPress }: PromoBannerProps) {
    const { theme } = useAppTheme();
    const { reduceMotion } = useMotionPreferences();
    const {
        data: fetchedBanners = [],
        error,
        isLoading,
        refetch,
    } = useQuery({ ...homeQueryOptions.promoBanners(), enabled: !bannersOverride });
    const banners = bannersOverride ?? fetchedBanners;
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
        if (error) logger.error('Error fetching banners:', error);
    }, [error]);

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
            scrollViewRef.current?.scrollTo({ x: nextIndex * bannerScrollInterval, animated: true });
        }, BANNER_AUTO_SCROLL_MS);

        return () => clearInterval(interval);
    }, [banners.length, bannerScrollInterval, reduceMotion]);

    useEffect(() => {
        currentIndexRef.current = banners.length > 1 ? 1 : 0;
        scrollViewRef.current?.scrollTo({ x: currentIndexRef.current * bannerScrollInterval, animated: false });
    }, [bannerScrollInterval, banners.length]);

    const getBannerVendorIds = (banner: BannerItem) => [...new Set((banner.vendorIds?.length ? banner.vendorIds : [banner.vendorId || banner.id || '']).map(id => id.trim()).filter(id => Boolean(id && banner.vendorNames?.[id])))];

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
        if (next !== index) scrollViewRef.current?.scrollTo({ x: next * bannerScrollInterval, animated: false });
        isUserInteractingRef.current = false;
    };

    const handlePress = (banner: BannerItem) => {
        const vendorIds = getBannerVendorIds(banner);
        if (!vendorIds.length) {
            logger.warn('Promo banner is missing a linked vendorId:', banner.bannerId);
            return;
        }
        void recordCmsClick('banner', banner.bannerId).catch(error => logger.warn('Unable to record banner click:', error));
        triggerSubtleHaptic();
        const open = (vendorId: string) => onBannerPress ? onBannerPress({ ...banner, vendorId }) : router.push({ pathname: '/realx/vendor/[id]', params: { id: vendorId } } as any);
        if (vendorIds.length === 1) open(vendorIds[0]);
        else {
            const options: AlertButton[] = vendorIds.map(vendorId => ({ text: banner.vendorNames?.[vendorId] || 'Vendor', onPress: () => open(vendorId) }));
            options.push({ text: 'Cancel', style: 'cancel' });
            Alert.alert('Choose a vendor', 'Select where you would like to go.', options);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.loaderContainer]}>
                <ActivityIndicator size="large" color={theme.brand} />
            </View>
        );
    }

    if (error && banners.length === 0) {
        return <StateSurface kind="error" compact onRetry={() => void refetch()} />;
    }

    if (banners.length === 0) {
        return (
            <View style={[styles.container, styles.loaderContainer]}>
                <StateSurface kind="empty" compact />
            </View>
        );
    }

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
                onScrollBeginDrag={handleScrollBegin}
                onMomentumScrollBegin={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                contentContainerStyle={styles.scrollContent}
            >
                {loopItems.map((banner, index) => {
                    const imageUri = banner.images.mobile || banner.images.desktop;
                    const imageRatio = imageUri ? imageRatios[imageUri] : undefined;

                    return (
                        <ScalePressable
                            key={`${banner.bannerId || banner.vendorId || banner.id}-${index}`}
                            style={({ pressed }) => [
                                styles.bannerColumn,
                                { width: bannerWidth },
                                pressed && styles.bannerPressed,
                            ]}
                            onPress={() => handlePress(banner)}
                            accessibilityRole="button"
                            accessibilityLabel={banner.altText || 'Open vendor'}
                        >
                            <View style={styles.bannerPill}>
                                <Image
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
                                    accessibilityLabel={banner.altText || 'Banner Image'}
                                />
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

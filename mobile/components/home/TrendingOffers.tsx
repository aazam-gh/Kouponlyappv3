import { Colors as BorderPalette } from '@/constants/Colors';
import { useMotionPreferences } from '@/lib/theme';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import RestaurantCard from '../category/RestaurantCard';
import { StateSurface } from '../StateSurface';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAppLocale } from '../../context/LocaleContext';
import { homeQueryOptions } from '../../utils/homeQueries';
import { useNearbyDistances } from '@/lib/nearby';
import HomeSectionHeading from './HomeSectionHeading';
import {
    HOME_CAROUSEL_GAP,
    HOME_HORIZONTAL_GUTTER,
} from './layout';

type TrendingOffersProps = {
    onVendorPress?: (vendor: any) => void;
};

const OFFER_CARD_GAP = HOME_CAROUSEL_GAP;
const OFFER_SIDE_PADDING = HOME_HORIZONTAL_GUTTER;
const OFFER_CARD_WIDTH_RATIO = 0.60;
const OFFER_AUTO_SCROLL_MS = 4000;
export default function TrendingOffers({ onVendorPress }: TrendingOffersProps) {
    const { t } = useTranslation();
    const { theme } = useAppTheme();
    const { reduceMotion } = useMotionPreferences();
    const { isRTL } = useAppLocale();
    const { distanceByVendor } = useNearbyDistances();
    const {
        data: vendors = [],
        error,
        isLoading,
        refetch,
    } = useQuery(homeQueryOptions.offers());
    const [currentIndex, setCurrentIndex] = useState(0);
    const currentIndexRef = useRef(0);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const isUserInteractingRef = useRef(false);
    const { width: screenWidth } = useWindowDimensions();
    const router = useRouter();
    const displayedVendors = useMemo(() => (isRTL ? [...vendors].reverse() : vendors), [vendors, isRTL]);
    const offerCardWidth = screenWidth * OFFER_CARD_WIDTH_RATIO;
    const offerScrollInterval = offerCardWidth + OFFER_CARD_GAP;
    const labelPrefix = t('trending_label_prefix');
    const labelHighlight = t('trending_label_highlight');

    useEffect(() => {
        if (error) logger.error('Error fetching trending vendors:', error);
    }, [error]);

    useEffect(() => {
        if (reduceMotion || displayedVendors.length <= 1) {
            return;
        }

        const interval = setInterval(() => {
            if (isUserInteractingRef.current) {
                return;
            }

            const nextIndex = (currentIndexRef.current + 1) % displayedVendors.length;
            currentIndexRef.current = nextIndex;
            setCurrentIndex(nextIndex);
        }, OFFER_AUTO_SCROLL_MS);

        return () => clearInterval(interval);
    }, [displayedVendors.length, reduceMotion]);

    useEffect(() => {
        if (!scrollViewRef.current || displayedVendors.length === 0) {
            return;
        }

        const maxIndex = Math.max(0, displayedVendors.length - 1);
        const safeIndex = Math.min(currentIndex, maxIndex);

        scrollViewRef.current.scrollTo({
            x: safeIndex * offerScrollInterval,
            animated: !reduceMotion,
        });
    }, [currentIndex, displayedVendors.length, offerScrollInterval, reduceMotion]);

    const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (displayedVendors.length <= 1) {
            isUserInteractingRef.current = false;
            return;
        }

        const maxIndex = Math.max(0, displayedVendors.length - 1);
        const nextIndex = Math.min(
            maxIndex,
            Math.max(0, Math.round(event.nativeEvent.contentOffset.x / offerScrollInterval)),
        );

        currentIndexRef.current = nextIndex;
        isUserInteractingRef.current = false;
    };

    const handleScrollBegin = () => {
        isUserInteractingRef.current = true;
    };

    const handleVendorPress = (vendor: any) => {
        if (onVendorPress) {
            onVendorPress(vendor);
        } else if (vendor.vendorId) {
            router.push({ pathname: '/realx/vendor/[id]', params: { id: vendor.vendorId } } as any);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.loaderContainer]}>
                <ActivityIndicator size="small" color={theme.brand} />
            </View>
        );
    }

    if (error && displayedVendors.length === 0) {
        return <StateSurface kind="error" compact onRetry={() => void refetch()} />;
    }

    if (displayedVendors.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <HomeSectionHeading prefix={labelPrefix} highlight={labelHighlight} onSeeMore={() => router.push({ pathname: '/vendors', params: { section: 'trending' } } as any)} />
            <ScrollView
                ref={scrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                canCancelContentTouches
                keyboardShouldPersistTaps="always"
                decelerationRate="normal"
                scrollEventThrottle={16}
                onScrollBeginDrag={handleScrollBegin}
                onMomentumScrollBegin={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                contentContainerStyle={[styles.scrollContent, { flexDirection: 'row' }]}
            >
                {displayedVendors.map((vendor) => {
                    const name = vendor.nameEn || vendor.vendorName || 'Vendor';

                    return (
                        <RestaurantCard
                            key={vendor.id}
                            id={vendor.id}
                            name={name}
                            imageUri={vendor.bannerImage || vendor.coverImage}
                            logoUri={vendor.vendorProfilePicture || vendor.profilePicture}
                            distance={distanceByVendor.get(String(vendor.vendorId || vendor.id))?.label}
                            xcardEnabled={vendor.xcard}
                            distanceOnImage
                            overlapLogo
                            badgeLabel={vendor.cardLabels?.[0] ?? vendor.cardLabel}
                            borderColor={BorderPalette.border}
                            imageHeight={89.2}
                            logoBottom={-35.6}
                            titleCaseName
                            nameStyle={styles.carouselName}
                            contentStyle={{ minHeight: 48, justifyContent: 'flex-start', paddingTop: 8, paddingBottom: 0 }}
                            onPress={() => handleVendorPress(vendor)}
                            style={{
                                width: offerCardWidth,
                                borderWidth: 1,
                                borderColor: BorderPalette.border,
                                borderRadius: 20,
                                overflow: 'hidden',
                            }}
                        />
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingTop: 16,
    },
    carouselName: {
        fontSize: 16,
        lineHeight: 21,
        fontWeight: '700',
    },
    loaderContainer: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: OFFER_SIDE_PADDING,
        gap: OFFER_CARD_GAP,
    },
});

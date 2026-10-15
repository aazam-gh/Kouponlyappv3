import { useMotionPreferences } from '@/lib/theme';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import {
    homeQueryOptions,
    type HomeFeaturedBannerItem,
} from '../../utils/homeQueries';
import { HOME_COMPACT_BANNER_HEIGHT } from './layout';
import FeaturedBanner from './FeaturedBanner';

const FEATURED_BANNER_TOP_SPACING = 16;
const DISPLAY_DURATION_MS = 4000;

export default function HomeBannerCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { reduceMotion } = useMotionPreferences();
    const [autoplayResetKey, setAutoplayResetKey] = useState(0);
    const currentIndexRef = useRef(0);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const { width: screenWidth } = useWindowDimensions();
    const {
        data: featuredBannerData = [],
    } = useQuery({
        ...homeQueryOptions.featuredBanner(),
    });
    const featuredBanners = Array.isArray(featuredBannerData)
        ? featuredBannerData
        : featuredBannerData
            ? [featuredBannerData]
            : [];

    const slideCount = featuredBanners.length;
    useEffect(() => {
        if (reduceMotion || slideCount <= 1) {
            return;
        }

        const timeout = setTimeout(() => {
            const nextIndex = (currentIndexRef.current + 1) % slideCount;
            currentIndexRef.current = nextIndex;
            setCurrentIndex(nextIndex);
            setAutoplayResetKey((key) => key + 1);
        }, DISPLAY_DURATION_MS);

        return () => clearTimeout(timeout);
    }, [autoplayResetKey, slideCount, reduceMotion]);

    useEffect(() => {
        if (slideCount === 0) {
            currentIndexRef.current = 0;
            setCurrentIndex(0);
            return;
        }

        const nextIndex = Math.min(currentIndexRef.current, slideCount - 1);
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
    }, [slideCount]);

    useEffect(() => {
        if (!scrollViewRef.current || slideCount === 0) {
            return;
        }

        scrollViewRef.current.scrollTo({
            x: currentIndex * screenWidth,
            animated: !reduceMotion,
        });
    }, [currentIndex, screenWidth, slideCount, reduceMotion]);

    const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const nextIndex = Math.min(
            slideCount - 1,
            Math.max(0, Math.round(event.nativeEvent.contentOffset.x / screenWidth)),
        );

        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        setAutoplayResetKey((key) => key + 1);
    };

    if (featuredBanners.length === 0) {
        return null;
    }

    return (
        <View style={styles.container} accessibilityLabel="Home promotional banners">
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                canCancelContentTouches
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                style={styles.stage}
            >
                {featuredBanners.map((featuredBanner) => (
                    <View
                        key={featuredBanner.id}
                        style={{ width: screenWidth }}
                    >
                        <FeaturedBanner
                            item={featuredBanner as HomeFeaturedBannerItem}
                            style={{ paddingTop: FEATURED_BANNER_TOP_SPACING }}
                        />
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: FEATURED_BANNER_TOP_SPACING + HOME_COMPACT_BANNER_HEIGHT,
        position: 'relative',
    },
    stage: {
        height: FEATURED_BANNER_TOP_SPACING + HOME_COMPACT_BANNER_HEIGHT,
        position: 'relative',
    },
});

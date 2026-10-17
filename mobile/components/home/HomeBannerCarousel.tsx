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
    const { reduceMotion } = useMotionPreferences();
    const [autoplayResetKey, setAutoplayResetKey] = useState(0);
    const currentIndexRef = useRef(1);
    const isUserInteractingRef = useRef(false);
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
    const loopItems = featuredBanners.length > 1 ? [featuredBanners[featuredBanners.length - 1], ...featuredBanners, featuredBanners[0]] : featuredBanners;
    useEffect(() => {
        if (reduceMotion || slideCount <= 1) {
            return;
        }

        const timeout = setTimeout(() => {
            if (isUserInteractingRef.current) return;
            const nextIndex = currentIndexRef.current + 1;
            currentIndexRef.current = nextIndex;
            scrollViewRef.current?.scrollTo({ x: nextIndex * screenWidth, animated: true });
            setAutoplayResetKey((key) => key + 1);
        }, DISPLAY_DURATION_MS);

        return () => clearTimeout(timeout);
    }, [autoplayResetKey, slideCount, reduceMotion, screenWidth]);

    useEffect(() => {
        currentIndexRef.current = slideCount > 1 ? 1 : 0;
        scrollViewRef.current?.scrollTo({ x: currentIndexRef.current * screenWidth, animated: false });
    }, [screenWidth, slideCount]);

    const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
        const next = slideCount > 1 ? index === 0 ? slideCount : index >= slideCount + 1 ? 1 : index : 0;
        currentIndexRef.current = next;
        if (next !== index) scrollViewRef.current?.scrollTo({ x: next * screenWidth, animated: false });
        isUserInteractingRef.current = false;
        setAutoplayResetKey(key => key + 1);
    };

    const handleScrollBegin = () => {
        isUserInteractingRef.current = true;
    };

    if (featuredBanners.length === 0) {
        return null;
    }

    return (
        <View style={styles.container} accessibilityLabel="Home promotional banners">
            <ScrollView
                testID="home-featured-carousel"
                ref={scrollViewRef}
                horizontal
                contentOffset={{ x: slideCount > 1 ? screenWidth : 0, y: 0 }}
                snapToInterval={screenWidth}
                bounces={false}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                canCancelContentTouches
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScrollBeginDrag={handleScrollBegin}
                onMomentumScrollBegin={handleScrollBegin}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                style={styles.stage}
            >
                {loopItems.map((featuredBanner, index) => (
                    <View
                        key={`${featuredBanner.id}-${index}`}
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

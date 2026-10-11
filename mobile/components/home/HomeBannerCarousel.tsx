import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import {
    homeQueryOptions,
    type HomeFeaturedBannerItem,
} from '../../utils/homeQueries';
import { HOME_COMPACT_BANNER_HEIGHT } from './layout';
import FeaturedBanner from './FeaturedBanner';
import { Colors } from '../../constants/Colors';

const FEATURED_BANNER_TOP_SPACING = 16;
const FEATURED_BANNER_INDICATOR_HEIGHT = 24;
const DISPLAY_DURATION_MS = 4000;

function PaginationIndicator({ index, pageProgress, currentIndex, reduceMotion }: {
    index: number;
    pageProgress: { get: () => number };
    currentIndex: number;
    reduceMotion: boolean;
}) {
    const animatedStyle = useAnimatedStyle(() => {
        const progress = reduceMotion ? currentIndex : pageProgress.get();
        return {
            backgroundColor: interpolateColor(progress, [index - 1, index, index + 1], ['#D6D9D7', Colors.brandGreen, '#D6D9D7']),
            transform: [{ scaleX: interpolate(progress, [index - 1, index, index + 1], [0.3, 1, 0.3], Extrapolation.CLAMP) }],
        };
    }, [currentIndex, index, reduceMotion]);

    return <Animated.View style={[styles.indicator, animatedStyle]} />;
}

export default function HomeBannerCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const { reduceMotion } = useMotionPreferences();
    const [autoplayResetKey, setAutoplayResetKey] = useState(0);
    const currentIndexRef = useRef(0);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const pageProgress = useSharedValue(0);
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
    const handleAnimatedScroll = useAnimatedScrollHandler(event => {
        pageProgress.set(event.contentOffset.x / screenWidth);
    });

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
            <Animated.ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                directionalLockEnabled
                canCancelContentTouches
                decelerationRate="normal"
                scrollEventThrottle={16}
                onScrollEndDrag={handleScrollEnd}
                onMomentumScrollEnd={handleScrollEnd}
                onScroll={handleAnimatedScroll}
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
            </Animated.ScrollView>
            {slideCount > 1 ? (
                <View style={styles.pagination} accessibilityLabel="Featured banner navigation">
                    {featuredBanners.map((featuredBanner, index) => (
                        <ScalePressable
                            key={`featured-indicator-${featuredBanner.id}`}
                            onPress={() => {
                                currentIndexRef.current = index;
                                setCurrentIndex(index);
                                setAutoplayResetKey((key) => key + 1);
                            }}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Show featured banner ${index + 1}`}
                            accessibilityState={{ selected: currentIndex === index }}
                            style={styles.indicatorButton}
                        >
                            <PaginationIndicator index={index} pageProgress={pageProgress} currentIndex={currentIndex} reduceMotion={reduceMotion} />
                        </ScalePressable>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: FEATURED_BANNER_TOP_SPACING + HOME_COMPACT_BANNER_HEIGHT + FEATURED_BANNER_INDICATOR_HEIGHT,
        position: 'relative',
    },
    stage: {
        height: FEATURED_BANNER_TOP_SPACING + HOME_COMPACT_BANNER_HEIGHT,
        position: 'relative',
    },
    pagination: {
        height: FEATURED_BANNER_INDICATOR_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
    },
    indicatorButton: {
        width: 32,
        height: FEATURED_BANNER_INDICATOR_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indicator: {
        width: 20,
        height: 6,
        borderRadius: 999,
        backgroundColor: Colors.brandGreen,
    },
});

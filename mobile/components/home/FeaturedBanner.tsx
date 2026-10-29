import { Colors as BorderPalette } from '@/constants/Colors';
import ScalePressable from '@/components/ScalePressable';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '../../constants/Colors';
import { Typography } from '../../constants/Typography';
import { useAppLocale } from '../../context/LocaleContext';
import { triggerSubtleHaptic } from '../../utils/haptics';
import {
    homeQueryOptions,
    isValidHomeFeaturedBanner,
    type HomeFeaturedBannerItem,
} from '../../utils/homeQueries';
import { logger } from '../../utils/logger';
import { safeWebUrl } from '@/lib/vendor-links';
import { recordCmsClick } from '@/lib/cms-clicks';
import AppText from '../AppText';
import {
    HOME_COMPACT_BANNER_HEIGHT,
    HOME_HORIZONTAL_GUTTER,
    HOME_SECTION_TOP_SPACING,
} from './layout';

type FeaturedBannerItem = HomeFeaturedBannerItem;

type FeaturedBannerProps = {
    item?: FeaturedBannerItem | null;
    style?: StyleProp<ViewStyle>;
};

export default function FeaturedBanner({ item, style }: FeaturedBannerProps) {
    const router = useRouter();
    const { isRTL } = useAppLocale();
    const {
        data: cmsItems = [],
        error,
        isLoading,
    } = useQuery({
        ...homeQueryOptions.featuredBanner(),
        enabled: item === undefined,
    });

    useEffect(() => {
        if (error) logger.error('Error fetching featured banner:', error);
    }, [error]);

    const currentItem = item === undefined
        ? (Array.isArray(cmsItems) ? (cmsItems[0] || null) : cmsItems)
        : item;
    const isCmsLoading = item === undefined && isLoading;

    const handlePress = () => {
        if (!currentItem) {
            return;
        }

        triggerSubtleHaptic();

        void recordCmsClick('featuredBrandShowcase', currentItem.id).catch(error => logger.warn('Unable to record showcase click:', error)).finally(() => {
            const url = safeWebUrl(currentItem.orderUrl);
            if (url) void Linking.openURL(url).catch(error => logger.warn('Unable to open showcase link:', error));
            else if (currentItem.vendorId?.trim()) router.push({ pathname: '/kouponly/vendor/[id]', params: { id: currentItem.vendorId.trim() } } as any);
        });
    };

    if (isCmsLoading) {
        return (
            <View style={[style]}>
                <ActivityIndicator size="small" color={Colors.brandGreen} />
            </View>
        );
    }

    if (!currentItem || !isValidHomeFeaturedBanner(currentItem)) {
        return null;
    }

    const title = currentItem.title?.trim();
    const ctaText = currentItem.ctaText?.trim();
    const imageUrl = currentItem.imageUrl || currentItem.heroImageUrl || '';
    const imagePositionY = Math.min(100, Math.max(0, currentItem.imagePositionY ?? 50));
    const accessibilityTitle = title || ctaText || 'Featured partner';

    return (
        <View style={[styles.section, style]}>
            <ScalePressable
                activeOpacity={0.9}
                onPress={handlePress}
                style={styles.card}
                accessibilityRole="button"
                accessibilityLabel={accessibilityTitle}
                accessibilityHint={ctaText}
            >
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.heroImage}
                    contentFit="cover"
                    contentPosition={{ top: `${imagePositionY}%`, left: '50%' }}
                    cachePolicy="memory-disk"
                    accessibilityLabel={accessibilityTitle}
                />
                <View style={[styles.content, isRTL && styles.contentRTL]}>
                    <View style={[styles.copy, isRTL && styles.copyRTL]}>
                        {title ? (
                            <AppText
                                numberOfLines={2}
                                style={[
                                    styles.title,
                                    isRTL && styles.titleRTL,
                                    {
                                        textAlign: isRTL ? 'right' : 'left',
                                        writingDirection: isRTL ? 'rtl' : 'ltr',
                                    },
                                ]}
                            >
                                {title}
                            </AppText>
                        ) : null}
                        {ctaText ? (
                            <View style={[styles.ctaPill, isRTL && styles.ctaPillRTL]}>
                                <AppText
                                    numberOfLines={1}
                                    style={[styles.ctaText, isRTL && styles.textRTL]}
                                >
                                    {ctaText}
                                </AppText>
                            </View>
                        ) : null}
                    </View>

                </View>
            </ScalePressable>
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        paddingTop: HOME_SECTION_TOP_SPACING,
        paddingBottom: 0,
    },
    card: {
        position: 'relative',
        width: '100%',
        height: HOME_COMPACT_BANNER_HEIGHT,
        overflow: 'hidden',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        backgroundColor: '#111111',
    },
    heroImage: {
        ...StyleSheet.absoluteFill,
    },
    content: {
        height: HOME_COMPACT_BANNER_HEIGHT,
        paddingVertical: 10,
        paddingHorizontal: HOME_HORIZONTAL_GUTTER,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        zIndex: 1,
    },
    contentRTL: {
        flexDirection: 'row-reverse',
    },
    copy: {
        flex: 1,
        minWidth: 0,
        gap: 10,
    },
    copyRTL: {
        alignItems: 'flex-end',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        lineHeight: 25,
        ...Typography.getTextVariantStyle('display'),
        includeFontPadding: false,
    },
    titleRTL: {
        alignSelf: 'stretch',
    },
    ctaPill: {
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingVertical: 7,
        paddingHorizontal: 12,
        backgroundColor: Colors.brandGreen,
    },
    ctaPillRTL: {
        alignSelf: 'flex-end',
    },
    ctaText: {
        color: '#0A0F0C',
        fontSize: 15,
        lineHeight: 18,
        ...Typography.getTextVariantStyle('display'),
        textTransform: 'uppercase',
    },
    textRTL: {
        textAlign: 'right',
        writingDirection: 'rtl',
        textTransform: 'none',
    },
    artWrap: {
        position: 'relative',
        width: 100,
        height: 92,
        flexShrink: 0,
    },
    tile: {
        position: 'absolute',
        width: 44,
        height: 76,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: BorderPalette.cardOutline,
        overflow: 'hidden',
        backgroundColor: '#f0f0f0',
        boxShadow: '0 12px 24px rgba(0, 0, 0, 0.24)',
    },
    tile0: {
        left: 0,
        top: 12,
        transform: [{ rotate: '-5deg' }],
    },
    tile1: {
        left: 28,
        top: 3,
        zIndex: 2,
    },
    tile2: {
        left: 56,
        top: 12,
        transform: [{ rotate: '5deg' }],
    },
    tileImage: {
        width: '100%',
        height: '100%',
    },
});

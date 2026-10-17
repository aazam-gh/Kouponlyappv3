import ScalePressable from '@/components/ScalePressable';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNearby, useNearbyDistances } from '@/lib/nearby';
import type { VendorMapLocation } from '@/lib/nearby-vendors';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { dealDiscountLabel } from '@/lib/data';
import RestaurantCard from '../category/RestaurantCard';
import { StateSurface } from '../StateSurface';
import HomeSectionHeading from './HomeSectionHeading';
import { HOME_CAROUSEL_GAP, HOME_HORIZONTAL_GUTTER } from './layout';

type NewDealsProps = {
    onVendorPress?: (vendor: VendorMapLocation) => void;
};

export default function NewDeals({ onVendorPress }: NewDealsProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const { isRTL } = useAppLocale();
    const { theme } = useAppTheme();
    const { position, status, error, canAskAgain, load } = useNearby();
    const { distanceByVendor } = useNearbyDistances();
    const { width } = useWindowDimensions();

    const nearestVendors = useMemo(() => {
        if (!position) return [];
        return [...distanceByVendor.values()]
            .map(({ location, distanceKm, label }) => ({ ...location, distanceKm, distance: label }))
            .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name))
            .slice(0, 10);
    }, [distanceByVendor, position]);

    const action = () => canAskAgain
        ? void load({ askForPermission: true, force: true })
        : void Linking.openSettings();
    const heading = <HomeSectionHeading prefix={t('offers_near_you_prefix')} highlight={t('offers_near_you_highlight')} onSeeMore={() => router.push({ pathname: '/vendors', params: { section: 'nearby' } } as any)} />;

    if (status === 'idle' || status === 'loading') {
        return <View style={styles.container}>{heading}<StateSurface kind="loading" compact /></View>;
    }

    if (status === 'permission') {
        return <View style={styles.container}>
            {heading}
            <StateSurface kind="empty" compact title={t('offers_near_location_title')} message={t('offers_near_location_message')} />
            <ScalePressable accessibilityRole="button" onPress={action} style={[styles.action, { backgroundColor: theme.actionSolid }]}>
                <Text style={[styles.actionText, { color: theme.onActionSolid }]}>{canAskAgain ? t('retry') : t('onboarding_v2_open_settings')}</Text>
            </ScalePressable>
        </View>;
    }

    if (status === 'error') {
        return <View style={styles.container}>{heading}<StateSurface kind="error" compact message={error} onRetry={() => void load({ askForPermission: true, force: true })} /></View>;
    }

    if (nearestVendors.length === 0) {
        return <View style={styles.container}>{heading}<StateSurface kind="empty" compact title={t('no_nearby_vendors')} /></View>;
    }

    const cardWidth = width * 0.6;
    return <View style={styles.container}>
        {heading}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {nearestVendors.map(vendor => (
                <RestaurantCard
                    key={vendor.vendorId}
                    id={vendor.vendorId}
                    name={vendor.name}
                    imageUri={vendor.image}
                    logoUri={vendor.logo}
                    distance={vendor.distance}
                    imageHeight={89.2}
                    logoBottom={-35.6}
                    distanceOnImage
                    overlapLogo
                    offerCard
                    discountLabel={dealDiscountLabel(vendor)}
                    borderColor={'rgba(100, 116, 106, 0.28)'}
                    titleCaseName
                    contentStyle={{ minHeight: 48, justifyContent: 'center', paddingTop: 10, paddingBottom: 10 }}
                    style={{ width: cardWidth, borderWidth: 1, borderColor: 'rgba(100, 116, 106, 0.28)', borderRadius: 20, overflow: 'hidden' }}
                    onPress={() => onVendorPress ? onVendorPress(vendor) : router.push({ pathname: '/realx/vendor/[id]', params: { id: vendor.vendorId } } as any)}
                />
            ))}
        </ScrollView>
    </View>;
}

const styles = StyleSheet.create({
    container: { paddingTop: 12, paddingBottom: 16 },
    scrollContent: { paddingHorizontal: HOME_HORIZONTAL_GUTTER, gap: HOME_CAROUSEL_GAP },
    action: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
    actionText: { fontSize: 14, fontWeight: '700' },
});

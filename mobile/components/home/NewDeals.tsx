import { useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { AppState, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNearby } from '@/lib/nearby';
import type { VendorMapLocation } from '@/lib/nearby-vendors';
import { useAppLocale } from '@/context/LocaleContext';
import { useAppTheme } from '@/context/AppThemeContext';
import { dealDiscountLabel } from '@/lib/data';
import RestaurantCard from '../category/RestaurantCard';
import { StateSurface } from '../StateSurface';
import HomeSectionHeading from './HomeSectionHeading';
import { HOME_CAROUSEL_GAP, HOME_HORIZONTAL_GUTTER, HOME_SECTION_TOP_SPACING } from './layout';

type NewDealsProps = {
    onVendorPress?: (vendor: VendorMapLocation) => void;
};

function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = radians(to.latitude - from.latitude);
    const dLng = radians(to.longitude - from.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NewDeals({ onVendorPress }: NewDealsProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const { isRTL } = useAppLocale();
    const { theme } = useAppTheme();
    const { locations, position, status, error, canAskAgain, load } = useNearby();
    const { width } = useWindowDimensions();

    useEffect(() => {
        if (status === 'idle') void load({ askForPermission: true });
    }, [load, status]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (nextState === 'active' && status === 'permission') void load({ force: true });
        });
        return () => subscription.remove();
    }, [load, status]);

    const nearestVendors = useMemo(() => {
        if (!position) return [];
        const nearestByVendor = new Map<string, VendorMapLocation>();
        for (const location of locations) {
            const latitude = location.latitude;
            const longitude = location.longitude;
            if (typeof latitude !== 'number' || !Number.isFinite(latitude) || typeof longitude !== 'number' || !Number.isFinite(longitude)) continue;
            const distance = distanceKm(position, { latitude, longitude });
            const current = nearestByVendor.get(location.vendorId);
            if (!current || distance < current.distanceKm) {
                nearestByVendor.set(location.vendorId, { ...location, distanceKm: distance, distance: `${distance.toFixed(2)} km` });
            }
        }
        return [...nearestByVendor.values()]
            .sort((a, b) => a.distanceKm - b.distanceKm || a.name.localeCompare(b.name))
            .slice(0, 10);
    }, [locations, position]);

    const action = () => canAskAgain
        ? void load({ askForPermission: true, force: true })
        : void Linking.openSettings();
    const heading = <HomeSectionHeading prefix={t('offers_near_you_prefix')} highlight={t('offers_near_you_highlight')} />;

    if (status === 'idle' || status === 'loading') {
        return <View style={styles.container}>{heading}<StateSurface kind="loading" compact /></View>;
    }

    if (status === 'permission') {
        return <View style={styles.container}>
            {heading}
            <StateSurface kind="empty" compact title={t('offers_near_location_title')} message={t('offers_near_location_message')} />
            <Pressable accessibilityRole="button" onPress={action} style={[styles.action, { backgroundColor: theme.actionSolid }]}>
                <Text style={[styles.actionText, { color: theme.onActionSolid }]}>{canAskAgain ? t('retry') : t('onboarding_v2_open_settings')}</Text>
            </Pressable>
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
                    titleCaseName
                    contentStyle={{ minHeight: 48, justifyContent: 'flex-start', paddingTop: 8, paddingBottom: 0 }}
                    style={{ width: cardWidth, borderWidth: 1, borderColor: theme.border, borderRadius: 20, overflow: 'hidden' }}
                    onPress={() => onVendorPress ? onVendorPress(vendor) : router.push({ pathname: '/realx/vendor/[id]', params: { id: vendor.vendorId } } as any)}
                />
            ))}
        </ScrollView>
    </View>;
}

const styles = StyleSheet.create({
    container: { paddingTop: HOME_SECTION_TOP_SPACING },
    scrollContent: { paddingHorizontal: HOME_HORIZONTAL_GUTTER, gap: HOME_CAROUSEL_GAP },
    action: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11 },
    actionText: { fontSize: 14, fontWeight: '700' },
});

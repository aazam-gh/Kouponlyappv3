import { Colors as BorderPalette } from '@/constants/Colors';
import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAppLocale } from '../../context/LocaleContext';
import { type VendorSortMode, vendorSortOptions } from '@/lib/vendor-sorting';

type FilterOption = {
    id: string;
    label: string;
    icon: ComponentProps<typeof Ionicons>['name'];
};

interface FilterTabsProps {
    selectedFilter: string;
    onFilterChange: (filterId: string) => void;
    filters?: FilterOption[];
    sortMode?: VendorSortMode;
    onSortModeChange?: (mode: VendorSortMode) => void;
    horizontalPadding?: number;
}

export default function FilterTabs({ selectedFilter, onFilterChange, filters, sortMode = 'alphabetical', onSortModeChange, horizontalPadding = 20 }: FilterTabsProps) {
    const { t } = useTranslation();
    const { reduceMotion } = useMotionPreferences();
    const { isDark, theme } = useAppTheme();
    const { isRTL } = useAppLocale();
    const { width } = useWindowDimensions();
    const [sortOpen, setSortOpen] = useState(false);
    const [outerWidth, setOuterWidth] = useState(0);

    const currentFilters = useMemo<FilterOption[]>(() => filters || [
        { id: 'all', label: 'Sort', icon: 'options-outline' },
        { id: 'nearest', label: t('nearest'), icon: 'navigate-outline' },
        { id: 'top', label: t('filter_top'), icon: 'flame' },
    ], [filters, t]);

    const containerWidth = Math.max(0, (outerWidth || width) - horizontalPadding * 2);
    const tabWidth = containerWidth / currentFilters.length;

    const initialIndex = currentFilters.findIndex(f => f.id === selectedFilter);
    const translateX = useSharedValue(initialIndex !== -1 ? initialIndex * tabWidth : 0);
    const opacity = useSharedValue(selectedFilter ? 1 : 0);

    useEffect(() => {
        const index = currentFilters.findIndex(f => f.id === selectedFilter);
        const hasSelection = index !== -1;

        if (hasSelection) {
            translateX.value = withTiming(index * tabWidth, {
                duration: reduceMotion ? 0 : 180,
                easing: Easing.bezier(0.77, 0, 0.175, 1),
            });
            opacity.value = withTiming(1, { duration: 150 });
        } else {
            opacity.value = withTiming(0, { duration: 150 });
        }
    }, [selectedFilter, currentFilters, tabWidth, translateX, opacity, reduceMotion]);

    const sliderStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
        opacity: opacity.value,
    }));

    const inactiveColor = isDark ? theme.text : theme.icon;
    const selectedColor = theme.onActionSolid;

    return (
        <View
            onLayout={({ nativeEvent }) => {
                const nextWidth = nativeEvent.layout.width;
                setOuterWidth(current => Math.abs(current - nextWidth) > 0.5 ? nextWidth : current);
            }}
            style={[styles.outerContainer, { paddingHorizontal: horizontalPadding }]}
        >
            <View style={[
                styles.container,
                {
                    backgroundColor: isDark ? theme.cardMuted : theme.surface,
                    borderColor: BorderPalette.border,
                },
            ]}>
                <Animated.View
                    style={[
                        styles.slider,
                        {
                            width: tabWidth,
                            backgroundColor: Colors.brandGreen,
                            borderColor: BorderPalette.border,
                        },
                        sliderStyle,
                    ]}
                />

                {currentFilters.map((filter) => {
                    const isSelected = selectedFilter === filter.id;

                    return (
                        <ScalePressable
                            key={filter.id}
                            style={[styles.filterButton, { width: tabWidth }]}
                            onPress={() => filter.id === 'all' && onSortModeChange ? setSortOpen(true) : onFilterChange(filter.id)}
                            activeOpacity={1}
                        >
                            <Ionicons
                                name={filter.icon}
                                size={20}
                                color={isSelected ? selectedColor : inactiveColor}
                            />
                            <Text style={[styles.filterText, { color: isSelected ? selectedColor : inactiveColor, marginTop: isRTL ? -2 : 0 }]}>
                                {filter.label}
                            </Text>
                        </ScalePressable>
                    );
                })}
            </View>
            {onSortModeChange ? <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
                <Pressable accessibilityRole="button" accessibilityLabel="Close sort options" onPress={() => setSortOpen(false)} style={styles.modalOverlay}>
                    <Pressable onPress={event => event.stopPropagation()} style={[styles.sortPopup, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                        <Text accessibilityRole="header" style={[styles.sortTitle, { color: theme.text }]}>Sort</Text>
                        {vendorSortOptions.map(option => {
                            const active = sortMode === option.id;
                            return <ScalePressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { onSortModeChange(option.id); onFilterChange('all'); setSortOpen(false); }} style={[styles.sortOption, active && { backgroundColor: theme.cardMuted }]}>
                                <Ionicons name={option.icon} size={20} color={active ? theme.brand : theme.icon} />
                                <Text style={[styles.sortOptionText, { color: theme.text }]}>{option.label}</Text>
                                {active ? <Ionicons name="checkmark" size={19} color={theme.brand} /> : null}
                            </ScalePressable>;
                        })}
                    </Pressable>
                </Pressable>
            </Modal> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        width: '100%',
        paddingVertical: 12,
    },
    container: {
        flexDirection: 'row',
        borderRadius: 24,
        borderWidth: 1,
        position: 'relative',
        height: 48,
        alignItems: 'center',
        direction: 'ltr',
    },
    slider: {
        position: 'absolute',
        height: '100%',
        borderRadius: 24,
        borderWidth: 1,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 8,
        zIndex: 1,
    },
    filterText: {
        fontSize: 14,
        ...Typography.getTextVariantStyle('bodyStrong'),
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.38)', justifyContent: 'center', paddingHorizontal: 28 },
    sortPopup: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4, elevation: 12 },
    sortTitle: { fontSize: 18, marginBottom: 8, ...Typography.getTextVariantStyle('bodyStrong') },
    sortOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, paddingHorizontal: 10 },
    sortOptionText: { flex: 1, fontSize: 15, ...Typography.getTextVariantStyle('body') },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { useAppTheme } from '../../context/AppThemeContext';
import { useAppLocale } from '../../context/LocaleContext';

type FilterOption = {
    id: string;
    label: string;
    icon: ComponentProps<typeof Ionicons>['name'];
};

interface FilterTabsProps {
    selectedFilter: string;
    onFilterChange: (filterId: string) => void;
    filters?: FilterOption[];
}

export default function FilterTabs({ selectedFilter, onFilterChange, filters }: FilterTabsProps) {
    const { t } = useTranslation();
    const { isDark, theme } = useAppTheme();
    const { isRTL } = useAppLocale();
    const { width } = useWindowDimensions();

    const currentFilters = useMemo<FilterOption[]>(() => filters || [
        { id: 'all', label: t('filter_all'), icon: 'apps-outline' },
        { id: 'nearest', label: t('nearest'), icon: 'navigate-outline' },
        { id: 'top', label: t('filter_top'), icon: 'flame' },
    ], [filters, t]);

    const containerWidth = width - 40;
    const tabWidth = containerWidth / currentFilters.length;

    const initialIndex = currentFilters.findIndex(f => f.id === selectedFilter);
    const translateX = useSharedValue(initialIndex !== -1 ? initialIndex * tabWidth : 0);
    const opacity = useSharedValue(selectedFilter ? 1 : 0);

    useEffect(() => {
        const index = currentFilters.findIndex(f => f.id === selectedFilter);
        const hasSelection = index !== -1;

        if (hasSelection) {
            translateX.value = withTiming(index * tabWidth, {
                duration: 250,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            });
            opacity.value = withTiming(1, { duration: 150 });
        } else {
            opacity.value = withTiming(0, { duration: 150 });
        }
    }, [selectedFilter, currentFilters, tabWidth, translateX, opacity]);

    const sliderStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
        opacity: opacity.value,
    }));

    const inactiveColor = isDark ? theme.text : theme.icon;
    const selectedColor = theme.onActionSolid;

    return (
        <View style={styles.outerContainer}>
            <View style={[
                styles.container,
                {
                    backgroundColor: isDark ? theme.cardMuted : theme.surface,
                    borderColor: isDark ? theme.borderStrong : theme.border,
                },
            ]}>
                <Animated.View
                    style={[
                        styles.slider,
                        {
                            width: tabWidth,
                            backgroundColor: Colors.limeGreen,
                            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.05)',
                        },
                        sliderStyle,
                    ]}
                />

                {currentFilters.map((filter) => {
                    const isSelected = selectedFilter === filter.id;

                    return (
                        <TouchableOpacity
                            key={filter.id}
                            style={[styles.filterButton, { width: tabWidth }]}
                            onPress={() => onFilterChange(filter.id)}
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
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        paddingHorizontal: 20,
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
});

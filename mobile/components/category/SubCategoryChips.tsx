import ScalePressable from '@/components/ScalePressable';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../context/AppThemeContext';
import { Typography } from '../../constants/Typography';

type SubCategory = {
    id: string;
    name: string;
    icon: string;
};

type Props = {
    subCategories?: SubCategory[];
    selectedId?: string;
    onSelect?: (subCategory: SubCategory) => void;
    containerStyle?: ViewStyle;
};

const ICON_SIZE = 48;

/**
 * SubCategoryChip component for individual chips
 */
const SubCategoryChip = memo(({
    item,
    isSelected,
    onPress,
    style,
}: {
    item: SubCategory;
    isSelected: boolean;
    onPress: (item: SubCategory) => void;
    style: ViewStyle;
}) => {
    const { theme } = useAppTheme();

    const renderIcon = () => {
        const { icon } = item;

        if (icon === 'apps-outline') return <Ionicons name="apps-outline" size={32} color={isSelected ? theme.brand : theme.icon} style={styles.vectorIcon} />;

        if (/^https?:\/\//i.test(icon)) return <Image source={{ uri: icon }} style={styles.imageIcon} contentFit="contain" />;
        return <View style={[styles.imageIcon, { backgroundColor: theme.surface, borderRadius: 10 }]} />;
    };

    return (
        <ScalePressable
            style={[styles.chip, style]}
            onPress={() => onPress(item)}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`Select ${item.name} category`}
        >
            {renderIcon()}
            <Text style={[
                styles.chipText,
                { color: isSelected ? theme.brand : theme.text },
                isSelected && styles.chipTextSelected,
            ]}>
                {item.name}
            </Text>
        </ScalePressable>
    );
});

SubCategoryChip.displayName = 'SubCategoryChip';

/**
 * Horizontal scrollable chips for sub-categories
 */
function SubCategoryChips({
    subCategories = [],
    selectedId = 'all',
    onSelect,
    containerStyle,
}: Props) {
    const { width } = useWindowDimensions();
    const horizontalPadding = 28;
    const minChipWidth = 72;
    const contentWidth = Math.max(width, subCategories.length * minChipWidth + horizontalPadding * 2);
    const chipWidth = subCategories.length > 0
        ? (contentWidth - horizontalPadding * 2) / subCategories.length
        : 0;

    const handleSelect = useCallback((item: SubCategory) => {
        onSelect?.(item);
    }, [onSelect]);

    return (
        <View style={[styles.container, containerStyle]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { width: contentWidth }]}
                decelerationRate="fast"
            >
                {subCategories.map((subCategory) => (
                    <SubCategoryChip
                        key={subCategory.id}
                        item={subCategory}
                        isSelected={selectedId === subCategory.id}
                        onPress={handleSelect}
                        style={{ width: chipWidth }}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
        minHeight: 125,
    },
    scrollContent: {
        paddingHorizontal: 28,
        justifyContent: 'space-between',
    },
    chip: {
        alignItems: 'center',
    },
    imageIcon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        marginBottom: 8,
    },
    vectorIcon: { width: ICON_SIZE, height: ICON_SIZE, marginBottom: 8, textAlign: 'center', textAlignVertical: 'center' },
    chipText: {
        fontSize: 12,
        ...Typography.getTextVariantStyle('body'),
        textAlign: 'center',
        lineHeight: 18,
    },
    chipTextSelected: {
        ...Typography.getTextVariantStyle('bodyStrong'),
    },
});

export default memo(SubCategoryChips);

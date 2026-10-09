import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../context/AppThemeContext';
import { Typography } from '../../constants/Typography';

type SubCategory = {
    id: string;
    name: string;
    icon: string | number | { uri: string };
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
}: {
    item: SubCategory;
    isSelected: boolean;
    onPress: (item: SubCategory) => void;
}) => {
    const { theme } = useAppTheme();

    const renderIcon = () => {
        const { icon } = item;

        if (icon === 'apps-outline') return <Ionicons name="apps-outline" size={32} color={isSelected ? theme.brand : theme.icon} style={styles.vectorIcon} />;

        // Handle Image sources (require/number or object with uri)
        if (typeof icon === 'number' || (typeof icon === 'object' && icon !== null)) {
            return <Image source={icon} style={styles.imageIcon} contentFit="contain" />;
        }

        // Handle remote images; missing Supabase artwork stays empty like the reference.
        if (typeof icon === 'string') {
            const isRemote = icon.startsWith('http') || icon.includes('/');
            if (isRemote) {
                return <Image source={{ uri: icon }} style={styles.imageIcon} contentFit="contain" />;
            }
        }

        return null;
    };

    return (
        <TouchableOpacity
            style={styles.chip}
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
        </TouchableOpacity>
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

    const handleSelect = useCallback((item: SubCategory) => {
        onSelect?.(item);
    }, [onSelect]);

    return (
        <View style={[styles.container, containerStyle]}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                decelerationRate="fast"
            >
                {subCategories.map((subCategory) => (
                    <SubCategoryChip
                        key={subCategory.id}
                        item={subCategory}
                        isSelected={selectedId === subCategory.id}
                        onPress={handleSelect}
                    />
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
        height: 125, // Fixed height to prevent layout jumps
    },
    scrollContent: {
        paddingHorizontal: 28,
        gap: 16, // Using gap for consistent spacing between chips
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

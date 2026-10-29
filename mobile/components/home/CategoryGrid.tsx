import { Colors as BorderPalette } from '@/constants/Colors';
import ScalePressable from '@/components/ScalePressable';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ellipsis } from 'lucide-react-native';
import { Typography } from '../../constants/Typography';
import { useAppTheme } from '../../context/AppThemeContext';
import { triggerSubtleHaptic } from '../../utils/haptics';
import { homeQueryOptions, type HomeCategoryItem } from '../../utils/homeQueries';
import { logger } from '../../utils/logger';
import { RemoteImage } from '../RemoteImage';
import { StateSurface } from '../StateSurface';
import AndroidBottomSheetModal from '../AndroidBottomSheetModal';
import ZigzagSection from './ZigzagSection';

type CategoryItem = HomeCategoryItem;

type Props = {
    categories?: CategoryItem[];
    onCategoryPress?: (category: CategoryItem) => void;
};

export default function CategoryGrid({ categories: propCategories, onCategoryPress }: Props) {
    const router = useRouter();
    const { t } = useTranslation();
    const { width, height } = useWindowDimensions();
    const { theme } = useAppTheme();
    const [moreVisible, setMoreVisible] = useState(false);
    const { data: fetchedCategories = [], error, isLoading, refetch } = useQuery({
        ...homeQueryOptions.categories('en'),
        enabled: !propCategories,
    });

    useEffect(() => {
        if (error) logger.error('Error fetching categories:', error);
    }, [error]);

    const categories = propCategories || fetchedCategories;
    const columnWidth = (width - 8) / 5;
    const imageSize = Math.min(64, Math.max(48, columnWidth - 12));
    const rowHeight = imageSize + 31;

    const openCategory = (item: CategoryItem) => {
        triggerSubtleHaptic();
        if (onCategoryPress) onCategoryPress(item);
        else router.push({ pathname: '/kouponly/category/[id]', params: { id: item.id, name: item.name, englishName: item.englishName || item.name } } as any);
    };

    const renderCategory = (item: CategoryItem, itemWidth = columnWidth, labelColor = theme.text) => (
        <ScalePressable
            key={item.id}
            style={[styles.categoryItem, { width: itemWidth }]}
            onPress={() => openCategory(item)}
            activeOpacity={0.78}
            accessibilityRole="button"
            accessibilityLabel={item.name}
        >
            <View style={[styles.imageContainer, { width: imageSize, height: imageSize, backgroundColor: theme.surface, borderColor: BorderPalette.border }]}>
                {item.image ? (
                    <RemoteImage source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.categoryImage} contentFit="contain" />
                ) : (
                    <Text style={[styles.categoryFallbackIcon, { color: theme.text }]}>{item.icon}</Text>
                )}
            </View>
            <Text style={[styles.categoryName, { color: labelColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {item.name}
            </Text>
        </ScalePressable>
    );

    if (!propCategories && isLoading) {
        return <ZigzagSection width={width} cutoutColor={theme.background} contentStyle={styles.sectionContent} collapseCompletely backgroundColor="transparent">
            <View style={[styles.container, styles.grid]}>
                {Array.from({ length: 10 }, (_, index) => (
                    <View key={`category-skeleton-${index}`} style={[styles.categoryItem, { width: columnWidth }]}>
                        <View style={[styles.categorySkeleton, { width: imageSize, height: imageSize, backgroundColor: theme.cardMuted }]} />
                    </View>
                ))}
            </View>
        </ZigzagSection>;
    }

    if (!propCategories && error) return <StateSurface kind="error" compact onRetry={() => void refetch()} />;
    if (categories.length === 0) return null;

    const hasMore = categories.length > 4;
    const visibleCategories = hasMore ? categories.slice(0, 4) : categories;
    const drawerColumnWidth = (width - 48) / 3;
    const drawerRows = categories.slice(4).reduce<CategoryItem[][]>((rows, item, index) => {
        if (index % 3 === 0) rows.push([]);
        rows[rows.length - 1].push(item);
        return rows;
    }, []);

    return <>
        <ZigzagSection width={width} cutoutColor={theme.background} contentStyle={styles.sectionContent} collapseCompletely backgroundColor="transparent">
            <View style={[styles.container, { minHeight: rowHeight }]}>
                <View style={styles.homeRow}>
                    {visibleCategories.map(item => renderCategory(item))}
                    {hasMore ? (
                        <ScalePressable
                            style={[styles.categoryItem, { width: columnWidth }]}
                            onPress={() => setMoreVisible(true)}
                            activeOpacity={0.78}
                            accessibilityRole="button"
                            accessibilityLabel={t('more')}
                        >
                            <View style={[styles.moreButton, { width: imageSize, height: imageSize, backgroundColor: theme.surface, borderColor: BorderPalette.border }]}>
                                <Ellipsis size={28} color={theme.text} />
                            </View>
                            <Text style={[styles.categoryName, { color: theme.text }]} numberOfLines={1}>{t('more')}</Text>
                        </ScalePressable>
                    ) : null}
                </View>
            </View>
        </ZigzagSection>
        <AndroidBottomSheetModal visible={moreVisible} onClose={() => setMoreVisible(false)} testID="category-drawer">
            <Text accessibilityRole="header" style={[styles.drawerTitle, { color: theme.text }]}>{t('category_grid_title')}</Text>
            <ScrollView style={{ maxHeight: height * 0.65 }} contentContainerStyle={styles.drawerRows} showsVerticalScrollIndicator={false}>
                {drawerRows.map((row, rowIndex) => (
                    <View key={`category-row-${rowIndex}`} style={styles.drawerRow}>
                        {row.map(item => renderCategory(item, drawerColumnWidth))}
                    </View>
                ))}
            </ScrollView>
        </AndroidBottomSheetModal>
    </>;
}

const styles = StyleSheet.create({
    sectionContent: { paddingTop: 0, paddingBottom: 8 },
    container: { paddingHorizontal: 4, paddingTop: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    homeRow: { flexDirection: 'row', justifyContent: 'space-between' },
    categoryItem: { alignItems: 'center', paddingHorizontal: 1 },
    imageContainer: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, marginBottom: 7 },
    categoryImage: { width: '100%', height: '100%' },
    categoryFallbackIcon: { fontSize: 34, ...Typography.getTextVariantStyle('body') },
    categoryName: { width: '100%', minHeight: 18, fontSize: 13, lineHeight: 16, ...Typography.getTextVariantStyle('body'), textAlign: 'center', textAlignVertical: 'top' },
    categorySkeleton: { borderRadius: 22, opacity: 0.8, overflow: 'hidden', justifyContent: 'flex-end' },
    moreButton: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, marginBottom: 7 },
    drawerTitle: { marginHorizontal: 24, marginBottom: 12, fontSize: 20, fontWeight: '700' },
    drawerRows: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
    drawerRow: { flexDirection: 'row', justifyContent: 'flex-start' },
});

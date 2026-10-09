import { memo, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '../../context/LocaleContext';
import { HeaderIconButton } from '../navigation/AppHeader';

type Props = {
    onBackPress?: () => void;
    accessory?: ReactNode;
};

function CategoryHeader({ onBackPress, accessory }: Props) {
    const { isRTL } = useAppLocale();
    const { t } = useTranslation();

    return (
        <View style={styles.container}>
            <HeaderIconButton
                icon={isRTL ? 'arrow-forward' : 'arrow-back'}
                onPress={() => onBackPress?.()}
                accessibilityLabel={t('back')}
            />


            <View style={styles.contentContainer}>
                {accessory}
            </View>
        </View>
    );
}

export default memo(CategoryHeader);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 56,
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    contentContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/context/AppThemeContext';
import SearchBar from './SearchBar';
import { HOME_HORIZONTAL_GUTTER } from './layout';

type Props = {
    userName: string;
    searchQuery: string;
    onSearchChange: (text: string) => void;
    onSearchSubmit: () => void;
    testID?: string;
};

export default function GreetingHeader({ userName, searchQuery, onSearchChange, onSearchSubmit, testID }: Props) {
    const { t } = useTranslation();
    const { theme } = useAppTheme();

    return (
        <View style={styles.container}>
            <SearchBar
                compact
                testID={testID}
                placeholder={t('home_search_placeholder', { name: userName })}
                value={searchQuery}
                onChangeText={onSearchChange}
                onSubmit={onSearchSubmit}
            />
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notifications_title')}
                hitSlop={8}
                onPress={() => router.push('/notifications' as any)}
                style={styles.notificationButton}
            >
                <Ionicons name="notifications-outline" size={24} color={theme.icon} />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: HOME_HORIZONTAL_GUTTER,
        gap: 12,
    },
    notificationButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

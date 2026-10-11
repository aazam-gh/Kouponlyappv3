import { Colors as BorderPalette } from '@/constants/Colors';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMotionPreferences } from '@/lib/theme';
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
    const { reduceMotion } = useMotionPreferences();
    const bellRotation = useSharedValue(0);
    const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${bellRotation.get()}deg` }] }));
    const openNotifications = () => router.push('/notifications' as any);
    const handleNotificationPress = () => {
        if (reduceMotion) {
            openNotifications();
            return;
        }
        bellRotation.set(withSequence(
            withTiming(-18, { duration: 55 }),
            withTiming(18, { duration: 90 }),
            withTiming(-12, { duration: 75 }),
            withTiming(0, { duration: 80 }, finished => {
                if (finished) scheduleOnRN(openNotifications);
            }),
        ));
    };
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
            <ScalePressable
                accessibilityRole="button"
                accessibilityLabel={t('notifications_title')}
                hitSlop={8}
                onPress={handleNotificationPress}
                style={styles.notificationButton}
            >
                <Animated.View style={bellStyle}>
                    <Ionicons name="notifications-outline" size={24} color="#000000" />
                </Animated.View>
            </ScalePressable>
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
        borderRadius: 24,
        borderWidth: 1,
        borderColor: BorderPalette.border,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
});

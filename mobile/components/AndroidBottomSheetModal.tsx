import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/AppThemeContext';

type AndroidBottomSheetModalProps = {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    backgroundColor?: string;
    testID?: string;
};

const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;

export default function AndroidBottomSheetModal({
    visible,
    onClose,
    children,
    backgroundColor,
    testID,
}: AndroidBottomSheetModalProps) {
    const insets = useSafeAreaInsets();
    const { theme } = useAppTheme();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const sheetBackground = backgroundColor ?? theme.surfaceElevated;

    const [mounted, setMounted] = useState(visible);
    // Start fully off-screen so the first painted frame is hidden (kills the open flicker).
    const translateY = useSharedValue(windowHeight);
    const sheetHeight = useRef(windowHeight);
    const hasOpened = useRef(false);

    useEffect(() => {
        if (visible) {
            setMounted(true);
        } else if (mounted) {
            hasOpened.current = false;
            translateY.value = withTiming(
                sheetHeight.current,
                { duration: CLOSE_DURATION, easing: Easing.in(Easing.cubic) },
                (finished) => {
                    if (finished) {
                        runOnJS(setMounted)(false);
                    }
                },
            );
        }
    }, [visible, mounted, translateY]);

    // Trigger the open animation only once we've measured the sheet, so the slide
    // distance is exact and never animates from a stale/default position.
    const handleLayout = (height: number) => {
        sheetHeight.current = height;
        if (visible && !hasOpened.current) {
            hasOpened.current = true;
            translateY.value = withSequence(
                withTiming(height, { duration: 0 }),
                withTiming(0, { duration: OPEN_DURATION, easing: Easing.out(Easing.cubic) }),
            );
        }
    };

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    if (!mounted) {
        return null;
    }

    return (
        <Modal
            visible
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <Pressable
                style={[styles.root, { backgroundColor: theme.overlay }]}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
            >
                <Animated.View
                    style={[
                        styles.sheet,
                        sheetStyle,
                        {
                            backgroundColor: sheetBackground,
                            paddingBottom: Math.max(insets.bottom, 16),
                            maxWidth: windowWidth >= 840 ? 720 : undefined,
                            alignSelf: windowWidth >= 840 ? 'center' : undefined,
                            width: windowWidth >= 840 ? '100%' : undefined,
                        },
                    ]}
                    onLayout={(event) => handleLayout(event.nativeEvent.layout.height)}
                    testID={testID}
                >
                    <Pressable onPress={(event) => event.stopPropagation()}>
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
                        </View>
                        {children}
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        width: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    handle: {
        width: 40,
        height: 5,
        borderRadius: 2.5,
    },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useMotionPreferences } from '@/lib/theme';
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
    const { reduceMotion } = useMotionPreferences();
    const { height: windowHeight, width: windowWidth } = useWindowDimensions();
    const sheetBackground = backgroundColor ?? theme.surfaceElevated;

    const [mounted, setMounted] = useState(visible);
    const visibleRef = useRef(visible);
    visibleRef.current = visible;
    const finishClose = useCallback(() => { if (!visibleRef.current) setMounted(false); }, []);
    const progress = useSharedValue(0);
    const sheetHeight = useSharedValue(windowHeight);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            progress.set(withTiming(1, { duration: reduceMotion ? 0 : OPEN_DURATION, easing: Easing.bezier(0.32, 0.72, 0, 1) }));
        } else if (mounted) {
            progress.set(withTiming(
                0,
                { duration: reduceMotion ? 0 : CLOSE_DURATION, easing: Easing.bezier(0.32, 0.72, 0, 1) },
                (finished) => {
                    if (finished) {
                        scheduleOnRN(finishClose);
                    }
                },
            ));
        }
        return () => cancelAnimation(progress);
    }, [visible, mounted, progress, reduceMotion, finishClose]);

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: reduceMotion ? 0 : (1 - progress.get()) * sheetHeight.get() }],
        opacity: reduceMotion ? progress.get() : 1,
    }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));

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
            <View style={styles.root} accessibilityViewIsModal>
                <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }, backdropStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
                </Animated.View>
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
                    onLayout={(event) => sheetHeight.set(event.nativeEvent.layout.height)}
                    testID={testID}
                >
                    <View>
                        <View style={styles.handleContainer}>
                            <View style={[styles.handle, { backgroundColor: theme.borderStrong }]} />
                        </View>
                        {children}
                    </View>
                </Animated.View>
            </View>
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

import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

type ScalePressableProps = Omit<PressableProps, 'style'> & {
    disabledOpacity?: number;
    pressedScale?: number;
    style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ScalePressable({
    accessibilityState,
    disabled,
    disabledOpacity = 0.55,
    onPressIn,
    onPressOut,
    pressedScale = 0.97,
    style,
    ...props
}: ScalePressableProps) {
    const isDisabled = disabled === true;
    const reduceMotion = useReducedMotion();
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: isDisabled ? disabledOpacity : 1,
        transform: [{ scale: scale.value }],
    }));

    return (
        <AnimatedPressable
            {...props}
            accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
            disabled={disabled}
            onPressIn={(event) => {
                if (!reduceMotion && !isDisabled) {
                    scale.value = withTiming(pressedScale, { duration: 80 });
                }
                onPressIn?.(event);
            }}
            onPressOut={(event) => {
                if (!reduceMotion && !isDisabled) {
                    scale.value = withSpring(1, { damping: 18, stiffness: 260, mass: 0.7 });
                }
                onPressOut?.(event);
            }}
            style={[style, animatedStyle]}
        />
    );
}

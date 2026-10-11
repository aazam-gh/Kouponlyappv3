import { forwardRef, useEffect, useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type View } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';
import { useAppTheme } from '@/lib/theme';

export type ScalePressableProps = PressableProps & {
    activeOpacity?: number;
    disabledOpacity?: number;
    pressedScale?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const easeOut = cubicBezier(0.23, 1, 0.32, 1);

const ScalePressable = forwardRef<View, ScalePressableProps>(function ScalePressable({
    accessibilityRole = 'button',
    accessibilityState,
    activeOpacity = 0.88,
    children,
    disabled,
    disabledOpacity = 1,
    onPressIn,
    onPressOut,
    onHoverIn,
    onHoverOut,
    pressedScale = 0.98,
    style,
    ...props
}, ref) {
    const { motion } = useAppTheme();
    const [pressed, setPressed] = useState(false);
    const [hovered, setHovered] = useState(false);
    const isDisabled = disabled === true || accessibilityState?.disabled === true;
    useEffect(() => { if (isDisabled) setPressed(false); }, [isDisabled]);
    const isPressed = pressed && !isDisabled;
    const resolvedStyle = typeof style === 'function' ? style({ pressed: isPressed, hovered }) : style;
    const flatStyle = StyleSheet.flatten(resolvedStyle);

    return (
        <AnimatedPressable
            {...props}
            ref={ref}
            accessibilityRole={accessibilityRole}
            accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
            disabled={isDisabled}
            pressRetentionOffset={props.pressRetentionOffset ?? 16}
            onPressIn={(event) => {
                setPressed(true);
                onPressIn?.(event);
            }}
            onPressOut={(event) => {
                setPressed(false);
                onPressOut?.(event);
            }}
            onHoverIn={(event) => { setHovered(true); onHoverIn?.(event); }}
            onHoverOut={(event) => { setHovered(false); onHoverOut?.(event); }}
            style={[
                resolvedStyle,
                {
                    opacity: typeof flatStyle?.opacity === 'object' ? flatStyle.opacity : (flatStyle?.opacity ?? 1) * (isDisabled ? disabledOpacity : isPressed ? activeOpacity : 1),
                    transform: [...(Array.isArray(flatStyle?.transform) ? flatStyle.transform : []), { scale: isPressed && !motion.reduceMotion ? pressedScale : 1 }],
                    transitionProperty: ['transform', 'opacity', 'backgroundColor', 'borderColor'],
                    transitionDuration: motion.reduceMotion ? 0 : 120,
                    transitionTimingFunction: easeOut,
                },
            ]}
        >
            {typeof children === 'function' ? children({ pressed: isPressed, hovered }) : children}
        </AnimatedPressable>
    );
});

export default ScalePressable;

import { useContext, useState, type ReactNode } from 'react';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ZigzagRevealContext } from './ScrollCrunchSection';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';

const EDGE_HEIGHT = 10;

export function interlockingZigzagPath(width: number, bottom = false) {
    let path = 'M 0 0';
    for (let x = 0; x < width; x += 24) path += ` L ${x + 12} ${EDGE_HEIGHT} L ${x + 24} 0`;
    const outside = bottom ? EDGE_HEIGHT : 0;
    return `${path} L ${width} ${outside} L 0 ${outside} Z`;
}

function InterlockingCutout({ width, bottom = false, color }: { width: number; bottom?: boolean; color: string }) {
    // The same boundary phase cuts above the top teeth and below the bottom teeth.
    return <Svg width={width} height={EDGE_HEIGHT} viewBox={`0 0 ${width} ${EDGE_HEIGHT}`}><Path d={interlockingZigzagPath(width, bottom)} fill={color} /></Svg>;
}

function ZigzagEdge({ width, bottom = false }: { width: number; bottom?: boolean; cutoutColor: string }) {
    let path = `M 0 ${EDGE_HEIGHT}`;
    for (let x = 0; x < width; x += 24) {
        path += ` Q ${x + 6} 0 ${x + 12} ${EDGE_HEIGHT / 2} Q ${x + 18} ${EDGE_HEIGHT} ${x + 24} ${EDGE_HEIGHT}`;
    }
    path += ` L ${width} ${EDGE_HEIGHT} L 0 ${EDGE_HEIGHT} Z`;
    return <Svg width={width} height={EDGE_HEIGHT} viewBox={`0 0 ${width} ${EDGE_HEIGHT}`} style={bottom ? { transform: [{ rotate: '180deg' }] } : undefined}><Path d={path} fill={Colors.brandGreen} stroke={Colors.brandGreen} strokeWidth={bottom ? 4 : 1} /></Svg>;
}

export default function ZigzagSection({ width, cutoutColor, children, contentStyle, collapseCompletely = false, backgroundColor = Colors.brandGreen }: { width: number; cutoutColor: string; children: ReactNode; contentStyle?: StyleProp<ViewStyle>; collapseCompletely?: boolean; backgroundColor?: string }) {
    const reveal = useContext(ZigzagRevealContext);
    const height = useSharedValue(0);
    const [contentVisible, setContentVisible] = useState(true);
    useAnimatedReaction(
        () => (reveal?.get() ?? 1) > 0,
        (visible, previous) => { if (visible !== previous) scheduleOnRN(setContentVisible, visible); },
        [reveal, collapseCompletely],
    );
    const clipStyle = useAnimatedStyle(() => {
        const closedHeight = Math.max(0, height.get() - (collapseCompletely ? 0 : EDGE_HEIGHT * 2)) * (1 - (reveal?.get() ?? 1));
        return { transform: [{ translateY: -closedHeight }] };
    });
    const anchoredStyle = useAnimatedStyle(() => {
        const closedHeight = Math.max(0, height.get() - (collapseCompletely ? 0 : EDGE_HEIGHT * 2)) * (1 - (reveal?.get() ?? 1));
        // Counter the mask translation so the top edge and content never move or scale.
        return { transform: [{ translateY: closedHeight }] };
    });
    return <View testID="zigzag-section" pointerEvents="box-none" style={styles.clip} onLayout={event => height.set(event.nativeEvent.layout.height)}>
        <Animated.View testID="zigzag-clip" pointerEvents="box-none" style={[styles.clip, clipStyle]}>
            <Animated.View testID="zigzag-anchored-content" style={anchoredStyle} pointerEvents={contentVisible ? 'auto' : 'none'} accessibilityElementsHidden={!contentVisible} importantForAccessibility={contentVisible ? 'auto' : 'no-hide-descendants'}>
                <View testID="zigzag-background" accessible={false} pointerEvents="none" style={[StyleSheet.absoluteFill, collapseCompletely && { backgroundColor }]}>
                    {!collapseCompletely ? <>
                    <View testID="zigzag-top-edge"><ZigzagEdge width={width} cutoutColor={cutoutColor} /></View>
                    <View style={{ flex: 1, backgroundColor: Colors.brandGreen }} />
                    <View style={{ height: EDGE_HEIGHT - 1 }} />
                    </> : null}
                </View>
                <View style={{ height: EDGE_HEIGHT }} />
                <View testID="zigzag-content" style={[styles.content, contentStyle]}>{children}</View>
                <View style={{ height: EDGE_HEIGHT - 1 }} />
                {collapseCompletely ? <View testID="zigzag-top-edge" accessible={false} pointerEvents="none" style={styles.topEdge}><InterlockingCutout width={width} color={cutoutColor} /></View> : null}
            </Animated.View>
            <View testID="zigzag-bottom-edge" accessible={false} pointerEvents="none" style={[styles.bottomEdge, !collapseCompletely && { backgroundColor: cutoutColor }]}>{collapseCompletely ? <InterlockingCutout width={width} bottom color={cutoutColor} /> : <ZigzagEdge width={width} bottom cutoutColor={cutoutColor} />}</View>
        </Animated.View>
    </View>;
}

const styles = StyleSheet.create({
    clip: { overflow: 'hidden' },
    topEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: EDGE_HEIGHT },
    bottomEdge: { position: 'absolute', bottom: 0, left: 0, right: 0, height: EDGE_HEIGHT },
    content: { paddingTop: 12, paddingBottom: 24 },
});

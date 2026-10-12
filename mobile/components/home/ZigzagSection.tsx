import { useContext, type ReactNode } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ZigzagRevealContext } from './ScrollCrunchSection';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';

const EDGE_HEIGHT = 10;

function ZigzagEdge({ width, bottom = false }: { width: number; bottom?: boolean; cutoutColor: string }) {
    let path = `M 0 ${EDGE_HEIGHT}`;
    for (let x = 0; x < width; x += 24) {
        path += ` Q ${x + 6} 0 ${x + 12} ${EDGE_HEIGHT / 2} Q ${x + 18} ${EDGE_HEIGHT} ${x + 24} ${EDGE_HEIGHT}`;
    }
    path += ` L ${width} ${EDGE_HEIGHT} L 0 ${EDGE_HEIGHT} Z`;
    return <Svg width={width} height={EDGE_HEIGHT} viewBox={`0 0 ${width} ${EDGE_HEIGHT}`} style={bottom ? { transform: [{ rotate: '180deg' }], marginTop: -1 } : undefined}><Path d={path} fill={Colors.brandGreen} stroke={Colors.brandGreen} strokeWidth={bottom ? 4 : 1} /></Svg>;
}

export default function ZigzagSection({ width, cutoutColor, children, contentStyle }: { width: number; cutoutColor: string; children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
    const reveal = useContext(ZigzagRevealContext);
    const backgroundStyle = useAnimatedStyle(() => {
        const progress = reveal?.get() ?? 1;
        return { opacity: progress, transform: [{ scaleX: progress }, { scaleY: progress }] };
    });
    return <View>
        <Animated.View testID="zigzag-background" accessible={false} pointerEvents="none" style={[StyleSheet.absoluteFill, backgroundStyle]}>
            <ZigzagEdge width={width} cutoutColor={cutoutColor} />
            <View style={{ flex: 1, backgroundColor: Colors.brandGreen }} />
            <ZigzagEdge width={width} bottom cutoutColor={cutoutColor} />
        </Animated.View>
        <View style={{ height: EDGE_HEIGHT }} />
        <View testID="zigzag-content" style={[styles.content, contentStyle]}>{children}</View>
        <View style={{ height: EDGE_HEIGHT - 1 }} />
    </View>;
}

const styles = StyleSheet.create({
    content: { paddingTop: 12, paddingBottom: 24 },
});

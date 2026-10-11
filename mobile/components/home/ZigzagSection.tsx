import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '@/constants/Colors';

const EDGE_HEIGHT = 12;
const BOTTOM_EDGE_INSET = 1;

function ZigzagEdge({ width, bottom = false, cutoutColor }: { width: number; bottom?: boolean; cutoutColor: string }) {
    if (bottom) {
        // Keep a one-pixel lime connection to the section content so SVG
        // antialiasing cannot expose a white hairline before the teeth.
        const baseline = BOTTOM_EDGE_INSET;
        const bottomY = EDGE_HEIGHT + BOTTOM_EDGE_INSET;
        let cutoutPath = `M 0 ${baseline}`;
        for (let x = 10, point = 1; x < width; x += 10, point += 1) {
            cutoutPath += ` L ${x} ${point % 2 === 1 ? bottomY : baseline}`;
        }
        cutoutPath += ` L ${width} ${baseline} L ${width} ${bottomY} L 0 ${bottomY} Z`;
        return <Svg width={width} height={bottomY} viewBox={`0 0 ${width} ${bottomY}`} preserveAspectRatio="none">
            <Path d={`M 0 0 H ${width} V ${bottomY} H 0 Z`} fill={Colors.limeGreen} />
            <Path d={cutoutPath} fill={cutoutColor} />
        </Svg>;
    }

    const baseline = EDGE_HEIGHT;
    let path = `M 0 ${baseline}`;
    for (let x = 10, point = 1; x < width; x += 10, point += 1) {
        path += ` L ${x} ${point % 2 === 0 ? baseline : EDGE_HEIGHT - baseline}`;
    }
    path += ` L ${width} ${baseline} Z`;
    return <Svg width={width} height={EDGE_HEIGHT} viewBox={`0 0 ${width} ${EDGE_HEIGHT}`} preserveAspectRatio="none"><Path d={path} fill={Colors.limeGreen} /></Svg>;
}

export default function ZigzagSection({ width, cutoutColor, children }: { width: number; cutoutColor: string; children: ReactNode }) {
    return <View>
        <ZigzagEdge width={width} cutoutColor={cutoutColor} />
        <View style={styles.content}>{children}</View>
        <ZigzagEdge width={width} bottom cutoutColor={cutoutColor} />
    </View>;
}

const styles = StyleSheet.create({
    content: { paddingTop: 12, paddingBottom: 24, backgroundColor: Colors.limeGreen },
});

import { useWindowDimensions, StyleSheet } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useAppTheme } from '@/context/AppThemeContext';

type SpriteKind = 'sparkle' | 'ticket' | 'heart' | 'orbit' | 'leaf' | 'star';
type SpritePlacement = { kind: SpriteKind; x: number; y: number; size: number; rotation: number; opacity: number };

function Sprite({ kind }: { kind: SpriteKind }) {
  if (kind === 'sparkle') return <Path d="M12 1.5 14.4 9l7.4 3-7.4 3-2.4 7.5L9.6 15l-7.4-3 7.4-3z" fill="currentColor" />;
  if (kind === 'ticket') return <>
    <Path d="M3 5h18v4a3 3 0 0 0 0 6v4H3v-4a3 3 0 0 0 0-6z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <Path d="M12 7v10" stroke="currentColor" strokeWidth={1.6} strokeDasharray="2 2" />
  </>;
  if (kind === 'heart') return <Path d="M12 21s-8.5-5.1-8.5-11.3A4.7 4.7 0 0 1 12 6.9a4.7 4.7 0 0 1 8.5 2.8C20.5 15.9 12 21 12 21Z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />;
  if (kind === 'orbit') return <>
    <Circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" strokeWidth={1.7} />
    <Circle cx="18.5" cy="7" r="2.5" fill="currentColor" />
    <Circle cx="8" cy="10" r="1.3" fill="currentColor" />
  </>;
  if (kind === 'leaf') return <>
    <Path d="M20.5 3.5C10 3.5 4 7.8 4 14.2a5.8 5.8 0 0 0 5.8 5.8c6.4 0 10.7-6 10.7-16.5Z" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
    <Path d="M5 19 15.8 8.2" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
  </>;
  return <>
    <Path d="m12 2 2.7 6.6 7.1.5-5.4 4.7 1.7 7-6.1-3.8-6.1 3.8 1.7-7-5.4-4.7 7.1-.5z" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    <Circle cx="12" cy="12.5" r="1.4" fill="currentColor" />
  </>;
}

export default function ProfileSprites() {
  const { width, height } = useWindowDimensions();
  const { theme, isDark } = useAppTheme();
  const sprites: SpritePlacement[] = [
    { kind: 'sparkle', x: 3, y: height * 0.08, size: 19, rotation: -12, opacity: 0.22 },
    { kind: 'orbit', x: width - 22, y: height * 0.15, size: 18, rotation: 12, opacity: 0.20 },
    { kind: 'ticket', x: 2, y: height * 0.25, size: 19, rotation: -9, opacity: 0.21 },
    { kind: 'heart', x: width - 22, y: height * 0.34, size: 18, rotation: 11, opacity: 0.19 },
    { kind: 'leaf', x: 3, y: height * 0.43, size: 19, rotation: -8, opacity: 0.19 },
    { kind: 'star', x: width - 22, y: height * 0.52, size: 19, rotation: 8, opacity: 0.21 },
    { kind: 'orbit', x: 3, y: height * 0.61, size: 18, rotation: 0, opacity: 0.18 },
    { kind: 'ticket', x: width - 22, y: height * 0.69, size: 19, rotation: 8, opacity: 0.20 },
    { kind: 'sparkle', x: 3, y: height * 0.77, size: 18, rotation: 8, opacity: 0.20 },
    { kind: 'heart', x: width - 22, y: height * 0.85, size: 18, rotation: -10, opacity: 0.18 },
    { kind: 'star', x: 3, y: height * 0.91, size: 17, rotation: -8, opacity: 0.18 },
    { kind: 'orbit', x: width - 22, y: height * 0.93, size: 17, rotation: 8, opacity: 0.18 },
  ];
  const spriteColor = isDark ? '#67D992' : theme.brand;

  return (
    <Svg
      accessible={false}
      pointerEvents="none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={StyleSheet.absoluteFill}
    >
      {sprites.map((sprite, index) => (
        <G
          key={`${sprite.kind}-${index}`}
          transform={`translate(${sprite.x} ${sprite.y}) rotate(${sprite.rotation} 12 12) scale(${sprite.size / 24})`}
          opacity={sprite.opacity}
          color={spriteColor}
        >
          <Sprite kind={sprite.kind} />
        </G>
      ))}
    </Svg>
  );
}

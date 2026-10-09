import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle, View, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { Typography } from '../../constants/Typography';

type StaggeredHeadingTextProps = {
  text: string;
  delay?: number;
  loopPauseMs?: number;
  staggerMs?: number;
  fontHeight: number;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

type StaggeredCharacterProps = {
  character: string;
  fontHeight: number;
  index: number;
  progress: SharedValue<number>;
  staggerMs: number;
  textStyle?: StyleProp<TextStyle>;
};

function splitText(text: string) {
  return text.trim().split(/\s+/g);
}

function StaggeredCharacter({
  character,
  fontHeight,
  index,
  progress,
  staggerMs,
  textStyle,
}: StaggeredCharacterProps) {
  const delayedProgress = useDerivedValue(() => {
    return withDelay(
      index * staggerMs,
      withSpring(progress.value, {
        damping: 18,
        mass: 0.65,
        stiffness: 170,
      }),
    );
  }, [index, staggerMs]);

  const topStyle = useAnimatedStyle(() => ({
    opacity: 1 - delayedProgress.value,
    transform: [
      { perspective: 1000 },
      { translateY: (-delayedProgress.value * fontHeight) / 2 },
      { rotateX: `${delayedProgress.value * 90}deg` },
    ],
  }));

  const bottomStyle = useAnimatedStyle(() => {
    const rotateX = interpolate(delayedProgress.value, [0, 1], [-90, 0]);
    const translateY = interpolate(delayedProgress.value, [0, 1], [fontHeight / 2, 0]);

    return {
      opacity: delayedProgress.value,
      transform: [
        { perspective: 1000 },
        { translateY },
        { rotateX: `${rotateX}deg` },
      ],
    };
  });

  return (
    <View style={[styles.characterContainer, { height: fontHeight }]}>
      <Animated.Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[textStyle, topStyle]}>
        {character}
      </Animated.Text>
      <Animated.Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.bottomCharacter, textStyle, bottomStyle]}
      >
        {character}
      </Animated.Text>
    </View>
  );
}

export default function StaggeredHeadingText({
  containerStyle,
  delay = 0,
  fontHeight,
  loopPauseMs = 1600,
  staggerMs = 34,
  text,
  textStyle,
}: StaggeredHeadingTextProps) {
  const prefersReducedMotion = useReducedMotion();
  const progress = useSharedValue(prefersReducedMotion ? 1 : 0);
  const characters = useMemo(() => splitText(text), [text]);

  useEffect(() => {
    progress.value = prefersReducedMotion ? 1 : 0;

    if (prefersReducedMotion) {
      return;
    }

    const cycleMs = characters.length * staggerMs + loopPauseMs;
    let isForward = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const startTimer = setTimeout(() => {
      progress.value = 1;
      interval = setInterval(() => {
        isForward = !isForward;
        progress.value = isForward ? 1 : 0;
      }, cycleMs);
    }, delay);

    return () => {
      clearTimeout(startTimer);
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [characters.length, delay, loopPauseMs, prefersReducedMotion, progress, staggerMs, text]);

  if (prefersReducedMotion) {
    return <Text style={[styles.headingText, textStyle]}>{text}</Text>;
  }

  return (
    <View accessible accessibilityLabel={text} style={[styles.container, containerStyle]}>
      {characters.map((character, index) => (
        <StaggeredCharacter
          character={character}
          fontHeight={fontHeight}
          index={index}
          key={`${character}-${index}`}
          progress={progress}
          staggerMs={staggerMs}
          textStyle={[styles.headingText, textStyle]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomCharacter: {
    left: 0,
    position: 'absolute',
    top: 0,
  },
  characterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  headingText: {
    ...Typography.getTextVariantStyle('display'),
  },
});

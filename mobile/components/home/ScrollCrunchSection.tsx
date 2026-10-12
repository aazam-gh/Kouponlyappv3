import { createContext, type ReactNode } from 'react';
import { View } from 'react-native';
import { Easing, useAnimatedReaction, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useMotionPreferences } from '@/lib/theme';

export const ZigzagRevealContext = createContext<SharedValue<number> | null>(null);

export function backgroundShouldExpand(top: number, height: number, viewportTop: number, viewportBottom: number, reduceMotion: boolean) {
  'worklet';
  if (reduceMotion || height <= 0 || viewportBottom <= viewportTop) return true;
  const center = top + height / 2;
  const inset = (viewportBottom - viewportTop) * 0.25;
  return center >= viewportTop + inset && center <= viewportBottom - inset;
}

export default function ScrollCrunchSection({ children, scrollY, viewportHeight, bottomInset, testID }: {
  children: ReactNode; scrollY: SharedValue<number>; viewportHeight: SharedValue<number>; bottomInset: number; testID: string;
}) {
  const { reduceMotion } = useMotionPreferences();
  const top = useSharedValue(0);
  const height = useSharedValue(0);
  const reveal = useSharedValue(1);
  useAnimatedReaction(
    () => backgroundShouldExpand(top.get() + 68 - scrollY.get(), height.get(), 68, viewportHeight.get() - bottomInset, reduceMotion),
    (expanded, previous) => {
      if (reduceMotion) reveal.set(1);
      else if (expanded !== previous) reveal.set(withTiming(expanded ? 1 : 0, { duration: 200, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    },
    [reduceMotion, bottomInset],
  );
  return <View testID={testID} onLayout={event => { top.set(event.nativeEvent.layout.y); height.set(event.nativeEvent.layout.height); }}>
    <ZigzagRevealContext.Provider value={reveal}>{children}</ZigzagRevealContext.Provider>
  </View>;
}

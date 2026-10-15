import { createContext, type ReactNode } from 'react';
import Animated, { Easing, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useMotionPreferences } from '@/lib/theme';

export const ZigzagRevealContext = createContext<SharedValue<number> | null>(null);

export function pinnedCategoryState(top: number, height: number, scrollY: number, headerHeight: number) {
  'worklet';
  if (height <= 0) return { translateY: 0, reveal: 1 };
  const translateY = Math.max(0, scrollY - Math.max(0, top - headerHeight));
  // The same scroll lifts the following section into the clipped space without relayout.
  return { translateY, reveal: Math.max(0, 1 - translateY / height) };
}

export function sectionShouldReveal(top: number, height: number, viewportTop: number, viewportBottom: number, reduceMotion: boolean) {
  'worklet';
  if (reduceMotion || height <= 0 || viewportBottom <= viewportTop) return true;
  const center = top + height / 2;
  const inset = (viewportBottom - viewportTop) * 0.25;
  return center >= viewportTop + inset && center <= viewportBottom - inset;
}

export default function ScrollCrunchSection({ children, scrollY, viewportHeight, bottomInset, testID, pinBelowHeader }: {
  children: ReactNode; scrollY: SharedValue<number>; viewportHeight: SharedValue<number>; bottomInset: number; testID: string; pinBelowHeader?: SharedValue<number>;
}) {
  const { reduceMotion } = useMotionPreferences();
  const top = useSharedValue(0);
  const height = useSharedValue(0);
  const reveal = useSharedValue(1);
  const pinnedStyle = useAnimatedStyle(() => pinBelowHeader && !reduceMotion ? {
    zIndex: 1,
    transform: [{ translateY: pinnedCategoryState(top.get() + 68, height.get(), scrollY.get(), pinBelowHeader.get()).translateY }],
  } : {});
  useAnimatedReaction(
    () => pinBelowHeader
      ? pinnedCategoryState(top.get() + 68, height.get(), scrollY.get(), pinBelowHeader.get()).reveal
      : Number(sectionShouldReveal(top.get() + 68 - scrollY.get(), height.get(), 68, viewportHeight.get() - bottomInset, reduceMotion)),
    (progress, previous) => {
      if (reduceMotion) reveal.set(1);
      else if (pinBelowHeader) reveal.set(progress);
      else if (progress !== previous) reveal.set(withTiming(progress, { duration: 800, easing: Easing.bezier(0.77, 0, 0.175, 1) }));
    },
    [reduceMotion, bottomInset, pinBelowHeader],
  );
  return <Animated.View testID={testID} pointerEvents="box-none" style={pinnedStyle} onLayout={event => { top.set(event.nativeEvent.layout.y); height.set(event.nativeEvent.layout.height); }}>
    <ZigzagRevealContext.Provider value={reveal}>{children}</ZigzagRevealContext.Provider>
  </Animated.View>;
}

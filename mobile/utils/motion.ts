import { Easing, FadeIn, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';

export const CONTENT_ENTER = FadeIn.duration(180).easing(Easing.bezier(0.23, 1, 0.32, 1)).reduceMotion(ReduceMotion.System);
export const CONTENT_EXIT = FadeOut.duration(120).reduceMotion(ReduceMotion.System);
export const CONTENT_LAYOUT = LinearTransition.duration(180).reduceMotion(ReduceMotion.System);

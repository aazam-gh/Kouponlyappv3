jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { GlassView: ({ children, ...props }: any) => React.createElement(View, props, children), GlassContainer: View, isLiquidGlassAvailable: () => false, isGlassEffectAPIAvailable: () => false };
});
import "./src/localization/i18n";
jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const value = (toValue: unknown) => toValue;
  const Animated = { View, Text: require("react-native").Text, ScrollView: require("react-native").ScrollView, createAnimatedComponent: (Component: unknown) => Component };
  const builder: any = new Proxy({}, { get: () => () => builder });
  return {
    __esModule: true,
    default: Animated,
    cubicBezier: (...args: number[]) => args,
    FadeIn: builder, FadeOut: builder, FadeInUp: builder, FadeInDown: builder, FadeOutUp: builder, LinearTransition: builder,
    ReducedMotionConfig: () => null,
    Easing: { cubic: value, quad: value, ease: value, in: value, out: value, inOut: value, bezier: () => value },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    ReduceMotion: { System: 'system', Never: 'never', Always: 'always' },
    cancelAnimation: jest.fn(),
    interpolate: (input: number, range: number[], output: number[]) => output[range.indexOf(input)] ?? output[0],
    interpolateColor: (_input: number, _range: number[], output: string[]) => output[0],
    runOnJS: (callback: (...args: any[]) => any) => callback,
    runOnUI: (callback: (...args: any[]) => any) => callback,
    useAnimatedReaction: jest.fn(),
    useAnimatedStyle: (styleFactory: () => unknown) => styleFactory(),
    useDerivedValue: (factory: () => unknown) => ({ value: factory() }),
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => { const ref = require("react").useRef(initial); return require("react").useMemo(() => ({ get value() { return ref.current; }, set value(next: unknown) { ref.current = next; }, get: () => ref.current, set: (next: unknown) => { ref.current = next; } }), []); },
    withDelay: (_duration: number, animation: unknown) => animation,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...animations: unknown[]) => animations[animations.length - 1],
    withSpring: value,
    withTiming: value,
  };
});
jest.mock("expo-blur", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { BlurView: ({ children, ...props }: any) => React.createElement(View, props, children) };
});
jest.mock("expo-haptics",()=>({selectionAsync:jest.fn(),impactAsync:jest.fn(),notificationAsync:jest.fn(),ImpactFeedbackStyle:{Light:"Light"},NotificationFeedbackType:{Success:"Success",Warning:"Warning",Error:"Error"}}));
jest.mock("expo-router", () => { const router={push:jest.fn(),replace:jest.fn(),back:jest.fn()}; return { router, useRouter:()=>router, useIsFocused:()=>true, useNavigation:()=>({addListener:jest.fn(()=>jest.fn())}), useLocalSearchParams:jest.fn(()=>({})), useFocusEffect:(callback:any)=>require("react").useEffect(callback,[callback]), Link:require("react-native").Text }; });
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return new Proxy({}, { get: () => (props: any) => React.createElement(View, { ...props, testID: props.testID ?? "icon" }) });
});

jest.mock("react-native-worklets", () => ({ scheduleOnRN: (callback: (...args: any[]) => any, ...args: any[]) => callback(...args) }));

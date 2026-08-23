jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { GlassView: ({ children, ...props }: any) => React.createElement(View, props, children), GlassContainer: View, isLiquidGlassAvailable: () => false, isGlassEffectAPIAvailable: () => false };
});
jest.mock("expo-blur", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { BlurView: ({ children, ...props }: any) => React.createElement(View, props, children) };
});
jest.mock("expo-haptics",()=>({selectionAsync:jest.fn(),impactAsync:jest.fn(),notificationAsync:jest.fn(),ImpactFeedbackStyle:{Light:"Light"},NotificationFeedbackType:{Success:"Success",Warning:"Warning",Error:"Error"}}));
jest.mock("expo-router", () => ({ router:{push:jest.fn(),replace:jest.fn(),back:jest.fn()}, useLocalSearchParams:jest.fn(()=>({})), Link:require("react-native").Text }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return new Proxy({}, { get: () => (props: any) => React.createElement(View, { ...props, testID: props.testID ?? "icon" }) });
});

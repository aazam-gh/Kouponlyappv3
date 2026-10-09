import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, Text, TextInput } from "react-native";

export type ThemeMode = "light" | "dark";
export type ThemePreference = ThemeMode | "system";

export interface ThemeColors {
  ink: string;
  inkOnAccent: string;
  blackSoft: string;
  lime: string;
  paper: string;
  elevated: string;
  card: string;
  muted: string;
  line: string;
  soft: string;
  success: string;
  danger: string;
  onDark: string;
  onDarkMuted: string;
  backdrop: string;
  glass: string;
  glassSolid: string;
  input: string;
}

export interface MotionPreferences {
  reduceMotion: boolean;
  reduceTransparency: boolean;
}

export interface Theme {
  mode: ThemeMode;
  preference: ThemePreference;
  dark: boolean;
  highContrast: boolean;
  boldText: boolean;
  colors: ThemeColors;
  motion: MotionPreferences;
  setPreference: (preference: ThemePreference) => void;
}

const light: ThemeColors = {
  ink: "#0A0F0C", inkOnAccent: "#0A0F0C", blackSoft: "#202020", lime: "#18B852",
  paper: "#FFFFFF", elevated: "#FFFFFF", card: "#FFFFFF", muted: "#5F6861",
  line: "#E2E8E1", soft: "#F1F4EF", success: "#08784F", danger: "#B42318",
  onDark: "#FFFFFF", onDarkMuted: "#D0D0D4", backdrop: "rgba(0,0,0,0.52)",
  glass: "rgba(255,255,255,0.48)", glassSolid: "#F7F8F6", input: "#FFFFFF",
};

const dark: ThemeColors = {
  ink: "#F4F8F3", inkOnAccent: "#080808", blackSoft: "#E4E4E7", lime: "#18B852",
  paper: "#0B0F0D", elevated: "#171C19", card: "#141916", muted: "#C8D0C8",
  line: "#29322D", soft: "#1E2420", success: "#52D69A", danger: "#FF6961",
  onDark: "#FFFFFF", onDarkMuted: "#D0D0D4", backdrop: "rgba(0,0,0,0.68)",
  glass: "rgba(17,21,19,0.54)", glassSolid: "#171C19", input: "#141916",
};

function withContrast(colors: ThemeColors, mode: ThemeMode): ThemeColors {
  return mode === "dark"
    ? { ...colors, muted: "#E0E0E4", line: "rgba(255,255,255,0.34)" }
    : { ...colors, muted: "#3A3A3F", line: "rgba(0,0,0,0.26)" };
}

const fallback: Theme = {
  mode: "light", preference: "system", dark: false, highContrast: false, boldText: false, colors: light,
  motion: { reduceMotion: false, reduceTransparency: false },
  setPreference: () => undefined,
};

const ThemeContext = createContext<Theme>(fallback);
let activeThemeColors: ThemeColors = light;
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference: ThemePreference = "light";
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [boldText, setBoldText] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduceTransparency);
    AccessibilityInfo.isBoldTextEnabled().then(setBoldText);
    const contrast = Platform.OS === "ios"
      ? AccessibilityInfo.isDarkerSystemColorsEnabled()
      : AccessibilityInfo.isHighTextContrastEnabled();
    contrast.then(setHighContrast).catch(() => undefined);
    const subscriptions = [
      AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion),
      AccessibilityInfo.addEventListener("reduceTransparencyChanged", setReduceTransparency),
      AccessibilityInfo.addEventListener("boldTextChanged", setBoldText),
      AccessibilityInfo.addEventListener(
        Platform.OS === "ios" ? "darkerSystemColorsChanged" : "highTextContrastChanged",
        setHighContrast,
      ),
    ];
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, []);

  const value = useMemo<Theme>(() => {
    const mode: ThemeMode = "light";
    const base = light;
    const colors = highContrast ? withContrast(base, "light") : base;
    return {
      mode,
      preference,
      dark: false,
      highContrast,
      boldText,
      colors,
      motion: { reduceMotion, reduceTransparency },
      setPreference: () => undefined,
    };
  }, [highContrast, boldText, reduceMotion, reduceTransparency]);

  useEffect(() => {
    activeThemeColors = value.colors;
    // Legacy screens still use React Native Text directly. Refresh the
    // inherited foreground color whenever the selected theme changes so text
    // does not stay black after switching to dark mode.
    (Text as any).defaultProps = {
      ...(Text as any).defaultProps,
      allowFontScaling: true,
      maxFontSizeMultiplier: 2.4,
      style: [{ color: value.colors.ink }],
    };
    (TextInput as any).defaultProps = {
      ...(TextInput as any).defaultProps,
      allowFontScaling: true,
      maxFontSizeMultiplier: 2.4,
      style: [{ color: value.colors.ink }],
    };
  }, [value.colors]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() { return useContext(ThemeContext); }
export function getTheme(mode: ThemeMode, highContrast = false): ThemeColors {
  const colors = mode === "dark" ? dark : light;
  return highContrast ? withContrast(colors, mode) : colors;
}

/**
 * Legacy screens can keep their StyleSheet API while resolving theme values
 * when a style is read, instead of freezing the initial appearance at import.
 */
export function dynamicStyles<T extends Record<string, unknown>>(
  factory: (colors: ThemeColors) => T,
): T {
  return new Proxy({} as T, {
    get: (_target, property: string) => factory(C)[property as keyof T],
  });
}

function channel(value:number){const normalized=value/255;return normalized<=0.03928?normalized/12.92:Math.pow((normalized+0.055)/1.055,2.4)}
export function contrastRatio(foreground:string,background:string){const parse=(color:string)=>{const hex=color.replace("#","");const expanded=hex.length===3?hex.split("").map(x=>x+x).join(""):hex;const [r,g,b]=[0,2,4].map(index=>parseInt(expanded.slice(index,index+2),16));return .2126*channel(r)+.7152*channel(g)+.0722*channel(b)};const a=parse(foreground),b=parse(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}

// Legacy screens import C directly. Resolve each property at read time so the
// explicit appearance choice updates those screens too, without a rewrite of
// every existing StyleSheet declaration.
export const C: ThemeColors = new Proxy({ ...light }, {
  get: (_target, property: string) => activeThemeColors[property as keyof ThemeColors],
}) as ThemeColors;

// Ensure legacy screen copy follows appearance even before every Text node adopts AppText.
(Text as any).defaultProps = { ...(Text as any).defaultProps, allowFontScaling: true, maxFontSizeMultiplier: 2.4, style: [{ color: C.ink, fontFamily: "Poppins" }, (Text as any).defaultProps?.style] };
(TextInput as any).defaultProps = { ...(TextInput as any).defaultProps, allowFontScaling: true, maxFontSizeMultiplier: 2.4, style: [{ color: C.ink, fontFamily: "Poppins" }, (TextInput as any).defaultProps?.style] };
(Pressable as any).defaultProps = { ...(Pressable as any).defaultProps, accessibilityRole: "button", hitSlop: 4 };

export const F = {
  heading: "PoppinsBold",
  headingSemi: "PoppinsBold",
  body: "Poppins",
  bodySemi: "PoppinsBold",
  bodyBold: "PoppinsBold",
} as const;

export type TypographyVariant = "largeTitle" | "title" | "headline" | "body" | "callout" | "caption" | "eyebrow";

export const typography = {
  largeTitle: { fontFamily: F.heading, fontSize: 30, lineHeight: 34 },
  title: { fontFamily: F.headingSemi, fontSize: 22, lineHeight: 27 },
  headline: { fontFamily: F.bodyBold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 21 },
  callout: { fontFamily: F.bodySemi, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: F.body, fontSize: 12, lineHeight: 16 },
  eyebrow: { fontFamily: F.bodyBold, fontSize: 11, lineHeight: 15, letterSpacing: 0.8 },
} as const;

export const shadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
  android: { elevation: 3 },
  default: {},
});

export const darkShadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.36, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  android: { elevation: 4 },
  default: {},
});

export const layout = { gutter: 18, radius: 22, tabHeight: 76, maxWidth: 560, minTarget: 44 } as const;

import { Colors as BorderPalette } from '@/constants/Colors';
import Animated from 'react-native-reanimated';
import { useMotionPreferences } from '@/lib/theme';
import ScalePressable from '@/components/ScalePressable';
import Ionicons from "@expo/vector-icons/Ionicons";
import { GlassView, isGlassEffectAPIAvailable } from "expo-glass-effect";
import { useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet, TextInput, View } from 'react-native';
import { Typography } from "../../constants/Typography";
import { useAppTheme } from "../../context/AppThemeContext";
import { useAppLocale } from "../../context/LocaleContext";
import { HOME_HORIZONTAL_GUTTER } from "./layout";

type Props = {
  placeholder?: string;
  compact?: boolean;
  value?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  testID?: string;
};

function canUseNativeGlass() {
  if (Platform.OS !== "ios") return false;

  try {
    return isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

export default function SearchBar({
  placeholder = "Search for anything...",
  compact = false,
  value,
  onChangeText,
  onSubmit,
  onClear,
  testID,
}: Props) {
  const navigation = useNavigation();
  const { reduceMotion } = useMotionPreferences();
  const { isDark, theme } = useAppTheme();
  const useNativeGlass = !isDark && canUseNativeGlass();
  const showHighlights = !isDark;
  const [isFocused, setIsFocused] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const { isRTL } = useAppLocale();
  const isActive = isFocused || (value?.length ?? 0) > 0;
  const placeholderText = isActive ? "" : formatPlaceholder(animatedPlaceholder, isRTL);

  useEffect(() => {
    if (!onChangeText) return;

    const unsubscribe = navigation.addListener("blur", () => {
      onChangeText("");
    });

    return unsubscribe;
  }, [navigation, onChangeText]);

  useEffect(() => {
    if (reduceMotion || isActive) { setAnimatedPlaceholder(placeholder); return; }
    let index = 0;
    let direction: "typing" | "deleting" = "typing";
    let frame: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (direction === "typing") {
        index += 1;
        setAnimatedPlaceholder(placeholder.slice(0, index));

        if (index >= placeholder.length) {
          direction = "deleting";
          frame = setTimeout(tick, 1400);
          return;
        }

        frame = setTimeout(tick, 55);
        return;
      }

      index -= 1;
      setAnimatedPlaceholder(placeholder.slice(0, index));

      if (index <= 0) {
        direction = "typing";
        frame = setTimeout(tick, 450);
        return;
      }

      frame = setTimeout(tick, 26);
    };

    setAnimatedPlaceholder("");
    frame = setTimeout(tick, 55);

    return () => clearTimeout(frame);
  }, [isActive, placeholder, reduceMotion]);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }

    onChangeText?.("");
  };

  return (
    <Animated.View style={[styles.searchShell, { backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: BorderPalette.border }, compact && styles.searchShellCompact]}>
      {useNativeGlass ? (
        <GlassView
          style={[styles.searchSurface, compact && styles.searchSurfaceCompact, { backgroundColor: theme.inputBackground, borderWidth: 0 }]}
          glassEffectStyle="regular"
          colorScheme={isDark ? "dark" : "light"}
          tintColor={theme.inputBackground}
        >
          {showHighlights ? <GlassHighlights topColor={theme.inputHighlight} bottomColor={theme.inputShade} /> : null}
          <SearchBarContent
            testID={testID}
            placeholder={placeholderText}
            value={value}
            onChangeText={onChangeText}
            onSubmit={onSubmit}
            onClear={handleClear}
            isActive={isActive}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textColor={theme.inputText}
            placeholderColor={theme.inputPlaceholder}
            iconColor={theme.icon}
            activeColor={theme.brand}
            isRTL={isRTL}
          />
        </GlassView>
      ) : (
        <View style={[styles.searchSurface, compact && styles.searchSurfaceCompact, { backgroundColor: theme.inputBackground, borderWidth: 0 }]}>
          {showHighlights ? <GlassHighlights topColor={theme.inputHighlight} bottomColor={theme.inputShade} /> : null}
          <SearchBarContent
            testID={testID}
            placeholder={placeholderText}
            value={value}
            onChangeText={onChangeText}
            onSubmit={onSubmit}
            onClear={handleClear}
            isActive={isActive}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            textColor={theme.inputText}
            placeholderColor={theme.inputPlaceholder}
            iconColor={theme.icon}
            activeColor={theme.brand}
            isRTL={isRTL}
          />
        </View>
      )}
    </Animated.View>
  );
}

function formatPlaceholder(placeholder: string, isRTL: boolean) {
  if (!isRTL) return placeholder;

  return placeholder.replace(/[\s.。…]+$/u, "");
}

function GlassHighlights({ topColor, bottomColor }: { topColor: string; bottomColor: string }) {
  return (
    <>
      <View pointerEvents="none" style={[styles.topHighlight, { backgroundColor: topColor }]} />
      <View pointerEvents="none" style={[styles.bottomShade, { backgroundColor: bottomColor }]} />
    </>
  );
}

type SearchBarContentProps = Required<Pick<Props, "placeholder">> &
  Omit<Props, "placeholder"> & {
    isActive: boolean;
    onFocus: () => void;
    onBlur: () => void;
    textColor: string;
    placeholderColor: string;
    iconColor: string;
    activeColor: string;
    isRTL: boolean;
  };

function SearchBarContent({
  placeholder,
  value,
  onChangeText,
  onSubmit,
  onClear,
  testID,
  isActive,
  onFocus,
  onBlur,
  textColor,
  placeholderColor,
  iconColor,
  activeColor,
  isRTL,
}: SearchBarContentProps) {
  return (
    <View style={styles.searchContent}>
      <Ionicons
        name="search"
        size={20}
        color={isActive ? activeColor : iconColor}
        style={styles.icon}
      />
      <TextInput
        style={[
          styles.input,
          {
            color: textColor,
            textAlign: isRTL ? "right" : "left",
            writingDirection: isRTL ? "rtl" : "ltr",
          },
          isActive && { color: activeColor },
        ]}
        testID={testID}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => { Keyboard.dismiss(); onSubmit?.(); }}
        selectionColor={activeColor}
        cursorColor={activeColor}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {(value?.length ?? 0) > 0 ? (
        <ScalePressable
          onPress={onClear}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          style={styles.clearButton}
        >
          <Ionicons name="close-circle" size={18} color={placeholderColor} />
        </ScalePressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchShell: {
    marginHorizontal: HOME_HORIZONTAL_GUTTER,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    overflow: "hidden",
  },
  searchShellCompact: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: 0,
  },
  searchSurface: {
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    justifyContent: "center",
    overflow: "hidden",
  },
  searchContent: {
    alignItems: "center",
    flexDirection: "row",
    width: "100%",
  },
  searchSurfaceCompact: {
    minHeight: 52,
    paddingVertical: 12,
  },
  topHighlight: {
    position: "absolute",
    top: 1,
    left: 14,
    right: 14,
    height: 1,
  },
  bottomShade: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 1,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  icon: {
    marginEnd: 10,
  },
  input: {
    flex: 1,
    height: 24,
    fontSize: 16,
    ...Typography.getTextVariantStyle('body'),
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  clearButton: {
    marginStart: 8,
  },
});

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { StyleSheet, Text } from "react-native";
import { AccessiblePressable } from "../components/ui";
import { contrastRatio, getTheme, layout } from "../lib/theme";

describe("Apple design foundations",()=>{
  it("provides distinct semantic light and dark appearances",()=>{
    const light=getTheme("light");const dark=getTheme("dark");
    expect(light.paper).not.toBe(dark.paper);
    expect(light.card).not.toBe(dark.card);
    expect(light.ink).not.toBe(dark.ink);
  });

  it("meets AA contrast for primary and secondary copy",()=>{
    for(const mode of ["light","dark"] as const){const colors=getTheme(mode);expect(contrastRatio(colors.ink,colors.paper)).toBeGreaterThanOrEqual(7);expect(contrastRatio(colors.muted,colors.paper)).toBeGreaterThanOrEqual(4.5)}
  });

  it("increases separator contrast with Increase Contrast",()=>{
    expect(getTheme("light",true).line).not.toBe(getTheme("light").line);
    expect(getTheme("dark",true).muted).not.toBe(getTheme("dark").muted);
  });

  it("gives shared controls a 44 point target and haptic feedback",async()=>{
    const onPress=jest.fn();const view=await render(<AccessiblePressable accessibilityLabel="Test action" onPress={onPress}><Text>Go</Text></AccessiblePressable>);
    const button=view.getByRole("button",{name:"Test action"});
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({minWidth:layout.minTarget,minHeight:layout.minTarget});
    fireEvent.press(button);expect(onPress).toHaveBeenCalled();expect(Haptics.impactAsync).toHaveBeenCalled();
  });
});

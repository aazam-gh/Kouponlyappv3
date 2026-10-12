import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import ScrollCrunchSection, { backgroundShouldExpand, ZigzagRevealContext } from '../components/home/ScrollCrunchSection';
import ZigzagSection from '../components/home/ZigzagSection';
let mockReducedMotion = false;
jest.mock('../lib/theme', () => ({ useMotionPreferences: () => ({ reduceMotion: mockReducedMotion }) }));
const value = (n: number) => ({ get: () => n, set: jest.fn(), value: n }) as any;
test('background fully collapses before reaching the viewport edge and reopens on every return', () => {
  expect([200, 18, 200, 650, 200].map(top => backgroundShouldExpand(top, 100, 68, 700, false))).toEqual([true, false, true, false, true]);
});
test('reduced motion and unmeasured layouts keep the full background', () => {
  expect(backgroundShouldExpand(650, 100, 68, 700, true)).toBe(true);
  expect(backgroundShouldExpand(0, 0, 68, 700, false)).toBe(true);
  expect(backgroundShouldExpand(0, 100, 68, 0, false)).toBe(true);
});
test('only the background collapses on both axes; foreground remains visible and unscaled', async () => {
  const view = await render(<ZigzagRevealContext.Provider value={value(0)}><ZigzagSection width={393} cutoutColor="#fff"><Text>Always visible</Text></ZigzagSection></ZigzagRevealContext.Provider>);
  expect(StyleSheet.flatten(view.getByTestId('zigzag-background').props.style)).toMatchObject({ opacity: 0, transform: [{ scaleX: 0 }, { scaleY: 0 }] });
  expect(StyleSheet.flatten(view.getByTestId('zigzag-content').props.style).transform).toBeUndefined();
  expect(view.getByText('Always visible')).toBeTruthy();
});
test('section wrapper never scales or hides its children', async () => {
  mockReducedMotion = true;
  const view = await render(<ScrollCrunchSection testID="crunch" scrollY={value(500)} viewportHeight={value(700)} bottomInset={98}><Text>Categories</Text></ScrollCrunchSection>);
  expect(view.getByTestId('crunch').props.style).toBeUndefined();
  expect(view.getByText('Categories')).toBeTruthy();
  mockReducedMotion = false;
});

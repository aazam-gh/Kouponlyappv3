import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { useAnimatedReaction } from 'react-native-reanimated';
import ScrollCrunchSection, { sectionShouldReveal, pinnedCategoryState, ZigzagRevealContext } from '../components/home/ScrollCrunchSection';
import ZigzagSection, { interlockingZigzagPath } from '../components/home/ZigzagSection';
let mockReducedMotion = false;
jest.mock('../lib/theme', () => ({ useMotionPreferences: () => ({ reduceMotion: mockReducedMotion }) }));
const value = (n: number) => ({ get: () => n, set: jest.fn(), value: n }) as any;
beforeEach(() => { mockReducedMotion = false; jest.mocked(useAnimatedReaction).mockClear(); });

test('closes before leaving either viewport edge and reopens on every return', () => {
  expect([200, 18, 200, 650, 200].map(top => sectionShouldReveal(top, 100, 68, 700, false))).toEqual([true, false, true, false, true]);
});
test('reduced motion and unmeasured layouts keep the contents revealed', () => {
  expect(sectionShouldReveal(650, 100, 68, 700, true)).toBe(true);
  expect(sectionShouldReveal(0, 0, 68, 700, false)).toBe(true);
  expect(sectionShouldReveal(0, 100, 68, 0, false)).toBe(true);
});

test.each([120, 240, 360])('bottom edge closes and reopens while top/content stay fixed at height %s', async height => {
  const progress = { current: 1 };
  const reveal = { get: () => progress.current } as any;
  const content = () => <ZigzagRevealContext.Provider value={reveal}><ZigzagSection width={393} cutoutColor="#fff"><Text>Section contents</Text></ZigzagSection></ZigzagRevealContext.Provider>;
  const view = await render(content());
  await fireEvent(view.getByTestId('zigzag-section'), 'layout', { nativeEvent: { layout: { height } } });
  for (const next of [1, 0.5, 0, 0.5, 1, 0, 1]) {
    progress.current = next;
    await view.rerender(content());
    const mask = StyleSheet.flatten(view.getByTestId('zigzag-clip').props.style);
    const anchored = StyleSheet.flatten(view.getByTestId('zigzag-anchored-content').props.style);
    const distance = (height - 20) * (1 - next);
    expect(mask.transform).toEqual([{ translateY: -distance }]);
    expect(anchored.transform).toEqual([{ translateY: distance }]);
    expect(mask.transform[0].translateY + anchored.transform[0].translateY).toBe(0);
    expect(StyleSheet.flatten(view.getByTestId('zigzag-section').props.style)).toEqual({ overflow: 'hidden' });
    expect(StyleSheet.flatten(view.getByTestId('zigzag-bottom-edge').props.style)).toMatchObject({ bottom: 0, height: 10, backgroundColor: '#fff' });
    expect(view.getByTestId('zigzag-top-edge').props.style).toBeUndefined();
    expect(StyleSheet.flatten(view.getByTestId('zigzag-background').props.style).transform).toBeUndefined();
    expect(StyleSheet.flatten(view.getByTestId('zigzag-content').props.style).transform).toBeUndefined();
  }
});

test('closed content cannot be tapped or reached by accessibility, and restores on opening', async () => {
  const view = await render(<ZigzagSection width={393} cutoutColor="#fff"><Text>Contents</Text></ZigzagSection>);
  const react = jest.mocked(useAnimatedReaction).mock.calls.at(-1)![1];
  await act(async () => react(false, true));
  expect(view.getByTestId('zigzag-anchored-content', { includeHiddenElements: true }).props).toMatchObject({ pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' });
  expect(view.queryByText('Contents')).toBeNull();
  await act(async () => react(true, false));
  expect(view.getByTestId('zigzag-anchored-content').props).toMatchObject({ pointerEvents: 'auto', accessibilityElementsHidden: false, importantForAccessibility: 'auto' });
  expect(view.getByText('Contents')).toBeTruthy();
});

test('reduced motion bypasses closing without changing the section layout', async () => {
  mockReducedMotion = true;
  const view = await render(<ScrollCrunchSection testID="crunch" scrollY={value(500)} viewportHeight={value(700)} bottomInset={98}><Text>Categories</Text></ScrollCrunchSection>);
  const [prepare, react] = jest.mocked(useAnimatedReaction).mock.calls.at(-1)!;
  expect(prepare()).toBe(1);
  await act(async () => react(true, false));
  expect(view.getByTestId('crunch').props.style).toEqual({});
  expect(view.getByText('Categories')).toBeTruthy();
});


test('categories reach the header before collapsing, stay pinned, disappear, and reverse with scroll', () => {
  const top = 400, height = 120, header = 68;
  for (const scroll of [0, 250, 332, 362, 407, 452, 900, 452, 407, 362, 332, 0]) {
    const state = pinnedCategoryState(top, height, scroll, header);
    expect(top - scroll + state.translateY).toBe(Math.max(header, top - scroll));
    expect(state.reveal).toBeCloseTo(Math.max(0, 1 - Math.max(0, scroll - 332) / height));
  }
  expect(pinnedCategoryState(top, 0, 900, header)).toEqual({ translateY: 0, reveal: 1 });
  expect(pinnedCategoryState(top, height, 300, 100)).toEqual({ translateY: 0, reveal: 1 });
});

test('categories clip at normal size without fading and stay interactive until completely closed', async () => {
  const progress = { current: 1 };
  const reveal = { get: () => progress.current } as any;
  const content = () => <ZigzagRevealContext.Provider value={reveal}><ZigzagSection width={393} cutoutColor="#fff" collapseCompletely><Text>Category icons</Text></ZigzagSection></ZigzagRevealContext.Provider>;
  const view = await render(content());
  await fireEvent(view.getByTestId('zigzag-section'), 'layout', { nativeEvent: { layout: { height: 120 } } });
  for (const next of [1, 0.75, 0.55, 0, 0.55, 0.75, 1]) {
    progress.current = next;
    await view.rerender(content());
    const mask = StyleSheet.flatten(view.getByTestId('zigzag-clip').props.style);
    const anchored = StyleSheet.flatten(view.getByTestId('zigzag-anchored-content').props.style);
    expect(mask.transform).toEqual([{ translateY: -120 * (1 - next) }]);
    expect(anchored.transform).toEqual([{ translateY: 120 * (1 - next) }]);
    expect(StyleSheet.flatten(view.getByTestId('zigzag-content').props.style).opacity).toBeUndefined();
    expect(StyleSheet.flatten(view.getByTestId('zigzag-content').props.style).transform).toBeUndefined();
    const [prepare] = jest.mocked(useAnimatedReaction).mock.calls.at(-1)!;
    expect(prepare()).toBe(next > 0);
  }
});


test.each([84, 120, 200])('strip height and following content move one-for-one with scroll for height %s', height => {
  const top = 400, header = 68, pinAt = top - header;
  for (const collapse of [0, 1, height / 2, height - 1, height, height + 50]) {
    const scroll = pinAt + collapse;
    const state = pinnedCategoryState(top, height, scroll, header);
    const remaining = height * state.reveal;
    expect(remaining).toBeCloseTo(Math.max(0, height - collapse));
    const nextSectionTop = top + height - scroll;
    if (collapse <= height) expect(nextSectionTop).toBeCloseTo(header + remaining);
    else expect(nextSectionTop).toBeLessThan(header);
  }
});

test('opposing pointy edges use identical horizontal phase, with complementary cutouts and no seam stroke', () => {
  const boundary = 'M 0 0 L 12 10 L 24 0 L 36 10 L 48 0';
  expect(interlockingZigzagPath(48)).toBe(`${boundary} L 48 0 L 0 0 Z`);
  expect(interlockingZigzagPath(48, true)).toBe(`${boundary} L 48 10 L 0 10 Z`);
});

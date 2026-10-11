import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import ScalePressable from '../components/ScalePressable';
import AndroidBottomSheetModal from '../components/AndroidBottomSheetModal';
import { useAppTheme } from '../lib/theme';

let mockReduceMotion = false;
jest.mock('../lib/theme', () => ({
  useAppTheme: () => ({ motion: { reduceMotion: mockReduceMotion } }),
  useMotionPreferences: () => ({ reduceMotion: mockReduceMotion }),
}));
jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { overlay: '#0008', surfaceElevated: '#fff', borderStrong: '#aaa' } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

beforeEach(() => { mockReduceMotion = false; });

it('provides feedback without changing layout styles, callbacks or action timing', async () => {
  const action = jest.fn(); const pressIn = jest.fn(); const pressOut = jest.fn();
  const view = await render(<ScalePressable testID="action" style={{ opacity: 0.6, transform: [{ rotate: '3deg' }], minHeight: 48 }} onPress={action} onPressIn={pressIn} onPressOut={pressOut}><Text>Go</Text></ScalePressable>);
  await fireEvent(view.getByTestId('action'), 'pressIn', {});
  expect(StyleSheet.flatten(view.getByTestId('action').props.style)).toMatchObject({ opacity: 0.528, minHeight: 48, transform: [{ rotate: '3deg' }, { scale: 0.98 }], transitionDuration: 120 });
  await fireEvent.press(view.getByTestId('action'));
  expect(action).toHaveBeenCalledTimes(1);
  await fireEvent(view.getByTestId('action'), 'pressOut', {});
  expect(pressIn).toHaveBeenCalledTimes(1); expect(pressOut).toHaveBeenCalledTimes(1);
  expect(StyleSheet.flatten(view.getByTestId('action').props.style).transform).toEqual([{ rotate: '3deg' }, { scale: 1 }]);
});

it('preserves functional styles and children, and suppresses motion when the preference changes', async () => {
  const Button = () => { useAppTheme(); return <ScalePressable testID="action" style={({ pressed }) => ({ backgroundColor: pressed ? '#000' : '#fff' })}>{({ pressed }) => <Text>{pressed ? 'Pressed' : 'Go'}</Text>}</ScalePressable>; };
  const view = await render(<Button />);
  await fireEvent(view.getByTestId('action'), 'pressIn', {});
  expect(view.getByText('Pressed')).toBeTruthy();
  expect(StyleSheet.flatten(view.getByTestId('action').props.style).backgroundColor).toBe('#000');
  mockReduceMotion = true; await view.rerender(<Button />);
  expect(StyleSheet.flatten(view.getByTestId('action').props.style)).toMatchObject({ transform: [{ scale: 1 }], transitionDuration: 0 });
});

it('blocks disabled actions and removes the pressed scale if disabled mid-press', async () => {
  const action = jest.fn();
  const view = await render(<ScalePressable testID="action" onPress={action}><Text>Go</Text></ScalePressable>);
  await fireEvent(view.getByTestId('action'), 'pressIn', {});
  await view.rerender(<ScalePressable testID="action" disabled accessibilityState={{ busy: true }} onPress={action}><Text>Go</Text></ScalePressable>);
  await fireEvent.press(view.getByTestId('action'));
  expect(action).not.toHaveBeenCalled();
  expect(view.getByTestId('action').props.accessibilityState).toEqual({ busy: true, disabled: true });
  expect(StyleSheet.flatten(view.getByTestId('action').props.style).transform).toEqual([{ scale: 1 }]);
});

it('keeps sheet content mounted through rapid close and reopen with reduced motion', async () => {
  mockReduceMotion = true; const close = jest.fn();
  let finishClose: ((finished: boolean) => void) | undefined;
  const timing = jest.spyOn(require('react-native-reanimated'), 'withTiming').mockImplementation((target: any, _config: any, complete: any) => { if (target === 0) finishClose = complete; return target; });
  const sheet = (visible: boolean) => <AndroidBottomSheetModal visible={visible} onClose={close} testID="sheet"><Text>Categories</Text></AndroidBottomSheetModal>;
  const view = await render(sheet(true));
  expect(view.getByText('Categories')).toBeTruthy();
  await view.rerender(sheet(false)); await view.rerender(sheet(true));
  await act(async () => { finishClose?.(true); });
  expect(view.getByText('Categories')).toBeTruthy();
  expect(StyleSheet.flatten(view.getByTestId('sheet').props.style).transform).toEqual([{ translateY: 0 }]);
  timing.mockRestore();
});

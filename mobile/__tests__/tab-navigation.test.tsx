import React from 'react';
import { render } from '@testing-library/react-native';
import HomeAlias from '../app/realx';
import ExploreAlias from '../app/realx/map';
import SavedAlias from '../app/realx/saved';
import ProfileAlias from '../app/realx/profile';
import NativeTabNavigator from '../components/navigation/TabNavigator.ios';

const mockTabs = jest.fn();
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => require('react').createElement(require('react-native').Text, { testID: 'destination' }, href),
}));
jest.mock('expo-router/unstable-native-tabs', () => {
  const Trigger = Object.assign(() => null, { Label: () => null, Icon: () => null });
  return { NativeTabs: Object.assign((props: any) => { mockTabs(props); return null; }, { Trigger }) };
});
jest.mock('../context/AppThemeContext', () => ({ useAppTheme: () => ({ theme: { brand: '#00AA00' } }) }));
jest.mock('../context/LocaleContext', () => ({ useAppLocale: () => ({ isRTL: false }) }));

describe('persistent bottom navigation', () => {
  it.each([
    [HomeAlias, '/(tabs)'],
    [ExploreAlias, '/(tabs)/explore'],
    [ProfileAlias, '/(tabs)/profile'],
    [SavedAlias, '/(tabs)/saved'],
  ])('redirects a legacy screen into the tab navigator', async (Screen, destination) => {
    const view = await render(<Screen />);
    expect(view.getByTestId('destination').props.children).toBe(destination);
  });

  it('keeps all four iOS tabs expanded while scrolling', async () => {
    await render(<NativeTabNavigator />);
    const props = mockTabs.mock.calls.at(-1)![0];
    expect(props.minimizeBehavior).toBe('never');
    expect(props.children[0].map((child: any) => child.props.name)).toEqual(['index', 'explore', 'saved', 'profile']);
  });
});

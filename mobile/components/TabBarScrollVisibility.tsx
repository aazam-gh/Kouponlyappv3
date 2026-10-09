import React, { useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

type TabBarVisibilityContextValue = {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
};

const TabBarVisibilityContext = React.createContext<TabBarVisibilityContextValue | null>(null);
const DIRECTION_CHANGE_THRESHOLD = 18;

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isTabBarVisible, setTabBarVisible] = useState(true);
  const value = useMemo(
    () => ({ isTabBarVisible, setTabBarVisible }),
    [isTabBarVisible],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibilityContext() {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    throw new Error('Tab bar visibility hooks must be used inside TabBarVisibilityProvider.');
  }
  return context;
}

export function useRestoreTabBarOnFocus() {
  const context = useContext(TabBarVisibilityContext);
  const setTabBarVisible = context?.setTabBarVisible;

  useFocusEffect(
    useCallback(() => {
      setTabBarVisible?.(true);
    }, [setTabBarVisible]),
  );
}

export function useTabBarScrollVisibility() {
  const context = useContext(TabBarVisibilityContext);
  const setTabBarVisible = context?.setTabBarVisible;
  const lastOffset = useRef(0);
  const distanceInDirection = useRef(0);
  const lastDirection = useRef<1 | -1 | null>(null);

  useRestoreTabBarOnFocus();

  const resetTracking = useCallback((offset = 0) => {
    lastOffset.current = Math.max(0, offset);
    distanceInDirection.current = 0;
    lastDirection.current = null;
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offset - lastOffset.current;
    lastOffset.current = offset;

    if (offset <= 0) {
      distanceInDirection.current = 0;
      lastDirection.current = null;
      setTabBarVisible?.(true);
      return;
    }

    if (Math.abs(delta) < 1) return;

    const direction: 1 | -1 = delta > 0 ? 1 : -1;
    distanceInDirection.current = lastDirection.current === direction
      ? distanceInDirection.current + Math.abs(delta)
      : Math.abs(delta);
    lastDirection.current = direction;

    if (distanceInDirection.current < DIRECTION_CHANGE_THRESHOLD) return;

    setTabBarVisible?.(direction < 0);
    distanceInDirection.current = 0;
  }, [setTabBarVisible]);

  return {
    onScroll,
    onScrollBeginDrag: () => resetTracking(lastOffset.current),
    onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      resetTracking(event.nativeEvent.contentOffset.y);
    },
    scrollEventThrottle: 16,
  };
}

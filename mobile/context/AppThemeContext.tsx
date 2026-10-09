import { createContext, PropsWithChildren, useContext, useMemo } from 'react';

import { Colors, type AppThemeColors, type AppThemeMode } from '../constants/Colors';

type AppThemeContextValue = {
  mode: AppThemeMode;
  isDark: boolean;
  theme: AppThemeColors;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const mode: AppThemeMode = 'light';

  const value = useMemo<AppThemeContextValue>(() => ({
    mode,
    isDark: false,
    theme: Colors.themes.light,
  }), []);

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }

  return context;
}

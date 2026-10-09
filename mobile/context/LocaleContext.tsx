import React from 'react';
import { View } from 'react-native';

export type AppLocale = 'en';

type LocaleContextValue = {
  locale: AppLocale;
  direction: 'ltr';
  isRTL: false;
};

const value: LocaleContextValue = { locale: 'en', direction: 'ltr', isRTL: false };
const LocaleContext = React.createContext<LocaleContextValue>(value);

export function LocaleProvider({ children }: React.PropsWithChildren) {
  return (
    <LocaleContext.Provider value={value}>
      <View testID="locale-root" style={{ flex: 1, direction: 'ltr' }}>
        {children}
      </View>
    </LocaleContext.Provider>
  );
}

export function useAppLocale() {
  return React.use(LocaleContext);
}

import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

// eslint-disable-next-line import/no-named-as-default-member
i18next.use(initReactI18next);

// eslint-disable-next-line import/no-named-as-default-member
void i18next.init({
  compatibilityJSON: 'v4',
  resources: { en: { translation: en } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  initImmediate: false,
});

export async function initI18n() {
  // eslint-disable-next-line import/no-named-as-default-member
  await i18next.changeLanguage('en');
  return 'en' as const;
}

export default i18next;

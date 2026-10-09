/// <reference types="jest" />

import i18n, { initI18n } from '../i18n';

describe('i18n initialization', () => {
  test('always initializes the app in English', async () => {
    await expect(initI18n()).resolves.toBe('en');
    expect(i18n.resolvedLanguage).toBe('en');
  });
});

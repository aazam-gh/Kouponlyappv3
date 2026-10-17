import { DEFAULT_HOME_SECTION_ORDER, normalizeHomeSectionOrder } from '../lib/home-layout';

test('retains a complete saved order', () => {
  const reversed = [...DEFAULT_HOME_SECTION_ORDER].reverse();
  expect(normalizeHomeSectionOrder(reversed)).toEqual(reversed);
});
test('repairs old, duplicate and unknown sections without losing known order', () => {
  expect(normalizeHomeSectionOrder(['top-brands', 'top-brands', 'future-section', null])).toEqual(['top-brands', ...DEFAULT_HOME_SECTION_ORDER.filter(id => id !== 'top-brands')]);
});
test.each([undefined, null, {}, 'categories', []])('missing or malformed layout falls back to all sections (%p)', value => {
  expect(normalizeHomeSectionOrder(value)).toEqual(DEFAULT_HOME_SECTION_ORDER);
});

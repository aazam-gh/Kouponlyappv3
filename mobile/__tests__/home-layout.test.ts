import { DEFAULT_HOME_SECTION_ORDER, normalizeHomeSectionOrder } from '../lib/home-layout';

test('retains a complete saved order', () => {
  const reversed = [...DEFAULT_HOME_SECTION_ORDER].reverse();
  expect(normalizeHomeSectionOrder(reversed)).toEqual(reversed);
});
test('keeps only the selected, known sections in saved order', () => {
  expect(normalizeHomeSectionOrder(['brand-logos', 'future-section', 'brand-logos', 'categories'])).toEqual(['brand-logos', 'categories']);
});
test.each([undefined, null, {}, 'categories'])('missing or malformed layout falls back to all sections (%p)', value => {
  expect(normalizeHomeSectionOrder(value)).toEqual(DEFAULT_HOME_SECTION_ORDER);
});
test('an empty saved selection hides all content sections', () => {
  expect(normalizeHomeSectionOrder([])).toEqual([]);
});

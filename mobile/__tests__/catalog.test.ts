import { applyCataloguePatch, categories, categoryBySlug, categoryItems, deals, directoryItems, heroSlides, rewards, searchDirectory } from '../lib/data';
import { clearFixture, loadFixture } from '../test/catalogue-fixture';

afterEach(clearFixture);
describe('Supabase-only catalogue',()=>{
  it('starts without bundled vendors, offers, rewards, or taxonomy',()=>{
    expect([deals,categories,directoryItems,heroSlides,rewards].every(items=>items.length===0)).toBe(true);
  });
  it('matches explicit main category and multiple assigned subcategories',()=>{
    loadFixture(); const food=categoryBySlug('food')!;
    expect(categoryItems(food,'Rice').map(row=>row.id)).toEqual(categoryItems(food,'Sweets').map(row=>row.id));
    expect(categoryItems(categoryBySlug('stays')!)).toHaveLength(0);
    expect(categoryItems(food,'Homestays')).toHaveLength(0);
    expect(categoryItems(food,'Rice','no-such-vendor')).toHaveLength(0);
    expect(searchDirectory('Sweets').length).toBeGreaterThan(0);
  });
  it('clears stale data when a successful refresh returns empty arrays',()=>{
    loadFixture(); expect(deals.length).toBeGreaterThan(0);
    clearFixture(); expect([deals,categories,directoryItems,heroSlides,rewards].every(items=>items.length===0)).toBe(true);
  });
  it('keeps unrelated arrays when applying a partial patch',()=>{
    loadFixture(); applyCataloguePatch({deals:[]}); expect(directoryItems.length).toBeGreaterThan(0);
  });
});

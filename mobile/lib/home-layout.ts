export const HOME_SECTIONS = [
  { id: 'partner-banners', title: 'Partner banners', description: 'Promotional images linked to vendors.' },
  { id: 'categories', title: 'Categories', description: 'Browse vendors by category.' },
  { id: 'nearby-vendors', title: 'Offers near you', description: 'Vendors near the student’s location.' },
  { id: 'new-deals', title: 'New deals', description: 'Recently added vendor offers.' },
  { id: 'featured-showcase', title: 'Featured showcase', description: 'The large promotional carousel.' },
  { id: 'trending-offers', title: 'Trending offers', description: 'Vendors marked as trending.' },
  { id: 'brand-logos', title: 'Top brands', description: 'Curated logos selected in Home content.' },
] as const;

export type HomeSectionId = typeof HOME_SECTIONS[number]['id'];
export const DEFAULT_HOME_SECTION_ORDER: HomeSectionId[] = HOME_SECTIONS.map(section => section.id);

export function normalizeHomeSectionOrder(value: unknown): HomeSectionId[] {
  if (!Array.isArray(value)) return [...DEFAULT_HOME_SECTION_ORDER];
  const known = new Set<string>(DEFAULT_HOME_SECTION_ORDER);
  return [...new Set(value.filter((id): id is HomeSectionId => typeof id === 'string' && known.has(id)))];
}

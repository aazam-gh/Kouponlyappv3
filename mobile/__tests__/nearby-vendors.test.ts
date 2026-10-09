import { locations, offers, taxonomy, vendor } from '../test/catalogue-fixture';

const mockBounds = jest.fn();
const rows: Record<string, unknown[]> = {
  realx_vendors: [vendor],
  realx_offers: offers,
  realx_vendor_locations: [{ ...locations[0], latitude: 9.9819, longitude: 76.2822 }],
  realx_categories: taxonomy.categories,
  realx_subcategories: taxonomy.subcategories,
  realx_vendor_subcategories: taxonomy.assignments,
};

jest.doMock('../lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        order: () => query,
        or: () => query,
        gte: (...args: unknown[]) => { mockBounds(args); return query; },
        lte: (...args: unknown[]) => { mockBounds(args); return query; },
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
          Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve, reject),
      };
      return query;
    },
  }),
}));

const { fetchVendorMapLocations } = require('../lib/nearby-vendors') as typeof import('../lib/nearby-vendors');

it('loads valid vendors outside Qatar when they are within the requested viewport', async () => {
  const result = await fetchVendorMapLocations(undefined, { south: 9, north: 11, west: 75, east: 77 });

  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ vendorId: 'vendor-1', latitude: 9.9819, longitude: 76.2822 });
  expect(mockBounds.mock.calls.map(([args]) => args)).toEqual([['latitude', 9], ['latitude', 11], ['longitude', 75], ['longitude', 77]]);
});

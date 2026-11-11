import { fetchVendorDeal } from '@/lib/backend';
import { getSupabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn(), supabaseConfigured: true }));

it('scopes vendor detail reads to the selected vendor', async () => {
  const filters: string[][] = [];
  const tables: Record<string, object[]> = {
    kouponly_vendors: [{ id: 'vendor-a', name: 'A', category_id: 'food', status: 'Active', catalogue_deal_id: 1 }],
    kouponly_offers: [{ id: 'offer-a', vendor_id: 'vendor-a', title: 'Offer', active: true }],
    kouponly_categories: [{ id: 'food', name: 'Food', active: true }],
  };
  jest.mocked(getSupabase).mockReturnValue({
    from: (table: string) => {
      const query = {
        select: () => query,
        order: () => query,
        eq: (column: string, value: string) => { filters.push([table, column, value]); return query; },
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve),
      };
      return query;
    },
  } as unknown as ReturnType<typeof getSupabase>);
  expect(await fetchVendorDeal('vendor-a')).toMatchObject({ vendorId: 'vendor-a', offers: [{ id: 'offer-a' }] });
  expect(filters).toEqual(expect.arrayContaining([
    ['kouponly_vendors', 'id', 'vendor-a'],
    ...['offers', 'vendor_locations', 'vendor_subcategories', 'vendor_categories']
      .map(table => ['kouponly_' + table, 'vendor_id', 'vendor-a']),
  ]));
});

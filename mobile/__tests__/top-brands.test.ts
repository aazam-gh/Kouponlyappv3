import { homeQueryOptions } from '../utils/homeQueries';
import { queryClient } from '../utils/queryClient';

jest.mock('../lib/backend', () => ({ fetchCloudCatalogue: async () => ({ deals: [
  { vendorId: 'available', name: 'Current vendor name', logo: 'vendor-logo.png' },
] }) }));
jest.mock('../lib/supabase', () => ({ getSupabase: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { payload: { brands: [
  { id: 'missing-link', isActive: true, logoUrl: 'legacy.png' },
  { id: 'deleted-vendor', vendorId: 'deleted', isActive: true },
  { id: 'inactive', vendorId: 'available', isActive: false },
  { id: 'valid', vendorId: 'available', isActive: true, logoUrl: '' },
  { id: 'custom', vendorId: 'available', isActive: true, logoUrl: 'custom.png' },
] } }, error: null }) }) }) }) }) }));

afterEach(() => queryClient.clear());
test('Top Brands uses current vendor names and logos, preserves custom logos and omits dead links', async () => {
  const brands = await queryClient.fetchQuery(homeQueryOptions.brands());
  expect(brands).toEqual([
    { id: 'valid', vendorId: 'available', isActive: true, name: 'Current vendor name', logoUrl: 'vendor-logo.png' },
    { id: 'custom', vendorId: 'available', isActive: true, name: 'Current vendor name', logoUrl: 'custom.png' },
  ]);
});

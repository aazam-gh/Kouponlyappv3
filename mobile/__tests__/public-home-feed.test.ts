it('shares one public request between categories and editorial', async () => {
  const env = jest.replaceProperty(process, 'env', { ...process.env, EXPO_PUBLIC_HOME_FEED_URL: 'https://example.test/home.json' });
  const fetchFeed = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      version: 1, categories: [{ id: 'food', name: 'Food' }], order: ['categories'],
      banners: [],
    }),
  } as Response);
  try {
    await jest.isolateModulesAsync(async () => {
      const { homeQueryOptions } = require('@/utils/homeQueries') as typeof import('@/utils/homeQueries');
      const { queryClient } = require('@/utils/queryClient') as typeof import('@/utils/queryClient');
      const [categories, editorial] = await Promise.all([
        queryClient.fetchQuery(homeQueryOptions.categories('en')),
        queryClient.fetchQuery(homeQueryOptions.editorial()),
      ]);
      expect(categories[0].name).toBe('Food');
      expect(editorial.order).toEqual(['categories']);
      expect(fetchFeed).toHaveBeenCalledTimes(1);
      queryClient.clear();
    });
  } finally {
    fetchFeed.mockRestore();
    env.restore();
  }
});

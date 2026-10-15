import { QueryClient } from '@tanstack/react-query';

const DEFAULT_QUERY_STALE_TIME_MS = 5 * 60 * 1000;
const DEFAULT_QUERY_GC_TIME_MS = 30 * 60 * 1000;
export const TRANSIENT_QUERY_GC_TIME_MS = process.env.NODE_ENV === 'test' ? Infinity : 2 * 60 * 1000;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: DEFAULT_QUERY_STALE_TIME_MS,
            gcTime: process.env.NODE_ENV === 'test' ? Infinity : DEFAULT_QUERY_GC_TIME_MS,
            retry: 1,
            refetchOnMount: false,
            refetchOnWindowFocus: false,
        },
    },
});

export type CachedVendor = {
    id: string;
    data: Record<string, any>;
};

export const queryKeys = {
    catalogueHome: () => ['catalogue-home'] as const,
    category: (categoryId: string) => ['category', categoryId] as const,
    categories: (language: string) => ['categories', language] as const,
    cmsDocument: (documentId: string) => ['cmsDocument', documentId] as const,
    mapLocations: () => ['mapLocations'] as const,
    mapLocationTiles: (precision: number, prefixes: string[]) => ['mapLocationTiles', precision, prefixes.join(',')] as const,
    mapLocationSearch: (searchQuery: string) => ['mapLocationSearch', searchQuery] as const,
    onlineVendorOffer: (vendorId: string) => ['onlineVendorOffer', vendorId] as const,
    redemptionHistory: (userId: string) => ['redemptionHistory', userId] as const,
    savedMapPlaces: (userId: string) => ['savedMapPlaces', userId] as const,
    savedOfferIds: (userId: string, vendorId: string) => ['savedOfferIds', userId, vendorId] as const,
    savedOffers: (userId: string) => ['savedOffers', userId] as const,
    searchVendorsPage: (searchQuery: string, cursorId: string | null) => ['searchVendorsPage', searchQuery, cursorId] as const,
    studentProfile: (userId: string) => ['studentProfile', userId] as const,
    trendingVendorRecommendations: () => ['trendingVendorRecommendations'] as const,
    trendingOffers: () => ['trendingOffers'] as const,
    vendor: (vendorId: string) => ['vendor', vendorId] as const,
    vendorRoute: (vendorIdOrName: string, language: string) => ['vendorRoute', vendorIdOrName, language] as const,
    vendorDisplay: (vendorId: string) => ['vendorDisplay', vendorId] as const,
    vendorsPage: (scope: string, params: Record<string, unknown>, cursorId: string | null) => ['vendorsPage', scope, params, cursorId] as const,
    xAcademyUniversities: () => ['xAcademyUniversities'] as const,
};

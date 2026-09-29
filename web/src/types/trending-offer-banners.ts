export interface TrendingOfferBannerImage {
    mobile: string
}

export interface TrendingOfferBannerItem {
    trendingOfferBannerId: string
    vendorId: string
    images: TrendingOfferBannerImage
    altText: string
    isActive: boolean
}

export interface TrendingOfferBannersConfig {
    lastUpdated: string
    items: TrendingOfferBannerItem[]
}

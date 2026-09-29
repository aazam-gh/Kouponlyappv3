export interface FeaturedBrandShowcaseItem {
    id: string
    title: string
    titleAr?: string
    orderUrl: string
    isActive: boolean
    heroImageUrl: string
    tileImageUrls: string[]
    altText?: string
    order?: number
}

export interface FeaturedBrandShowcaseConfig {
    lastUpdated: string
    items: FeaturedBrandShowcaseItem[]
}

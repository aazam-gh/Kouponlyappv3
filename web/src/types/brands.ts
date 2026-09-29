export interface BrandItem {
    id: string
    logoUrl: string
    vendorId?: string
    isActive: boolean
}

export interface BrandsConfig {
    lastUpdated: string
    brands: BrandItem[]
}

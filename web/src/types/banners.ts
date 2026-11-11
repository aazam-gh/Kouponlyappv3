export interface BannerImage {
    mobile: string
}

export interface BannerItem {
    bannerId: string
    vendorId: string
    vendorIds?: string[]
    images: BannerImage
    mobileDimensions?: { width: number; height: number }
    altText: string
    isActive: boolean
}

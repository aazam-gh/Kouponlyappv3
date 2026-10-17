export interface BannerImage {
    mobile: string
}

export interface BannerItem {
    bannerId: string
    vendorId: string
    vendorIds?: string[]
    images: BannerImage
    altText: string
    isActive: boolean
}

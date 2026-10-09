export interface UniversityItem {
    id: string
    nameEn: string
    logoUrl: string
    bannerUrl: string
    link: string
    bannerStatus: boolean
}

export interface UniversitiesConfig {
    lastUpdated: string
    universities: UniversityItem[]
}

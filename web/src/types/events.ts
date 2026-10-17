
export interface StudentEvent {
    id: string
    titleEn: string
    descriptionEn?: string
    locationEn?: string
    imageUrl?: string
    link?: string
    startsAt?: Date | string | null
    isActive: boolean
    createdAt?: string
    updatedAt?: string
}

export interface EventsConfig {
    lastUpdated: string
    events: StudentEvent[]
}

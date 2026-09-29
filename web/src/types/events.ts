import type { Timestamp } from 'firebase/firestore'

export interface StudentEvent {
    id: string
    titleEn: string
    titleAr?: string
    descriptionEn?: string
    descriptionAr?: string
    locationEn?: string
    locationAr?: string
    imageUrl?: string
    link?: string
    startsAt?: Timestamp | Date | string | null
    isActive: boolean
    createdAt?: string
    updatedAt?: string
}

export interface EventsConfig {
    lastUpdated: string
    events: StudentEvent[]
}

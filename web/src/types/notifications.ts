export interface NotificationRecord {
    id: string
    title: string
    body: string
    imageUrl?: string | null
    topic: string
    sentBy: string
    queuedAt?: { seconds: number; nanoseconds: number }
    sentAt?: { seconds: number; nanoseconds: number }
    status?: 'queued' | 'processing' | 'sent' | 'failed'
    messageId?: string
    sentCount?: number
    failedCount?: number
    invalidTokenCount?: number
    totalRegistered?: number
}

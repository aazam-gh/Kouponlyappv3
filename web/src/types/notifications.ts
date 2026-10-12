export interface NotificationRecord {
    id: string
    title: string
    body: string
    data?: { topic?: string; imageUrl?: string | null; errors?: string[] }
    sent_at: string
    status: 'queued' | 'processing' | 'sent' | 'partial' | 'failed'
    sent_count: number
    failed_count: number
    total_registered: number
    receipt_success_count: number
    receipt_failure_count: number
}

import { createFileRoute } from '@tanstack/react-router'
import {
    collection,
    getDocs,
    orderBy,
    query,
    Timestamp,
    type DocumentData,
    type QueryDocumentSnapshot,
    where,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { formatTimestamp } from '@/lib/format-timestamp'

export interface Transaction {
    id: string
    date: string
    rawDate?: string | null
    transactionId: string
    vendorName: string
    totalAmountNum?: number
    totalAmount: string
    type: string
    cashbackAmount?: number
    creatorCashbackAmount?: number
    creatorCode?: string | null
    creatorCodeOwnerId?: string | null
    creatorUid?: string | null
    discountAmount?: number
    discountCode?: string | null
    discountType?: string | null
    discountValue?: number
    finalAmount?: number
    purchaseUrl?: string | null
    offerId?: string | null
    pin?: string | null
    userId?: string | null
    vendorId?: string | null
    redemptionCardAmount?: number
    remainingAmount?: number
}

export const DAILY_TRANSACTIONS_QUERY_KEY = ['daily-transactions'] as const
const QATAR_TIME_ZONE = 'Asia/Qatar'
const QATAR_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

export function getQatarDayBounds(now = new Date()) {
    const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: QATAR_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now)
    const part = (type: Intl.DateTimeFormatPartTypes) =>
        Number(dateParts.find((datePart) => datePart.type === type)?.value)
    const year = part('year')
    const month = part('month')
    const day = part('day')
    const startMs = Date.UTC(year, month - 1, day) - QATAR_UTC_OFFSET_MS

    return {
        dayKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        start: new Date(startMs),
        end: new Date(startMs + 24 * 60 * 60 * 1000),
    }
}

export function dailyTransactionsQuery(start: Date, end: Date) {
    return query(
        collection(db, 'transactions'),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<', Timestamp.fromDate(end)),
        orderBy('createdAt', 'desc'),
    )
}

export function mapTransactionSnapshot(
    snapshot: QueryDocumentSnapshot<DocumentData>,
): Transaction {
    const data = snapshot.data()
    const createdAt = formatTimestamp(data.createdAt)
    const totalAmount = typeof data.totalAmount === 'number' ? data.totalAmount : 0

    return {
        id: snapshot.id,
        ...data,
        date: createdAt.toLocaleString(),
        rawDate: createdAt.toISOString(),
        transactionId: data.pin || snapshot.id,
        vendorName: data.vendorName || 'Unknown Vendor',
        totalAmountNum: totalAmount,
        totalAmount: `QAR ${totalAmount}`,
        type: data.type || 'N/A',
    } as Transaction
}

export async function fetchDailyTransactions(start: Date, end: Date) {
    const snapshot = await getDocs(dailyTransactionsQuery(start, end))
    return snapshot.docs.map(mapTransactionSnapshot)
}

export const Route = createFileRoute('/admin/transactions/')({})

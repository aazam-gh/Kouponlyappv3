import { createFileRoute } from '@tanstack/react-router'
import { httpsCallable } from 'firebase/functions'
import { z } from 'zod'
import { functions } from '@/firebase/config'
import type { Transaction } from '../transactions'

const sortSchema = z.enum(['date_asc', 'date_desc', 'amount_asc', 'amount_desc', 'vendor_asc', 'vendor_desc'])

const searchSchema = z.object({
    pageSize: z.number().catch(10),
    page: z.number().catch(1),
    vendorName: z.string().optional().catch(undefined),
    sort: sortSchema.optional().catch(undefined),
    cursor: z.string().optional().catch(undefined),
    history: z.string().optional().catch(undefined),
})

export type BigQueryTransactionSearch = z.infer<typeof searchSchema>
export type BigQueryTransactionSort = z.infer<typeof sortSchema>

export interface BigQueryTransactionResult {
    transactions: Transaction[]
    nextCursor: string | null
    query: {
        durationMs: number
        bytesProcessed: number
        bytesBilled: number
        cacheHit: boolean
    }
    freshness: string | null
}

export async function fetchBigQueryTransactions(
    pageSize: number,
    vendorName?: string,
    sort?: BigQueryTransactionSort,
    cursor?: string,
) {
    const request: {
        pageSize: number
        vendorName?: string
        sort?: BigQueryTransactionSort
        cursor?: string
    } = { pageSize }

    if (vendorName) request.vendorName = vendorName
    if (sort) request.sort = sort
    if (cursor) request.cursor = cursor

    const callable = httpsCallable<
        { pageSize: number; vendorName?: string; sort?: BigQueryTransactionSort; cursor?: string },
        BigQueryTransactionResult
    >(functions, 'listAdminBigQueryTransactions')
    const result = await callable(request)

    return {
        ...result.data,
        transactions: result.data.transactions.map((transaction) => {
            const date = transaction.rawDate ? new Date(transaction.rawDate) : null
            const totalAmountNum = transaction.totalAmountNum || 0
            return {
                ...transaction,
                date: date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Unknown Date',
                totalAmount: `QAR ${totalAmountNum}`,
            }
        }),
    }
}

export const Route = createFileRoute('/admin/bigquery-transactions/')({
    validateSearch: (search) => searchSchema.parse(search),
})

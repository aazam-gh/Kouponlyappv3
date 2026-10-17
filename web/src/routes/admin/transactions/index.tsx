import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { invokeAdminAction } from '@/lib/admin-actions'

const sortSchema = z.enum(['date_asc', 'date_desc', 'amount_asc', 'amount_desc', 'vendor_asc', 'vendor_desc'])

const searchSchema = z.object({
    pageSize: z.number().catch(10),
    page: z.number().catch(1),
    vendorName: z.string().optional().catch(undefined),
    sort: sortSchema.optional().catch(undefined),
    cursor: z.string().optional().catch(undefined),
    history: z.string().optional().catch(undefined),
})

export type TransactionSearch = z.infer<typeof searchSchema>
export type TransactionSort = z.infer<typeof sortSchema>

export interface Transaction {
    id: string
    date: string
    rawDate?: string | null
    transactionId: string
    vendorName: string
    totalAmountNum?: number
    totalAmount: string
    currency?: string
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
    userId?: string | null
    vendorId?: string | null
    redemptionCardAmount?: number
    remainingAmount?: number
}

interface TransactionListResult {
    transactions: Transaction[]
    nextCursor: string | null
}

export async function fetchTransactions(
    pageSize: number,
    vendorName?: string,
    sort?: TransactionSort,
    cursor?: string,
) {
    const request: { pageSize: number; vendorName?: string; sort?: TransactionSort; cursor?: string } = { pageSize }
    if (vendorName) request.vendorName = vendorName
    if (sort) request.sort = sort
    if (cursor) request.cursor = cursor

    const data = await invokeAdminAction<TransactionListResult>('listAdminTransactions', request)

    return {
        ...data,
        transactions: data.transactions.map((transaction) => {
            const date = transaction.rawDate ? new Date(transaction.rawDate) : null
            return {
                ...transaction,
                date: date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Unknown Date',
                totalAmount: `QAR ${transaction.totalAmountNum || 0}`,
            }
        }),
    }
}

export const Route = createFileRoute('/admin/transactions/')({
    validateSearch: (search) => searchSchema.parse(search),
})

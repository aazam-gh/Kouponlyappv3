import { createFileRoute } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import type { Transaction } from './index'

export const Route = createFileRoute('/admin/transactions/$id')({
    loader: async ({ params: { id } }) => {
        const { data, error } = await supabase.rpc('kouponly_admin_coupons', {
            p_vendor_id: null,
            p_user_id: null,
            p_search: id,
            p_offset: 0,
            p_limit: 100,
            p_from: null,
            p_to: null,
        })
        if (error) throw error
        const record = (data as { receipts: Array<Record<string, any>> }).receipts.find(row => row.id === id)

        if (!record) {
            throw new Error('Transaction not found')
        }

        const date = new Date(record.consumedAt)

        return {
            id,
            date: Number.isNaN(date.getTime()) ? 'Unknown Date' : date.toLocaleString(),
            rawDate: Number.isNaN(date.getTime()) ? null : date.toISOString(),
            transactionId: id,
            vendorName: record.vendor || 'Unknown Vendor',
            vendorId: record.vendorId || null,
            userId: record.userId || null,
            offerId: record.offerId || null,
            totalAmountNum: record.billAmount || 0,
            totalAmount: `${record.currency || 'INR'} ${record.billAmount || 0}`,
            currency: record.currency || 'INR',
            finalAmount: record.finalAmount ?? null,
            discountAmount: record.discountAmount || 0,
            type: record.source || 'N/A',
        } as Transaction
    },
})

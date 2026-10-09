import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/firebase/config'
import { doc, getDoc } from 'firebase/firestore'
import type { Transaction } from './index'

export const Route = createFileRoute('/admin/transactions/$id')({
    loader: async ({ params: { id } }) => {
        const docRef = doc(db, 'transactions', id)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
            throw new Error('Transaction not found')
        }

        const data = docSnap.data()

        let formattedDate = ''
        if (data.createdAt) {
            if (typeof data.createdAt === 'string') {
                formattedDate = new Date(data.createdAt).toLocaleString()
            } else if (data.createdAt?.toDate) {
                formattedDate = data.createdAt.toDate().toLocaleString()
            }
        }

        return {
            id,
            ...data,
            date: formattedDate || 'Unknown Date',
            rawDate: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
            transactionId: id,
            vendorName: data.vendorName || 'Unknown Vendor',
            vendorId: data.vendorId || null,
            userId: data.userId || null,
            offerId: data.offerId || null,
            totalAmountNum: data.totalAmount || 0,
            totalAmount: data.totalAmount ? `QAR ${data.totalAmount}` : 'QAR 0',
            finalAmount: data.finalAmount || null,
            discountAmount: data.discountAmount || 0,
            discountCode: data.discountCode || null,
            type: data.type || 'N/A',
            cashbackAmount: data.cashbackAmount || 0,
            creatorCashbackAmount: data.creatorCashbackAmount || 0,
            creatorCode: data.creatorCode || null,
            creatorUid: data.creatorUid || null,
            purchaseUrl: data.purchaseUrl || null,
        } as Transaction
    },
})

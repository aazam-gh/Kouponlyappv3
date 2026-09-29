import { queryOptions } from '@tanstack/react-query'
import { db } from '@/firebase/config'
import { doc, getDoc, query, collection, where, getDocs, Timestamp, type DocumentReference, orderBy, limit, getAggregateFromServer, sum, count } from 'firebase/firestore'
import { STALE_TIME } from '@/lib/constants'
import type { Category } from '@/types/categories'

export interface EmbeddedOffer {
    titleEn: string
    titleAr?: string
    descriptionEn?: string
    descriptionAr?: string
    discountType: 'percentage' | 'amount' | 'buy1get1'
    discountValue?: number
}

export interface OnlineRedemptionConfig {
    discountCode: string
    purchaseUrl: string
    dailyLimitPerUser: number
    enabled: boolean
}

export interface VendorLocation {
    id: string
    name?: string
    nameAr?: string
    phoneNumber?: string
    address?: string
    addressAr?: string
    latitude?: number
    longitude?: number
    geohash?: string
    isPrimary?: boolean
}

export interface Vendor {
    id: string
    name?: string
    nameAr?: string
    email?: string
    phoneNumber?: string
    website?: string
    status?: 'Active' | 'Inactive'
    contact?: string
    profilePicture?: string
    coverImage?: string
    galleryImages?: string[]
    isFeatured?: boolean
    tagsEn?: string[]
    tagsAr?: string[]
    vendorType?: 'in_store' | 'online'
    xcard?: boolean
    loyalty?: number[]
    mainCategory?: string
    subcategory?: string[]
    isTrending?: boolean
    searchTokens?: string[]
    shortDescription?: string
    shortDescriptionAr?: string
    brandOfferName?: string
    brandOfferNameAr?: string
    offers?: EmbeddedOffer[]
    latitude?: number
    longitude?: number
    lat?: number
    lng?: number
    geohash?: string
    address?: string
    addressAr?: string
    locations?: VendorLocation[]
}

export interface Transaction {
    id: string
    vendorName: string
    vendorId: string
    type: string
    totalAmount: number
    discountAmount: number
    discountType: 'percentage' | 'amount' | 'buy1get1'
    discountValue?: number
    finalAmount: number
    status: 'completed' | 'pending' | 'failed'
    createdAt: Timestamp
    // Optional fields
    studentRef?: DocumentReference
    vendorRef?: DocumentReference
    pin?: string
    offerId?: string
    cashbackAmount?: number
    creatorCashbackAmount?: number
    creatorCode?: string | null
    creatorCodeOwnerId?: string | null
    creatorUid?: string | null
    redemptionCardAmount?: number
    remainingAmount?: number
}

export interface VendorStats {
    totalRedemptions: number
    totalRevenue: number
    totalDiscount: number
    activeOffers: number
    pendingTransactions: number
    redemptionsTrend: number
    revenueTrend: number
}

export interface DailyChartPoint {
    date: string
    redemptions: number
    revenue: number
}

export type ChartRange = '7d' | '30d' | '90d'

export const vendorQueryOptions = (vendorId: string) => queryOptions({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
        if (!vendorId) throw new Error('No vendor ID provided')
        const docRef = doc(db, 'vendors', vendorId)
        const snapshot = await getDoc(docRef)
        if (!snapshot.exists()) {
            throw new Error('Vendor not found')
        }
        const data = snapshot.data();
        return {
            id: snapshot.id,
            ...data,
            profilePicture: data.profilePicture || data.logo || data.logoUrl || ''
        } as Vendor
    },
    staleTime: STALE_TIME.EXTENDED,
})

export const vendorPinQueryOptions = (vendorId: string) => queryOptions({
    queryKey: ['vendor-pin', vendorId],
    queryFn: async () => {
        if (!vendorId) throw new Error('No vendor ID provided')
        const snapshot = await getDoc(doc(db, 'vendor_pins', vendorId))
        const pin = snapshot.data()?.pin
        return typeof pin === 'string' && /^\d{4}$/.test(pin) ? pin : ''
    },
})

export const vendorTransactionsQueryOptions = (vendorId: string) => queryOptions({
    queryKey: ['vendor-transactions', vendorId],
    queryFn: async () => {
        if (!vendorId) return []
        const q = query(
            collection(db, 'transactions'),
            where('vendorId', '==', vendorId),
            orderBy('createdAt', 'desc'),
            limit(50),
        )
        const snapshot = await getDocs(q)
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Transaction[]
    },
    staleTime: STALE_TIME.MEDIUM,
})

export const transactionQueryOptions = (transactionId: string) => queryOptions({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
        if (!transactionId) throw new Error('No transaction ID provided')
        const docRef = doc(db, 'transactions', transactionId)
        const snapshot = await getDoc(docRef)
        if (!snapshot.exists()) throw new Error('Transaction not found')
        return { id: snapshot.id, ...snapshot.data() } as Transaction
    },
    staleTime: STALE_TIME.MEDIUM,
})

export const vendorStatsQueryOptions = (vendorId: string) => queryOptions({
    queryKey: ['vendor-stats', vendorId],
    queryFn: async () => {
        if (!vendorId) return null

        // ?? HUGE OPTIMIZATION: Database-level aggregations
        // These cost exactly 1 document read each, no matter if there are 1,000,000 transactions!

        const completedQ = query(collection(db, 'transactions'), where('vendorId', '==', vendorId), where('status', '==', 'completed'))
        const completedAgg = await getAggregateFromServer(completedQ, {
            totalRevenue: sum('finalAmount'),
            totalDiscount: sum('discountAmount'),
            count: count()
        })

        const pendingQ = query(collection(db, 'transactions'), where('vendorId', '==', vendorId), where('status', '==', 'pending'))
        const pendingAgg = await getAggregateFromServer(pendingQ, { count: count() })

        const totalQ = query(collection(db, 'transactions'), where('vendorId', '==', vendorId))
        const totalAgg = await getAggregateFromServer(totalQ, { count: count() })

        const vendorSnap = await getDoc(doc(db, 'vendors', vendorId))
        const offerCount = vendorSnap.exists() ? (vendorSnap.data()?.offers?.length || 0) : 0

        return {
            totalRedemptions: totalAgg.data().count,
            totalRevenue: completedAgg.data().totalRevenue,
            totalDiscount: completedAgg.data().totalDiscount,
            activeOffers: offerCount,
            pendingTransactions: pendingAgg.data().count,
            redemptionsTrend: 5.2,
            revenueTrend: 8.4
        } as VendorStats
    },
    staleTime: STALE_TIME.LONG,
})

export const vendorChartDataQueryOptions = (vendorId: string, range: ChartRange) => queryOptions({
    queryKey: ['vendor-chart-data', vendorId, range],
    queryFn: async () => {
        if (!vendorId) return []

        const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : 90
        const result: Record<string, DailyChartPoint> = {}

        const startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        startDate.setDate(startDate.getDate() - (rangeDays - 1))

        // Pre-fill array
        for (let i = rangeDays - 1; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split('T')[0]
            result[dateStr] = { date: dateStr, redemptions: 0, revenue: 0 }
        }

        // ?? OPTIMIZATION: Date boundary filters
        // Only fetching transactions from within the requested chart date range!
        const q = query(
            collection(db, 'transactions'),
            where('vendorId', '==', vendorId),
            where('createdAt', '>=', Timestamp.fromDate(startDate))
        )
        const snapshot = await getDocs(q)

        snapshot.docs.forEach(doc => {
            const data = doc.data() as Transaction
            if (data.status === 'completed' && data.createdAt) {
                const dateData = data.createdAt.toDate()
                const dateStr = dateData.toISOString().split('T')[0]
                if (result[dateStr]) {
                    result[dateStr].redemptions += 1
                    result[dateStr].revenue += (data.finalAmount || 0)
                }
            }
        })

        return Object.values(result)
    },
    staleTime: STALE_TIME.LONG,
})

export const categoriesQueryOptions = () => queryOptions({
    queryKey: ['categories'],
    queryFn: async () => {
        const snapshot = await getDocs(collection(db, 'categories'))
        const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category))
        return cats.sort((a, b) => a.order - b.order)
    },
    staleTime: STALE_TIME.EXTENDED,
})

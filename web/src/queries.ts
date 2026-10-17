import { queryOptions } from '@tanstack/react-query'
import { db } from '@/firebase/config'
import { supabase } from '@/lib/supabase'
import { doc, getDoc, query, collection, where, getDocs, Timestamp, type DocumentReference, orderBy, limit } from 'firebase/firestore'
import { STALE_TIME } from '@/lib/constants'
import type { Category } from '@/types/categories'

export interface EmbeddedOffer {
    id?: string
    titleEn: string
    descriptionEn?: string
    discountType: 'percentage' | 'amount' | 'buy1get1' | 'free' | 'combo' | 'fixed_price'
    discountValue?: number
    currency?: string
    savingLabel?: string
    offerValue?: number
    termsEn?: string
    redemptionInstructionsEn?: string
    active?: boolean
    redemptionMode?: 'inStore'
}

export interface VendorLocation {
    id: string
    name?: string
    phoneNumber?: string
    address?: string
    latitude?: number
    longitude?: number
    geohash?: string
    isPrimary?: boolean
}

export interface Vendor {
    id: string
    name?: string
    email?: string
    phoneNumber?: string
    website?: string
    instagramUrl?: string
    status?: 'Active' | 'Inactive'
    contact?: string
    profilePicture?: string
    cardLabel?: string | null
    coverImage?: string
    galleryImages?: string[]
    rating?: number
    distanceKm?: number
    savingLabel?: string
    offerValue?: number
    place?: string
    isFeatured?: boolean
    tagsEn?: string[]
    vendorType?: 'in_store'
    categoryId?: string
    mainCategory?: string
    subcategory?: string[]
    isTrending?: boolean
    newest?: number
    sortOrder?: number
    searchTokens?: string[]
    shortDescription?: string
    brandOfferName?: string
    offers?: EmbeddedOffer[]
    latitude?: number
    longitude?: number
    lat?: number
    lng?: number
    geohash?: string
    address?: string
    locations?: VendorLocation[]
}

export interface Transaction {
    id: string
    vendorName: string
    vendorId: string
    type: string
    totalAmount: number
    discountAmount: number
    discountType: 'percentage' | 'amount' | 'buy1get1' | 'free' | 'combo' | 'fixed_price'
    discountValue?: number
    finalAmount: number
    status: 'completed' | 'pending' | 'failed'
    createdAt: Timestamp
    // Optional fields
    studentRef?: DocumentReference
    vendorRef?: DocumentReference
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
        const { data, error } = await supabase.rpc('couponly_vendor_dashboard_stats', { p_vendor_id: vendorId })
        if (error) throw error
        return data as VendorStats
    },
    retry: false,
    staleTime: STALE_TIME.LONG,
})

export const vendorChartDataQueryOptions = (vendorId: string, range: ChartRange) => queryOptions({
    queryKey: ['vendor-chart-data', vendorId, range],
    queryFn: async () => {
        if (!vendorId) return []

        const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : 90
        const result: Record<string, DailyChartPoint> = {}

        for (let i = rangeDays - 1; i >= 0; i--) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const dateStr = date.toISOString().split('T')[0]
            result[dateStr] = { date: dateStr, redemptions: 0, revenue: 0 }
        }

        const { data, error } = await supabase.rpc('couponly_vendor_dashboard_chart', {
            p_vendor_id: vendorId,
            p_range_days: rangeDays,
        })
        if (error) throw error
        for (const point of data ?? []) {
            const date = String(point.date)
            if (result[date]) {
                result[date].redemptions = Number(point.redemptions)
                result[date].revenue = Number(point.revenue)
            }
        }

        return Object.values(result)
    },
    retry: false,
    staleTime: STALE_TIME.LONG,
})

export const categoriesQueryOptions = () => queryOptions({
    queryKey: ['categories'],
    queryFn: async () => {
        const snapshot = await getDocs(query(collection(db, 'categories'), where('active', '==', true)))
        const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category))
        return cats.sort((a, b) => a.order - b.order)
    },
    staleTime: STALE_TIME.EXTENDED,
})

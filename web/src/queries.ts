import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { STALE_TIME } from '@/lib/constants'
import type { Category } from '@/types/categories'
import { mapVendor } from '@/lib/vendor-directory'

export interface EmbeddedOffer {
    id?: string
    titleEn: string
    descriptionEn?: string
    branchIds?: string[]
    redemptionLimit?: number
    badgeLabel?: string
    discountType: 'percentage' | 'amount' | 'buy1get1' | 'free' | 'combo' | 'fixed_price'
    discountValue?: number
    currency?: string
    savingLabel?: string
    offerValue?: number
    termsEn?: string
    redemptionInstructionsEn?: string
    startsAt?: string
    endsAt?: string
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
    username?: string
    email?: string
    phoneNumber?: string
    website?: string
    instagramUrl?: string
    status?: 'Active' | 'Inactive'
    contact?: string
    profilePicture?: string
    cardLabel?: string | null
    isSuggested?: boolean
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
    categoryIds?: string[]
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
    createdAt: string
    // Optional fields
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
    thisMonthRedemptions: number
    totalRevenue: number
    totalDiscount: number
    uniqueCustomers: number
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
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export interface VendorPortalTransaction {
    id: string; createdAt: string; type: string; totalAmount: number; discountAmount: number
    finalAmount: number; status: string; offerTitle: string; studentName: string; studentPhone: string | null
}

export const vendorQueryOptions = (vendorId: string) => queryOptions({
    queryKey: ['vendor', vendorId],
    queryFn: async () => {
        if (!vendorId) throw new Error('No vendor ID provided')
        const { data: row, error } = await supabase.from('couponly_vendors').select('*,couponly_categories!couponly_vendors_category_id_fkey(name),couponly_vendor_subcategories(subcategory_id,couponly_subcategories(name))').eq('id', vendorId).maybeSingle()
        if (error) throw error
        if (!row) return null
        return mapVendor(row as any)
    },
    staleTime: STALE_TIME.EXTENDED,
})

export const vendorTransactionsQueryOptions = (vendorId: string, from = '', to = '', offset = 0) => queryOptions({
    queryKey: ['vendor-transactions', vendorId, from, to, offset],
    queryFn: async () => {
        if (!vendorId) return []
        const { data, error } = await supabase.rpc('kouponly_vendor_transactions', {
            p_vendor_id: vendorId, p_from: from || null, p_to: to || null, p_offset: offset, p_limit: 100,
        })
        if (error) throw error
        return (data ?? []).map((row: any) => ({ id: row.transaction_id, createdAt: row.created_at, type: row.transaction_type, totalAmount: Number(row.total_amount), discountAmount: Number(row.discount_amount), finalAmount: Number(row.final_amount), status: row.status, offerTitle: row.offer_title, studentName: row.student_name, studentPhone: row.student_phone })) as VendorPortalTransaction[]
    },
    staleTime: STALE_TIME.MEDIUM,
})

export const transactionQueryOptions = (transactionId: string) => queryOptions({
    queryKey: ['transaction', transactionId],
    queryFn: async () => {
        if (!transactionId) throw new Error('No transaction ID provided')
        const { data, error } = await supabase.from('couponly_transactions').select('*').eq('id', transactionId).maybeSingle()
        if (error) throw error
        if (!data) throw new Error('Transaction not found')
        return { id: data.id, vendorName: data.vendor_name || 'Unknown Vendor', vendorId: data.vendor_id || '', type: data.transaction_type, totalAmount: Number(data.total_amount ?? data.amount ?? 0), discountAmount: Number(data.discount_amount || 0), discountType: data.discount_type || 'amount', discountValue: data.discount_value, finalAmount: Number(data.final_amount || 0), status: data.status, createdAt: data.created_at, offerId: data.offer_id, cashbackAmount: data.cashback_amount, creatorCashbackAmount: data.creator_cashback_amount, creatorCode: data.creator_code, creatorCodeOwnerId: data.creator_code_owner_id, creatorUid: data.creator_uid, redemptionCardAmount: data.redemption_card_amount, remainingAmount: data.remaining_amount } as Transaction
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

export const vendorChartDataQueryOptions = (vendorId: string, range: ChartRange, from = '', to = '') => queryOptions({
    queryKey: ['vendor-chart-data', vendorId, range, from, to],
    queryFn: async () => {
        if (!vendorId) return []

        const rangeDays = range === '7d' ? 7 : range === '30d' ? 30 : 90
        const result: Record<string, DailyChartPoint> = {}

        const start = from ? new Date(`${from}T00:00:00`) : to ? new Date(`${to}T00:00:00`) : new Date()
        const end = to ? new Date(`${to}T00:00:00`) : new Date()
        if (!from && !to) start.setDate(start.getDate() - rangeDays + 1)
        for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dateStr = localDateKey(date)
            result[dateStr] = { date: dateStr, redemptions: 0, revenue: 0 }
        }

        const { data, error } = from || to
            ? await supabase.rpc('couponly_vendor_dashboard_range', { p_vendor_id: vendorId, p_from: from || null, p_to: to || null })
            : await supabase.rpc('couponly_vendor_dashboard_chart', { p_vendor_id: vendorId, p_range_days: rangeDays })
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
        const { data, error } = await supabase.from('couponly_categories').select('*,couponly_subcategories(*)').eq('active', true)
        if (error) throw error
        const cats = (data || []).map(row => ({ id: row.id, nameEnglish: row.name, imageUrl: row.image_path || '', subcategories: (row.couponly_subcategories || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((sub: any) => ({ nameEnglish: sub.name, imageUrl: sub.image_path || '' })), order: Number(row.sort_order || 0) } as Category))
        return cats.sort((a, b) => a.order - b.order)
    },
    staleTime: STALE_TIME.EXTENDED,
})

import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import type { Vendor } from '@/queries'
import { logAdminRead } from '@/lib/admin-read-logging'

export const vendorsSearchSchema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(5).max(50).catch(10),
    search: z.string().catch(''),
    sort: z.enum(['name-asc', 'name-desc']).catch('name-asc'),
})

export type VendorsSearch = z.infer<typeof vendorsSearchSchema>
export type VendorScope = 'all' | 'in_store'
export interface VendorsPageResult { vendors: Vendor[]; totalCount: number }

type VendorRow = Record<string, any> & { id: string; payload?: Record<string, any> }
const VENDOR_SELECT = '*,couponly_categories!couponly_vendors_category_id_fkey(name),couponly_vendor_subcategories(subcategory_id,couponly_subcategories(name))'

export function mapVendor(row: VendorRow): Vendor {
    const payload = row.payload || {}
    return {
        ...payload,
        id: row.id,
        name: row.name || payload.name || 'Unnamed Vendor',
        username: payload.username || row.username,
        contact: payload.contact || payload.username || row.email || row.phone || '',
        email: row.email || payload.email,
        phoneNumber: row.phone || payload.phoneNumber,
        website: row.website || payload.website,
        profilePicture: row.logo_path || payload.profilePicture || '',
        cardLabel: row.card_label ?? payload.cardLabel ?? null,
        vendorType: row.vendor_type || 'in_store',
        status: row.status,
        locations: row.locations || payload.locations || [],
        categoryId: row.category_id,
        categoryIds: payload.categoryIds?.length ? payload.categoryIds : [row.category_id].filter(Boolean),
        mainCategory: row.couponly_categories?.name || payload.mainCategory,
        subcategory: row.couponly_vendor_subcategories?.map((link: any) => link.couponly_subcategories?.name).filter(Boolean) || payload.subcategory || [],
        isTrending: Number(row.trend) > 0,
        sortOrder: row.sort_order,
        offers: payload.offers || [],
        shortDescription: row.description || payload.shortDescription,
        place: row.place_label || payload.place,
        coverImage: row.cover_image_url || payload.coverImage,
        galleryImages: row.gallery_images || payload.galleryImages || [],
    } as Vendor
}

function matches(row: VendorRow, search: string) {
    const vendor = mapVendor(row)
    return [vendor.name, vendor.email, vendor.contact, vendor.mainCategory, ...(vendor.categoryIds || []), ...(vendor.subcategory || [])]
        .some(value => typeof value === 'string' && value.toLowerCase().includes(search))
}

export async function fetchVendorsPage(search: VendorsSearch, vendorScope: VendorScope): Promise<VendorsPageResult> {
    const term = search.search.trim().toLowerCase()
    let request = supabase.from('couponly_vendors').select(VENDOR_SELECT, { count: 'exact' })
    if (vendorScope !== 'all') request = request.eq('vendor_type', vendorScope)
    request = request.order('name', { ascending: search.sort === 'name-asc', nullsFirst: false }).order('id')
    if (term) {
        const { data, error } = await request
        if (error) throw error
        const rows = ((data || []) as VendorRow[]).filter(row => matches(row, term))
        const start = (search.page - 1) * search.pageSize
        return { vendors: rows.slice(start, start + search.pageSize).map(mapVendor), totalCount: rows.length }
    }
    const start = (search.page - 1) * search.pageSize
    const { data, error, count } = await request.range(start, start + search.pageSize - 1)
    if (error) throw error
    const vendors = ((data || []) as VendorRow[]).map(mapVendor)
    logAdminRead('vendors-page', { scope: vendorScope, page: search.page, pageSize: search.pageSize, docsFetched: vendors.length, docsDisplayed: vendors.length, totalCount: count || 0, hasSearch: false, sort: search.sort })
    return { vendors, totalCount: count || 0 }
}

export async function fetchAllVendors(): Promise<Vendor[]> {
    const { data, error } = await supabase.from('couponly_vendors').select(VENDOR_SELECT).order('name').order('id')
    if (error) throw error
    return ((data || []) as VendorRow[]).map(mapVendor)
}

export async function updateVendor(vendorId: string, updates: Record<string, unknown>): Promise<void> {
    const { data: current, error: readError } = await supabase.from('couponly_vendors').select('payload').eq('id', vendorId).single()
    if (readError) throw readError
    const payload = { ...(current.payload || {}), ...updates }
    for (const field of ['newest', 'sortOrder']) {
        const value = updates[field]
        if (value != null && (!Number.isSafeInteger(value) || Number(value) < 0)) throw new Error('Vendor ordering must use non-negative whole numbers.')
    }
    if (updates.cardLabel != null && (typeof updates.cardLabel !== 'string' || updates.cardLabel.trim().length > 32)) throw new Error('Vendor card label must be 32 characters or fewer.')
    if (typeof updates.cardLabel === 'string') payload.cardLabel = updates.cardLabel.trim() || null
    const row: Record<string, unknown> = { payload }
    const fields: Record<string, string> = {
        name: 'name', status: 'status', vendorType: 'vendor_type', categoryId: 'category_id',
        website: 'website', profilePicture: 'logo_path', shortDescription: 'description',
        place: 'place_label', imageUrl: 'image_url', coverImage: 'cover_image_url',
        savingLabel: 'saving_label', offerValue: 'offer_value', sortOrder: 'sort_order', newest: 'newest',
        phoneNumber: 'phone', galleryImages: 'gallery_images',
        businessHours: 'business_hours', locations: 'locations', rating: 'rating',
    }
    if (Array.isArray(updates.categoryIds) && updates.categoryIds.length) row.category_id = updates.categoryIds[0]
    if ('cardLabel' in updates) row.card_label = typeof updates.cardLabel === 'string' ? updates.cardLabel.trim() || null : null
    for (const [key, column] of Object.entries(fields)) if (key in updates) row[column] = updates[key] ?? null
    if ('isTrending' in updates) { row.trend = updates.isTrending ? 1 : 0; row.featured = updates.isTrending }
    const { error } = await supabase.from('couponly_vendors').update(row).eq('id', vendorId)
    if (error) throw error
}

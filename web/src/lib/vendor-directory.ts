import { z } from 'zod'
import { db } from '@/firebase/config'
import {
    collection,
    getCountFromServer,
    getDocs,
    orderBy,
    query,
    where,
    type DocumentData,
    type QueryDocumentSnapshot,
    type QueryConstraint,
} from 'firebase/firestore'
import type { Vendor } from '@/queries'
import { logAdminRead } from '@/lib/admin-read-logging'
import { getCursorPage } from '@/lib/firestore-pagination'

export const vendorsSearchSchema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(5).max(50).catch(10),
    search: z.string().catch(''),
    sort: z.enum(['name-asc', 'name-desc']).catch('name-asc'),
    xcard: z.enum(['all', 'enabled', 'disabled']).catch('all'),
})

export type VendorsSearch = z.infer<typeof vendorsSearchSchema>
export type VendorScope = 'all' | 'in_store' | 'online'

export interface VendorsPageResult {
    vendors: Vendor[]
    totalCount: number
}

function mapVendor(docSnap: QueryDocumentSnapshot<DocumentData>): Vendor {
    const data = docSnap.data()

    return {
        id: docSnap.id,
        name: data.name || 'Unnamed Vendor',
        contact: data.contact || data.email || '',
        profilePicture: data.profilePicture || '',
        vendorType: data.vendorType || 'in_store',
        xcard: !!data.xcard,
        mainCategory: data.mainCategory,
        subcategory: data.subcategory,
        isTrending: data.isTrending,
        latitude: data.latitude,
        longitude: data.longitude,
        lat: data.lat,
        lng: data.lng,
        offers: data.offers || [],
    } as Vendor
}

function vendorMatchesSearch(docSnap: QueryDocumentSnapshot<DocumentData>, searchTerm: string): boolean {
    const data = docSnap.data()
    const searchableValues = [
        data.name,
        data.nameAr,
        data.contact,
        data.email,
        data.mainCategory,
        ...(Array.isArray(data.subcategory) ? data.subcategory : []),
    ]

    return searchableValues.some((value) => (
        typeof value === 'string' && value.toLowerCase().includes(searchTerm)
    ))
}

export async function fetchVendorsPage(search: VendorsSearch, vendorScope: VendorScope): Promise<VendorsPageResult> {
    const collRef = collection(db, 'vendors')
    const trimmedSearch = search.search.trim().toLowerCase()
    const constraints: QueryConstraint[] = []

    if (vendorScope !== 'all') {
        constraints.push(where('vendorType', '==', vendorScope))
    }

    if (search.xcard === 'enabled') {
        constraints.push(where('xcard', '==', true))
    } else if (search.xcard === 'disabled') {
        constraints.push(where('xcard', '==', false))
    }

    const sortConstraint = orderBy('name', search.sort === 'name-desc' ? 'desc' : 'asc')

    if (trimmedSearch) {
        const snapshot = await getDocs(query(collRef, ...constraints, sortConstraint))
        const matchedDocs = snapshot.docs.filter((docSnap) => vendorMatchesSearch(docSnap, trimmedSearch))
        const pageDocs = matchedDocs.slice((search.page - 1) * search.pageSize, search.page * search.pageSize)

        return {
            vendors: pageDocs.map(mapVendor),
            totalCount: matchedDocs.length,
        }
    }

    const countQuery = query(collRef, ...constraints)
    const cursorKey = `vendors:${vendorScope}:${trimmedSearch}:${search.sort}:${search.xcard}`

    const [countSnapshot, pageResult] = await Promise.all([
        getCountFromServer(countQuery),
        getCursorPage(collRef, [...constraints, sortConstraint], search.page, search.pageSize, cursorKey),
    ])
    const vendors = pageResult.docs.map(mapVendor)
    const totalCount = countSnapshot.data().count

    logAdminRead('vendors-page', {
        scope: vendorScope,
        page: search.page,
        pageSize: search.pageSize,
        docsFetched: pageResult.docsFetched,
        docsDisplayed: vendors.length,
        totalCount,
        hasSearch: !!trimmedSearch,
        sort: search.sort,
        xcard: search.xcard,
    })

    return {
        vendors,
        totalCount,
    }
}

export async function fetchAllVendors(): Promise<Vendor[]> {
    const collRef = collection(db, 'vendors')
    const q = query(collRef, orderBy('name', 'asc'))
    const snapshot = await getDocs(q)

    return snapshot.docs.map(mapVendor)
}

import { db } from '@/firebase/config'
import {
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs
} from 'firebase/firestore'

export interface VendorOption {
    id: string
    name: string
    logoUrl?: string
}

const CACHE_DOC = 'meta/vendorList'

/** Read the cached vendor list (1 Firestore read). Returns sorted by name. */
export async function getVendorList(): Promise<VendorOption[]> {
    const snap = await getDoc(doc(db, CACHE_DOC))
    let vendors: VendorOption[] = snap.exists() ? snap.data().vendors || [] : []
    if (!snap.exists() || vendors.some(vendor => !('logoUrl' in vendor))) {
        const current = await getDocs(collection(db, 'vendors'))
        vendors = current.docs.map(item => {
            const vendor = item.data()
            return { id: item.id, name: vendor.name || 'Unnamed', logoUrl: vendor.profilePicture || vendor.logo || vendor.logoUrl || vendor.logo_path }
        })
    }
    return vendors.sort((a, b) => a.name.localeCompare(b.name))
}

/** Fetch all vendors from the collection and rebuild the cache document. */
export async function refreshVendorList(): Promise<void> {
    const snap = await getDocs(collection(db, 'vendors'))
    const vendors: VendorOption[] = []
    snap.forEach(d => {
        const data = d.data()
        vendors.push({ id: d.id, name: data.name || 'Unnamed', logoUrl: data.profilePicture || data.logo || data.logoUrl || data.logo_path })
    })
    vendors.sort((a, b) => a.name.localeCompare(b.name))
    await setDoc(doc(db, CACHE_DOC), { vendors, lastUpdated: new Date().toISOString() })
}

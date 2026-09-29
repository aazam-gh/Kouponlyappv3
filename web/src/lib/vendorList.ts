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
}

const CACHE_DOC = 'meta/vendorList'

/** Read the cached vendor list (1 Firestore read). Returns sorted by name. */
export async function getVendorList(): Promise<VendorOption[]> {
    const snap = await getDoc(doc(db, CACHE_DOC))
    if (!snap.exists()) return []
    const data = snap.data()
    const vendors: VendorOption[] = data.vendors || []
    return vendors.sort((a, b) => a.name.localeCompare(b.name))
}

/** Fetch all vendors from the collection and rebuild the cache document. */
export async function refreshVendorList(): Promise<void> {
    const snap = await getDocs(collection(db, 'vendors'))
    const vendors: VendorOption[] = []
    snap.forEach(d => {
        const data = d.data()
        vendors.push({ id: d.id, name: data.name || 'Unnamed' })
    })
    vendors.sort((a, b) => a.name.localeCompare(b.name))
    await setDoc(doc(db, CACHE_DOC), { vendors, lastUpdated: new Date().toISOString() })
}

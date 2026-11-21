import { supabase } from '@/lib/supabase'
import type { BannerItem } from '@/types/banners'

export async function getCmsDocument<T extends Record<string, any> = Record<string, any>>(id: string): Promise<T | null> {
    const { data, error } = await supabase.from('couponly_cms_documents').select('payload').eq('id', id).maybeSingle()
    if (error) throw error
    return (data?.payload ?? null) as T | null
}

export async function saveCmsDocument<T extends object>(id: string, payload: T, options?: { merge?: boolean }): Promise<void> {
    const value = options?.merge ? { ...(await getCmsDocument(id) || {}), ...payload } : payload
    const { error } = await supabase.from('couponly_cms_documents').upsert({ id, payload: value })
    if (error) throw error
}

export type BannerDocument = { banners?: BannerItem[]; lastUpdated?: string }

export async function saveBannerDocument(snapshot: BannerDocument | null, banners: BannerItem[]) {
    const previousRevision = snapshot?.lastUpdated ?? null
    const nextRevision = new Date(Math.max(Date.now(), (Date.parse(previousRevision ?? '') + 1) || 0)).toISOString()
    const payload = { ...snapshot, banners, lastUpdated: nextRevision }
    const documents = supabase.from('couponly_cms_documents')
    const conflict = 'Banners changed in another session. Reload the latest banners before saving again.'

    if (!snapshot) {
        const { error } = await documents.insert({ id: 'banner', payload })
        if (error?.code === '23505') throw new Error(conflict)
        if (error) throw error
    } else {
        // Keep the revision comparison in the update so concurrent editors cannot both win.
        const update = documents.update({ payload }).eq('id', 'banner')
        const { data, error } = await (previousRevision === null
            ? update.is('payload->>lastUpdated', null)
            : update.eq('payload->>lastUpdated', previousRevision)
        ).select('id').maybeSingle()
        if (error) throw error
        if (!data) throw new Error(conflict)
    }
    return payload
}

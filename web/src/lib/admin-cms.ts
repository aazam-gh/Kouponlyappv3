import { supabase } from '@/lib/supabase'

export async function getCmsDocument<T extends Record<string, any> = Record<string, any>>(id: string): Promise<T | null> {
    const { data, error } = await supabase.from('couponly_cms_documents').select('payload').eq('id', id).maybeSingle()
    if (error) throw error
    return data?.payload as T | null
}

export async function saveCmsDocument<T extends object>(id: string, payload: T, options?: { merge?: boolean }): Promise<void> {
    const value = options?.merge ? { ...(await getCmsDocument(id) || {}), ...payload } : payload
    const { error } = await supabase.from('couponly_cms_documents').upsert({ id, payload: value })
    if (error) throw error
}

import { supabase } from '@/lib/supabase'

export async function invokeAdminAction<T>(action: string, data: unknown): Promise<T> {
    const { data: result, error } = await supabase.functions.invoke('kouponly-admin-action', { body: { action, data } })
    if (error) {
        let message = error.message || 'The admin action failed.'
        try {
            const details = await (error as any).context?.json?.()
            if (details?.error) message = details.error
        } catch { /* Keep the Supabase error message. */ }
        throw new Error(message)
    }
    return result as T
}

import { supabase } from '@/lib/supabase'

export type CredentialStatus = { username: string; email: string; pendingEmail: string }

export async function vendorCredentials<T = { message: string }>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const { data: result, error } = await supabase.functions.invoke('kouponly-vendor-credentials', { body: { action, data } })
  if (error) {
    let message = error.message
    try { message = (await error.context?.json())?.error || message } catch { /* Keep the transport error. */ }
    throw new Error(message)
  }
  return result as T
}

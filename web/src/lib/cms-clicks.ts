import { supabase } from '@/lib/supabase'

export async function getCmsClickMetrics(documentId: string, itemId: string, from?: string, to?: string) {
  const { data, error } = await supabase.rpc('couponly_cms_click_metrics', {
    p_document_id: documentId,
    p_item_id: itemId,
    p_from: from || null,
    p_to: to || null,
  })
  if (error) throw error
  return (data?.[0] || { total_clicks: 0, unique_students: 0 }) as { total_clicks: number; unique_students: number }
}

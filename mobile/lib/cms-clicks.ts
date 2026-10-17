import { getSupabase } from '@/lib/supabase';

export async function recordCmsClick(documentId: 'appLaunchPoster' | 'featuredBrandShowcase' | 'banner', itemId: string) {
  if (!itemId.trim()) return;
  const { error } = await getSupabase().rpc('couponly_record_cms_click', {
    p_document_id: documentId,
    p_item_id: itemId,
  });
  if (error) throw error;
}

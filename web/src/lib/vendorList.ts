import { supabase } from '@/lib/supabase'

export interface VendorOption {
    id: string
    name: string
    logoUrl?: string
}

export async function getVendorList(): Promise<VendorOption[]> {
    const { data, error } = await supabase.from('couponly_vendors').select('id,name,logo_path,payload').order('name').order('id')
    if (error) throw error
    return (data || []).map(vendor => ({
        id: vendor.id,
        name: vendor.name || 'Unnamed',
        logoUrl: vendor.logo_path || vendor.payload?.profilePicture || '',
    }))
}

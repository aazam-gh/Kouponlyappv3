import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const accountManagerQueryOptions = (vendorId: string) => queryOptions({
    queryKey: ['vendor-account-manager', vendorId],
    enabled: Boolean(vendorId),
    queryFn: async () => {
        const { data, error } = await supabase.from('kouponly_vendor_account_managers')
            .select('full_name,email,phone').eq('vendor_id', vendorId).maybeSingle()
        if (error) throw error
        return data
    },
})

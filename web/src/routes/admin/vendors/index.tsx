import { createFileRoute } from '@tanstack/react-router'
import {
    fetchAllVendors,
    fetchVendorsPage,
    vendorsSearchSchema,
} from '@/lib/vendor-directory'

export const Route = createFileRoute('/admin/vendors/')({
    validateSearch: (search) => vendorsSearchSchema.parse(search),
    loader: async ({ context: { queryClient }, location }) => {
        const search = vendorsSearchSchema.parse(location.search)
        await queryClient.ensureQueryData({
            queryKey: ['vendors-page', 'in_store', search],
            queryFn: () => fetchVendorsPage(search, 'in_store'),
        })
    },
})

export type { VendorsPageResult, VendorsSearch } from '@/lib/vendor-directory'
export { fetchAllVendors, fetchVendorsPage, vendorsSearchSchema }

import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { vendorQueryOptions } from '@/queries'
import { VendorInfoTable } from '@/components/admin/vendors/VendorInfoTable'

export const Route = createFileRoute('/admin/online-vendors/$vendorId/settings/info')({
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
    },
    component: OnlineVendorInfoPage,
})

function OnlineVendorInfoPage() {
    const { vendorId } = Route.useParams()
    const { data: vendor, isLoading } = useQuery(vendorQueryOptions(vendorId))

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
            </div>
        )
    }

    if (!vendor) {
        return <div className="p-8 text-center text-red-500">Online vendor not found</div>
    }

    return (
        <VendorInfoTable
            vendor={vendor}
            vendorId={vendorId}
            brandingPath="/admin/online-vendors/$vendorId/settings/branding"
        />
    )
}

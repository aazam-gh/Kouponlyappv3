import { createFileRoute } from '@tanstack/react-router'
import { OffersSettings } from '@/components/admin/vendors/OffersSettings'
import { vendorQueryOptions } from '@/queries'

export const Route = createFileRoute('/admin/vendors/$vendorId/settings/offers')({
    component: OffersSettingsComponent,
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
    },
})

function OffersSettingsComponent() {
    const { vendorId } = Route.useParams()

    return (
        <div className="pt-6">
            <OffersSettings
                vendorId={vendorId}
            />
        </div>
    )
}

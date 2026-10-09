import { createFileRoute } from '@tanstack/react-router'
import { InvoiceSettings } from '@/components/admin/vendors/InvoiceSettings'
import { vendorQueryOptions } from '@/queries'

export const Route = createFileRoute('/admin/vendors/$vendorId/settings/invoices')({
    component: InvoiceSettingsComponent,
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
    },
})

function InvoiceSettingsComponent() {
    const { vendorId } = Route.useParams()

    return (
        <div className="pt-6">
            <InvoiceSettings vendorId={vendorId} />
        </div>
    )
}

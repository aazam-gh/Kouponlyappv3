import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/vendors/$vendorId/settings/')({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: '/admin/vendors/$vendorId/settings/branding',
            params: { vendorId: params.vendorId },
        })
    },
})

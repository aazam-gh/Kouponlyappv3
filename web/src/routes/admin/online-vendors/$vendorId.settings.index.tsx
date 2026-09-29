import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/online-vendors/$vendorId/settings/')({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: '/admin/online-vendors/$vendorId/settings/info',
            params: { vendorId: params.vendorId },
        })
    },
    component: () => null,
})

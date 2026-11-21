import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
    beforeLoad: ({ context, location }) => {
        const { auth } = context

        if (!auth.isAuthenticated) {
            throw redirect({
                to: '/login',
                search: { redirect: location.href },
            })
        }

        if (!auth.isAdmin) {
            throw redirect({
                to: '/unauthorized',
            })
        }
    },
})

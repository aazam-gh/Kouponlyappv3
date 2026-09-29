import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
    beforeLoad: ({ context, location }) => {
        const { auth } = context

        // Wait until Firebase auth has resolved
        if (auth.isInitialLoading) {
            return
        }

        // Not logged in at all
        if (!auth.isAuthenticated) {
            throw redirect({
                to: '/login',
                search: { redirect: location.href },
            })
        }

        // Logged in but NOT admin
        if (!auth.isAdmin) {
            throw redirect({
                to: '/unauthorized',
            })
        }
    },
})

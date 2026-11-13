import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
    beforeLoad: ({ context, location }) => {
        const { auth } = context

        // Keep the requested admin URL while the login page waits for session recovery.
        if (auth.isInitialLoading) {
            throw redirect({
                to: '/login',
                search: { redirect: location.href },
            })
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

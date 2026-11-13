import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
    beforeLoad: ({ context, location }) => {
        const { auth } = context

        // Keep the requested admin route mounted while Supabase restores the session.
        if (auth.isInitialLoading) return

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

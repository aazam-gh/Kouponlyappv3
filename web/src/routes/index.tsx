import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/login' })
    }
    if (context.auth.isAdmin) {
      throw redirect({ to: '/admin/dashboard' })
    }
    if (context.auth.isHoldingAccount) {
      throw redirect({ to: '/holding/dashboard' })
    }
    throw redirect({ to: '/dashboard' })
  },
})

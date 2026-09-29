import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/(auth)/login')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(''),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      if (search.redirect) {
        throw redirect({ to: search.redirect })
      }
      if (context.auth.isAdmin) {
        throw redirect({ to: '/admin/dashboard' })
      }
      if (context.auth.isHoldingAccount) {
        throw redirect({ to: '/holding/dashboard' })
      }
      throw redirect({ to: '/dashboard' })
    }
  },
})

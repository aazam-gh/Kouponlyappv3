import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/holding/')({
  beforeLoad: () => {
    throw redirect({ to: '/holding/dashboard' })
  },
})

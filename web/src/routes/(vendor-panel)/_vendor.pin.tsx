import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(vendor-panel)/_vendor/pin')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})

import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/(vendor-panel)/_vendor/transaction-history')({
  component: () => <Outlet />,
})

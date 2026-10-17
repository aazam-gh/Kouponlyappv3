import { createLazyFileRoute } from '@tanstack/react-router'
import { TransactionActivity } from '@/components/admin/TransactionActivity'
export const Route = createLazyFileRoute('/admin/transactions/')({ component: () => <TransactionActivity /> })

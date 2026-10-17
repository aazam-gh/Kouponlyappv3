import { createFileRoute } from '@tanstack/react-router'
import { TransactionActivity } from '@/components/admin/TransactionActivity'
export const Route = createFileRoute('/admin/dashboard')({ component: () => <TransactionActivity overview /> })

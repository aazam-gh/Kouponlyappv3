import { createLazyFileRoute } from '@tanstack/react-router'
import { CouponActivity } from '@/components/admin/CouponActivity'
export const Route = createLazyFileRoute('/admin/transactions/')({ component: () => <CouponActivity /> })

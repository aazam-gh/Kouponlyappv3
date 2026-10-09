import { createFileRoute } from '@tanstack/react-router'
import { CouponActivity } from '@/components/admin/CouponActivity'
export const Route = createFileRoute('/admin/dashboard')({ component: () => <CouponActivity overview /> })

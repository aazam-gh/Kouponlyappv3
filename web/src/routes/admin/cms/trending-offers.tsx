import { createFileRoute } from '@tanstack/react-router'
import { HomeOfferPriority } from '@/components/admin/HomeOfferPriority'

export const Route = createFileRoute('/admin/cms/trending-offers')({
  component: () => <HomeOfferPriority section="trending-vendors" />,
})

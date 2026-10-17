import { createFileRoute } from '@tanstack/react-router'
import { HomeOfferPriority } from '@/components/admin/HomeOfferPriority'

export const Route = createFileRoute('/admin/cms/new-deals')({
  component: () => <HomeOfferPriority section="new-deals" />,
})

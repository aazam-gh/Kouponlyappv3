import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { vendorQueryOptions } from '@/queries'
import { useAuth } from '@/auth'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/(vendor-panel)/_vendor/campaign')({
  component: VendorCampaign,
})

function VendorCampaign() {
  const { user } = useAuth()
  const vendorId = user?.uid || ''

  const { data: vendor, isLoading } = useQuery(vendorQueryOptions(vendorId))
  const offers = vendor?.offers || []

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Offers</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {offers.map((offer, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 space-y-2">
              <h3 className="font-semibold text-lg">{offer.titleEn}</h3>
              <p className="text-sm text-gray-500 line-clamp-2">{offer.descriptionEn}</p>
              <div className="pt-4 flex justify-between items-center text-sm">
                <span className="font-medium text-blue-600">
                  {offer.discountType === 'buy1get1' ? 'Buy 1 Get 1' : offer.discountType === 'percentage' ? `${offer.discountValue}% OFF` : `$${offer.discountValue} OFF`}
                </span>
              </div>
            </div>
          </div>
        ))}
        {offers.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            No campaigns found. Create your first offer to get started.
          </div>
        )}
      </div>
    </div>
  )
}

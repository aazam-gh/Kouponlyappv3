import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { vendorQueryOptions } from '@/queries'
import { useAuth } from '@/auth'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/(vendor-panel)/_vendor/campaign')({
  component: VendorCampaign,
})

function VendorCampaign() {
  const { user } = useAuth()
  const vendorId = user?.uid || ''
  const queryClient = useQueryClient()
  const [badgeLabels, setBadgeLabels] = useState<Record<string, string>>({})

  const { data: vendor, isLoading } = useQuery(vendorQueryOptions(vendorId))
  const offers = vendor?.offers || []
  const saveBadgeLabel = useMutation({
    mutationFn: async ({ offerId, badgeLabel }: { offerId: string; badgeLabel: string }) => {
      const { error } = await supabase.rpc('couponly_vendor_set_offer_badge_label', { p_offer_id: offerId, p_badge_label: badgeLabel.trim() || null })
      if (error) throw error
    },
    onSuccess: (_result, { offerId, badgeLabel }) => {
      setBadgeLabels(current => ({ ...current, [offerId]: badgeLabel.trim() }))
      void queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
      toast.success('Badge label saved')
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Could not save badge label'),
  })

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
              <form className="mt-4 space-y-2 border-t pt-4" onSubmit={event => {
                event.preventDefault()
                if (offer.id) saveBadgeLabel.mutate({ offerId: offer.id, badgeLabel: badgeLabels[offer.id] ?? offer.badgeLabel ?? '' })
              }}>
                <label htmlFor={`badge-label-${offer.id || index}`} className="text-sm font-medium">Mobile badge text</label>
                <Input id={`badge-label-${offer.id || index}`} maxLength={60} value={offer.id ? badgeLabels[offer.id] ?? offer.badgeLabel ?? '' : offer.badgeLabel ?? ''} onChange={event => offer.id && setBadgeLabels(current => ({ ...current, [offer.id!]: event.target.value }))} placeholder="e.g. 50% OFF TOTAL BILL" />
                <p className="text-xs text-muted-foreground">Shown on the green offer badge. Leave blank to generate it from the discount.</p>
                <Button type="submit" size="sm" disabled={!offer.id || saveBadgeLabel.isPending}>Save badge text</Button>
              </form>
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

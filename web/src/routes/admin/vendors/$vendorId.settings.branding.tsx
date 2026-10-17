import { createFileRoute } from '@tanstack/react-router'
import { BrandingSettings, type VendorBrandingForm } from '@/components/admin/vendors/BrandingSettings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { deleteGalleryImages, getRemovedGalleryImages } from '@/lib/vendor-gallery'
import { vendorQueryOptions, type Vendor } from '@/queries'
import { updateVendor } from '@/lib/vendor-directory'

export const Route = createFileRoute('/admin/vendors/$vendorId/settings/branding')({
    component: BrandingSettingsComponent,
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
    },
})

function BrandingSettingsComponent() {
    const { vendorId } = Route.useParams()
    const queryClient = useQueryClient()
    const [formData, setFormData] = useState<VendorBrandingForm | null>(null)
    const [uploadingImages, setUploadingImages] = useState(false)


    const { data: vendor, isLoading } = useQuery(vendorQueryOptions(vendorId))
    useEffect(() => {
        if (vendor) {
            setFormData({ ...vendor })
        }
    }, [vendor])

    const updateMutation = useMutation({
        mutationFn: async (vendorData: VendorBrandingForm) => {

            const dataToUpdate: Partial<VendorBrandingForm> = { ...vendorData }
            delete dataToUpdate.id
            dataToUpdate.status = 'Active'

            await updateVendor(vendorId, dataToUpdate)
        },
        onMutate: async (vendorData) => {
            await queryClient.cancelQueries({ queryKey: ['vendor', vendorId] })
            const previousVendor = queryClient.getQueryData(['vendor', vendorId])
            const optimisticVendor = { ...vendorData }
            queryClient.setQueryData(['vendor', vendorId], (old: Vendor | undefined) => {
                if (!old) return old
                return { ...old, ...optimisticVendor }
            })
            return { previousVendor }
        },
        onSuccess: (_result, vendorData) => {
            void deleteGalleryImages(getRemovedGalleryImages(vendor?.galleryImages, vendorData.galleryImages))
            toast.success('Settings updated successfully!', {
                description: 'The vendor information has been synchronized with the database.',
                duration: 3000,
            })
        },
        onError: (error, _variables, context) => {
            if (context?.previousVendor) {
                queryClient.setQueryData(['vendor', vendorId], context.previousVendor)
            }
            toast.error('Failed to update settings', {
                description: error instanceof Error ? error.message : 'An unknown error occurred',
            })
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
        },
    })

    const handleSave = () => {
        if (formData) {
            updateMutation.mutate(formData)
        }
    }

    const handleReset = () => {
        if (!formData || !vendor || uploadingImages) return
        void deleteGalleryImages(getRemovedGalleryImages(formData.galleryImages, vendor.galleryImages))
        setFormData({ ...vendor })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-green border-t-transparent" />
            </div>
        )
    }

    if (!vendor) return <div className="p-8 text-center text-red-500">Vendor not found</div>

    return (
        <div className="space-y-6 pt-6">
            {formData && (
                <BrandingSettings
                    formData={formData}
                    setFormData={setFormData}
                    vendorId={vendorId}
                    savedGalleryImages={vendor.galleryImages}
                    onUploadingChange={setUploadingImages}
                />
            )}

            <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-3 border-t bg-background/95 py-4 backdrop-blur-sm">
                <Button variant="outline" onClick={handleReset} disabled={uploadingImages}>Reset Changes</Button>
                <Button
                    className="bg-brand-green hover:bg-brand-green/90 text-white gap-2"
                    onClick={handleSave}
                    disabled={updateMutation.isPending || uploadingImages}
                >
                    {updateMutation.isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Save Settings
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}

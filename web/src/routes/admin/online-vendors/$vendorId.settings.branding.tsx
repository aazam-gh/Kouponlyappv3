import { createFileRoute, redirect } from '@tanstack/react-router'
import { BrandingSettings, type VendorBrandingForm } from '@/components/admin/vendors/BrandingSettings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db, functions } from '@/firebase/config'
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { refreshVendorList } from '@/lib/vendorList'
import { deleteGalleryImages, getRemovedGalleryImages } from '@/lib/vendor-gallery'
import { vendorPinQueryOptions, vendorQueryOptions, type OnlineRedemptionConfig, type Vendor } from '@/queries'

export const Route = createFileRoute('/admin/online-vendors/$vendorId/settings/branding')({
    component: OnlineVendorBrandingSettingsComponent,
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        const vendor = await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
        if (vendor.vendorType !== 'online') {
            throw redirect({ to: '/admin/vendors/$vendorId/settings/branding', params: { vendorId } })
        }
    },
})

function OnlineVendorBrandingSettingsComponent() {
    const { vendorId } = Route.useParams()
    const queryClient = useQueryClient()
    const [formData, setFormData] = useState<VendorBrandingForm | null>(null)
    const [uploadingImages, setUploadingImages] = useState(false)
    const [onlineConfig, setOnlineConfig] = useState<OnlineRedemptionConfig>({
        discountCode: '',
        purchaseUrl: '',
        dailyLimitPerUser: 1,
        enabled: false,
    })

    const { data: vendor, isLoading } = useQuery(vendorQueryOptions(vendorId))
    const { data: vendorPin = '', isLoading: isPinLoading } = useQuery(vendorPinQueryOptions(vendorId))

    useEffect(() => {
        if (vendor) {
            setFormData({ ...vendor, redemptionPin: vendorPin })
        }
    }, [vendor, vendorPin])

    useEffect(() => {
        let active = true

        const loadOnlineConfig = async () => {
            const snapshot = await getDoc(doc(db, 'vendorOnlineRedemptionConfigs', vendorId))
            if (!active) return

            if (!snapshot.exists()) {
                setOnlineConfig({
                    discountCode: '',
                    purchaseUrl: '',
                    dailyLimitPerUser: 1,
                    enabled: false,
                })
                return
            }

            const data = snapshot.data()
            setOnlineConfig({
                discountCode: data.discountCode || '',
                purchaseUrl: data.purchaseUrl || '',
                dailyLimitPerUser: Number(data.dailyLimitPerUser || 1),
                enabled: data.enabled === true,
            })
        }

        void loadOnlineConfig()

        return () => {
            active = false
        }
    }, [vendorId])

    const updateMutation = useMutation({
        mutationFn: async ({ vendorData, configData }: { vendorData: VendorBrandingForm, configData: OnlineRedemptionConfig }) => {
            if (vendorData.vendorType === 'online') {
                const discountCode = configData.discountCode.trim()
                const purchaseUrl = configData.purchaseUrl.trim()
                const dailyLimitPerUser = Number(configData.dailyLimitPerUser)

                if (!discountCode || !purchaseUrl || !Number.isFinite(dailyLimitPerUser) || dailyLimitPerUser < 1) {
                    throw new Error('Online vendors require a discount code, purchase URL, and daily limit of at least 1.')
                }

                try {
                    new URL(purchaseUrl)
                } catch {
                    throw new Error('Purchase URL must be a valid URL.')
                }
            }

            const dataToUpdate: Partial<VendorBrandingForm> = { ...vendorData }
            delete dataToUpdate.id
            delete dataToUpdate.redemptionPin

            const pin = vendorData.redemptionPin?.trim() || ''
            if (pin && !/^\d{4}$/.test(pin)) {
                throw new Error('Vendor security PIN must be exactly 4 digits.')
            }
            if (pin && pin !== vendorPin) {
                await httpsCallable(functions, 'setVendorRedemptionPin')({ vendorId, pin })
            }

            const vendorRef = doc(db, 'vendors', vendorId)
            await updateDoc(vendorRef, dataToUpdate)

            await setDoc(doc(db, 'vendorOnlineRedemptionConfigs', vendorId), {
                discountCode: configData.discountCode.trim(),
                purchaseUrl: configData.purchaseUrl.trim(),
                dailyLimitPerUser: Math.max(1, Math.floor(Number(configData.dailyLimitPerUser) || 1)),
                enabled: configData.enabled === true,
                updatedAt: serverTimestamp(),
            }, { merge: true })

            return { savedPin: pin || vendorPin }
        },
        onMutate: async ({ vendorData }) => {
            await queryClient.cancelQueries({ queryKey: ['vendor', vendorId] })
            const previousVendor = queryClient.getQueryData(['vendor', vendorId])
            const optimisticVendor = { ...vendorData }
            delete optimisticVendor.redemptionPin
            queryClient.setQueryData(['vendor', vendorId], (old: Vendor | undefined) => {
                if (!old) return old
                return { ...old, ...optimisticVendor }
            })
            return { previousVendor }
        },
        onSuccess: ({ savedPin }, { vendorData }) => {
            queryClient.setQueryData(['vendor-pin', vendorId], savedPin)
            setFormData((current) => current ? { ...current, redemptionPin: savedPin } : current)
            void deleteGalleryImages(getRemovedGalleryImages(vendor?.galleryImages, vendorData.galleryImages))
            void refreshVendorList()
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
            queryClient.invalidateQueries({ queryKey: ['vendor-pin', vendorId] })
        },
    })

    const handleSave = () => {
        if (formData) {
            updateMutation.mutate({ vendorData: formData, configData: onlineConfig })
        }
    }

    const handleReset = () => {
        if (!formData || !vendor || uploadingImages) return
        void deleteGalleryImages(getRemovedGalleryImages(formData.galleryImages, vendor.galleryImages))
        setFormData({ ...vendor, redemptionPin: vendorPin })
    }

    if (isLoading || isPinLoading) {
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
                    onlineConfig={onlineConfig}
                    setOnlineConfig={setOnlineConfig}
                    savedGalleryImages={vendor.galleryImages}
                    onUploadingChange={setUploadingImages}
                    showOnlineBrandOfferFields
                />
            )}

            <div className="flex justify-end gap-4 pt-4 border-t">
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

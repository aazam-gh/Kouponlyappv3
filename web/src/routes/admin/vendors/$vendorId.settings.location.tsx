import { createFileRoute } from '@tanstack/react-router'
import { LocationSettings } from '@/components/admin/vendors/LocationSettings'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '@/firebase/config'
import { doc, updateDoc } from 'firebase/firestore'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, Save } from 'lucide-react'
import { refreshVendorList } from '@/lib/vendorList'
import { vendorQueryOptions, type Vendor } from '@/queries'

function stripUndefined<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => stripUndefined(item)).filter((item) => item !== undefined) as T
    }
    if (value && typeof value === 'object') {
        return Object.entries(value as Record<string, unknown>).reduce((acc, [key, entry]) => {
            if (entry !== undefined) {
                acc[key] = stripUndefined(entry)
            }
            return acc
        }, {} as Record<string, unknown>) as T
    }
    return value
}

export const Route = createFileRoute('/admin/vendors/$vendorId/settings/location')({
    component: LocationSettingsComponent,
    loader: async ({ context: { queryClient }, params: { vendorId } }) => {
        await queryClient.ensureQueryData(vendorQueryOptions(vendorId))
    },
})

function LocationSettingsComponent() {
    const { vendorId } = Route.useParams()
    const queryClient = useQueryClient()
    const [formData, setFormData] = useState<Vendor | null>(null)

    const { data: vendor, isLoading } = useQuery(vendorQueryOptions(vendorId))

    useEffect(() => {
        if (vendor) {
            setFormData(vendor)
        }
    }, [vendor])

    const updateMutation = useMutation({
        mutationFn: async (updatedData: Partial<Vendor>) => {
            const { id, ...dataToUpdate } = updatedData
            if (typeof dataToUpdate.latitude === 'number') dataToUpdate.lat = dataToUpdate.latitude
            if (typeof dataToUpdate.longitude === 'number') dataToUpdate.lng = dataToUpdate.longitude
            const vendorRef = doc(db, 'vendors', vendorId)
            await updateDoc(vendorRef, stripUndefined(dataToUpdate))
        },
        onMutate: async (updatedData) => {
            await queryClient.cancelQueries({ queryKey: ['vendor', vendorId] })
            const previousVendor = queryClient.getQueryData(['vendor', vendorId])
            queryClient.setQueryData(['vendor', vendorId], (old: Vendor | undefined) => {
                if (!old) return old
                return { ...old, ...updatedData }
            })
            return { previousVendor }
        },
        onSuccess: async () => {
            await refreshVendorList()
            await queryClient.invalidateQueries({ queryKey: ['vendor', vendorId] })
            toast.success('Location updated successfully!', {
                description: 'The vendor location has been synchronized with the database.',
                duration: 3000,
            })
        },
        onError: (error, _variables, context) => {
            if (context?.previousVendor) {
                queryClient.setQueryData(['vendor', vendorId], context.previousVendor)
            }
            toast.error('Failed to update location', {
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
                <LocationSettings formData={formData} setFormData={setFormData} vendorId={vendorId} />
            )}

            <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" onClick={() => setFormData(vendor)}>Reset Changes</Button>
                <Button
                    className="bg-brand-green hover:bg-brand-green/90 text-white gap-2"
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                >
                    {updateMutation.isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="h-4 w-4" />
                            Save Location
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
